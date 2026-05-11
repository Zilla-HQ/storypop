import sharp from "sharp";
import { env } from "@/lib/env";

/**
 * Build a 9:16 social-card from a homeowner-side preview's before/after pair.
 * Layout: top = "before" satellite tile, bottom = "after" rendered mockup,
 * with a brand strip + city caption. 1080×1920 (Pinterest/TikTok native).
 */
export async function buildSocialCard(args: {
  beforeUrl: string;
  afterUrl: string;
  caption: string;
}): Promise<Buffer> {
  const W = 1080;
  const H = 1920;
  const halfH = Math.floor((H - 200) / 2); // 200px reserved for branding strip + caption

  const [before, after] = await Promise.all([
    fetchAndResize(args.beforeUrl, W, halfH),
    fetchAndResize(args.afterUrl, W, halfH),
  ]);

  const brandStripSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="200">
    <rect width="${W}" height="200" fill="#0f172a"/>
    <text x="${W / 2}" y="58" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#10b981">REALSCALE</text>
    <text x="${W / 2}" y="115" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="white">${escapeXml(args.caption)}</text>
    <text x="${W / 2}" y="165" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="500" fill="#94a3b8">Free at realscale.app</text>
  </svg>`;

  const beforeLabelSvg = svgLabel("BEFORE", 24, 24);
  const afterLabelSvg = svgLabel("AFTER", 24, halfH + 24);

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 15, g: 23, b: 42 },
    },
  })
    .composite([
      { input: before, top: 0, left: 0 },
      { input: after, top: halfH, left: 0 },
      { input: Buffer.from(beforeLabelSvg), top: 0, left: 0 },
      { input: Buffer.from(afterLabelSvg), top: 0, left: 0 },
      { input: Buffer.from(brandStripSvg), top: H - 200, left: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function fetchAndResize(url: string, w: number, h: number): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf).resize(w, h, { fit: "cover", position: "center" }).jpeg({ quality: 90 }).toBuffer();
}

function svgLabel(text: string, x: number, y: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <rect x="${x}" y="${y}" width="160" height="48" rx="6" fill="black" fill-opacity="0.7"/>
    <text x="${x + 16}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="white">${text}</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Pinterest ──────────────────────────────────────────────────────────
// API: https://developers.pinterest.com/docs/api/v5/
// Auth: long-lived OAuth access token in PINTEREST_ACCESS_TOKEN.
// Board id from PINTEREST_BOARD_ID. Image must be a public URL.

export async function postToPinterest(args: {
  imageUrl: string;
  title: string;
  description: string;
  destinationLink: string;
  altText: string;
}): Promise<{ pinId: string }> {
  const token = env("PINTEREST_ACCESS_TOKEN");
  const boardId = env("PINTEREST_BOARD_ID");
  if (!token || !boardId) {
    throw new Error("Pinterest not configured: PINTEREST_ACCESS_TOKEN or PINTEREST_BOARD_ID missing");
  }

  const body = {
    board_id: boardId,
    title: args.title.slice(0, 100),
    description: args.description.slice(0, 500),
    alt_text: args.altText.slice(0, 500),
    link: args.destinationLink,
    media_source: {
      source_type: "image_url",
      url: args.imageUrl,
    },
  };

  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinterest pin failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error(`Pinterest response missing id: ${JSON.stringify(json).slice(0, 200)}`);
  return { pinId: json.id };
}

// ─── TikTok ─────────────────────────────────────────────────────────────
// TikTok Posts API requires app review + user OAuth. Full direct-publish
// is gated. Until that's approved, we publish via the "Inbox" mode which
// drops the asset into the user's TikTok drafts for one-tap publish from
// the app. Requires TIKTOK_ACCESS_TOKEN scope: video.publish + video.upload.
//
// If neither token is set, we no-op gracefully so the cron doesn't fail.
//
// NOTE: TikTok takes VIDEO, not images. For now the Pinterest path runs
// daily; the TikTok path is wired up to receive a video URL when we add a
// short ffmpeg pan-and-zoom step over the social card. Stubbed.

export async function postToTikTokInbox(args: {
  videoUrl: string;
  title: string;
}): Promise<{ publishId: string } | { skipped: true; reason: string }> {
  const token = env("TIKTOK_ACCESS_TOKEN");
  if (!token) return { skipped: true, reason: "TIKTOK_ACCESS_TOKEN not set" };

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_info: {
        source: "PULL_FROM_URL",
        video_url: args.videoUrl,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TikTok publish failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { publish_id?: string } };
  const publishId = json.data?.publish_id;
  if (!publishId) throw new Error("TikTok response missing publish_id");
  return { publishId };
}
