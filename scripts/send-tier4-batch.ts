/**
 * Tier-4 cold-email batch — 15 STR-adjacency prospects (insurance,
 * smart-locks, design/furnishing, coaching, CPA, cleaning marketplaces).
 * Sub-agent researched 2026-05-07. Each prospect owns a host
 * relationship adjacent to listing optimization without competing.
 *
 * 7 of 15 are tagged \`unverified\` — emails follow company format but
 * weren't visible on a public page. Will know within 24h if any bounce.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier4-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier4-batch.ts
 */
import { Resend } from "resend";
import { TIER_4_PROSPECTS } from "@/lib/outreach";
import { env } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

// Tier-4 angle is adjacency — these prospects are vendors who already
// own host relationships, not media. Subject line emphasizes
// partnership-with-vendor framing rather than affiliate-with-creator.
const SUBJECT_VARIANTS = [
  "Quick partner intro — Restay (we slot in next to your product)",
  "Co-marketing fit? Restay × your hosts",
  "$24/host referral — Restay × your customer base",
];

function buildBody(p: { handle: string; firstName: string; email: string; brand: string; hook: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subjectIdx = p.handle.length % SUBJECT_VARIANTS.length;
  const subject = SUBJECT_VARIANTS[subjectIdx];
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

${p.hook}

Quick intro — I'm Jack, founder of Restay (restay.agency). We grade Airbnb listings 0-100 in 10 seconds (free at restay.agency/grade) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + ships a 30-day pricing report. Delivered in under 4 hours.

The pitch I'd love to explore for ${p.brand}:
  · Co-marketing — I email a Tune-Up offer to anyone you flag (with your branding)
  · Affiliate — 30% / $24 per Tune-Up referred, paid Fridays via Stripe (no claw-back)
  · Audit add-on — your customers see "your photos look great, want them re-shot too?" as a one-click upsell
  · Co-branded grader page already provisioned: ${partnerLink}

Free demo offer: I'll ship a free Tune-Up on a property of your choice (yours, a customer's, a partner's) so you can see the output before any commitment. Reply with any Airbnb URL.

Or just kick the tires on the public grader: ${APP_URL}/grade

— Jack
${APP_URL}/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>${p.hook}</p>
<p>Quick intro — I'm Jack, founder of <strong>Restay</strong> (<a href="${APP_URL}">restay.agency</a>). We grade Airbnb listings 0-100 in 10 seconds (free at <a href="${APP_URL}/grade">restay.agency/grade</a>) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + ships a 30-day pricing report. Delivered in under 4 hours.</p>
<p>The pitch I'd love to explore for <strong>${p.brand}</strong>:</p>
<ul>
<li><strong>Co-marketing</strong> — I email a Tune-Up offer to anyone you flag (with your branding)</li>
<li><strong>Affiliate</strong> — 30% / $24 per Tune-Up referred, paid Fridays via Stripe (no claw-back)</li>
<li><strong>Audit add-on</strong> — your customers see "your photos look great, want them re-shot too?" as a one-click upsell</li>
<li><strong>Co-branded grader page</strong> already provisioned: <a href="${partnerLink}">${partnerLink}</a></li>
</ul>
<p><strong>Free demo offer:</strong> I'll ship a free Tune-Up on a property of your choice — reply with any Airbnb URL and I'll have output back to you tomorrow.</p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending to ${TIER_4_PROSPECTS.length} Tier-4 prospects from ${FROM}`);
  const unverified = TIER_4_PROSPECTS.filter((p) => p.unverified).length;
  if (unverified > 0) console.log(`  (${unverified} unverified — may bounce)\n`);

  let sent = 0;
  let failed = 0;
  for (const p of TIER_4_PROSPECTS) {
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
        headers: { "Idempotency-Key": `tier4-${p.handle}` },
        tags: [
          { name: "type", value: "tier4_outreach" },
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
