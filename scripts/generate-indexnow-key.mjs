#!/usr/bin/env node
/**
 * Generate a unique IndexNow key for this merchant + write the
 * verification file to public/<key>.txt.
 *
 *   node scripts/generate-indexnow-key.mjs
 *
 * Run ONCE per merchant fork. After this script, set
 * NEXT_PUBLIC_INDEXNOW_KEY in Vercel env to the printed value.
 *
 * Why one key per merchant: IndexNow keys are scoped to a host. A
 * key file at https://xyz.zilla.so/<key>.txt cannot be reused at
 * https://abc.zilla.so/<key>.txt — Bing will reject the second host
 * as unverified. Each merchant gets its own key, owned by that
 * merchant.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

async function main() {
  const key = crypto.randomBytes(16).toString("hex");
  const filePath = path.join(PUBLIC_DIR, `${key}.txt`);

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(filePath, key, "utf8");

  console.log(`✓ Wrote ${filePath}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Set NEXT_PUBLIC_INDEXNOW_KEY=${key} in Vercel env`);
  console.log("  2. Commit + push the key file:");
  console.log(`       git add public/${key}.txt && git commit -m "Add IndexNow key"`);
  console.log("  3. After deploy, run:");
  console.log("       node scripts/indexnow-ping.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
