import { inngest } from "@/inngest/client";
import { Resend } from "resend";
import {
  db,
  listings,
  outreachEvents,
  outboundContactMessages,
  outboundContacts,
  directMailEvents,
  campaigns,
  orders,
  referrals,
} from "@/db";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Monday 13:00 UTC operator digest. One email summarizing every channel
 * from the past 7 days. Goal: the operator never has to log in to know
 * how the business is doing.
 *
 * Sections:
 *   - Revenue + funnel (listings → outreach sent → opened → replied → paid)
 *   - Paid channels (Meta + Google: spend, conv, CAC)
 *   - Direct mail (pieces + spend)
 *   - Sponsor outreach (sent / replied / won / archived + open replies)
 *   - Affiliate program (top codes by purchases)
 *
 * Skips silently when RESEND_API_KEY is missing.
 */
export const weeklyDigestFn = inngest.createFunction(
  {
    id: "weekly-digest",
    name: "Weekly digest — Monday operator summary",
    retries: 1,
  },
  [{ cron: "0 13 * * 1" }, { event: "weekly-digest/run" }],
  async () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { sent: false, reason: "RESEND_API_KEY missing" };
    const operator = process.env.OPERATOR_NOTIFY_EMAIL;
    if (!operator) return { sent: false, reason: "OPERATOR_NOTIFY_EMAIL missing" };

    const stats = await gatherStats();
    const { subject, bodyText } = renderText(stats);
    const fromDomain =
      process.env.RESEND_SEND_DOMAIN ?? "mail.example.com";
    const fromLocal = process.env.RESEND_FROM_LOCAL ?? "hello";
    const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";

    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from: `${brandName} Agent <${fromLocal}@${fromDomain}>`,
        to: operator,
        subject,
        text: bodyText,
        tags: [{ name: "kind", value: "weekly_digest" }],
      });
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
    }
  },
);

interface WeekStats {
  windowStart: string;
  windowEnd: string;
  newListings: number;
  outreachSent: number;
  outreachOpened: number;
  outreachReplied: number;
  ordersPaid: number;
  revenueUsd: number;
  metaSpend: number;
  metaConv: number;
  googleSpend: number;
  googleConv: number;
  postcardsSent: number;
  postcardsSpendUsd: number;
  sponsorSent: number;
  sponsorReplies: number;
  sponsorWon: number;
  sponsorArchived: number;
  sponsorOpen: Array<{ name: string; org: string }>;
  topAffiliates: Array<{ code: string; clicks: number; purchases: number; revenueUsd: number }>;
}

async function gatherStats(): Promise<WeekStats> {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 86_400_000);

  const [{ c: newListings }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(listings)
    .where(gte(listings.createdAt, start));

  const [{ c: outreachSent }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.status, "sent"), gte(outreachEvents.createdAt, start)));
  const [{ c: outreachOpened }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.status, "opened"), gte(outreachEvents.createdAt, start)));
  const [{ c: outreachReplied }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.status, "replied"), gte(outreachEvents.createdAt, start)));

  const [{ paid, revenueCents }] = await db
    .select({
      paid: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.amountCents}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.paidAt, start)));

  const allCampaigns = await db.select().from(campaigns);
  let metaSpend = 0;
  let metaConv = 0;
  let googleSpend = 0;
  let googleConv = 0;
  for (const c of allCampaigns) {
    if (c.platform === "meta") {
      metaSpend += (c.spentCents ?? 0) / 100;
      metaConv += c.conversionsCount ?? 0;
    } else if (c.platform === "google") {
      googleSpend += (c.spentCents ?? 0) / 100;
      googleConv += c.conversionsCount ?? 0;
    }
  }

  const dmRows = await db
    .select({ cost: directMailEvents.costCents })
    .from(directMailEvents)
    .where(
      and(eq(directMailEvents.status, "sent"), gte(directMailEvents.createdAt, start)),
    );
  const postcardsSent = dmRows.length;
  const postcardsSpendUsd = dmRows.reduce((s, r) => s + (r.cost ?? 0), 0) / 100;

  const [{ c: sponsorSent }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outboundContactMessages)
    .where(
      and(
        eq(outboundContactMessages.direction, "out"),
        eq(outboundContactMessages.status, "sent"),
        gte(outboundContactMessages.createdAt, start),
      ),
    );
  const [{ c: sponsorReplies }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outboundContactMessages)
    .where(
      and(
        eq(outboundContactMessages.direction, "in"),
        gte(outboundContactMessages.createdAt, start),
      ),
    );

  const allContacts = await db.select().from(outboundContacts);
  const sponsorWon = allContacts.filter((c) => c.status === "won").length;
  const sponsorArchived = allContacts.filter((c) => c.status === "archived").length;
  const sponsorOpen = allContacts
    .filter((c) => c.status === "replied")
    .slice(0, 5)
    .map((c) => ({ name: c.name ?? c.email, org: c.organization ?? c.email }));

  // Affiliate top 3 by purchases.
  const allRefs = await db.select().from(referrals);
  const agg = new Map<string, { clicks: number; purchases: number; revenueCents: number }>();
  for (const r of allRefs) {
    const a = agg.get(r.code) ?? { clicks: 0, purchases: 0, revenueCents: 0 };
    if (r.status === "clicked") a.clicks += 1;
    if (r.status === "purchased") {
      a.purchases += 1;
      a.revenueCents += r.amountCents ?? 0;
    }
    agg.set(r.code, a);
  }
  const topAffiliates = [...agg.entries()]
    .sort(([, a], [, b]) => b.purchases - a.purchases)
    .slice(0, 3)
    .map(([code, a]) => ({
      code,
      clicks: a.clicks,
      purchases: a.purchases,
      revenueUsd: a.revenueCents / 100,
    }));

  return {
    windowStart: start.toISOString().slice(0, 10),
    windowEnd: now.toISOString().slice(0, 10),
    newListings: Number(newListings ?? 0),
    outreachSent: Number(outreachSent ?? 0),
    outreachOpened: Number(outreachOpened ?? 0),
    outreachReplied: Number(outreachReplied ?? 0),
    ordersPaid: Number(paid ?? 0),
    revenueUsd: Number(revenueCents ?? 0) / 100,
    metaSpend,
    metaConv,
    googleSpend,
    googleConv,
    postcardsSent,
    postcardsSpendUsd,
    sponsorSent: Number(sponsorSent ?? 0),
    sponsorReplies: Number(sponsorReplies ?? 0),
    sponsorWon,
    sponsorArchived,
    sponsorOpen,
    topAffiliates,
  };
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function renderText(s: WeekStats): { subject: string; bodyText: string } {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").replace(/\/$/, "");
  const cac = (spend: number, conv: number): string =>
    conv > 0 ? fmtUsd(spend / conv) : "n/a";
  const openRate =
    s.outreachSent > 0 ? Math.round((s.outreachOpened / s.outreachSent) * 1000) / 10 : 0;
  const replyRate =
    s.outreachSent > 0 ? Math.round((s.outreachReplied / s.outreachSent) * 1000) / 10 : 0;

  const subject = `📊 ${brandName} week — ${fmtUsd(s.revenueUsd)} revenue, ${s.ordersPaid} sales (${s.windowStart} → ${s.windowEnd})`;

  const bodyText = `${brandName} weekly digest · ${s.windowStart} → ${s.windowEnd}

================================================================
REVENUE & FUNNEL
================================================================
Sales:                ${s.ordersPaid}    Revenue: ${fmtUsd(s.revenueUsd)}
New listings:         ${s.newListings}
Outreach sent:        ${s.outreachSent}
Open rate:            ${openRate}%   (${s.outreachOpened} opens)
Reply rate:           ${replyRate}%   (${s.outreachReplied} replies)

================================================================
PAID CHANNELS
================================================================
Meta Ads:             ${fmtUsd(s.metaSpend)} spend, ${s.metaConv} conv → CAC ${cac(s.metaSpend, s.metaConv)}
Google Ads:           ${fmtUsd(s.googleSpend)} spend, ${s.googleConv} conv → CAC ${cac(s.googleSpend, s.googleConv)}
Direct mail:          ${s.postcardsSent} postcards, ${fmtUsd(s.postcardsSpendUsd)}

================================================================
SPONSOR OUTREACH
================================================================
Pitches sent:         ${s.sponsorSent}
Replies received:     ${s.sponsorReplies}
Status — won:         ${s.sponsorWon}
Status — archived:    ${s.sponsorArchived}

${
  s.sponsorOpen.length > 0
    ? `Outstanding replies (need your eyeballs):
${s.sponsorOpen.map((r) => `  • ${r.name} — ${r.org}`).join("\n")}

Reply at: ${appUrl}/admin/outreach`
    : "No outstanding sponsor replies need attention."
}

================================================================
AFFILIATE PROGRAM
================================================================
${
  s.topAffiliates.length === 0
    ? "No affiliate activity yet."
    : s.topAffiliates
        .map(
          (a) =>
            `  ${a.code.padEnd(12)}  ${a.clicks} clicks · ${a.purchases} sales · ${fmtUsd(a.revenueUsd)}`,
        )
        .join("\n")
}

Full dashboard: ${appUrl}/admin
Sponsor inbox:  ${appUrl}/admin/outreach
Referrals:      ${appUrl}/admin/referrals

— ${brandName} Agent`;

  return { subject, bodyText };
}
