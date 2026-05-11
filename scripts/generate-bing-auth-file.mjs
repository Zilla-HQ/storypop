#!/usr/bin/env node
/**
 * Write public/BingSiteAuth.xml with the verification token from
 * Bing Webmaster Tools. See SEO.md §2.2 for how the operator gets the
 * token.
 *
 *   BING_TOKEN=40759474A5E4B7C69E2658CAE1EBFD32 \
 *     node scripts/generate-bing-auth-file.mjs
 *
 * Or, equivalently, set NEXT_PUBLIC_BING_VERIFICATION_TOKEN in your
 * shell or .env.local before running.
 *
 * The output file is committed to the repo. Bing serves it as a static
 * asset at https://<merchant>/BingSiteAuth.xml.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

// Read .env.local if running locally so NEXT_PUBLIC_BING_VERIFICATION_TOKEN
// is picked up without needing to set it in the shell.
try {
  const env = await fs.readFile(path.resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env.local — fall through */
}

const token =
  process.env.BING_TOKEN ?? process.env.NEXT_PUBLIC_BING_VERIFICATION_TOKEN;

if (!token) {
  console.error(
    "ERR: token not provided. Set NEXT_PUBLIC_BING_VERIFICATION_TOKEN or pass BING_TOKEN=<value>.",
  );
  process.exit(1);
}

if (!/^[A-Z0-9]{6,64}$/i.test(token)) {
  console.error("ERR: token shape looks wrong. Expected 6–64 alphanumeric chars.");
  process.exit(1);
}

const xml = `<?xml version="1.0"?>\n<users>\n\t<user>${token}</user>\n</users>\n`;
const out = path.join(PUBLIC_DIR, "BingSiteAuth.xml");

await fs.mkdir(PUBLIC_DIR, { recursive: true });
await fs.writeFile(out, xml, "utf8");

console.log(`✓ Wrote ${out}`);
console.log("");
console.log("Next steps:");
console.log("  git add public/BingSiteAuth.xml && git commit -m 'Add Bing verification'");
console.log("  → Then click Verify in Bing Webmaster Tools after deploy.");
