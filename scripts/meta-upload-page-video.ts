/**
 * Upload a video to your Facebook Page as an unpublished post — that post can
 * then be referenced by ad creatives for video ads. Uses the chunked upload
 * protocol (start → transfer → finish) which is the only reliable path for
 * System User tokens; the simpler /act_<id>/advideos endpoint hangs at
 * "uploading" status forever for system-user uploads.
 *
 *   npx tsx scripts/meta-upload-page-video.ts /path/to/video.mp4
 *
 * Requires META_ADS_ACCESS_TOKEN with pages_manage_posts + pages_read_engagement
 * scopes, and META_PAGE_ID set to your Facebook Page ID.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const PAGE_ID = process.env.META_PAGE_ID!;
const V = process.env.META_API_VERSION || "v19.0";

if (!TOKEN || !PAGE_ID) {
  console.error("Missing META_ADS_ACCESS_TOKEN or META_PAGE_ID");
  process.exit(1);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: npx tsx scripts/meta-upload-page-video.ts <path-to-video>");
    process.exit(1);
  }

  // System User can't upload to /<page>/videos with its own token — needs the
  // page-scoped one. Fetch via the System User token (which can read the page
  // since the user is assigned to it).
  const pageRes = await fetch(`https://graph.facebook.com/${V}/${PAGE_ID}?fields=access_token&access_token=${TOKEN}`);
  const pageJson: any = await pageRes.json();
  if (pageJson.error || !pageJson.access_token) {
    throw new Error(`page token fetch failed: ${pageJson.error?.message || "no token returned"}`);
  }
  const PAGE_TOKEN = pageJson.access_token;

  const fileSize = fs.statSync(filePath).size;
  console.log(`File: ${filePath}  size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`);

  // Phase 1: start
  const startRes = await fetch(`https://graph-video.facebook.com/${V}/${PAGE_ID}/videos`, {
    method: "POST",
    body: new URLSearchParams({
      upload_phase: "start",
      file_size: String(fileSize),
      access_token: PAGE_TOKEN,
    }),
  });
  const startJson: any = await startRes.json();
  if (startJson.error) throw new Error(`start: ${startJson.error.message}`);
  const sessionId = startJson.upload_session_id;
  const videoId = startJson.video_id;
  let startOffset = parseInt(startJson.start_offset);
  let endOffset = parseInt(startJson.end_offset);
  console.log(`→ start  video_id=${videoId}  session=${sessionId}`);

  // Phase 2: transfer chunks
  const fd = fs.openSync(filePath, "r");
  while (startOffset < fileSize) {
    const chunkSize = endOffset - startOffset;
    const buf = Buffer.alloc(chunkSize);
    fs.readSync(fd, buf, 0, chunkSize, startOffset);
    const form = new FormData();
    form.append("upload_phase", "transfer");
    form.append("upload_session_id", sessionId);
    form.append("start_offset", String(startOffset));
    form.append("video_file_chunk", new Blob([buf]), path.basename(filePath));
    form.append("access_token", PAGE_TOKEN);

    const tRes = await fetch(`https://graph-video.facebook.com/${V}/${PAGE_ID}/videos`, {
      method: "POST",
      body: form,
    });
    const tJson: any = await tRes.json();
    if (tJson.error) throw new Error(`transfer: ${tJson.error.message}`);
    console.log(`→ transfer  bytes ${startOffset}-${endOffset} ok`);
    startOffset = parseInt(tJson.start_offset);
    endOffset = parseInt(tJson.end_offset);
  }
  fs.closeSync(fd);

  // Phase 3: finish — published:false makes this a "dark post" usable in ads
  // but invisible on the public page timeline.
  const finishRes = await fetch(`https://graph-video.facebook.com/${V}/${PAGE_ID}/videos`, {
    method: "POST",
    body: new URLSearchParams({
      upload_phase: "finish",
      upload_session_id: sessionId,
      published: "false",
      access_token: PAGE_TOKEN,
    }),
  });
  const finishJson: any = await finishRes.json();
  if (finishJson.error) throw new Error(`finish: ${finishJson.error.message}`);
  console.log(`→ finish  ${JSON.stringify(finishJson)}\n`);

  console.log("→ Waiting for processing...");
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const sRes = await fetch(`https://graph.facebook.com/${V}/${videoId}?fields=status,length&access_token=${PAGE_TOKEN}`);
    const sJson: any = await sRes.json();
    const vs = sJson.status?.video_status;
    process.stdout.write(`\r   status: ${vs}  length: ${sJson.length || 0}s     `);
    if (vs === "ready") { console.log("\n\nVIDEO READY"); break; }
    if (vs === "error") throw new Error("processing failed");
  }

  console.log(`\nVIDEO_ID=${videoId}`);
  console.log(`Now plug this into scripts/meta-create-ads.ts (set the VIDEO_ID const) and run that to attach to ad sets.`);
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
