/**
 * Tier-2 follow-up email — short, polite "checking back" send to the
 * 8 prospects who got Tier-2 outreach 24-48h ago. Threads the same
 * subject so it lands in the same conversation in Gmail/Outlook.
 *
 * Industry norm is 3-4 days between cold + follow-up; we're doing
 * 24-48h on operator override ("send follow-ups very often"). Risk:
 * faster cadence reads needier — accepted because the urgency is
 * Restay's, not the prospect's.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier2-followup.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier2-followup.ts
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

interface Tier2Prospect {
  handle: string;
  firstName: string;
  email: string;
  brand: string;
}

// Mirrors the prospects fired in send-tier2-batch.ts (subset of fields).
const PROSPECTS: Tier2Prospect[] = [
  { handle: "hosting-journey", firstName: "Evelyn", email: "evelyn@thehostingjourney.com", brand: "The Hosting Journey" },
  { handle: "str-lab", firstName: "Alisha", email: "hello@alishaarnold.com", brand: "STR Lab" },
  { handle: "bnb-mastery", firstName: "James", email: "james@bnbmastery.com", brand: "BNB Mastery" },
  { handle: "str-riches", firstName: "Tim", email: "tim@strriches.com", brand: "STR Riches" },
  { handle: "nastra", firstName: "team", email: "nastra2016@gmail.com", brand: "NASTRA" },
  { handle: "vacation-rental-success", firstName: "Heather", email: "heather@cottageblogger.com", brand: "Vacation Rental Success" },
  { handle: "boostly", firstName: "Mark", email: "mark@boostly.co.uk", brand: "Boostly" },
  { handle: "business-of-glamping", firstName: "Sarah", email: "sarah@inspiredcamping.com", brand: "Business of Glamping" },
];

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

// Match the original subject lines (they rotate by handle.length % 3) so the
// follow-up threads correctly in the prospect's inbox client.
const ORIGINAL_SUBJECTS = [
  "Quick partner-program intro — Restay (Airbnb optimization)",
  "$24/referral, paid Friday — Restay × your audience",
  "Restay × your audience — would there be fit?",
];

function buildFollowUp(p: Tier2Prospect): { subject: string; text: string; html: string } {
  const original = ORIGINAL_SUBJECTS[p.handle.length % ORIGINAL_SUBJECTS.length];
  const subject = `Re: ${original}`;
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

Quick bump — wanted to make sure my note didn't get buried.

Three things still on the table for ${p.brand}:

  1. Free Tune-Up on any listing you'd like to walk through (yours or one your audience flagged) — I ship it back personally, ~4 hours, no commitment to partner after.
  2. Co-branded grader page already provisioned at ${partnerLink} — paste your logo, share with your audience, attribute the leads back to you on the partner dashboard.
  3. 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe. No claw-back. Faster + bigger per-lead than PriceLabs (10%) or Hospitable (25%).

If now isn't right, totally fine to circle back in 3-6 months. If "no" full stop, just hit reply with "no" — I'd rather know.

— Jack
${APP_URL}/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>Quick bump — wanted to make sure my note didn't get buried.</p>
<p>Three things still on the table for <strong>${p.brand}</strong>:</p>
<ol>
<li><strong>Free Tune-Up</strong> on any listing you'd like to walk through (yours or one your audience flagged) — I ship it back personally, ~4 hours, no commitment to partner after.</li>
<li><strong>Co-branded grader page</strong> already provisioned at <a href="${partnerLink}">${partnerLink}</a> — paste your logo, share with your audience, attribute the leads back to you on the partner dashboard.</li>
<li><strong>30% commission</strong> ($24 per Tune-Up referred), paid Fridays via Stripe. No claw-back. Faster + bigger per-lead than PriceLabs (10%) or Hospitable (25%).</li>
</ol>
<p>If now isn't right, totally fine to circle back in 3-6 months. If "no" full stop, just hit reply with "no" — I'd rather know.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">${APP_URL.replace(/^https?:\/\//, "")}/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending Tier-2 follow-up to ${PROSPECTS.length} prospects from ${FROM}\n`);
  let sent = 0;
  let failed = 0;
  for (const p of PROSPECTS) {
    const { subject, text, html } = buildFollowUp(p);
    if (dryRun) {
      console.log(`[dry] ${p.handle.padEnd(28)} → ${p.email.padEnd(40)} [${subject.slice(0, 60)}]`);
      continue;
    }
    try {
      const r = await resend.emails.send({
        from: FROM,
        to: p.email,
        replyTo: REPLY_TO,
        subject,
        text,
        html,
        headers: { "Idempotency-Key": `tier2-followup-${p.handle}` },
        tags: [
          { name: "type", value: "tier2_followup" },
          { name: "handle", value: p.handle },
        ],
      });
      if (r.error) {
        console.error(`✗ ${p.handle}: ${r.error.message}`);
        failed++;
      } else {
        console.log(`✓ ${p.handle.padEnd(28)} → ${p.email}  (${r.data?.id})`);
        sent++;
      }
      await new Promise((r) => setTimeout(r, 2500));
    } catch (err) {
      console.error(`✗ ${p.handle}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }
  console.log(`\nSent: ${sent}, Failed: ${failed}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
