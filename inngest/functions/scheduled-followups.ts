/**
 * Scheduled cold-outreach follow-ups. Triggered by a one-shot event,
 * the function sleeps until the configured fire-time, then sends the
 * follow-up batch via Resend with idempotency keys (so re-firing the
 * trigger event is a no-op).
 *
 * Why Inngest sleepUntil and not OS cron / Vercel Cron: Vercel Crons
 * can't address a future-only-once schedule cleanly, and the
 * sleepUntil pattern survives Inngest worker restarts.
 *
 * Usage:
 *   import { inngest } from "@/inngest/client";
 *   await inngest.send({
 *     name: "outreach/schedule-tier1-followup",
 *     data: { fireAt: "2026-05-09T21:00:00Z" },
 *   });
 *
 * Then it'll fire automatically when the time arrives.
 */
import { inngest } from "@/inngest/client";
import { Resend } from "resend";
import { TIER_1 } from "@/lib/outreach";
import { TIER_3_PROSPECTS, TIER_4_PROSPECTS, TIER_5_PROSPECTS, TIER_6_PROSPECTS } from "@/lib/outreach";
import { env } from "@/lib/env";

const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY");
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

function buildBreakUp(d: { id: string; name: string; subject: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = d.name.split(/[\s+/]/)[0];
  const subject = `Re: ${d.subject}`;
  const text = `Hey ${firstName},

Last note from me, promise.

Closing the loop on Restay — if there's never a fit, no problem. If something changes (audience asks about listing optimization, you want to walk through a specific listing on the show, audit angle for a video), my line is open.

The free grader stays free permanently — ${APP_URL}/grade — so feel free to use it personally any time without thinking of me.

— Jack
${APP_URL}
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${firstName},</p>
<p>Last note from me, promise.</p>
<p>Closing the loop on Restay — if there's never a fit, no problem. If something changes (audience asks about listing optimization, you want to walk through a specific listing on the show, audit angle for a video), my line is open.</p>
<p>The free grader stays free permanently — <a href="${APP_URL}/grade">restay.agency/grade</a> — so feel free to use it personally any time without thinking of me.</p>
<p>— Jack<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`;
  return { subject, text, html };
}

function buildFollowUp(d: { id: string; name: string; subject: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = d.name.split(/[\s+/]/)[0];
  const subject = `Re: ${d.subject}`;
  const text = `Hey ${firstName},

Quick bump — wanted to make sure my note didn't get buried.

Same offer if any of it caught your eye:

  · I'll send a free Tune-Up on whichever listing you'd like — yours or one of your audience members'. Reply with a URL, output back to you tonight.
  · Standard partner program is 30% / $24 per Tune-Up referral, paid Fridays. No claw-back.
  · Free public grader at ${APP_URL}/grade if you want to kick the tires first.

If now isn't right, totally fine to circle back later. If "no" full stop, hit reply with one word and I'll stop chasing.

— Jack
${APP_URL}/partners
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${firstName},</p>
<p>Quick bump — wanted to make sure my note didn't get buried.</p>
<p>Same offer if any of it caught your eye:</p>
<ul>
<li>I'll send a <strong>free Tune-Up</strong> on whichever listing you'd like — yours or one of your audience members'. Reply with a URL, output back to you tonight.</li>
<li>Standard partner program is <strong>30% / $24 per Tune-Up referral, paid Fridays</strong>. No claw-back.</li>
<li>Free public grader at <a href="${APP_URL}/grade">restay.agency/grade</a> if you want to kick the tires first.</li>
</ul>
<p>If now isn't right, totally fine to circle back later. If "no" full stop, hit reply with one word and I'll stop chasing.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;
  return { subject, text, html };
}

export const scheduleTier1FollowupFn = inngest.createFunction(
  {
    id: "schedule-tier1-followup",
    name: "Schedule Tier-1 follow-up batch",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier1-followup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");

    await step.sleepUntil("wait-for-followup-time", new Date(fireAt));

    if (!resend) {
      logger.warn("[scheduled-followups] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }

    const sendable = TIER_1.filter((d) => d.to);
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];

    for (const d of sendable) {
      const { subject, text, html } = buildFollowUp(d);
      const result = await step.run(`send-${d.id}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: d.to!,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier1-followup-${d.id}` },
            tags: [
              { name: "type", value: "tier1_followup" },
              { name: "handle", value: d.id },
            ],
          });
          if (r.error) return { id: d.id, status: "failed" as const, error: r.error.message };
          return { id: d.id, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: d.id, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }

    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

export const scheduleTier1BreakupFn = inngest.createFunction(
  {
    id: "schedule-tier1-breakup",
    name: "Schedule Tier-1 break-up (touch #3)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier1-breakup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-breakup-time", new Date(fireAt));
    if (!resend) {
      logger.warn("[scheduled-followups] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const sendable = TIER_1.filter((d) => d.to);
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const d of sendable) {
      const { subject, text, html } = buildBreakUp(d);
      const result = await step.run(`send-${d.id}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: d.to!,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier1-breakup-${d.id}` },
            tags: [
              { name: "type", value: "tier1_breakup" },
              { name: "handle", value: d.id },
            ],
          });
          if (r.error) return { id: d.id, status: "failed" as const, error: r.error.message };
          return { id: d.id, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: d.id, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

const TIER_2_PROSPECTS = [
  { id: "hosting-journey", name: "Evelyn Badia", email: "evelyn@thehostingjourney.com", subject: "Quick partner-program intro — Restay (Airbnb optimization)" },
  { id: "str-lab", name: "Alisha Arnold", email: "hello@alishaarnold.com", subject: "$24/referral, paid Friday — Restay × your audience" },
  { id: "bnb-mastery", name: "James Svetec", email: "james@bnbmastery.com", subject: "Restay × your audience — would there be fit?" },
  { id: "str-riches", name: "Tim Hubbard", email: "tim@strriches.com", subject: "$24/referral, paid Friday — Restay × your audience" },
  { id: "nastra", name: "team", email: "nastra2016@gmail.com", subject: "Quick partner-program intro — Restay (Airbnb optimization)" },
  { id: "vacation-rental-success", name: "Heather Bayer", email: "heather@cottageblogger.com", subject: "Restay × your audience — would there be fit?" },
  { id: "boostly", name: "Mark Simpson", email: "mark@boostly.co.uk", subject: "$24/referral, paid Friday — Restay × your audience" },
  { id: "business-of-glamping", name: "Sarah Riley", email: "sarah@inspiredcamping.com", subject: "Restay × your audience — would there be fit?" },
];

// ─── Tier-3: bump (day 2) + break-up (day 5) ─────────────────────────────

function buildTier3Followup(p: { firstName: string; brand: string; handle: string }): {
  subject: string;
  text: string;
  html: string;
} {
  // Mirror the original subject rotation in send-tier3-batch.ts so this threads.
  const SUBJECTS = [
    "Quick partner-program intro — Restay (Airbnb optimization)",
    "$24/referral, paid Friday — Restay × your audience",
    "Restay × your audience — would there be fit?",
  ];
  const original = SUBJECTS[p.handle.length % SUBJECTS.length];
  const subject = `Re: ${original}`;
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

Quick bump — wanted to make sure my note didn't get buried.

Three things still on the table for ${p.brand}:

  1. Free Tune-Up on any listing you'd like to walk through — yours or one your audience flagged. ~4-hour turnaround, no commitment.
  2. Co-branded grader page already provisioned at ${partnerLink} — paste your logo, share with your audience.
  3. 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe. No claw-back. Faster + bigger per-lead than PriceLabs (10%) or Hospitable (25%).

If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.

— Jack
${APP_URL}/partners
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>Quick bump — wanted to make sure my note didn't get buried.</p>
<p>Three things still on the table for <strong>${p.brand}</strong>:</p>
<ol>
<li><strong>Free Tune-Up</strong> on any listing you'd like to walk through — yours or one your audience flagged. ~4-hour turnaround, no commitment.</li>
<li><strong>Co-branded grader page</strong> at <a href="${partnerLink}">${partnerLink}</a> — paste your logo, share with your audience.</li>
<li><strong>30% commission</strong> ($24 per Tune-Up referred), paid Fridays via Stripe.</li>
</ol>
<p>If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;
  return { subject, text, html };
}

function buildTier3BreakUp(p: { firstName: string; handle: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const SUBJECTS = [
    "Quick partner-program intro — Restay (Airbnb optimization)",
    "$24/referral, paid Friday — Restay × your audience",
    "Restay × your audience — would there be fit?",
  ];
  const original = SUBJECTS[p.handle.length % SUBJECTS.length];
  return {
    subject: `Re: ${original}`,
    text: `Hey ${p.firstName},

Last note from me, promise.

Closing the loop on Restay — if there's never a fit, no problem. If something changes (audience asks about listing optimization, you want to walk through a specific listing on the show), my line is open.

The free grader stays free permanently — ${APP_URL}/grade — feel free to use it personally any time.

— Jack
${APP_URL}
`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>Last note from me, promise.</p>
<p>Closing the loop on Restay — if there's never a fit, no problem. If something changes (audience asks about listing optimization, you want to walk through a specific listing on the show), my line is open.</p>
<p>The free grader stays free permanently — <a href="${APP_URL}/grade">restay.agency/grade</a> — feel free to use it personally any time.</p>
<p>— Jack<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`,
  };
}

export const scheduleTier3FollowupFn = inngest.createFunction(
  {
    id: "schedule-tier3-followup",
    name: "Schedule Tier-3 follow-up (touch #2)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier3-followup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-tier3-followup", new Date(fireAt));
    if (!resend) {
      logger.warn("[tier3-followup] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const p of TIER_3_PROSPECTS) {
      const { subject, text, html } = buildTier3Followup(p);
      const result = await step.run(`send-${p.handle}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: p.email,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier3-followup-${p.handle}` },
            tags: [
              { name: "type", value: "tier3_followup" },
              { name: "handle", value: p.handle },
            ],
          });
          if (r.error) return { id: p.handle, status: "failed" as const, error: r.error.message };
          return { id: p.handle, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: p.handle, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

export const scheduleTier3BreakupFn = inngest.createFunction(
  {
    id: "schedule-tier3-breakup",
    name: "Schedule Tier-3 break-up (touch #3)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier3-breakup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-tier3-breakup", new Date(fireAt));
    if (!resend) {
      logger.warn("[tier3-breakup] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const p of TIER_3_PROSPECTS) {
      const { subject, text, html } = buildTier3BreakUp(p);
      const result = await step.run(`send-${p.handle}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: p.email,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier3-breakup-${p.handle}` },
            tags: [
              { name: "type", value: "tier3_breakup" },
              { name: "handle", value: p.handle },
            ],
          });
          if (r.error) return { id: p.handle, status: "failed" as const, error: r.error.message };
          return { id: p.handle, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: p.handle, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

// ─── Tier-4: bump (day 2) + break-up (day 5) ─────────────────────────────

function buildTier4Followup(p: { firstName: string; brand: string; handle: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const SUBJECTS = [
    "Quick partner intro — Restay (we slot in next to your product)",
    "Co-marketing fit? Restay × your hosts",
    "$24/host referral — Restay × your customer base",
  ];
  const original = SUBJECTS[p.handle.length % SUBJECTS.length];
  const subject = `Re: ${original}`;
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

Quick bump — wanted to make sure my note didn't get buried.

Three angles still on the table for ${p.brand}:

  1. Free Tune-Up demo on a property of your choice — yours, a customer's, a partner's. Output back to you in 4 hours, no commitment.
  2. Co-branded grader page already provisioned at ${partnerLink} — use it as a 1-click upsell during your customer onboarding.
  3. 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe. No claw-back.

If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.

— Jack
${APP_URL}/partners
`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>Quick bump — wanted to make sure my note didn't get buried.</p>
<p>Three angles still on the table for <strong>${p.brand}</strong>:</p>
<ol>
<li><strong>Free Tune-Up demo</strong> on a property of your choice. ~4-hour turnaround, no commitment.</li>
<li><strong>Co-branded grader page</strong> at <a href="${partnerLink}">${partnerLink}</a> — use it as a 1-click upsell during customer onboarding.</li>
<li><strong>30% commission</strong> ($24 per Tune-Up referred), paid Fridays via Stripe.</li>
</ol>
<p>If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;
  return { subject, text, html };
}

function buildTier4BreakUp(p: { firstName: string; handle: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const SUBJECTS = [
    "Quick partner intro — Restay (we slot in next to your product)",
    "Co-marketing fit? Restay × your hosts",
    "$24/host referral — Restay × your customer base",
  ];
  const original = SUBJECTS[p.handle.length % SUBJECTS.length];
  return {
    subject: `Re: ${original}`,
    text: `Hey ${p.firstName},

Last note from me, promise.

Closing the loop on Restay — if there's no fit on the partnership angle, no problem. If something changes (your customers ask about listing photos, you launch a new program, you want a free Tune-Up demo), my line is open.

The free grader stays free permanently — ${APP_URL}/grade — feel free to use it anytime.

— Jack
${APP_URL}
`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>Last note from me, promise.</p>
<p>Closing the loop on Restay — if there's no fit on the partnership angle, no problem. If something changes (your customers ask about listing photos, you launch a new program, you want a free Tune-Up demo), my line is open.</p>
<p>The free grader stays free permanently — <a href="${APP_URL}/grade">restay.agency/grade</a> — feel free to use it anytime.</p>
<p>— Jack<br/><a href="${APP_URL}" style="color:#475569;">restay.agency</a></p>
</body></html>`,
  };
}

export const scheduleTier4FollowupFn = inngest.createFunction(
  {
    id: "schedule-tier4-followup",
    name: "Schedule Tier-4 follow-up (touch #2)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier4-followup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-tier4-followup", new Date(fireAt));
    if (!resend) {
      logger.warn("[tier4-followup] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const p of TIER_4_PROSPECTS) {
      const { subject, text, html } = buildTier4Followup(p);
      const result = await step.run(`send-${p.handle}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: p.email,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier4-followup-${p.handle}` },
            tags: [
              { name: "type", value: "tier4_followup" },
              { name: "handle", value: p.handle },
            ],
          });
          if (r.error) return { id: p.handle, status: "failed" as const, error: r.error.message };
          return { id: p.handle, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: p.handle, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

export const scheduleTier4BreakupFn = inngest.createFunction(
  {
    id: "schedule-tier4-breakup",
    name: "Schedule Tier-4 break-up (touch #3)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier4-breakup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-tier4-breakup", new Date(fireAt));
    if (!resend) {
      logger.warn("[tier4-breakup] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const p of TIER_4_PROSPECTS) {
      const { subject, text, html } = buildTier4BreakUp(p);
      const result = await step.run(`send-${p.handle}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: p.email,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier4-breakup-${p.handle}` },
            tags: [
              { name: "type", value: "tier4_breakup" },
              { name: "handle", value: p.handle },
            ],
          });
          if (r.error) return { id: p.handle, status: "failed" as const, error: r.error.message };
          return { id: p.handle, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: p.handle, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

export const scheduleTier2BreakupFn = inngest.createFunction(
  {
    id: "schedule-tier2-breakup",
    name: "Schedule Tier-2 break-up (touch #3)",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: "outreach/schedule-tier2-breakup" },
  async ({ event, step, logger }) => {
    const fireAt = event.data?.fireAt as string | undefined;
    if (!fireAt) throw new Error("missing event.data.fireAt");
    await step.sleepUntil("wait-for-breakup-time", new Date(fireAt));
    if (!resend) {
      logger.warn("[scheduled-followups] no RESEND_API_KEY — skipping");
      return { skipped: "no-resend-key" };
    }
    const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
    for (const p of TIER_2_PROSPECTS) {
      const { subject, text, html } = buildBreakUp(p);
      const result = await step.run(`send-${p.id}`, async () => {
        try {
          const r = await resend!.emails.send({
            from: FROM,
            to: p.email,
            replyTo: REPLY_TO,
            subject,
            text,
            html,
            headers: { "Idempotency-Key": `tier2-breakup-${p.id}` },
            tags: [
              { name: "type", value: "tier2_breakup" },
              { name: "handle", value: p.id },
            ],
          });
          if (r.error) return { id: p.id, status: "failed" as const, error: r.error.message };
          return { id: p.id, status: "sent" as const, resendId: r.data?.id };
        } catch (err) {
          return { id: p.id, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }
    return {
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  },
);

// ─── Tier-5 + Tier-6: bump (day 2) + break-up (day 5) ────────────────────

const TIER_5_SUBJECTS = [
  "Quick partner intro — Restay (listing setup for your clients)",
  "$24/referral on every new-property listing — Restay × you",
  "Restay × your clients — would there be fit?",
];

const TIER_6_SUBJECTS = [
  "Quick partner-program intro — Restay (Airbnb optimization)",
  "$24/referral, paid Friday — Restay × your audience",
  "Restay × your audience — would there be fit?",
];

function buildGenericFollowup(p: { firstName: string; brand: string; handle: string }, originalSubjects: string[]): {
  subject: string;
  text: string;
  html: string;
} {
  const original = originalSubjects[p.handle.length % originalSubjects.length];
  const subject = `Re: ${original}`;
  const partnerLink = `${APP_URL}/p/${p.handle}`;
  const text = `Hey ${p.firstName},

Quick bump — wanted to make sure my note didn't get buried.

Three things still on the table for ${p.brand}:

  1. Free Tune-Up demo on whichever listing you'd like — output back to you in 4 hours, no commitment.
  2. Co-branded grader page already provisioned at ${partnerLink}
  3. 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe. No claw-back.

If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.

— Jack
${APP_URL}/partners
`;
  const html = `<p>Hey ${p.firstName},</p><p>Quick bump — wanted to make sure my note didn't get buried.</p><p>Three things still on the table for <strong>${p.brand}</strong>:</p><ol><li><strong>Free Tune-Up demo</strong> — output back to you in 4 hours, no commitment.</li><li><strong>Co-branded grader page</strong> at <a href="${partnerLink}">${partnerLink}</a></li><li><strong>30% commission</strong> ($24 per Tune-Up referred), paid Fridays via Stripe.</li></ol><p>If now isn't right, totally fine. If "no" full stop, hit reply with one word and I'll stop chasing.</p><p>— Jack<br/><a href="${APP_URL}/partners">restay.agency/partners</a></p>`;
  return { subject, text, html };
}

function buildGenericBreakUp(p: { firstName: string; handle: string }, originalSubjects: string[]): {
  subject: string;
  text: string;
  html: string;
} {
  const original = originalSubjects[p.handle.length % originalSubjects.length];
  return {
    subject: `Re: ${original}`,
    text: `Hey ${p.firstName},\n\nLast note from me, promise.\n\nClosing the loop on Restay — if there's no fit, no problem. If something changes, my line is open.\n\nThe free grader stays free permanently — ${APP_URL}/grade — feel free to use it anytime.\n\n— Jack\n${APP_URL}\n`,
    html: `<p>Hey ${p.firstName},</p><p>Last note from me, promise.</p><p>Closing the loop on Restay — if there's no fit, no problem. If something changes, my line is open.</p><p>The free grader stays free permanently — <a href="${APP_URL}/grade">restay.agency/grade</a> — feel free to use it anytime.</p><p>— Jack<br/><a href="${APP_URL}">restay.agency</a></p>`,
  };
}

function makeScheduledSendFn<E extends "outreach/schedule-tier5-followup" | "outreach/schedule-tier5-breakup" | "outreach/schedule-tier6-followup" | "outreach/schedule-tier6-breakup">(opts: {
  id: string;
  name: string;
  event: E;
  prospects: { handle: string; firstName: string; email: string; brand: string }[];
  build: (p: { handle: string; firstName: string; brand: string }) => { subject: string; text: string; html: string };
  tagType: string;
  idempotencyPrefix: string;
}) {
  return inngest.createFunction(
    { id: opts.id, name: opts.name, concurrency: { limit: 1 }, retries: 2 },
    { event: opts.event },
    async ({ event, step, logger }) => {
      const fireAt = event.data?.fireAt as string | undefined;
      if (!fireAt) throw new Error("missing event.data.fireAt");
      await step.sleepUntil(`wait-${opts.id}`, new Date(fireAt));
      if (!resend) {
        logger.warn(`[${opts.id}] no RESEND_API_KEY — skipping`);
        return { skipped: "no-resend-key" };
      }
      const results: { id: string; status: "sent" | "failed"; resendId?: string; error?: string }[] = [];
      for (const p of opts.prospects) {
        const { subject, text, html } = opts.build(p);
        const result = await step.run(`send-${p.handle}`, async () => {
          try {
            const r = await resend!.emails.send({
              from: FROM,
              to: p.email,
              replyTo: REPLY_TO,
              subject,
              text,
              html,
              headers: { "Idempotency-Key": `${opts.idempotencyPrefix}-${p.handle}` },
              tags: [
                { name: "type", value: opts.tagType },
                { name: "handle", value: p.handle },
              ],
            });
            if (r.error) return { id: p.handle, status: "failed" as const, error: r.error.message };
            return { id: p.handle, status: "sent" as const, resendId: r.data?.id };
          } catch (err) {
            return { id: p.handle, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
          }
        });
        results.push(result);
      }
      return {
        sent: results.filter((r) => r.status === "sent").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      };
    },
  );
}

export const scheduleTier5FollowupFn = makeScheduledSendFn({
  id: "schedule-tier5-followup",
  name: "Schedule Tier-5 follow-up (touch #2)",
  event: "outreach/schedule-tier5-followup",
  prospects: TIER_5_PROSPECTS,
  build: (p) => buildGenericFollowup(p, TIER_5_SUBJECTS),
  tagType: "tier5_followup",
  idempotencyPrefix: "tier5-followup",
});

export const scheduleTier5BreakupFn = makeScheduledSendFn({
  id: "schedule-tier5-breakup",
  name: "Schedule Tier-5 break-up (touch #3)",
  event: "outreach/schedule-tier5-breakup",
  prospects: TIER_5_PROSPECTS,
  build: (p) => buildGenericBreakUp(p, TIER_5_SUBJECTS),
  tagType: "tier5_breakup",
  idempotencyPrefix: "tier5-breakup",
});

export const scheduleTier6FollowupFn = makeScheduledSendFn({
  id: "schedule-tier6-followup",
  name: "Schedule Tier-6 follow-up (touch #2)",
  event: "outreach/schedule-tier6-followup",
  prospects: TIER_6_PROSPECTS,
  build: (p) => buildGenericFollowup(p, TIER_6_SUBJECTS),
  tagType: "tier6_followup",
  idempotencyPrefix: "tier6-followup",
});

export const scheduleTier6BreakupFn = makeScheduledSendFn({
  id: "schedule-tier6-breakup",
  name: "Schedule Tier-6 break-up (touch #3)",
  event: "outreach/schedule-tier6-breakup",
  prospects: TIER_6_PROSPECTS,
  build: (p) => buildGenericBreakUp(p, TIER_6_SUBJECTS),
  tagType: "tier6_breakup",
  idempotencyPrefix: "tier6-breakup",
});
