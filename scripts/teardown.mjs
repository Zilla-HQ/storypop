#!/usr/bin/env node
/**
 * Bulk-audit a list of domains and emit a markdown teardown ready to
 * paste into Twitter, LinkedIn, or a blog post.
 *
 * Usage:
 *   node scripts/teardown.mjs domains.txt > teardown.md
 *   cat domains.txt | node scripts/teardown.mjs > teardown.md
 *   node scripts/teardown.mjs --industry plumbers --city austin > teardown.md
 *
 * domains.txt = one domain per line (yourdomain.com or https://yourdomain.com).
 *
 * Hits the live Sitebeat /api/audit endpoint at SITEBEAT_BASE (default
 * https://sitebeat.com). Polls for completion, then aggregates the
 * results into a markdown report with score distribution + top
 * failures + outlier callouts.
 */

import fs from "node:fs/promises";
import { argv, exit, stdin } from "node:process";

const SITEBEAT_BASE = process.env.SITEBEAT_BASE ?? "https://sitebeat.com";
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

async function main() {
  const args = parseArgs(argv.slice(2));

  let domains = [];
  if (args.industry && args.city) {
    domains = await fetchYelpDomains(args.industry, args.city, args.limit ?? 50);
  } else if (args.file) {
    const buf = await fs.readFile(args.file, "utf8");
    domains = splitDomains(buf);
  } else {
    const buf = await readStdin();
    domains = splitDomains(buf);
  }

  if (domains.length === 0) {
    console.error("No domains provided. Pipe a list of domains or pass a file argument.");
    exit(1);
  }

  console.error(`Auditing ${domains.length} domains via ${SITEBEAT_BASE}…`);

  const results = [];
  for (let i = 0; i < domains.length; i++) {
    const d = domains[i];
    process.stderr.write(`  [${i + 1}/${domains.length}] ${d}… `);
    try {
      const r = await auditDomain(d);
      process.stderr.write(`${r.score}/100\n`);
      results.push({ domain: d, ...r });
    } catch (e) {
      process.stderr.write(`FAILED (${e.message})\n`);
    }
  }

  const md = formatTeardown(results, args);
  process.stdout.write(md);
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--industry") out.industry = args[++i];
    else if (a === "--city") out.city = args[++i];
    else if (a === "--limit") out.limit = parseInt(args[++i], 10);
    else if (a === "--title") out.title = args[++i];
    else if (!a.startsWith("--")) out.file = a;
  }
  return out;
}

function splitDomains(buf) {
  return buf
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
}

async function readStdin() {
  let data = "";
  for await (const chunk of stdin) data += chunk;
  return data;
}

async function fetchYelpDomains(industry, city, limit) {
  const secret = process.env.OUTREACH_SECRET;
  if (!secret) {
    throw new Error(
      "OUTREACH_SECRET env var required when using --industry/--city. Set it to the same value as in Vercel.",
    );
  }
  console.error(`Fetching ${limit} ${industry} URLs from Yelp via Sitebeat (dry-run)…`);
  const res = await fetch(`${SITEBEAT_BASE}/api/discover/yelp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      terms: [industry],
      locations: [city],
      perCallLimit: limit,
      dryRun: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`yelp discovery failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.urls ?? [])
    .map((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function auditDomain(domain) {
  const submit = await fetch(`${SITEBEAT_BASE}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: domain,
      attribution: { utmSource: "teardown_script", utmMedium: "cli" },
    }),
  });
  if (!submit.ok) throw new Error(`HTTP ${submit.status}`);
  const { auditId } = await submit.json();
  if (!auditId) throw new Error("no auditId returned");

  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(`${SITEBEAT_BASE}/api/audit?id=${auditId}`);
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === "complete") {
      return { auditId, score: data.score, report: data.report };
    }
    if (data.status === "error") {
      throw new Error(data.errorMessage || "audit error");
    }
  }
  throw new Error("audit timed out");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatTeardown(results, args) {
  const sorted = [...results].sort((a, b) => a.score - b.score);
  const avg =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;

  const distribution = bucketScores(results);
  const issueCounts = countIssues(results);
  const topIssues = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const title = args.title
    ? args.title
    : args.industry && args.city
      ? `I audited ${results.length} ${args.industry} websites in ${args.city}`
      : `I audited ${results.length} websites`;

  let out = "";
  out += `# ${title}\n\n`;
  out += `Audited ${results.length} sites with [Sitebeat](${SITEBEAT_BASE}). Average score: **${avg}/100**.\n\n`;

  out += `## Score distribution\n\n`;
  for (const [bucket, count] of distribution) {
    const bar = "█".repeat(Math.round((count / results.length) * 40));
    out += `- ${bucket}: ${bar} ${count}\n`;
  }
  out += "\n";

  out += `## Top 5 most common SEO failures\n\n`;
  for (const [name, count] of topIssues) {
    const pct = Math.round((count / results.length) * 100);
    out += `${count}/${results.length} (${pct}%) — **${name}**\n\n`;
  }

  out += `## Worst 5 sites\n\n`;
  for (const r of sorted.slice(0, 5)) {
    out += `- ${r.domain} — **${r.score}/100** ([report](${SITEBEAT_BASE}/audit/${r.auditId}))\n`;
  }
  out += "\n";

  out += `## Best 5 sites\n\n`;
  for (const r of sorted.slice(-5).reverse()) {
    out += `- ${r.domain} — **${r.score}/100** ([report](${SITEBEAT_BASE}/audit/${r.auditId}))\n`;
  }
  out += "\n";

  out += `---\n\n`;
  out += `_Each site was checked against 13 SEO signals (HTTPS, meta description, headings, page speed, sitemap, robots, canonical, viewport, alt text, OG, broken links, structured data, language attr). Run a free audit on yours: ${SITEBEAT_BASE}_\n`;

  return out;
}

function bucketScores(results) {
  const buckets = [
    ["A (90-100)", 0],
    ["B (80-89)", 0],
    ["C (70-79)", 0],
    ["D (60-69)", 0],
    ["F (<60)", 0],
  ];
  for (const r of results) {
    if (r.score >= 90) buckets[0][1]++;
    else if (r.score >= 80) buckets[1][1]++;
    else if (r.score >= 70) buckets[2][1]++;
    else if (r.score >= 60) buckets[3][1]++;
    else buckets[4][1]++;
  }
  return buckets;
}

function countIssues(results) {
  const counts = new Map();
  for (const r of results) {
    const checks = r.report?.checks ?? [];
    for (const c of checks) {
      if (c.status === "fail" || c.status === "warn") {
        counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
      }
    }
  }
  return counts;
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
