/**
 * Tier-1 follow-up — short polite "checking back" send to the 10
 * industry-influencer Tier-1 prospects. Threads the original subject
 * via "Re: " prefix so it shows up in the same Gmail/Outlook thread.
 *
 * Fire 48h after Tier-1 sent. The Tier-1 originals went out at
 * 2026-05-07 ~21:00 UTC, so this should fire ≥ 2026-05-09 21:00 UTC
 * (or sooner if operator override).
 *
 *   npx tsx --env-file=.env.local scripts/send-tier1-followup.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier1-followup.ts
 */
import { Resend } from "resend";
import { TIER_1 } from "@/lib/outreach";
import { env } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

function buildFollowUp(d: { id: string; name: string; subject: string }): { subject: string; text: string; html: string } {
  // Short re-engagement framing — pick the FIRST name from the prospect's
  // display name. "Annette Grant + Sarah Karakaian (TFV)" -> "Annette".
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

async function main() {
  const sendable = TIER_1.filter((d) => d.to);
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending Tier-1 follow-up to ${sendable.length} prospects from ${FROM}\n`);

  let sent = 0;
  let failed = 0;
  for (const d of sendable) {
    const { subject, text, html } = buildFollowUp(d);
    if (dryRun) {
      console.log(`[dry] ${d.name.padEnd(40)} → ${d.to}  [${subject.slice(0, 70)}]`);
      continue;
    }
    try {
      const r = await resend.emails.send({
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
      if (r.error) {
        console.error(`✗ ${d.name}: ${r.error.message}`);
        failed++;
      } else {
        console.log(`✓ ${d.name.padEnd(40)} → ${d.to}  (${r.data?.id})`);
        sent++;
      }
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error(`✗ ${d.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }
  console.log(`\nSent: ${sent}, Failed: ${failed}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
