import { inngest } from "@/inngest/client";
import { db, outboundContacts } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Weekly sponsor-discovery cron — expands outbound_contacts via Hunter
 * domain-search against a curated seed list of podcast / newsletter
 * websites in the merchant's target vertical.
 *
 * Idempotent: existing emails are merged (templateId is patched only
 * when empty; status is never downgraded). Per-run cap prevents a
 * Hunter quota refresh + a fat seed list from drowning the queue.
 *
 * Sets autoSendEnabled=true on every newly-discovered contact, BUT
 * actual sending is gated on SPONSOR_OUTREACH_ENABLED at the send-cron
 * level — discovery alone never sends.
 *
 * SEED_DOMAINS env: comma-separated list of "domain|organization|kind|
 * template_id" rows. Example:
 *   "thedentalpodcast.com|The Dental Podcast|podcast|podcast_generic,..."
 */
export const sponsorDiscoverFn = inngest.createFunction(
  {
    id: "sponsor-discover",
    name: "Sponsors — weekly Hunter domain-search discovery",
    retries: 1,
  },
  [{ cron: "0 18 * * 0" }, { event: "sponsor/discover" }],
  async ({ logger }) => {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) {
      return { skipped: true, reason: "HUNTER_API_KEY missing" };
    }
    const seedRaw = process.env.SPONSOR_SEED_DOMAINS ?? "";
    if (!seedRaw) {
      return { skipped: true, reason: "SPONSOR_SEED_DOMAINS not configured" };
    }
    const maxPerRun = Number(process.env.SPONSOR_DISCOVER_MAX_PER_RUN ?? "30");

    const seeds = parseSeeds(seedRaw);
    let discovered = 0;
    let newContacts = 0;
    let skipped = 0;

    for (const seed of seeds) {
      if (newContacts >= maxPerRun) break;
      const personas = await hunterDomainSearch(apiKey, seed.domain);
      for (const p of personas) {
        if (newContacts >= maxPerRun) {
          skipped += 1;
          continue;
        }
        discovered += 1;

        const [existing] = await db
          .select()
          .from(outboundContacts)
          .where(eq(outboundContacts.email, p.email))
          .limit(1);
        if (existing) {
          if (!existing.templateId) {
            await db
              .update(outboundContacts)
              .set({
                templateId: seed.templateId,
                autoSendEnabled: existing.autoSendEnabled || true,
                source: existing.source ?? "seed_discover",
              })
              .where(eq(outboundContacts.id, existing.id));
          }
          skipped += 1;
          continue;
        }

        await db.insert(outboundContacts).values({
          kind: seed.kind,
          name: p.fullName,
          email: p.email,
          organization: seed.organization,
          role: p.position ?? undefined,
          status: "queued",
          templateId: seed.templateId,
          autoSendEnabled: true,
          source: "seed_discover",
        });
        newContacts += 1;
      }
    }

    logger.info(`sponsor-discover: ${newContacts} new contacts from ${seeds.length} seeds`);
    return { discovered, newContacts, skipped };
  },
);

interface Seed {
  domain: string;
  organization: string;
  kind: string;
  templateId: string;
}

function parseSeeds(raw: string): Seed[] {
  return raw
    .split(",")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [domain, organization, kind, templateId] = row.split("|");
      return {
        domain: (domain ?? "").trim(),
        organization: (organization ?? "").trim(),
        kind: (kind ?? "other").trim(),
        templateId: (templateId ?? "podcast_generic").trim(),
      };
    })
    .filter((s) => s.domain);
}

interface HunterPersona {
  email: string;
  fullName: string | null;
  position: string | null;
}

async function hunterDomainSearch(apiKey: string, domain: string): Promise<HunterPersona[]> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(
    apiKey,
  )}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { emails?: Array<{ value: string; first_name?: string; last_name?: string; position?: string }> };
  };
  return (json.data?.emails ?? []).map((e) => ({
    email: e.value,
    fullName: [e.first_name, e.last_name].filter(Boolean).join(" ") || null,
    position: e.position ?? null,
  }));
}
