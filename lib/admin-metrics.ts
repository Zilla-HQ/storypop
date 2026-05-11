import { db, listings, previews, outreachEvents, orders, agentCosts } from "@/db";
import { and, count, eq, gte, sql } from "drizzle-orm";

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUTC(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface FunnelMetrics {
  scrapedToday: number;
  qualifiedToday: number;
  previewsToday: number;
  emailsSentToday: number;
  emailsOpenedToday: number;
  emailsClickedToday: number;
  emailsRepliedToday: number;
  emailsBouncedToday: number;
  paidOrdersToday: number;
  revenueCentsToday: number;
  revenueCentsMtd: number;
  // Derived rates (computed client-side from above)
  openRate: number; // 0..1 of sent
  clickRate: number; // 0..1 of sent
  replyRate: number; // 0..1 of sent
  conversionRate: number; // 0..1 of clicked → paid
  // Lifetime (since project start) — used for the "All-time" panel
  scrapedAllTime: number;
  qualifiedAllTime: number;
  previewsAllTime: number;
  emailsSentAllTime: number;
  emailsDeliveredAllTime: number;
  emailsOpenedAllTime: number;
  emailsClickedAllTime: number;
  emailsRepliedAllTime: number;
  emailsBouncedAllTime: number;
  emailsComplainedAllTime: number;
  emailsUnsubscribedAllTime: number;
  uniqueRecipientsAllTime: number;
  paidOrdersAllTime: number;
  revenueCentsAllTime: number;
  openRateAllTime: number;
  clickRateAllTime: number;
  replyRateAllTime: number;
  bounceRateAllTime: number;
  deliveryRateAllTime: number;
}

export async function getFunnelMetrics(): Promise<FunnelMetrics> {
  const today = startOfTodayUTC();
  const mStart = startOfMonthUTC();

  const [[scraped]] = await Promise.all([
    db.select({ n: count() }).from(listings).where(gte(listings.createdAt, today)),
  ]);
  const [qualified] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(gte(listings.createdAt, today), eq(listings.qualified, true)));
  const [previewsN] = await db
    .select({ n: count() })
    .from(previews)
    .where(gte(previews.createdAt, today));
  const [emails] = await db
    .select({ n: count() })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.channel, "email"), gte(outreachEvents.createdAt, today)));
  const [opened] = await db
    .select({ n: count() })
    .from(outreachEvents)
    .where(
      and(eq(outreachEvents.channel, "email"), gte(outreachEvents.firstOpenedAt, today)),
    );
  const [clicked] = await db
    .select({ n: count() })
    .from(outreachEvents)
    .where(
      and(eq(outreachEvents.channel, "email"), gte(outreachEvents.firstClickedAt, today)),
    );
  const [replied] = await db
    .select({ n: count() })
    .from(outreachEvents)
    .where(
      and(eq(outreachEvents.channel, "email"), gte(outreachEvents.repliedAt, today)),
    );
  const [bounced] = await db
    .select({ n: count() })
    .from(outreachEvents)
    .where(
      and(
        eq(outreachEvents.channel, "email"),
        eq(outreachEvents.status, "bounced"),
        gte(outreachEvents.createdAt, today),
      ),
    );

  const [paidToday] = await db
    .select({
      n: count(),
      revenue: sql<number>`coalesce(sum(${orders.amountCents}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.paidAt, today)));

  const [paidMtd] = await db
    .select({ revenue: sql<number>`coalesce(sum(${orders.amountCents}), 0)` })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.paidAt, mStart)));

  const sent = Number(emails.n);
  const clickedN = Number(clicked.n);
  const paidN = Number(paidToday.n);

  // Lifetime aggregates — single round-trip per table
  const [scrapedAll] = await db.select({ n: count() }).from(listings);
  const [qualifiedAll] = await db
    .select({ n: count() })
    .from(listings)
    .where(eq(listings.qualified, true));
  const [previewsAll] = await db.select({ n: count() }).from(previews);
  const [emailAll] = await db
    .select({
      sent: count(),
      delivered: sql<number>`sum(case when status in ('delivered','opened','clicked','replied') then 1 else 0 end)`,
      opened: sql<number>`sum(case when first_opened_at is not null then 1 else 0 end)`,
      clicked: sql<number>`sum(case when first_clicked_at is not null then 1 else 0 end)`,
      replied: sql<number>`sum(case when replied_at is not null then 1 else 0 end)`,
      bounced: sql<number>`sum(case when status='bounced' then 1 else 0 end)`,
      complained: sql<number>`sum(case when status='complained' then 1 else 0 end)`,
      unsubscribed: sql<number>`sum(case when status='unsubscribed' then 1 else 0 end)`,
    })
    .from(outreachEvents)
    .where(eq(outreachEvents.channel, "email"));
  const [uniqueRecipients] = await db
    .select({ n: sql<number>`count(distinct ${listings.agentEmail})` })
    .from(outreachEvents)
    .innerJoin(listings, eq(outreachEvents.listingId, listings.id))
    .where(and(eq(outreachEvents.channel, "email"), sql`${listings.agentEmail} is not null`));
  const [orderAll] = await db
    .select({
      paid: sql<number>`sum(case when status='paid' then 1 else 0 end)`,
      revenue: sql<number>`coalesce(sum(case when status='paid' then amount_cents else 0 end), 0)`,
    })
    .from(orders);

  const sentAll = Number(emailAll.sent);
  const openedAll = Number(emailAll.opened ?? 0);
  const clickedAll = Number(emailAll.clicked ?? 0);
  const repliedAll = Number(emailAll.replied ?? 0);
  const bouncedAll = Number(emailAll.bounced ?? 0);
  const deliveredAll = Number(emailAll.delivered ?? 0);

  return {
    scrapedToday: Number(scraped.n),
    qualifiedToday: Number(qualified.n),
    previewsToday: Number(previewsN.n),
    emailsSentToday: sent,
    emailsOpenedToday: Number(opened.n),
    emailsClickedToday: clickedN,
    emailsRepliedToday: Number(replied.n),
    emailsBouncedToday: Number(bounced.n),
    paidOrdersToday: paidN,
    revenueCentsToday: Number(paidToday.revenue ?? 0),
    revenueCentsMtd: Number(paidMtd.revenue ?? 0),
    openRate: sent > 0 ? Number(opened.n) / sent : 0,
    clickRate: sent > 0 ? clickedN / sent : 0,
    replyRate: sent > 0 ? Number(replied.n) / sent : 0,
    conversionRate: clickedN > 0 ? paidN / clickedN : 0,
    scrapedAllTime: Number(scrapedAll.n),
    qualifiedAllTime: Number(qualifiedAll.n),
    previewsAllTime: Number(previewsAll.n),
    emailsSentAllTime: sentAll,
    emailsDeliveredAllTime: deliveredAll,
    emailsOpenedAllTime: openedAll,
    emailsClickedAllTime: clickedAll,
    emailsRepliedAllTime: repliedAll,
    emailsBouncedAllTime: bouncedAll,
    emailsComplainedAllTime: Number(emailAll.complained ?? 0),
    emailsUnsubscribedAllTime: Number(emailAll.unsubscribed ?? 0),
    uniqueRecipientsAllTime: Number(uniqueRecipients.n ?? 0),
    paidOrdersAllTime: Number(orderAll.paid ?? 0),
    revenueCentsAllTime: Number(orderAll.revenue ?? 0),
    openRateAllTime: sentAll > 0 ? openedAll / sentAll : 0,
    clickRateAllTime: sentAll > 0 ? clickedAll / sentAll : 0,
    replyRateAllTime: sentAll > 0 ? repliedAll / sentAll : 0,
    bounceRateAllTime: sentAll > 0 ? bouncedAll / sentAll : 0,
    deliveryRateAllTime: sentAll > 0 ? deliveredAll / sentAll : 0,
  };
}

// ============ Issues / hiccups ============

export interface IssuesMetrics {
  refundedOrdersToday: number;
  failedOrdersToday: number;
  fulfillingStuck: number; // orders in `fulfilling` for >2h
  unfulfilledPaidStuck: number; // paid for >2h, never started fulfilling
  highBounceDomains: string[];
}

export async function getIssuesMetrics(): Promise<IssuesMetrics> {
  const today = startOfTodayUTC();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const [refunded] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.status, "refunded"), gte(orders.createdAt, today)));
  const [failed] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.status, "failed"), gte(orders.createdAt, today)));
  const [stuck] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.status, "fulfilling"), sql`${orders.paidAt} < ${twoHoursAgo}`));
  const [unfulfilled] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.status, "paid"), sql`${orders.paidAt} < ${twoHoursAgo}`));

  // Sender domains with >5% bounce rate in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const bouncey = await db
    .select({
      domain: outreachEvents.senderDomain,
      total: count(),
      bounces: sql<number>`sum(case when status='bounced' then 1 else 0 end)`,
    })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.channel, "email"), gte(outreachEvents.createdAt, since)))
    .groupBy(outreachEvents.senderDomain);

  const highBounce = bouncey
    .filter((d) => Number(d.total) >= 20 && Number(d.bounces) / Number(d.total) > 0.05)
    .map((d) => d.domain ?? "(unknown)");

  return {
    refundedOrdersToday: Number(refunded.n),
    failedOrdersToday: Number(failed.n),
    fulfillingStuck: Number(stuck.n),
    unfulfilledPaidStuck: Number(unfulfilled.n),
    highBounceDomains: highBounce,
  };
}

export interface DeliverabilityMetrics {
  totalLast24h: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
  perDomain: {
    domain: string;
    total: number;
    bounces: number;
    complaints: number;
    unsubs: number;
  }[];
}

export async function getDeliverabilityMetrics(): Promise<DeliverabilityMetrics> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total] = await db
    .select({
      total: count(),
      bounces: sql<number>`sum(case when status='bounced' then 1 else 0 end)`,
      complaints: sql<number>`sum(case when status='complained' then 1 else 0 end)`,
      unsubs: sql<number>`sum(case when status='unsubscribed' then 1 else 0 end)`,
    })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.channel, "email"), gte(outreachEvents.createdAt, since)));

  const perDomain = await db
    .select({
      domain: outreachEvents.senderDomain,
      total: count(),
      bounces: sql<number>`sum(case when status='bounced' then 1 else 0 end)`,
      complaints: sql<number>`sum(case when status='complained' then 1 else 0 end)`,
      unsubs: sql<number>`sum(case when status='unsubscribed' then 1 else 0 end)`,
    })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.channel, "email"), gte(outreachEvents.createdAt, since)))
    .groupBy(outreachEvents.senderDomain);

  const t = Number(total.total ?? 0);
  return {
    totalLast24h: t,
    bounceRate: t > 0 ? Number(total.bounces ?? 0) / t : 0,
    complaintRate: t > 0 ? Number(total.complaints ?? 0) / t : 0,
    unsubscribeRate: t > 0 ? Number(total.unsubs ?? 0) / t : 0,
    perDomain: perDomain.map((r) => ({
      domain: r.domain ?? "(unknown)",
      total: Number(r.total),
      bounces: Number(r.bounces ?? 0),
      complaints: Number(r.complaints ?? 0),
      unsubs: Number(r.unsubs ?? 0),
    })),
  };
}

export interface AgentSpendRow {
  agent: string;
  todayCents: number;
}

export async function getTodayAgentSpend(): Promise<AgentSpendRow[]> {
  const date = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(agentCosts)
    .where(eq(agentCosts.date, date));
  return rows.map((r) => ({ agent: r.agent, todayCents: r.costCents }));
}
