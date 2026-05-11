#!/usr/bin/env node
/**
 * Propagate the four shared Zilla HQ SEO credentials to every merchant
 * project in the Zilla-HQ Vercel scope.
 *
 *   node scripts/propagate-zilla-seo-env.mjs                    # propagate to default merchant list
 *   node scripts/propagate-zilla-seo-env.mjs --all              # propagate to every Zilla-HQ project
 *   node scripts/propagate-zilla-seo-env.mjs --targets a,b,c    # propagate to a specific list
 *   node scripts/propagate-zilla-seo-env.mjs --source restay    # pull creds from a specific source project (default: sitebeat)
 *   node scripts/propagate-zilla-seo-env.mjs --dry-run          # show what would change without writing
 *
 * The four propagated vars (matched against the Zilla HQ vault):
 *   ZILLA_GSC_OAUTH_CLIENT_ID
 *   ZILLA_GSC_OAUTH_CLIENT_SECRET
 *   ZILLA_GSC_OAUTH_REFRESH_TOKEN
 *   ZILLA_BING_WEBMASTER_API_KEY
 *
 * Run this:
 *   1. Once for every existing merchant when first wiring up SEO autonomy.
 *   2. Every time you fork a new merchant from this template.
 *   3. Whenever any of the four credentials rotates.
 *
 * Idempotent — projects that already have all four vars are skipped
 * (unless you pass --force). Auth: uses your local Vercel CLI session;
 * if you can `vercel projects ls --scope zilla-hq` you can run this.
 */

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Default merchant list — projects that should always have SEO env
// vars. Add new merchants here as they're forked. Or pass --targets to
// override.
const DEFAULT_MERCHANTS = ["sitebeat", "restay", "sitegrid", "realestate"];

const REQUIRED_VARS = [
  "ZILLA_GSC_OAUTH_CLIENT_ID",
  "ZILLA_GSC_OAUTH_CLIENT_SECRET",
  "ZILLA_GSC_OAUTH_REFRESH_TOKEN",
  "ZILLA_BING_WEBMASTER_API_KEY",
];

const SCOPE = "zilla-hq";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    source: "sitebeat",
    targets: null,
    all: false,
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--all") out.all = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--source") out.source = args[++i];
    else if (a === "--targets") {
      out.targets = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/propagate-zilla-seo-env.mjs [options]

Options:
  --source <project>    Source project to pull creds from (default: sitebeat)
  --targets a,b,c       Comma-separated list of target projects
  --all                 Target every project in the Zilla-HQ Vercel scope
  --dry-run             Show what would change, don't write
  --force               Overwrite even if all four vars are already set
  -h, --help            Print this help

Default targets: ${DEFAULT_MERCHANTS.join(", ")}`);
}

/**
 * Run a Vercel CLI command in a fresh temp dir linked to the given
 * project. Captures stdout+stderr, throws on non-zero exit.
 */
function vercel(project, args, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), `vc-${project}-`));
  try {
    // Link silently
    execSync(
      `vercel link --yes --project ${project} --scope ${SCOPE}`,
      { cwd: dir, stdio: "ignore" },
    );
    const result = execSync(`vercel ${args}`, {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      input: opts.input,
      encoding: "utf8",
    });
    return result;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pullCredsFromSource(sourceProject) {
  console.error(`Pulling creds from ${sourceProject}…`);
  const dir = mkdtempSync(join(tmpdir(), `vc-pull-${sourceProject}-`));
  try {
    execSync(
      `vercel link --yes --project ${sourceProject} --scope ${SCOPE}`,
      { cwd: dir, stdio: "ignore" },
    );
    execSync(`vercel env pull .env.creds --environment=production --yes`, {
      cwd: dir,
      stdio: "ignore",
    });
    const env = readFileSync(join(dir, ".env.creds"), "utf8");
    const creds = {};
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) creds[m[1]] = m[2].replace(/^"|"$/g, "");
    }
    const missing = REQUIRED_VARS.filter((v) => !creds[v]);
    if (missing.length > 0) {
      console.error(
        `ERR: source project ${sourceProject} is missing required vars: ${missing.join(", ")}`,
      );
      console.error(
        "Pick a source project that already has the four ZILLA_* vars set.",
      );
      process.exit(1);
    }
    return Object.fromEntries(REQUIRED_VARS.map((v) => [v, creds[v]]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function listAllProjects() {
  const out = execSync(`vercel projects ls --scope ${SCOPE}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  // Output is a table with project names in the first column. Skip
  // non-data lines (header + footer).
  const projects = [];
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    // Skip empty, headers, separators, "Latest" lines
    if (
      !trimmed ||
      trimmed.startsWith("Vercel CLI") ||
      trimmed.startsWith("Fetching") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("Project") ||
      trimmed.startsWith("Latest")
    ) {
      continue;
    }
    const name = trimmed.split(/\s+/)[0];
    if (/^[a-z0-9_-]+$/i.test(name)) projects.push(name);
  }
  return projects;
}

function getProjectCurrentVars(project) {
  const out = execSync(
    `cd "$(mktemp -d)" && vercel link --yes --project ${project} --scope ${SCOPE} >/dev/null 2>&1 && vercel env ls 2>&1`,
    { encoding: "utf8", shell: "/bin/bash" },
  );
  // Parse "<NAME>   Encrypted   Production" rows
  const present = new Set();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+([A-Z_][A-Z0-9_]+)\s+Encrypted\s+/);
    if (m && REQUIRED_VARS.includes(m[1])) present.add(m[1]);
  }
  return present;
}

function setVar(project, name, value, dryRun) {
  if (dryRun) {
    console.log(`  [dry-run] would set ${name} on ${project}`);
    return;
  }
  // Vercel doesn't have an idempotent `env set` — must rm first then add.
  const dir = mkdtempSync(join(tmpdir(), `vc-set-${project}-`));
  try {
    execSync(
      `vercel link --yes --project ${project} --scope ${SCOPE}`,
      { cwd: dir, stdio: "ignore" },
    );
    // Try rm; ignore failure (var may not exist yet).
    try {
      execSync(`vercel env rm ${name} production --yes`, {
        cwd: dir,
        stdio: "ignore",
      });
    } catch {
      /* not present, fine */
    }
    execSync(`vercel env add ${name} production`, {
      cwd: dir,
      input: value,
      stdio: ["pipe", "ignore", "ignore"],
    });
    console.log(`  ✓ ${name}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs();
  const creds = pullCredsFromSource(opts.source);
  console.error(`✓ Got all ${REQUIRED_VARS.length} required vars from ${opts.source}`);
  console.error("");

  let targets = opts.targets;
  if (!targets) {
    targets = opts.all ? listAllProjects() : DEFAULT_MERCHANTS;
  }
  // Don't propagate to the source project (already has them)
  targets = targets.filter((t) => t !== opts.source);

  console.error(
    `Target projects (${targets.length}): ${targets.join(", ")}${opts.dryRun ? " [DRY RUN]" : ""}`,
  );
  console.error("");

  for (const project of targets) {
    console.log(`=== ${project} ===`);
    let currentVars = new Set();
    try {
      currentVars = getProjectCurrentVars(project);
    } catch (err) {
      console.log(
        `  ⚠ couldn't read env vars (${(err.message ?? "").slice(0, 100)}). Skipping.`,
      );
      continue;
    }
    const allPresent = REQUIRED_VARS.every((v) => currentVars.has(v));
    if (allPresent && !opts.force) {
      console.log("  · all four vars already set — skipping (pass --force to overwrite)");
      continue;
    }
    for (const name of REQUIRED_VARS) {
      try {
        setVar(project, name, creds[name], opts.dryRun);
      } catch (err) {
        console.log(`  ✗ ${name}: ${(err.message ?? "").slice(0, 100)}`);
      }
    }
  }

  console.error("");
  console.error(`✓ Done${opts.dryRun ? " (dry run — no changes written)" : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
