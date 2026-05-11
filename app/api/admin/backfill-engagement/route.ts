import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, outreachEvents } from "@/db";
import { eq, isNotNull } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Backfill open/click/delivery state on outreach_events whose webhook
 * never fired (because the prior signature verifier was broken).
 * Hits Resend's GET /emails/{id} for each resend_id and rewrites the
 * row's status + first_opened_at + first_clicked_at fields from the
 * authoritative provider state.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const rows = await db
    .select()
    .from(outreachEvents)
    .where(isNotNull(outreachEvents.resendId));

  let updated = 0;
  let alreadyTracked = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.resendId) continue;
    if (row.status === "delivered" || row.status === "opened" || row.status === "clicked" || row.firstOpenedAt) {
      alreadyTracked += 1;
      continue;
    }

    try {
      const res = await fetch(`https://api.resend.com/emails/${row.resendId}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      if (res.status === 404) {
        notFound += 1;
        continue;
      }
      if (!res.ok) {
        errors.push(`${row.resendId}: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as {
        last_event?: string;
        delivered_at?: string;
        opened_at?: string;
        clicked_at?: string;
        bounced_at?: string;
      };

      // Prefer the most-engaged state we can derive.
      const update: Record<string, unknown> = {};
      if (data.opened_at) update.firstOpenedAt = new Date(data.opened_at);
      if (data.clicked_at) update.firstClickedAt = new Date(data.clicked_at);
      if (data.last_event === "clicked") update.status = "clicked";
      else if (data.last_event === "opened") update.status = "opened";
      else if (data.last_event === "delivered") update.status = "delivered";
      else if (data.last_event === "bounced") update.status = "bounced";

      if (Object.keys(update).length > 0) {
        await db
          .update(outreachEvents)
          .set(update)
          .where(eq(outreachEvents.id, row.id));
        updated += 1;
      }
    } catch (e) {
      errors.push(`${row.resendId}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    total_examined: rows.length,
    updated,
    already_tracked: alreadyTracked,
    not_found: notFound,
    errors: errors.slice(0, 10),
  });
}
