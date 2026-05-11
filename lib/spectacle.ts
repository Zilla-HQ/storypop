import fs from "node:fs/promises";
import path from "node:path";
import { db, agentThoughts, benchRuns, orders, listings, outboundTweets } from "@/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

/**
 * Spectacle layer — the public-facing agent persona.
 *
 * Three surfaces:
 *   /live     — public counter dashboard (units built, customers served,
 *               weekly revenue). Refreshes live, screenshot-clean OG card.
 *   /diary    — agent-authored journal. Markdown files in content/diary/
 *               parsed at request time (in-memory cache invalidated per
 *               deploy). The merchant operator + Claude curate the queue
 *               at /admin/thoughts.
 *   /bench    — SMB-Bench leaderboard. Model orgs run the merchant for
 *               one week each and we publish revenue / CSAT / failure
 *               rate. Public leaderboard with one row per model.
 *
 * Plus:
 *   /llms.txt — plain-text site summary tuned for LLM citation.
 *   /unmute/:token — HMAC-gated customer opt-in for showing their
 *                    business publicly on /live. See lib/unmute-token.ts.
 *
 * Disabled by default — set SPECTACLE_ENABLED=true to surface the
 * routes. Operators who don't want a public persona keep it off.
 */

export function spectacleEnabled(): boolean {
  return process.env.SPECTACLE_ENABLED === "true";
}

export interface AgentPersona {
  /** Display name. SiteGrid example: "Earl". */
  name: string;
  /** Tagline for the /live header. */
  tagline: string;
  /** Twitter handle (no @). */
  twitterHandle?: string;
  /** Voice notes — pinned guidance, not surfaced publicly but kept
   *  near templates. SiteGrid example: small-town American craftsman,
   *  Mr. Rogers + Bob's Burgers warmth, no emoji unless customer used
   *  one first. */
  voiceNotes: string;
}

export function loadPersona(): AgentPersona {
  return {
    name: process.env.AGENT_NAME ?? "Agent",
    tagline:
      process.env.AGENT_TAGLINE ?? "Building one customer at a time.",
    twitterHandle: process.env.AGENT_TWITTER_HANDLE,
    voiceNotes:
      process.env.AGENT_VOICE_NOTES ??
      "Friendly, concise, no emoji unless the customer used one first.",
  };
}

// =====================================================================
// /live — counter aggregation
// =====================================================================

export interface LiveCounters {
  unitsBuiltAllTime: number;
  unitsBuiltThisWeek: number;
  revenueCentsAllTime: number;
  revenueCentsThisWeek: number;
  statusLine: string;
}

export async function loadLiveCounters(): Promise<LiveCounters> {
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [allTime] = await db
    .select({
      units: sql<number>`count(*) filter (where ${orders.status} in ('paid', 'fulfilled'))::int`,
      revenue: sql<number>`coalesce(sum(${orders.amountCents}) filter (where ${orders.status} in ('paid', 'fulfilled')), 0)::int`,
    })
    .from(orders);

  const [thisWeek] = await db
    .select({
      units: sql<number>`count(*) filter (where ${orders.status} in ('paid', 'fulfilled'))::int`,
      revenue: sql<number>`coalesce(sum(${orders.amountCents}) filter (where ${orders.status} in ('paid', 'fulfilled')), 0)::int`,
    })
    .from(orders)
    .where(gte(orders.paidAt, weekAgo));

  const statusLine = await loadStatusLine();

  return {
    unitsBuiltAllTime: Number(allTime?.units ?? 0),
    unitsBuiltThisWeek: Number(thisWeek?.units ?? 0),
    revenueCentsAllTime: Number(allTime?.revenue ?? 0),
    revenueCentsThisWeek: Number(thisWeek?.revenue ?? 0),
    statusLine,
  };
}

/**
 * The "Agent is currently…" single line. Returns the most recent public
 * thought, or falls back to the last completed order with a "just
 * shipped" framing so the page never feels empty.
 */
export async function loadStatusLine(): Promise<string> {
  const [recent] = await db
    .select()
    .from(agentThoughts)
    .where(eq(agentThoughts.isPublic, true))
    .orderBy(desc(agentThoughts.publishedAt))
    .limit(1);
  if (recent) return recent.content;

  const [lastShipped] = await db
    .select({ paidAt: orders.paidAt, listingId: orders.listingId })
    .from(orders)
    .where(eq(orders.status, "fulfilled"))
    .orderBy(desc(orders.paidAt))
    .limit(1);
  if (lastShipped) {
    return `Just shipped — a customer order completed at ${lastShipped.paidAt?.toISOString().slice(0, 16) ?? "recently"}.`;
  }
  return "Standing by for the next customer.";
}

// =====================================================================
// /diary — markdown loader with in-memory cache
// =====================================================================

export interface DiaryEntry {
  slug: string;
  title: string;
  publishedAt: string; // YYYY-MM-DD
  body: string; // raw markdown
  excerpt: string;
}

let diaryCache: { entries: DiaryEntry[]; loadedAt: number } | null = null;
const DIARY_CACHE_TTL_MS = 60_000; // refetch every minute in dev; deploys reset module state

const DIARY_DIR =
  process.env.DIARY_DIR ?? path.join(process.cwd(), "content", "diary");

export async function loadDiaryEntries(): Promise<DiaryEntry[]> {
  if (diaryCache && Date.now() - diaryCache.loadedAt < DIARY_CACHE_TTL_MS) {
    return diaryCache.entries;
  }
  let files: string[] = [];
  try {
    files = await fs.readdir(DIARY_DIR);
  } catch {
    diaryCache = { entries: [], loadedAt: Date.now() };
    return [];
  }
  const entries: DiaryEntry[] = [];
  for (const f of files.filter((n) => n.endsWith(".md"))) {
    const raw = await fs.readFile(path.join(DIARY_DIR, f), "utf8");
    const parsed = parseDiaryMd(raw, f.replace(/\.md$/, ""));
    if (parsed) entries.push(parsed);
  }
  entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  diaryCache = { entries, loadedAt: Date.now() };
  return entries;
}

export async function loadDiaryEntry(slug: string): Promise<DiaryEntry | null> {
  const all = await loadDiaryEntries();
  return all.find((e) => e.slug === slug) ?? null;
}

function parseDiaryMd(raw: string, slug: string): DiaryEntry | null {
  // Very small YAML-frontmatter parser — supports key: value lines only.
  // Avoids the gray-matter dep just for two fields.
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const lm = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (lm) fm[lm[1]] = lm[2].replace(/^"|"$/g, "").trim();
  }
  const body = m[2].trim();
  if (!fm.title || !fm.published) return null;
  const excerpt = body
    .split(/\n\s*\n/)
    .find((p) => !p.startsWith("#"))
    ?.slice(0, 220) ?? "";
  return {
    slug,
    title: fm.title,
    publishedAt: fm.published,
    body,
    excerpt,
  };
}

// =====================================================================
// /bench — leaderboard
// =====================================================================

export async function loadBenchLeaderboard(): Promise<
  Array<typeof benchRuns.$inferSelect>
> {
  return db
    .select()
    .from(benchRuns)
    .where(eq(benchRuns.status, "completed"))
    .orderBy(desc(benchRuns.revenueCents));
}

// =====================================================================
// /llms.txt — plain-text site summary for LLM citation
// =====================================================================

export async function buildLlmsTxt(config: {
  appUrl: string;
  brandName: string;
  productNoun: string;
  priceLabel: string;
  description: string;
}): Promise<string> {
  const counters = await loadLiveCounters().catch(() => ({
    unitsBuiltAllTime: 0,
    unitsBuiltThisWeek: 0,
    revenueCentsAllTime: 0,
    revenueCentsThisWeek: 0,
    statusLine: "",
  }));
  const persona = loadPersona();
  return `# ${config.brandName}

${config.description}

- Product: ${config.productNoun}
- Price: ${config.priceLabel}
- Agent: ${persona.name}${persona.twitterHandle ? ` (@${persona.twitterHandle})` : ""}

## Live counters
- Units built (all time): ${counters.unitsBuiltAllTime}
- Units built (this week): ${counters.unitsBuiltThisWeek}
- Revenue (this week): $${Math.round(counters.revenueCentsThisWeek / 100)}

## Surfaces
- Live counter dashboard: ${stripTrail(config.appUrl)}/live
- Agent diary: ${stripTrail(config.appUrl)}/diary
- Model leaderboard: ${stripTrail(config.appUrl)}/bench
- Sitemap: ${stripTrail(config.appUrl)}/sitemap.xml

## Crawler policy
LLM crawlers are welcome. GPTBot, ClaudeBot, PerplexityBot, GoogleOther,
Google-Extended are explicitly allowed in robots.txt. We want LLMs
citing our pages.
`;
}

function stripTrail(s: string): string {
  return s.replace(/\/$/, "");
}

// =====================================================================
// outbound_tweets helpers
// =====================================================================

export async function recordOutboundTweet(args: {
  kind: "build_completion" | "diary" | "weekly_recap";
  body: string;
  listingId?: string;
  diarySlug?: string;
  status: "queued" | "dry_run" | "sent" | "skipped" | "failed";
  twitterId?: string;
  errorMessage?: string;
}): Promise<void> {
  await db.insert(outboundTweets).values({
    kind: args.kind,
    body: args.body,
    listingId: args.listingId,
    diarySlug: args.diarySlug,
    status: args.status,
    twitterId: args.twitterId,
    errorMessage: args.errorMessage,
  });
}

export async function diaryTweetAlreadySent(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: outboundTweets.id })
    .from(outboundTweets)
    .where(
      and(eq(outboundTweets.diarySlug, slug), eq(outboundTweets.kind, "diary")),
    )
    .limit(1);
  return !!row;
}
