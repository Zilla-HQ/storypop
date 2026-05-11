/**
 * Tier-5 cold-email batch — 16 STR realtors + boutique PMs + small
 * coaches. Sub-agent researched 2026-05-07 round 3.
 *
 * Distinct angle from prior tiers: realtors close STR-friendly
 * properties and need listing setup for clients post-close; PMs
 * onboard new properties weekly; coaches teach students who launch
 * units. Restay is the $79 listing-side handoff for all three.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier5-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier5-batch.ts
 */
import { Resend } from "resend";
import { TIER_5_PROSPECTS } from "@/lib/outreach";
import { env } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

const SUBJECT_VARIANTS = [
  "Quick partner intro — Restay (listing setup for your clients)",
  "$24/referral on every new-property listing — Restay × you",
  "Restay × your clients — would there be fit?",
];

function buildBody(p: { handle: string; firstName: string; brand: string; hook: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subjectIdx = p.handle.length % SUBJECT_VARIANTS.length;
  const subject = SUBJECT_VARIANTS[subjectIdx];
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

${p.hook}

Quick intro — I'm Jack, founder of Restay (restay.agency). We sell a $79 one-time Airbnb Tune-Up: rewritten title + description, 10 restyled photos, 30-day pricing report. Delivered in under 4 hours. Free 0-100 grader at restay.agency/grade.

For ${p.brand}, the angle:
  · Hand off ${p.brand}'s new-property closings / onboardings to Restay for listing setup. $79/property.
  · 30% commission ($24/lead, paid Fridays via Stripe, no claw-back).
  · Co-branded grader + landing page already provisioned: ${partnerLink}
  · Custom higher-volume rates if you'd refer 5+/month.

Free demo offer: I'll ship a free Tune-Up on whichever property you'd like — yours, a current client's, a recent close. Output back to you in 4 hours.

— Jack
${APP_URL}/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>${p.hook}</p>
<p>Quick intro — I'm Jack, founder of <strong>Restay</strong> (<a href="${APP_URL}">restay.agency</a>). We sell a $79 one-time Airbnb Tune-Up: rewritten title + description, 10 restyled photos, 30-day pricing report. Delivered in under 4 hours. Free 0-100 grader at <a href="${APP_URL}/grade">restay.agency/grade</a>.</p>
<p>For <strong>${p.brand}</strong>, the angle:</p>
<ul>
<li>Hand off new-property closings / onboardings to Restay for listing setup ($79/property)</li>
<li><strong>30% commission</strong> ($24/lead, paid Fridays via Stripe, no claw-back)</li>
<li>Co-branded grader + landing page already provisioned: <a href="${partnerLink}">${partnerLink}</a></li>
<li>Custom higher-volume rates if you'd refer 5+/month</li>
</ul>
<p><strong>Free demo offer:</strong> I'll ship a free Tune-Up on whichever property you'd like — output back to you in 4 hours, no commitment.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending to ${TIER_5_PROSPECTS.length} Tier-5 prospects from ${FROM}`);
  const unverified = TIER_5_PROSPECTS.filter((p) => p.unverified).length;
  if (unverified > 0) console.log(`  (${unverified} unverified — may bounce)\n`);

  let sent = 0;
  let failed = 0;
  for (const p of TIER_5_PROSPECTS) {
    const { subject, text, html } = buildBody(p);
    if (dryRun) {
      console.log(`[dry] ${p.handle.padEnd(28)} → ${p.email.padEnd(40)} ${p.unverified ? "[UNVERIFIED]" : ""}`);
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
        headers: { "Idempotency-Key": `tier5-${p.handle}` },
        tags: [
          { name: "type", value: "tier5_outreach" },
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
