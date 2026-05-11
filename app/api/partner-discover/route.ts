import { NextRequest, NextResponse } from "next/server";
import { searchYelpFanOut } from "@/lib/yelp";
import { findCompanyEmail } from "@/lib/find-company-email";
import { hasMxRecord } from "@/lib/validate-email";
import { bulkAddProspects, sendPartnerEmail } from "@/lib/partner-outreach";
import { db, partnerOutreach } from "@/db";
import { inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Agency-shaped business discovery for the partner-outreach pipeline.
 *
 * Auth: Bearer OUTREACH_SECRET (same as /api/discover/yelp).
 *
 * Body:
 *   { terms: string[], locations: string[],
 *     perCallLimit?: number, autoSend?: boolean, dryRun?: boolean }
 *
 * Pipeline:
 *   1. Yelp fan-out → list of business URLs (homepage)
 *   2. For each: scrape homepage for contact email, MX-validate it
 *   3. bulkAddProspects: dedupe vs partner_outreach + blacklist
 *   4. If autoSend, fire initial pitch from partners@ for each new row
 *
 * The audit-side discovery (/api/discover/yelp) targets businesses
 * that need SEO. This endpoint targets the agencies and freelancers
 * who manage SEO for those businesses — they become Sitebeat
 * affiliates (30% lifetime), not direct customers.
 */
export async function POST(req: NextRequest) {
  const outreachSecret = process.env.OUTREACH_SECRET;
  if (!outreachSecret) {
    return NextResponse.json({ error: "OUTREACH_SECRET not set" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth.replace(/^Bearer\s+/i, "") !== outreachSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.APIFY_TOKEN && !process.env.YELP_API_KEY) {
    return NextResponse.json(
      { error: "APIFY_TOKEN not set; Yelp discovery disabled" },
      { status: 503 },
    );
  }

  let body: {
    terms?: unknown;
    locations?: unknown;
    perCallLimit?: unknown;
    autoSend?: unknown;
    dryRun?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.terms) || !Array.isArray(body.locations)) {
    return NextResponse.json(
      { error: "terms and locations must be arrays of strings" },
      { status: 400 },
    );
  }

  const terms = body.terms.filter((t): t is string => typeof t === "string").slice(0, 8);
  const locations = body.locations
    .filter((l): l is string => typeof l === "string")
    .slice(0, 25);
  const perCallLimit =
    typeof body.perCallLimit === "number" ? body.perCallLimit : 30;
  const autoSend = Boolean(body.autoSend);
  const dryRun = Boolean(body.dryRun);

  // 1. Yelp fan-out
  const urls = await searchYelpFanOut({ terms, locations, perCallLimit });
  if (urls.length === 0) {
    return NextResponse.json({ discovered: 0, note: "no Yelp matches" });
  }

  // 2. For each URL, find a contact email + MX-validate. Run in modest
  // parallelism (5 at a time) to avoid hammering small agency sites.
  type Found = { siteUrl: string; email: string };
  const found: Found[] = [];
  const seenEmails = new Set<string>();

  // We already have the URLs deduped by searchYelpFanOut. Cap at 100
  // per run so a single cron tick doesn't blow the 300s budget.
  const sliced = urls.slice(0, 100);

  const concurrency = 5;
  for (let i = 0; i < sliced.length; i += concurrency) {
    const slice = sliced.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (url) => {
        if (!url) return null;
        try {
          const email = await findCompanyEmail(url);
          if (!email) return null;
          const lower = email.toLowerCase();
          if (seenEmails.has(lower)) return null;
          // MX validate — drops typos and dead domains.
          const mxOk = await hasMxRecord(email).catch(() => false);
          if (!mxOk) return null;
          seenEmails.add(lower);
          return { siteUrl: url, email: lower };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) found.push(r);
    }
  }

  if (dryRun) {
    return NextResponse.json({ discovered: urls.length, withEmail: found.length, sample: found.slice(0, 5), dryRun: true });
  }

  if (found.length === 0) {
    return NextResponse.json({
      discovered: urls.length,
      withEmail: 0,
      added: 0,
      note: "no usable emails extracted",
    });
  }

  // 3. Bulk-add to partner_outreach (dedupes vs existing + blacklist).
  const addResult = await bulkAddProspects(
    found.map((f) => ({
      email: f.email,
      notes: `Discovered via Yelp partner-discover: ${f.siteUrl}`,
    })),
  );

  // 4. If autoSend, look up the just-inserted prospects and fire the
  // initial pitch for each. We re-query to get IDs because the bulk
  // insert with onConflictDoNothing only returns rows it actually
  // inserted, but that's already what we want — only new prospects
  // get pitched.
  let sent = 0;
  let failed = 0;
  if (autoSend && addResult.inserted > 0) {
    const emails = found.map((f) => f.email);
    const newProspects = await db
      .select({
        id: partnerOutreach.id,
        email: partnerOutreach.email,
        sendCount: partnerOutreach.sendCount,
      })
      .from(partnerOutreach)
      .where(inArray(partnerOutreach.email, emails));

    for (const f of found) {
      const match = newProspects.find((p) => p.email === f.email);
      if (!match) continue;
      // Only send if this prospect has never been emailed (sendCount=0).
      // Avoids re-sending if the prospect was added by a previous run.
      if (match.sendCount > 0) continue;
      try {
        // Mark which campaign this came from so we can attribute opens
        // to the partner-discovery channel later.
        await sendPartnerEmail({ prospectId: match.id, variant: "initial" });
        sent++;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "partner-discover send failed for",
          match.email,
          (err as Error).message,
        );
        failed++;
      }
    }
  }

  return NextResponse.json({
    discovered: urls.length,
    withEmail: found.length,
    added: addResult.inserted,
    sent,
    failed,
    autoSend,
  });
}
