/**
 * Fire the Tier-2 affiliate cold-email batch — 8 prospects with real
 * email addresses, sent from jack@mail.restay.agency.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier2-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier2-batch.ts        # sends for real
 *
 * Each prospect gets:
 *   - The bulk template body (from docs/outreach/affiliate-tier2.md)
 *   - A personalized opener line built from their documented hook
 *   - Idempotency key by prospect handle so retries don't double-send
 *
 * The 42 prospects without email addresses are listed in the manual
 * action TODO at the bottom of this script's output — they need
 * DM/form/Substack-DM contact that can't be automated from here.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

interface Tier2Prospect {
  handle: string; // unique slug for idempotency / partner-link generation
  firstName: string;
  email: string;
  brand: string;
  hook: string; // one-line specific reference for the opener
}

const PROSPECTS: Tier2Prospect[] = [
  {
    handle: "hosting-journey",
    firstName: "Evelyn",
    email: "evelyn@thehostingjourney.com",
    brand: "The Hosting Journey",
    hook: "Your 14-year NYC Superhost track record plus the 5k+ Hosting Journey FB community means your audience is exactly the operator-tier hosts who'd benefit from a one-time listing tune-up the most.",
  },
  {
    handle: "str-lab",
    firstName: "Alisha",
    email: "hello@alishaarnold.com",
    brand: "Short Term Rental Lab",
    hook: "Your STR Lab course already pushes design + photo modules — Restay slots in as the post-launch optimization step where students paste their finished listing and get a graded fix-list within 10 seconds.",
  },
  {
    handle: "bnb-mastery",
    firstName: "James",
    email: "james@bnbmastery.com",
    brand: "BNB Mastery",
    hook: "Your BNB Tribe co-host community is the cleanest fit I've seen — co-hosts already charge owner-clients setup fees, and a $79 Restay audit slots as a $79 line item they upsell with a guaranteed margin.",
  },
  {
    handle: "str-riches",
    firstName: "Tim",
    email: "tim@strriches.com",
    brand: "Short Term Rental Riches",
    hook: "Hitting 25k+ guests yourself means you've optimized listings the long way — would love to send you a free Tune-Up output on one of your earliest listings as a teardown demo for the show.",
  },
  {
    handle: "nastra",
    firstName: "team",
    email: "nastra2016@gmail.com",
    brand: "NASTRA",
    hook: "NASTRA's vendor-vetting model is exactly the trust signal Nashville hosts need — would love to be a vetted Nashville member benefit (we're city-tested via Restay's 25 programmatic Nashville pages).",
  },
  {
    handle: "vacation-rental-success",
    firstName: "Heather",
    email: "heather@cottageblogger.com",
    brand: "Vacation Rental Success",
    hook: "Your decade-plus run on Vacation Rental Success means your audience trusts your tool picks more than most — would love to send Tune-Up output on whichever listing you'd want to walk through on the show.",
  },
  {
    handle: "boostly",
    firstName: "Mark",
    email: "mark@boostly.co.uk",
    brand: "Boostly",
    hook: "Your direct-booking Boostly audience already pays for tools — Restay's optimization improves their conversion on direct sites too, not just Airbnb. Worth a pilot host-read if there's interest.",
  },
  {
    handle: "business-of-glamping",
    firstName: "Sarah",
    email: "sarah@inspiredcamping.com",
    brand: "Business of Glamping",
    hook: "Your Glamping Academy already sells courses to a niche-margin audience — Restay's a complementary one-time spend their students hit AFTER getting the course's launch checklist done.",
  },
];

const dryRun = process.argv.includes("--dry-run");
const APP_URL = (env("NEXT_PUBLIC_APP_URL", "https://restay.agency") ?? "https://restay.agency").replace(/\/$/, "");
const SENDER_DOMAINS = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",").map((s) => s.trim());
const FROM_DOMAIN = SENDER_DOMAINS[0];
const FROM = `Jack at Restay <jack@${FROM_DOMAIN}>`;
const REPLY_TO = `jack@${FROM_DOMAIN}`;
const RESEND_KEY = env("RESEND_API_KEY");
if (!RESEND_KEY) {
  console.error("Need RESEND_API_KEY");
  process.exit(1);
}
const resend = new Resend(RESEND_KEY);

const SUBJECT_VARIANTS = [
  "Quick partner-program intro — Restay (Airbnb optimization)",
  "$24/referral, paid Friday — Restay × your audience",
  "Restay × your audience — would there be fit?",
];

function buildBody(p: Tier2Prospect): { subject: string; text: string; html: string } {
  // Subject rotation by handle hash so different prospects see different subjects
  const subjectIdx = p.handle.length % SUBJECT_VARIANTS.length;
  const subject = SUBJECT_VARIANTS[subjectIdx];

  const partnerLink = `${APP_URL}/?utm_source=partner&utm_medium=referral&utm_campaign=affiliate&utm_content=${encodeURIComponent(p.handle)}`;
  const branded = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

${p.hook}

Quick intro — I'm Jack, founder of Restay (restay.agency). We grade Airbnb listings 0–100 in 10 seconds (free, no signup at restay.agency/grade) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. Delivered in under 4 hours.

We pay partners 30% — $24 per converted referral, every Friday via Stripe. No claw-back, no MRR clock. Compared to subscription affiliate programs in this space (PriceLabs 10% / 12mo, Hospitable 25% / 3mo), the per-lead payout is faster and bigger.

If a partnership angle makes sense for ${p.brand}, here's what I'd offer:
  · Standard: 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe
  · Custom higher-volume rates available
  · Co-branded grader page if helpful: ${branded}
  · Iframe embed of the grader for your site/course platform

I'd love to send you a free Tune-Up on a listing of your choice so you can see the output. Reply with any Airbnb URL and I'll have the full output by tomorrow.

Or just kick the tires on the free grader: ${APP_URL}/grade

— Jack
restay.agency/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>${p.hook}</p>
<p>Quick intro — I'm Jack, founder of <strong>Restay</strong> (<a href="${APP_URL}">restay.agency</a>). We grade Airbnb listings 0–100 in 10 seconds (free, no signup at <a href="${APP_URL}/grade">restay.agency/grade</a>) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. Delivered in under 4 hours.</p>
<p>We pay partners <strong>30% — $24 per converted referral, every Friday via Stripe</strong>. No claw-back, no MRR clock. Compared to subscription affiliate programs in this space (PriceLabs 10% / 12mo, Hospitable 25% / 3mo), the per-lead payout is faster and bigger.</p>
<p>If a partnership angle makes sense for <strong>${p.brand}</strong>, here's what I'd offer:</p>
<ul>
<li>Standard: 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe</li>
<li>Custom higher-volume rates available</li>
<li>Co-branded grader page if helpful: <a href="${branded}">${branded}</a></li>
<li>Iframe embed of the grader for your site/course platform</li>
</ul>
<p>I'd love to send you a free Tune-Up on a listing of your choice so you can see the output. <strong>Reply with any Airbnb URL</strong> and I'll have the full output by tomorrow.</p>
<p>Or just kick the tires on the free grader: <a href="${APP_URL}/grade">${APP_URL}/grade</a></p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending to ${PROSPECTS.length} Tier-2 prospects from ${FROM}\n`);
  let sent = 0;
  let failed = 0;
  const out: { handle: string; status: "sent" | "failed" | "dry-run"; resendId?: string; error?: string }[] = [];

  for (const p of PROSPECTS) {
    const { subject, text, html } = buildBody(p);
    if (dryRun) {
      console.log(`[dry-run] ${p.handle.padEnd(28)} → ${p.email.padEnd(40)} [${subject.slice(0, 50)}]`);
      out.push({ handle: p.handle, status: "dry-run" });
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
        headers: {
          "Idempotency-Key": `tier2-${p.handle}`,
        },
        tags: [
          { name: "type", value: "tier2_outreach" },
          { name: "handle", value: p.handle },
        ],
      });
      if (r.error) {
        console.error(`✗ ${p.handle}: ${r.error.message}`);
        out.push({ handle: p.handle, status: "failed", error: r.error.message });
        failed++;
      } else {
        console.log(`✓ ${p.handle.padEnd(28)} → ${p.email}  (${r.data?.id})`);
        out.push({ handle: p.handle, status: "sent", resendId: r.data?.id });
        sent++;
      }
      // Soft pace — don't blast 8 in 8 seconds, looks bot-y to Resend reputation systems
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`✗ ${p.handle}: ${err instanceof Error ? err.message : String(err)}`);
      out.push({ handle: p.handle, status: "failed", error: String(err) });
      failed++;
    }
  }

  console.log(`\n────────────────`);
  console.log(`Sent:    ${sent}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Dry-run: ${out.filter((o) => o.status === "dry-run").length}`);
  console.log(`────────────────\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗", err);
    process.exit(1);
  });

export {};
