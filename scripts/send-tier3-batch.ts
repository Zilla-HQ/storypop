/**
 * Tier-3 cold-email batch — 15 STR-ecosystem prospects researched
 * by sub-agent on 2026-05-07. Heather Bayer dropped (already in
 * Tier-2 under cottageblogger.com).
 *
 * Two prospects (Jenn Boyles, Jamie Lane) used standard org-email
 * format (firstname@org.com / firstname.lastname@org.com) but agent
 * couldn't visually verify on their public site. Tagged "_unverified"
 * in the prospect record so we can drop them later if they bounce.
 *
 *   npx tsx --env-file=.env.local scripts/send-tier3-batch.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/send-tier3-batch.ts
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

interface Tier3Prospect {
  handle: string;
  firstName: string;
  email: string;
  brand: string;
  hook: string;
  /** True if email is org-format-guess vs. visually-verified on a public site. */
  unverified?: boolean;
}

export const TIER_3_PROSPECTS: Tier3Prospect[] = [
  {
    handle: "wil-slickers",
    firstName: "Wil",
    email: "wil@hospitality.fm",
    brand: "Hospitality.FM / Slick Talk",
    hook: "Hospitality.FM now distributes No Vacancy and STR Sisterhood — Restay slots in as a $79 product worth recommending on Good Morning Hospitality.",
  },
  {
    handle: "stacey-st-john",
    firstName: "Stacey",
    email: "hello@staceystjohn.com",
    brand: "The STR Sisterhood",
    hook: "Your TFV episode #145 covered photos+copy as the #1 conversion lever — Restay is exactly that done-for-you, at a price your community will actually buy.",
  },
  {
    handle: "mike-bayer",
    firstName: "Mike",
    email: "highfive@vacationrentalformula.com",
    brand: "Vacation Rental Formula",
    hook: "Your VRS184 'Vacation Rental Marketing 2.0' episode is exactly Restay's positioning — copy + photos as the highest-leverage marketing move.",
  },
  {
    handle: "alex-and-annie",
    firstName: "Alex and Annie",
    email: "alexandanniepodcast@gmail.com",
    brand: "Alex & Annie: The Real Women of Vacation Rentals",
    hook: "Your Heather Bayer 'Trust-Based Blueprint' episode talks about trust as the brand-equity pillar — Restay's photo restyling is the visual half of trust-building.",
  },
  {
    handle: "natalie-palmer",
    firstName: "Natalie",
    email: "airbnbwithnatalie@gmail.com",
    brand: "No Vacancy / Host With Natalie",
    hook: "Your Episode 11 'Listen if you want to become an Airbnb host' opens with photos+title as the bookings unlock — Restay productizes that for your audience.",
  },
  {
    handle: "jamie-lane-airdna",
    firstName: "Jamie",
    email: "jamie.lane@airdna.co",
    brand: "STR Data Lab / AirDNA",
    hook: "Your STR Data Lab Ep 85 with Shawn Moore covered listing presentation as the lever AirDNA data alone can't fix — Restay closes that loop for AirDNA users.",
    unverified: true,
  },
  {
    handle: "jenn-boyles",
    firstName: "Jenn",
    email: "jenn@directbookingsuccess.com",
    brand: "Direct Booking Success / Book Direct Pro",
    hook: "Your Brian Olson episode emphasized listing copy as direct-booking SEO fuel — Restay's $79 SKU plugs straight into your Book Direct Pro affiliate stack.",
    unverified: true,
  },
  {
    handle: "conrad-oconnell",
    firstName: "Conrad",
    email: "conrad@buildupbookings.com",
    brand: "BuildUp Bookings",
    hook: "Your 2026 STR Marketing Guide says listing copy + photos is the #1 free conversion lever before ad spend — Restay is the productized version of your consultancy.",
  },
  {
    handle: "zach-busekrus",
    firstName: "Zach",
    email: "zach@sponstayneous.com",
    brand: "Behind the Stays / Journey Rewards",
    hook: "Your STR Cribs / Mark Lumpkin episode on '600 homes turned into Airbnbs' is exactly the renovation→listing→bookings funnel where Restay is the final-mile fix.",
  },
  {
    handle: "erin-spradlin",
    firstName: "Erin",
    email: "erin@erinspradlin.com",
    brand: "The Real Estate Education Podcast",
    hook: "Your 'Leaving the US? Here's what to do with your house' episode targets owners turning a primary residence into an STR — Restay's $79 setup is the obvious next-action upsell.",
  },
  {
    handle: "james-carlson-re",
    firstName: "James",
    email: "james@jamescarlsonre.com",
    brand: "The Real Estate Education Podcast",
    hook: "Episode 341 on legally investing in Airbnb shows your audience is exactly Restay's first-time-host ICP — they need their first listing optimized, not a SaaS subscription.",
  },
  {
    handle: "margot-hostfully",
    firstName: "Margot",
    email: "margot@hostfully.com",
    brand: "Hostfully",
    hook: "You told Alex & Annie that listing differentiation is the #1 unsolved problem for new Hostfully customers — Restay is the $79 onboarding add-on that solves it pre-day-1.",
  },
  {
    handle: "matt-landau-vrmb",
    firstName: "Matt",
    email: "matt@vrmb.com",
    brand: "VRMB / Inner Circle",
    hook: "Your Vacation Rental Marketing Makeover series literally walks owners through copy+photo rewrites — Restay productizes your Makeover playbook for owners who'd rather buy than DIY.",
  },
  {
    handle: "thibault-pricelabs",
    firstName: "Thibault",
    email: "thibault.masson@pricelabs.co",
    brand: "Rental Scale-Up / PriceLabs",
    hook: "Your Rental Scale-Up profile of Heather Bayer's VRF treats education + done-for-you services as the next industry wave — Restay is exactly that productized service play.",
  },
  {
    handle: "vintory-press",
    firstName: "team",
    email: "rob@vintory.com",
    brand: "Vintory",
    hook: "Brooke's STR Data Lab Ep 59 with Jamie Lane said the bottleneck on growing VR inventory is owner perception of their own listing — Restay reframes that perception in 4 hours.",
  },
];

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

export function buildBody(p: Tier3Prospect): { subject: string; text: string; html: string } {
  const subjectIdx = p.handle.length % SUBJECT_VARIANTS.length;
  const subject = SUBJECT_VARIANTS[subjectIdx];
  const partnerLink = `${APP_URL}/p/${p.handle}`;

  const text = `Hey ${p.firstName},

${p.hook}

Quick intro — I'm Jack, founder of Restay (restay.agency). We grade Airbnb listings 0–100 in 10 seconds (free, no signup at restay.agency/grade) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. Delivered in under 4 hours.

We pay partners 30% — $24 per converted referral, every Friday via Stripe. No claw-back, no MRR clock. Compared to subscription affiliate programs in this space (PriceLabs 10% / 12mo, Hospitable 25% / 3mo), the per-lead payout is faster and bigger.

If a partnership angle makes sense for ${p.brand}, here's what I'd offer:
  · Standard: 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe
  · Custom higher-volume rates available
  · Co-branded grader page if helpful: ${partnerLink}
  · Iframe embed of the grader for your site/course platform

I'd love to send you a free Tune-Up on a listing of your choice so you can see the output. Reply with any Airbnb URL and I'll have the full output by tomorrow.

Or just kick the tires on the free grader: ${APP_URL}/grade

— Jack
${APP_URL}/partners
`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
<p>Hey ${p.firstName},</p>
<p>${p.hook}</p>
<p>Quick intro — I'm Jack, founder of <strong>Restay</strong> (<a href="${APP_URL}">restay.agency</a>). We grade Airbnb listings 0–100 in 10 seconds (free, no signup at <a href="${APP_URL}/grade">restay.agency/grade</a>) and sell a $79 one-time Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. Delivered in under 4 hours.</p>
<p>We pay partners <strong>30% — $24 per converted referral, every Friday via Stripe</strong>. No claw-back, no MRR clock. Compared to subscription affiliate programs in this space (PriceLabs 10% / 12mo, Hospitable 25% / 3mo), the per-lead payout is faster and bigger.</p>
<p>If a partnership angle makes sense for <strong>${p.brand}</strong>:</p>
<ul>
<li>Standard: 30% commission ($24 per Tune-Up referred), paid Fridays via Stripe</li>
<li>Custom higher-volume rates available</li>
<li>Co-branded grader page if helpful: <a href="${partnerLink}">${partnerLink}</a></li>
<li>Iframe embed of the grader for your site/course platform</li>
</ul>
<p>I'd love to send you a free Tune-Up on a listing of your choice so you can see the output. <strong>Reply with any Airbnb URL</strong> and I'll have the full output by tomorrow.</p>
<p>Or just kick the tires on the free grader: <a href="${APP_URL}/grade">${APP_URL}/grade</a></p>
<p>— Jack<br/><a href="${APP_URL}/partners" style="color:#475569;">restay.agency/partners</a></p>
</body></html>`;

  return { subject, text, html };
}

async function main() {
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Sending to ${TIER_3_PROSPECTS.length} Tier-3 prospects from ${FROM}`);
  const unverifiedCount = TIER_3_PROSPECTS.filter((p) => p.unverified).length;
  if (unverifiedCount > 0) {
    console.log(`  (${unverifiedCount} unverified — emails are org-format-guesses, may bounce)\n`);
  }

  let sent = 0;
  let failed = 0;
  for (const p of TIER_3_PROSPECTS) {
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
        headers: { "Idempotency-Key": `tier3-${p.handle}` },
        tags: [
          { name: "type", value: "tier3_outreach" },
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
