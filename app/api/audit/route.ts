import { NextResponse } from "next/server";
import { db, sites, audits } from "@/db";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { sendCapiEvent, extractCapiContextFromRequest } from "@/lib/meta-capi";

export const runtime = "nodejs";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.origin + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
    const { url, email, metaEventId, attribution } = (body ?? {}) as {
      url?: unknown;
      email?: unknown;
      metaEventId?: unknown;
      attribution?: Record<string, unknown>;
    };

    const pickStr = (v: unknown): string | null =>
      typeof v === "string" && v.length > 0 && v.length < 1000 ? v : null;
    const a = attribution ?? {};
    const fbclid = pickStr(a.fbclid);
    const utmSource = pickStr(a.utmSource);
    const utmMedium = pickStr(a.utmMedium);
    const utmCampaign = pickStr(a.utmCampaign);
    const utmTerm = pickStr(a.utmTerm);
    const utmContent = pickStr(a.utmContent);
    const referrer = pickStr(a.referrer);

    if (typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      return NextResponse.json({ error: "invalid URL" }, { status: 400 });
    }

    const customerEmail =
      typeof email === "string" && email.includes("@")
        ? email.toLowerCase().trim().slice(0, 254)
        : null;

    // Upsert site row keyed on URL so resubmissions reuse the same row.
    const existing = await db.select().from(sites).where(eq(sites.siteUrl, normalized)).limit(1);
    const siteRow = existing[0]
      ? (
          await db
            .update(sites)
            .set({
              customerEmail: customerEmail ?? existing[0].customerEmail,
              updatedAt: new Date(),
            })
            .where(eq(sites.id, existing[0].id))
            .returning()
        )[0]
      : (
          await db
            .insert(sites)
            .values({ siteUrl: normalized, customerEmail })
            .returning()
        )[0];

    // Pull server-visible attribution (cookies + headers) up-front so the
    // audit row stores the same context CAPI is about to send to Meta.
    const capiCtx = extractCapiContextFromRequest(req);

    const [auditRow] = await db
      .insert(audits)
      .values({
        siteId: siteRow.id,
        status: "pending",
        fbp: capiCtx.fbp ?? null,
        fbc: capiCtx.fbc ?? null,
        fbclid,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        referrer,
        clientIp: capiCtx.clientIpAddress ?? null,
        clientUa: capiCtx.clientUserAgent ?? null,
      })
      .returning();

    // Fire-and-forget: if Inngest isn't configured yet, the audit row still
    // exists; the user gets a "pending" status forever until Inngest is wired.
    try {
      await inngest.send({
        name: "audit/run-requested",
        data: { siteId: siteRow.id, auditId: auditRow.id, siteUrl: normalized },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("inngest.send failed (audit will not run):", (err as Error).message);
    }

    // Server-side CAPI Lead — paired with the browser Pixel fire via shared
    // event_id so Meta dedupes. Fire-and-forget; CAPI failures must not
    // block the audit submission.
    if (typeof metaEventId === "string" && metaEventId.length > 0) {
      sendCapiEvent({
        eventName: "Lead",
        eventId: metaEventId,
        actionSource: "website",
        eventSourceUrl: req.headers.get("referer") ?? undefined,
        userData: {
          email: customerEmail ?? undefined,
          externalId: siteRow.id,
          ...capiCtx,
        },
        customData: {
          contentName: "audit_submit",
          contentCategory: "seo_audit",
        },
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("CAPI Lead failed:", (err as Error).message);
      });
    }

    return NextResponse.json({ siteId: siteRow.id, auditId: auditRow.id, siteUrl: normalized });
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    // eslint-disable-next-line no-console
    console.error("POST /api/audit failed:", msg, err);
    return NextResponse.json({ error: "audit submit failed", detail: msg.slice(0, 200) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auditId = url.searchParams.get("id");
  if (!auditId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const rows = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);
  const audit = rows[0];
  if (!audit) {
    return NextResponse.json({ error: "audit not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    score: audit.score,
    report: audit.report,
    runAt: audit.runAt,
    errorMessage: audit.errorMessage,
  });
}
