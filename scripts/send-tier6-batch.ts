/**
 * Tier-6 cold-email batch — 17 small STR media operators (design-IG
 * creators, niche Substack writers, micro-podcasters covering tiny-
 * homes, glamping, MTR, RV). Sub-agent researched 2026-05-07 round 4.
 *
 * Distinct angle from Tier-1/2/3: smaller audiences mean these are
 * sponsorship-receptive (cheaper ad slots), and creators are typically
 * more responsive to cold outreach because they want sponsors. The
 * pitch leans into "$24/sale referral" + "happy to be a recurring
 * sponsor segment" framing.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier6-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier6-batch.ts
 */
import { Resend } from "resend";
import { TIER_6_PROSPECTS } from "@/lib/outreach";
import { env } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

const SUBJECT_VARIANTS = [
  "Quick partner-program intro — Restay (Airbnb optimization)",
  "$24/referral, paid Friday — Restay × your audience",
  "Restay × your audience — would there be fit?",
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

Quick intro — I'm Jack, founder of Restay (restay.agency). $79 one-time Airbnb Tune-Up: rewrites copy + restyles 10 photos + ships a 30-day pricing report, delivered in 4 hours. Free public grader at restay.agency/grade.

For ${p.brand}, the angle:
  · 30% rev share — $24 per Tune-Up referred, paid Fridays via Stripe
  · Recurring sponsor slot if it makes sense (open to creative formats)
  · Co-branded grader page already provisioned: ${partnerLink}
  · Free Tune-Up demo on whichever listing you'd like — yours or one your audience flagged

Your audience size doesn't need to match Robuilt's for this to work — Restay actually converts BETTER on smaller, more-engaged audiences than top-of-pile ones, because the recommendation feels personal.

Reply with any Airbnb URL and I'll have free output back to you in 4 hours.

— Jack
${APP_URL}/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>${p.hook}</p>
<p>Quick intro — I'm Jack, founder of <strong>Restay</strong> (<a href="${APP_URL}">restay.agency</a>). $79 one-time Airbnb Tune-Up: rewrites copy + restyles 10 photos + ships a 30-day pricing report, delivered in 4 hours. Free public grader at <a href="${APP_URL}/grade">restay.agency/grade</a>.</p>
<p>For <strong>${p.brand}</strong>, the angle:</p>
<ul>
<li><strong>30% rev share</strong> — $24 per Tune-Up referred, paid Fridays via Stripe</li>
<li>Recurring sponsor slot if it makes sense (open to creative formats)</li>
<li>Co-branded grader page already provisioned: <a href="${partnerLink}">${partnerLink}</a></li>
<li>Free Tune-Up demo on whichever listing you'd like</li>
</ul>
<p>Your audience size doesn't need to match Robuilt's for this to work — Restay actually converts <strong>better</strong> on smaller, more-engaged audiences than top-of-pile ones, because the recommendation feels personal.</p>
<p><strong>Reply with any Airbnb URL</strong> and I'll have free output back to you in 4 hours.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending to ${TIER_6_PROSPECTS.length} Tier-6 prospects from ${FROM}`);
  const unverified = TIER_6_PROSPECTS.filter((p) => p.unverified).length;
  if (unverified > 0) console.log(`  (${unverified} unverified — may bounce)\n`);

  let sent = 0;
  let failed = 0;
  for (const p of TIER_6_PROSPECTS) {
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
        headers: { "Idempotency-Key": `tier6-${p.handle}` },
        tags: [
          { name: "type", value: "tier6_outreach" },
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
