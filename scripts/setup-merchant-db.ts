/**
 * One-command Supabase + schema provisioning for a new Zilla merchant.
 *
 * Replaces the manual checklist from merchant-template/MERCHANT.md §0:
 *   "New Supabase project (database isolation is the strongest compliance
 *    posture; do not reuse another merchant's DB)."
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   SUPABASE_ORG_ID=paremiacnrwdsgwtthxx \
 *   VERCEL_TOKEN=vcp_... \
 *   VERCEL_PROJECT_ID=prj_... \
 *   VERCEL_TEAM_ID=team_... \
 *   MERCHANT_SLUG=storypop \
 *   npm run setup:db
 *
 * What it does:
 *   1. Creates a Supabase project named <slug> in the given org (us-east-1, free).
 *   2. Polls for ACTIVE_HEALTHY.
 *   3. Pulls the transaction-mode pooler URL + injects the generated password.
 *   4. Sets DATABASE_URL in the given Vercel project (production+preview+dev).
 *   5. Runs `drizzle-kit generate` to produce drizzle/0000_initial.sql.
 *   6. Creates the merchant's Postgres schema namespace and applies the
 *      generated SQL using drizzle's own statement-breakpoint separator
 *      (drizzle-kit push has a known UI bug where it claims success but
 *      only applies the enum types — we apply manually instead).
 *
 * Idempotent: re-running against the same merchant slug detects the
 * existing Supabase project and reuses it without recreating.
 *
 * Operator action remaining after this script: deploy Vercel
 * (`vercel --prod`) so the new DATABASE_URL is loaded.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing required env: ${k}`);
    process.exit(2);
  }
  return v;
};

const SUPA = need("SUPABASE_ACCESS_TOKEN");
const SUPA_ORG = need("SUPABASE_ORG_ID");
const VTOK = need("VERCEL_TOKEN");
const VPROJ = need("VERCEL_PROJECT_ID");
const VTEAM = need("VERCEL_TEAM_ID");
const SLUG = need("MERCHANT_SLUG");

const REGION = process.env.SUPABASE_REGION ?? "us-east-1";
const DB_PASS = process.env.SUPABASE_DB_PASSWORD ?? randomBytes(24).toString("hex");

async function supabase<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SUPA}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${path}: ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function vercel<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.vercel.com${path}${sep}teamId=${VTEAM}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VTOK}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vercel ${res.status} on ${path}: ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function findOrCreateProject(): Promise<{ id: string; isNew: boolean }> {
  const existing = await supabase<Array<{ id: string; name: string; status: string }>>(
    "/v1/projects",
  );
  const hit = existing.find((p) => p.name === SLUG);
  if (hit) {
    console.log(`✓ Found existing Supabase project '${SLUG}' (id=${hit.id}, status=${hit.status})`);
    return { id: hit.id, isNew: false };
  }
  console.log(`→ Creating Supabase project '${SLUG}' in org ${SUPA_ORG}...`);
  const created = await supabase<{ id: string; ref: string }>("/v1/projects", {
    method: "POST",
    body: JSON.stringify({
      name: SLUG,
      organization_id: SUPA_ORG,
      plan: "free",
      region: REGION,
      db_pass: DB_PASS,
    }),
  });
  return { id: created.id, isNew: true };
}

async function waitHealthy(projectRef: string): Promise<void> {
  console.log("→ Waiting for project to become ACTIVE_HEALTHY...");
  const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
  while (Date.now() < deadline) {
    const proj = await supabase<{ status: string }>(`/v1/projects/${projectRef}`);
    if (proj.status === "ACTIVE_HEALTHY") {
      console.log("✓ Project healthy");
      return;
    }
    await new Promise((r) => setTimeout(r, 5_000));
    process.stdout.write(`  ...${proj.status}\r`);
  }
  throw new Error("Project did not become ACTIVE_HEALTHY within 5min");
}

async function buildDatabaseUrl(projectRef: string): Promise<string> {
  const pooler = await supabase<
    Array<{ db_user: string; db_host: string; db_port: number; db_name: string }>
  >(`/v1/projects/${projectRef}/config/database/pooler`);
  const cfg = pooler[0];
  if (!cfg) throw new Error("No pooler config returned from Supabase");
  return `postgresql://${cfg.db_user}:${DB_PASS}@${cfg.db_host}:${cfg.db_port}/${cfg.db_name}`;
}

async function setVercelEnv(databaseUrl: string): Promise<void> {
  console.log("→ Setting DATABASE_URL in Vercel project...");
  // POST will fail with 400 if the key already exists; in that case PATCH
  // the value instead.
  try {
    await vercel(`/v10/projects/${VPROJ}/env`, {
      method: "POST",
      body: JSON.stringify({
        key: "DATABASE_URL",
        value: databaseUrl,
        target: ["production", "preview", "development"],
        type: "encrypted",
      }),
    });
    console.log("✓ DATABASE_URL created on Vercel");
  } catch (err) {
    if (!String(err).includes("already exists")) throw err;
    // Find the existing env-var id and PATCH it.
    const list = await vercel<{ envs: Array<{ id: string; key: string }> }>(
      `/v9/projects/${VPROJ}/env`,
    );
    const hit = list.envs.find((e) => e.key === "DATABASE_URL");
    if (!hit) throw new Error("Failed to locate existing DATABASE_URL on Vercel");
    await vercel(`/v9/projects/${VPROJ}/env/${hit.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: databaseUrl }),
    });
    console.log("✓ DATABASE_URL updated on Vercel");
  }
}

async function runDrizzleGenerate(databaseUrl: string): Promise<void> {
  console.log("→ Running drizzle-kit generate (writes drizzle/0000_initial.sql)...");
  await mkdir("drizzle", { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "npx",
      ["--yes", "drizzle-kit", "generate", "--name=initial"],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`drizzle-kit exited ${code}`))));
  });
}

async function applyMigration(databaseUrl: string): Promise<void> {
  console.log("→ Applying migration to Postgres directly...");
  const raw = await readFile("drizzle/0000_initial.sql", "utf8");
  // CREATE SCHEMA goes first as its own statement (drizzle puts it inline
  // but on a brand-new DB the schema needs to exist before any "schema"."type"
  // reference resolves).
  const cleaned = raw.replace(/CREATE SCHEMA "[^"]+";/g, "");
  const statements = cleaned
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  // Use the `postgres` package that's already in node_modules.
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  // Create the schema first using DB_SCHEMA env (default 'storypop' for this
  // template).
  const schemaName = process.env.DB_SCHEMA ?? SLUG;
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
  console.log(`  ✓ schema "${schemaName}" ready`);

  let ok = 0;
  let failed = 0;
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      ok++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL: ${stmt.slice(0, 70).replace(/\n/g, " ")}`);
      console.log(`    ${msg.slice(0, 200)}`);
    }
  }
  await sql.end();
  console.log(`  ✓ ${ok} statements applied, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} migration statement(s) failed`);
}

async function main() {
  const { id: projectRef, isNew } = await findOrCreateProject();
  if (isNew) {
    await waitHealthy(projectRef);
    console.log("");
    console.log(`  ⚠ Save this password somewhere — it won't be shown again:`);
    console.log(`    SUPABASE_DB_PASSWORD=${DB_PASS}`);
    console.log("");
    await writeFile(
      `.supabase-${SLUG}-credentials.txt`,
      `PROJECT_REF=${projectRef}\nDB_PASSWORD=${DB_PASS}\n`,
      { mode: 0o600 },
    );
    console.log(`  (also written to .supabase-${SLUG}-credentials.txt)`);
  }
  const url = await buildDatabaseUrl(projectRef);
  await setVercelEnv(url);
  await runDrizzleGenerate(url);
  await applyMigration(url);
  console.log("");
  console.log("✅ Done. Deploy with:  vercel --prod --yes");
}

main().catch((err) => {
  console.error("✗ Setup failed:", err);
  process.exit(1);
});
