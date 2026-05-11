#!/usr/bin/env node
/**
 * Submit every URL in the live sitemap to IndexNow (Bing, Yandex,
 * Naver). Run after every deploy with new pages.
 *
 *   node scripts/indexnow-ping.mjs
 *
 * Reads NEXT_PUBLIC_APP_URL + NEXT_PUBLIC_INDEXNOW_KEY from env. If
 * you haven't run scripts/generate-indexnow-key.mjs yet, do that first.
 *
 * IndexNow accepts up to 10,000 URLs per request. We chunk into 1,000
 * to stay well under the limit and to keep request bodies modest.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Read .env.local if running outside Vercel (local invocations).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const env = await readFile(path.resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env.local — assume env is set externally (CI / cron / shell).
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
const KEY = process.env.NEXT_PUBLIC_INDEXNOW_KEY;

if (!APP_URL) {
  console.error("ERR: NEXT_PUBLIC_APP_URL not set.");
  process.exit(1);
}
if (!KEY) {
  console.error("ERR: NEXT_PUBLIC_INDEXNOW_KEY not set. Run scripts/generate-indexnow-key.mjs first.");
  process.exit(1);
}

const HOST = new URL(APP_URL).hostname;
const KEY_LOCATION = `${APP_URL.replace(/\/$/, "")}/${KEY}.txt`;
const SITEMAP = `${APP_URL.replace(/\/$/, "")}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const CHUNK = 1000;

async function main() {
  console.error(`Fetching sitemap: ${SITEMAP}`);
  const res = await fetch(SITEMAP);
  if (!res.ok) throw new Error(`sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.error(`Found ${urls.length} URLs in sitemap.`);

  if (urls.length === 0) {
    console.error("Sitemap is empty — nothing to submit. Check NEXT_PUBLIC_APP_URL and app/sitemap.ts.");
    return;
  }

  let total = 0;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    const body = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: slice,
    };
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await r.text().catch(() => "");
    console.error(
      `  [${i / CHUNK + 1}] sent ${slice.length} URLs → HTTP ${r.status} ${text ? "·" : ""} ${text.slice(0, 200)}`,
    );
    if (r.status === 403 && text.includes("SiteVerificationNotCompleted")) {
      console.error(
        "  Bing hasn't verified the key file yet. Wait ~5 min after deploy and retry.",
      );
    }
    total += slice.length;
  }
  console.error(`Submitted ${total} URLs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
