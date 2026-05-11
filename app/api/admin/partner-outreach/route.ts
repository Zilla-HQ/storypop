import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { bulkAddProspects, sendPartnerEmail } from "@/lib/partner-outreach";
import { importPartnersFromSites } from "@/lib/partner-import";

export const runtime = "nodejs";
// The site-import path scrapes up to 50 URLs in parallel batches; the
// default 30s function timeout isn't enough. 300s matches the cron.
export const maxDuration = 300;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (
  process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io,zilla.so"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

/**
 * Admin-only routes for partner outreach. Replicates the email/domain
 * gate the middleware applies to /admin/* page routes — necessary
 * because /api/admin/* isn't covered by the middleware's redirect
 * logic, only by Clerk's session attachment.
 */
async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) throw new Error("unauthorized");
  const domain = email.split("@")[1];
  const allowed = email === ADMIN_EMAIL || (domain ? ADMIN_DOMAINS.includes(domain) : false);
  if (!allowed) throw new Error("forbidden");
}

/**
 * POST /api/admin/partner-outreach
 *
 * Two actions, distinguished by the `action` field:
 *   - "bulk_add"     : { rows: [{email, name?, company?, notes?}] }
 *   - "send"         : { prospectId, variant: "initial" | "followup" | "custom",
 *                        customSubject?, customText? }
 *   - "send_initial" : { rows: [...] } — bulk add + send initial in one call
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { action?: string; rows?: Array<{ email: string; name?: string; company?: string; notes?: string }>; prospectId?: string; variant?: "initial" | "followup" | "custom"; customSubject?: string; customText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (body.action === "bulk_add") {
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
    }
    const result = await bulkAddProspects(body.rows);
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "send") {
    if (!body.prospectId || !body.variant) {
      return NextResponse.json({ error: "prospectId and variant required" }, { status: 400 });
    }
    try {
      const result = await sendPartnerEmail({
        prospectId: body.prospectId,
        variant: body.variant,
        customSubject: body.customSubject,
        customText: body.customText,
      });
      return NextResponse.json({ ok: true, messageId: result.messageId });
    } catch (err) {
      const msg = (err as Error).message;
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  }

  if (body.action === "import_from_sites") {
    const opts = body as unknown as {
      keywords?: string[];
      limit?: number;
      dryRun?: boolean;
      autoSend?: boolean;
    };
    try {
      const result = await importPartnersFromSites({
        keywords: Array.isArray(opts.keywords) ? opts.keywords : undefined,
        limit: typeof opts.limit === "number" ? opts.limit : undefined,
        dryRun: opts.dryRun,
        autoSend: opts.autoSend,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message.slice(0, 200) },
        { status: 500 },
      );
    }
  }

  if (body.action === "send_initial") {
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
    }
    const added = await bulkAddProspects(body.rows);
    // Re-fetch the just-inserted prospects to get their ids and send.
    // (Safe because bulkAddProspects dedupes against existing emails.)
    // For simplicity we issue a follow-up SELECT keyed on the inputs.
    const { db, partnerOutreach } = await import("@/db");
    const { inArray } = await import("drizzle-orm");
    const emails = body.rows
      .map((r) => r.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e && e.includes("@")));
    if (emails.length === 0) {
      return NextResponse.json({ ok: true, ...added, sent: 0 });
    }
    const matches = await db
      .select({ id: partnerOutreach.id, status: partnerOutreach.status, sendCount: partnerOutreach.sendCount })
      .from(partnerOutreach)
      .where(inArray(partnerOutreach.email, emails));

    let sent = 0;
    let failed = 0;
    for (const m of matches) {
      // Only initial-send rows that haven't been emailed before
      if (m.sendCount > 0) continue;
      try {
        await sendPartnerEmail({ prospectId: m.id, variant: "initial" });
        sent++;
      } catch (err) {
        failed++;
        // eslint-disable-next-line no-console
        console.warn("partner_send failed for", m.id, (err as Error).message);
      }
    }
    return NextResponse.json({ ok: true, ...added, sent, failed });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
