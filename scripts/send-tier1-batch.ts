/**
 * Override the "send Tier-1 manually" guidance and fire the 10
 * personalized cold-emails via Resend now. Each email is the SAME
 * handcrafted draft from lib/outreach.ts — personalization is per-
 * prospect, not a bulk template — so the recipient experience is
 * identical to a manual send. Only difference: speed.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier1-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier1-batch.ts        # sends for real
 *
 * Operator override: Jack explicitly said "we need as many paying
 * customers as possible, figure out what to do" — speed > caution
 * on the relationship plays.
 */
import { Resend } from "resend";
import { TIER_1 } from "@/lib/outreach";
import { env } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const RESEND_KEY = env("RESEND_API_KEY")!;
const resend = new Resend(RESEND_KEY);

async function main() {
  const sendable = TIER_1.filter((d) => d.to);
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending ${sendable.length} Tier-1 emails from ${FROM}\n`);

  let sent = 0;
  let failed = 0;
  for (const d of sendable) {
    if (dryRun) {
      console.log(`[dry] ${d.name.padEnd(40)} → ${d.to}`);
      continue;
    }
    try {
      const r = await resend.emails.send({
        from: FROM,
        to: d.to!,
        replyTo: REPLY_TO,
        subject: d.subject,
        text: d.body,
        headers: { "Idempotency-Key": `tier1-${d.id}` },
        tags: [
          { name: "type", value: "tier1_outreach" },
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
      await new Promise((r) => setTimeout(r, 3000)); // 3s pacing
    } catch (err) {
      console.error(`✗ ${d.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  const dmOnly = TIER_1.filter((d) => !d.to);
  if (dmOnly.length > 0) {
    console.log(`\n${dmOnly.length} prospects need DM/form contact (can't auto-send):`);
    for (const d of dmOnly) console.log(`  · ${d.name}: ${d.contactNote ?? "no email"}`);
  }
  console.log(`\nSent: ${sent}, Failed: ${failed}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
export {};
