import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, outreachEvents, listings, orders, previews } from "@/db";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";

export const runtime = "nodejs";

const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

function isAuthed(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [emailTotal] = await db
    .select({
      n: count(),
      delivered: sql<number>`sum(case when status in ('delivered','opened','clicked','replied') then 1 else 0 end)`,
      opened: sql<number>`sum(case when first_opened_at is not null then 1 else 0 end)`,
      clicked: sql<number>`sum(case when first_clicked_at is not null then 1 else 0 end)`,
      replied: sql<number>`sum(case when replied_at is not null then 1 else 0 end)`,
      bounced: sql<number>`sum(case when status='bounced' then 1 else 0 end)`,
      complained: sql<number>`sum(case when status='complained' then 1 else 0 end)`,
      unsubscribed: sql<number>`sum(case when status='unsubscribed' then 1 else 0 end)`,
      failed: sql<number>`sum(case when status='failed' then 1 else 0 end)`,
    })
    .from(outreachEvents)
    .where(eq(outreachEvents.channel, "email"));

  const [listingTotal] = await db
    .select({ n: count() })
    .from(listings);

  const sourceBreakdown = await db
    .select({
      source: listings.source,
      n: count(),
      since24h: sql<number>`sum(case when created_at > now() - interval '24 hours' then 1 else 0 end)`,
      since7d: sql<number>`sum(case when created_at > now() - interval '7 days' then 1 else 0 end)`,
    })
    .from(listings)
    .groupBy(listings.source);

  const [previewTotal] = await db
    .select({ n: count() })
    .from(previews);

  const [orderTotal] = await db
    .select({
      n: count(),
      paid: sql<number>`sum(case when status='paid' then 1 else 0 end)`,
      refunded: sql<number>`sum(case when status='refunded' then 1 else 0 end)`,
      revenueCents: sql<number>`coalesce(sum(case when status='paid' then amount_cents else 0 end), 0)`,
    })
    .from(orders);

  const [uniqueRecipients] = await db
    .select({ n: sql<number>`count(distinct ${listings.agentEmail})` })
    .from(outreachEvents)
    .innerJoin(listings, eq(outreachEvents.listingId, listings.id))
    .where(and(eq(outreachEvents.channel, "email"), isNotNull(listings.agentEmail)));

  const replies = await db
    .select({
      id: outreachEvents.id,
      recipient: listings.agentEmail,
      agentName: listings.agentName,
      address: listings.address,
      subject: outreachEvents.subject,
      repliedAt: outreachEvents.repliedAt,
      listingId: outreachEvents.listingId,
    })
    .from(outreachEvents)
    .innerJoin(listings, eq(outreachEvents.listingId, listings.id))
    .where(isNotNull(outreachEvents.repliedAt))
    .orderBy(sql`replied_at desc`)
    .limit(20);

  const sent = Number(emailTotal.n);
  const opened = Number(emailTotal.opened ?? 0);
  const clicked = Number(emailTotal.clicked ?? 0);
  const replied = Number(emailTotal.replied ?? 0);
  const delivered = Number(emailTotal.delivered ?? 0);
  const bounced = Number(emailTotal.bounced ?? 0);

  return NextResponse.json({
    emails: {
      sent,
      delivered,
      opened,
      clicked,
      replied,
      bounced,
      complained: Number(emailTotal.complained ?? 0),
      unsubscribed: Number(emailTotal.unsubscribed ?? 0),
      failed: Number(emailTotal.failed ?? 0),
      uniqueRecipients: Number(uniqueRecipients.n),
      openRate: sent ? opened / sent : 0,
      clickRate: sent ? clicked / sent : 0,
      replyRate: sent ? replied / sent : 0,
      bounceRate: sent ? bounced / sent : 0,
      deliveryRate: sent ? delivered / sent : 0,
    },
    listings: {
      total: Number(listingTotal.n),
      bySource: sourceBreakdown.map((s) => ({
        source: s.source,
        total: Number(s.n),
        last24h: Number(s.since24h ?? 0),
        last7d: Number(s.since7d ?? 0),
      })),
    },
    previews: { total: Number(previewTotal.n) },
    orders: {
      total: Number(orderTotal.n),
      paid: Number(orderTotal.paid ?? 0),
      refunded: Number(orderTotal.refunded ?? 0),
      revenueCents: Number(orderTotal.revenueCents ?? 0),
    },
    recentReplies: replies,
  });
}
