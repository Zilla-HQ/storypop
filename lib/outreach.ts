/**
 * Structured outreach drafts. Same content as the markdown files in
 * docs/outreach/, but as data so /admin/outreach can render Gmail-compose
 * buttons. Markdown stays authoritative for human reading; this file mirrors
 * it for the operator dashboard.
 *
 * If you edit a draft, update both this file AND docs/outreach/affiliate-tier1.md
 * (or podcast-sponsors.md). Yes it's duplication — the alternative is parsing
 * markdown at request time which adds runtime cost without paying back.
 */

export interface OutreachDraft {
  id: string;
  /** Display name of the recipient. */
  name: string;
  /** Recipient email if known; null when contact is via DM/form. */
  to: string | null;
  /** Subject line. */
  subject: string;
  /** Plain-text body. */
  body: string;
  /** Public note about the prospect — surfaced as the card subtitle. */
  context: string;
  /** Source channel: youtube, podcast, course, fb-group, substack, x. */
  channel:
    | "youtube"
    | "podcast"
    | "course"
    | "fb-group"
    | "substack"
    | "x"
    | "industry";
  /** Tier — 1 = direct contact w/ named drafts; 2 = template-batch. */
  tier: 1 | 2;
  /** Whether contact requires DM/form (no email). */
  contactNote?: string;
}

const SIG = `

— Jack
Founder, Restay
restay.agency/partners`;

const PODCAST_SIG = `

— Jack
restay.agency`;

// ─── Tier-1 affiliate outreach (10 personal-relationship drafts) ─────────────

export const TIER_1: OutreachDraft[] = [
  {
    id: "rakidzich",
    name: "Sean Rakidzich",
    to: "sean@airbnbautomated.com",
    channel: "youtube",
    tier: 1,
    context: "Airbnb Automated · ~322k YouTube subs · runs Cracking Superhost",
    subject: "$24/referral, paid Friday — would Airbnb Automated audience care?",
    body: `Sean,

Watched your "Cracking Superhost" walkthrough last week — the part where you graded Sam's listing live and the title was the first thing you flagged. That's basically the entire thesis of what we're building.

Restay grades any Airbnb listing in 10 seconds (free, public at restay.agency/grade) and sells a one-time $79 Tune-Up that rewrites copy + restyles 10 photos + generates a 30-day pricing report. No subscription, delivered in under 4 hours.

We pay partners 30% — $24 per referral on the standard tier — every Friday via Stripe. No 90-day claw-back, no MRR waiting game. Most subscription affiliate programs in this space are slower and less per-lead than that.

I'd love to do two things:
1. Send you a free Tune-Up on a listing of your choice (yours or one of the Automated members') so you have a real before/after to walk through on camera
2. Get you set up with a unique referral link if it makes sense after seeing the work

You can grade any listing at restay.agency/grade with no signup if you want to kick the tires first. Reply with the URL of any listing and I'll personally get you the Tune-Up output by tomorrow.${SIG}`,
  },
  {
    id: "robuilt",
    name: "Rob Abasolo / Robuilt",
    to: "rob@robuilt.com",
    channel: "youtube",
    tier: 1,
    context: "Robuilt · ~260k YouTube · runs Host Camp + Host Con",
    subject: "Restay × Host Camp — listing-grader for module homework?",
    body: `Rob,

Caught the Host Con announcement — congrats on getting Faeth and Carl on the lineup, that's the strongest STR room of the year.

Quick pitch: Restay is a $79 one-time Airbnb listing optimizer (rewritten copy + 10 restyled photos + pricing report, delivered in 4 hours). I built the version of this tool I wished existed when I was first learning hosting — most listing-optimization advice is generic, ours is specific because it actually scrapes the listing and grades it.

I'd love to figure out a Host Camp partnership angle — possibilities I'd love your read on:
- Free graded report as a homework assignment in Module 3 or 4
- Bonus offer for Host Camp members at a custom rate
- Standard 30% partner program ($24/lead, paid weekly via Stripe — fastest payouts in the space)

If any of those resonate, the easiest first step is for me to ship you a free Tune-Up on whichever listing you'd like. Just reply with a URL.

restay.agency/grade is the public free grader. Type any listing URL and you'll see the format.${SIG}`,
  },
  {
    id: "rusteen",
    name: "Daniel Rusteen",
    to: "daniel@optimizemyairbnb.com",
    channel: "industry",
    tier: 1,
    context: "Optimize My Airbnb · author + $1k+ done-for-you optimizer",
    subject: "Have an obvious downsell handoff for Optimize My Airbnb",
    body: `Daniel,

I've recommended your book to enough hosts that I should've reached out sooner. We built Restay (restay.agency) for the segment of your audience that wants the optimization work done but isn't at $1k+ ready — a $79 one-time Tune-Up: rewritten title + description, 10 restyled photos, 30-day pricing report, delivered in under 4 hours.

It's not a competitor — we're the on-ramp for the people who'd otherwise bounce off your offer. Two ways this could work:

1. Affiliate referral: 30% of $79 = $24 per converted lead, paid Fridays, no MRR clock. You'd point under-budget hosts to restay.agency with your link.
2. Upsell into Optimize My Airbnb: we route hosts who clearly need the white-glove $1k+ work back to you. Tagged in our admin, paid back to you at whatever rate makes sense.

I'd love to do a free Tune-Up on a listing of your choosing so you have output you can compare against your own. restay.agency/grade is the public free grader if you want to see the diagnostic side first.${SIG}`,
  },
  {
    id: "ribbers",
    name: "Jasper Ribbers",
    to: "jasper@getpaidforyourpad.com",
    channel: "podcast",
    tier: 1,
    context: "Get Paid For Your Pad · 700+ episodes · Hospitable currently sponsors",
    subject: "Thoughts on a Restay × GP4YP pilot?",
    body: `Jasper,

700+ episodes is wild — went back to your Rankbreeze review from a few years ago to figure out the right pitch angle.

Restay is the on-ramp version of the listing-optimization tools you've reviewed: $79 one-time, 4-hour turnaround, no subscription. Copy + photos + pricing in one job — the things PriceLabs/Wheelhouse/Rankbreeze don't bundle together.

I noticed Hospitable is your current SaaS sponsor, which makes sense — they own the channel-manager category. We're a complement, not a competitor: optimize the listing once, then let Hospitable handle automation.

A few angles I'd love your read on:
- 60-second host-read sponsor on a relevant episode
- Affiliate review post (we'd send you free Tune-Up output on whichever listing you'd like)
- Just a one-off mention in the next "tools we like" episode

We pay 30% commission on the $79 — $24/lead, weekly via Stripe. Whichever angle works for you.

restay.agency/grade is the public free grader. Reply with any URL and I'll get you the Tune-Up output by tomorrow.${SIG}`,
  },
  {
    id: "tfv",
    name: "Annette Grant + Sarah Karakaian (TFV)",
    to: "hello@thanksforvisiting.com",
    channel: "podcast",
    tier: 1,
    context: "Thanks For Visiting / Hosting Hotline · no current dominant SaaS sponsor",
    subject: "Hosting Hotline + Restay grader = obvious match?",
    body: `Annette and Sarah,

I have to imagine you've been pitched on every Airbnb tool by now, but the format-fit for Hosting Hotline is too good not to ask.

Most of the questions you take on Hosting Hotline diagnose what's wrong with someone's listing. Restay (restay.agency/grade) does that diagnostic in 10 seconds: paste any URL, get a 0–100 score across copy, photos, and listing signals plus the 3 highest-impact fixes. Free, no signup.

Could be a natural sponsor format: "while we read this question, paste your URL into restay.agency/grade and you'll have a score by the time we get to the answer." Or a per-episode 60-second host-read.

The full Tune-Up is $79 one-time (rewrite + 10 photos + pricing) for hosts who want the work done after the diagnostic. We pay 30% commission to partners — $24 per referral, weekly via Stripe.

I'd love to ship you both a free Tune-Up on any listing you want to use as a real example. Send me a URL — I'll have the output by tomorrow.${SIG}`,
  },
  {
    id: "faeth",
    name: "Bill Faeth",
    to: "bill@billfaeth.com",
    channel: "podcast",
    tier: 1,
    context: "STR Unfiltered · STR Wealth Conference",
    subject: "Restay → STR Unfiltered host-read pilot",
    body: `Bill,

I've watched STR Wealth grow from a small Faeth event to the biggest density of buyer-segment STR hosts in the country. Long-term I want to be at the conference in July; short-term I'd love to start with a podcast pilot.

Restay is a $79 one-time Airbnb listing optimizer (copy + photos + pricing, 4-hour delivery). Free public grader at restay.agency/grade. The economics work cleanly with paid acquisition because we're not asking for monthly revenue — and that's part of why I think we'd be a good STR Unfiltered fit, since most of your audience is operating on tight one-time-purchase budgets, not enterprise SaaS.

Two angles:
1. 60s host-read on STR Unfiltered, $1.5–3k range depending on which episodes match
2. Standard affiliate program (30% / $24 per referral, paid Fridays) you can pass to coaches in your network

Happy to send you a free Tune-Up on whatever listing you'd like to walk through on the show.${SIG}`,
  },
  {
    id: "carl",
    name: "Avery Carl",
    to: "avery@theshorttermshop.com",
    channel: "podcast",
    tier: 1,
    context: "The Short Term Show · 1M+ downloads · investor-leaning audience",
    subject: "Quick partner-program intro — Restay",
    body: `Avery,

The Short Term Show audience leans investor — Restay is the optimization layer that takes "I bought the property" to "the listing is converting." $79 one-time, 4-hour delivery, copy + photos + pricing.

If a partnership angle makes sense, our standard program is 30% commission ($24 per converted referral) paid Fridays via Stripe. We can do custom for higher-volume partners.

Free public grader at restay.agency/grade — type any listing URL and you'll see the format. Happy to ship you a free Tune-Up if you want to walk one through on the show.${SIG}`,
  },
  {
    id: "chang",
    name: "Michael Chang",
    to: "michael@tenatatime.com",
    channel: "youtube",
    tier: 1,
    context: "Ten At A Time · STR investor content",
    subject: "Restay × Ten At A Time — listing-grader collab?",
    body: `Michael,

Your audience is right at the intersection where Restay's pitch lands hardest — investors who own the unit but don't have the optimization muscle. We grade any Airbnb listing in 10 seconds (restay.agency/grade) and sell a $79 one-time Tune-Up to fix it.

Two paths I'd love your take on:
- Affiliate program (30% / $24 per referral, paid weekly via Stripe)
- A "grade your audience's listings live" segment if you do livestreams or member calls

Free Tune-Up on any listing if you want the output to walk through. Reply with a URL.${SIG}`,
  },
  {
    id: "symon-he",
    name: "Symon He",
    to: "symon@learnbnb.com",
    channel: "course",
    tier: 1,
    context: "LearnAirbnb · highest-volume host-education funnel",
    subject: "$79 listing-optimization tool — fit for LearnAirbnb students?",
    body: `Symon,

LearnAirbnb has been the highest-volume host-education funnel in the space for years. Restay is the $79 one-time tool that fits as the "homework" layer below your courses — students grade their listing free, then get the work done for $79 if they want a clean baseline before going deeper.

Standard partner program: 30% / $24 per referral, paid Fridays via Stripe. Custom rates for educator-bundle deals.

Free Tune-Up offer stands — send me a URL and I'll get you the output by tomorrow.${SIG}`,
  },
  {
    id: "lodgify",
    name: "Lodgify content team",
    to: "content@lodgify.com",
    channel: "industry",
    tier: 1,
    context: "Lodgify · large host-education content team",
    subject: "Co-marketing — Restay's free grader as a Lodgify resource?",
    body: `Hello,

Quick co-marketing note — your blog has hundreds of host-education posts and Restay just shipped a free public listing grader (restay.agency/grade) that scores any Airbnb listing 0–100 in 10 seconds. It would slot well into your existing posts on listing optimization as a sidebar tool.

Open to:
- Referencing each other's content (we'd link Lodgify resources from our blog if there's a fit)
- Standard affiliate (30% / $24 per Tune-Up referred)
- Custom co-branded grader if there's volume to justify it

Easiest first step: any listing URL into restay.agency/grade and you'll see what hosts get. Happy to send sample output as well.${SIG}`,
  },
];

// ─── Podcast sponsorship inquiries (3) ──────────────────────────────────────

export const PODCASTS: OutreachDraft[] = [
  {
    id: "tfv-sponsor",
    name: "Thanks For Visiting / Hosting Hotline",
    to: "hello@thanksforvisiting.com",
    channel: "podcast",
    tier: 1,
    context: "Annette Grant + Sarah Karakaian · Hosting Hotline Q&A format = perfect fit",
    subject: "Sponsorship inquiry — Restay (60s host-read on Hosting Hotline)",
    body: `Annette and Sarah,

I'd like to sponsor Hosting Hotline — specifically the Q&A format episodes where listeners write in with listing problems. Restay (restay.agency) is a free Airbnb listing grader and a one-time $79 Tune-Up service. The format-fit is too clean not to ask.

The pitch I'd love you to read:

> "While we read this question, paste your URL into restay.agency/grade. By the time we get to the answer you'll have a 0–100 score on your listing's copy, photos, and signals — plus the 3 fixes that would lift bookings the most. Free, no signup."

That's 15 seconds. The 60-second version adds: "Restay also does the work for you — $79 one-time, four-hour turnaround, rewritten copy + 10 restyled photos + 30-day pricing report. No subscription. Less than a month of Guesty."

Budget I can support:
- $1,500 for one Hosting Hotline episode (60s host-read, mid-roll)
- $4,000 for a 4-episode pilot run
- $10,000 for a 12-episode quarter (pre-roll + mid-roll)

I'd want UTM tracking on the link (?utm_source=tfv&utm_medium=podcast) and an opt-in code that listeners can use to identify themselves as TFV-driven for an additional split if it becomes a longer relationship.

Free demo: I'll ship you both a free Tune-Up on whichever listings you'd like to use as recurring real-world examples on the show. Send me URLs.

When are you booking summer dates?${PODCAST_SIG}`,
  },
  {
    id: "str-unfiltered-sponsor",
    name: "STR Unfiltered (Bill Faeth)",
    to: "bill@billfaeth.com",
    channel: "podcast",
    tier: 1,
    context: "Operator-tier audience · STR Wealth Conference overlap",
    subject: "Restay sponsorship inquiry — STR Unfiltered",
    body: `Bill,

I'd like to sponsor STR Unfiltered. Restay (restay.agency) is a $79 one-time Airbnb listing optimization service — rewritten copy + 10 restyled photos + 30-day pricing report, four-hour turnaround. Free public grader at restay.agency/grade.

Why this fits Unfiltered specifically: your audience is operator-tier hosts running 1–10 listings. They're below the Guesty/Hospitable enterprise spend tier but above the casual host. That's exactly Restay's ICP — and it's a segment that's traditionally underserved by SaaS because subscription economics don't work at their volume. We work because we're one-time.

The pitch I'd love to read:

> "If you've been meaning to refresh your listing but haven't gotten to it — paste your URL into restay.agency/grade. Free 10-second audit, zero signup, tells you the three things to fix first. The full done-for-you Tune-Up is $79 one-time — less than a month of Guesty, delivered in four hours."

Budget:
- $1,500 for one mid-roll host-read
- $4,500 for a 3-episode test run
- Custom rates available if there's a fit for STR Wealth Conference sponsorship in July (separate conversation)

I'd want clean UTM tracking and a coupon code for STR Unfiltered listeners.

Free demo: I'll ship a free Tune-Up on whichever listing you'd like for the read. Reply with a URL.${PODCAST_SIG}`,
  },
  {
    id: "gp4yp-sponsor",
    name: "Get Paid For Your Pad (Jasper Ribbers)",
    to: "jasper@getpaidforyourpad.com",
    channel: "podcast",
    tier: 1,
    context: "Hospitable already a sponsor — multi-sponsor or rotating slot OK",
    subject: "Sponsorship inquiry — Restay (multi-sponsor slot OK)",
    body: `Jasper,

Hospitable is the GP4YP sponsor I'm most aware of, and I have no interest in displacing them — but Restay is a complement, not a competitor. Hospitable handles automation; Restay handles the listing optimization. They're additive on the same host.

I'd like to explore a multi-sponsor or rotating slot.

Restay in one sentence: $79 one-time Airbnb listing tune-up — rewritten copy + 10 restyled photos + 30-day pricing report, delivered in four hours. Free public grader at restay.agency/grade.

The pitch:

> "If your listing hasn't been refreshed in over a year — and most haven't — Restay grades it for free. Paste your URL at restay.agency/grade and see your score. The full Tune-Up is $79 one-time. No subscription, no PMS lock-in."

Budget:
- $2,000 for one episode mid-roll (host-read)
- $5,000 for a 3-pack
- $15,000 for a 12-episode quarter — comfortable with a Hospitable-rotation slot

UTM tracking and a GP4YP-listener code. Free Tune-Up demo on whatever listing you'd like to walk through on the show.${PODCAST_SIG}`,
  },
];

// ─── Tier-3 cold-email prospects (sub-agent researched 2026-05-07) ─────────
// Smaller STR podcasters / Substack writers / course operators / co-host
// networks / adjacent-vertical vendors. Different from TIER_1 (relationship)
// and TIER_2 (template+hook); these get the same template-with-hook treatment
// as Tier-2.

export interface Tier3Prospect {
  handle: string;
  firstName: string;
  email: string;
  brand: string;
  hook: string;
  /** True if email is org-format-guess vs. visually-verified on a public site. */
  unverified?: boolean;
}

export const TIER_3_PROSPECTS: Tier3Prospect[] = [
  { handle: "wil-slickers", firstName: "Wil", email: "wil@hospitality.fm", brand: "Hospitality.FM / Slick Talk", hook: "Hospitality.FM now distributes No Vacancy and STR Sisterhood — Restay slots in as a $79 product worth recommending on Good Morning Hospitality." },
  { handle: "stacey-st-john", firstName: "Stacey", email: "hello@staceystjohn.com", brand: "The STR Sisterhood", hook: "Your TFV episode #145 covered photos+copy as the #1 conversion lever — Restay is exactly that done-for-you, at a price your community will actually buy." },
  { handle: "mike-bayer", firstName: "Mike", email: "highfive@vacationrentalformula.com", brand: "Vacation Rental Formula", hook: "Your VRS184 'Vacation Rental Marketing 2.0' episode is exactly Restay's positioning — copy + photos as the highest-leverage marketing move." },
  { handle: "alex-and-annie", firstName: "Alex and Annie", email: "alexandanniepodcast@gmail.com", brand: "Alex & Annie: The Real Women of Vacation Rentals", hook: "Your Heather Bayer 'Trust-Based Blueprint' episode talks about trust as the brand-equity pillar — Restay's photo restyling is the visual half of trust-building." },
  { handle: "natalie-palmer", firstName: "Natalie", email: "airbnbwithnatalie@gmail.com", brand: "No Vacancy / Host With Natalie", hook: "Your Episode 11 'Listen if you want to become an Airbnb host' opens with photos+title as the bookings unlock — Restay productizes that for your audience." },
  { handle: "jamie-lane-airdna", firstName: "Jamie", email: "jamie.lane@airdna.co", brand: "STR Data Lab / AirDNA", hook: "Your STR Data Lab Ep 85 with Shawn Moore covered listing presentation as the lever AirDNA data alone can't fix — Restay closes that loop for AirDNA users.", unverified: true },
  { handle: "jenn-boyles", firstName: "Jenn", email: "jenn@directbookingsuccess.com", brand: "Direct Booking Success / Book Direct Pro", hook: "Your Brian Olson episode emphasized listing copy as direct-booking SEO fuel — Restay's $79 SKU plugs straight into your Book Direct Pro affiliate stack.", unverified: true },
  { handle: "conrad-oconnell", firstName: "Conrad", email: "conrad@buildupbookings.com", brand: "BuildUp Bookings", hook: "Your 2026 STR Marketing Guide says listing copy + photos is the #1 free conversion lever before ad spend — Restay is the productized version of your consultancy." },
  { handle: "zach-busekrus", firstName: "Zach", email: "zach@sponstayneous.com", brand: "Behind the Stays / Journey Rewards", hook: "Your STR Cribs / Mark Lumpkin episode on '600 homes turned into Airbnbs' is exactly the renovation→listing→bookings funnel where Restay is the final-mile fix." },
  { handle: "erin-spradlin", firstName: "Erin", email: "erin@erinspradlin.com", brand: "The Real Estate Education Podcast", hook: "Your 'Leaving the US? Here's what to do with your house' episode targets owners turning a primary residence into an STR — Restay's $79 setup is the obvious next-action upsell." },
  { handle: "james-carlson-re", firstName: "James", email: "james@jamescarlsonre.com", brand: "The Real Estate Education Podcast", hook: "Episode 341 on legally investing in Airbnb shows your audience is exactly Restay's first-time-host ICP — they need their first listing optimized, not a SaaS subscription." },
  { handle: "margot-hostfully", firstName: "Margot", email: "margot@hostfully.com", brand: "Hostfully", hook: "You told Alex & Annie that listing differentiation is the #1 unsolved problem for new Hostfully customers — Restay is the $79 onboarding add-on that solves it pre-day-1." },
  { handle: "matt-landau-vrmb", firstName: "Matt", email: "matt@vrmb.com", brand: "VRMB / Inner Circle", hook: "Your Vacation Rental Marketing Makeover series literally walks owners through copy+photo rewrites — Restay productizes your Makeover playbook for owners who'd rather buy than DIY." },
  { handle: "thibault-pricelabs", firstName: "Thibault", email: "thibault.masson@pricelabs.co", brand: "Rental Scale-Up / PriceLabs", hook: "Your Rental Scale-Up profile of Heather Bayer's VRF treats education + done-for-you services as the next industry wave — Restay is exactly that productized service play." },
  { handle: "vintory-press", firstName: "team", email: "rob@vintory.com", brand: "Vintory", hook: "Brooke's STR Data Lab Ep 59 with Jamie Lane said the bottleneck on growing VR inventory is owner perception of their own listing — Restay reframes that perception in 4 hours." },
];

// ─── Tier-4 cold-email prospects (sub-agent researched 2026-05-07 round 2) ──
// STR adjacency layer — insurance, smart-locks, design/furnishing, coaching,
// CPA, cleaning marketplaces, smart-WiFi. Each owns the host relationship
// without competing with Restay's listing-optimization product.

export const TIER_4_PROSPECTS: Tier3Prospect[] = [
  { handle: "proper-insurance", firstName: "Darren", email: "darren@proper.insure", brand: "Proper Insurance", hook: "Saw Proper just rolled out Equipment Breakdown Coverage and was named 'Best Insurance for Airbnb Hosts' on the Optimize My Bnb Q+A — Restay slots in as the listing-side complement to your coverage-side host relationship.", unverified: true },
  { handle: "noiseaware", firstName: "Andrew", email: "andrew@noiseaware.com", brand: "NoiseAware (Rest)", hook: "Saw the rebrand from NoiseAware to Rest and your shift to CGO — natural moment to add affiliate revenue lines, and Restay's $79 listing tune-up is a clean cross-sell to your operator-tier hosts." },
  { handle: "stayfi", firstName: "Arthur", email: "arthur.colker@stayfi.com", brand: "StayFi", hook: "StayFi's positioning is turning guest WiFi into a marketing asset — Restay's 'photo-as-marketing' refresh is the cousin pitch, same operator-tier hosts.", unverified: true },
  { handle: "minoan", firstName: "Marc", email: "marc@minoanexperience.com", brand: "Minoan", hook: "Per your Alex & Annie episode 'Make Your Vacation Rental Shoppable' — Minoan helps hosts buy nicer things; Restay reshoots them so they actually convert in the search grid." },
  { handle: "str-cribs-jlewis", firstName: "Joshua", email: "jlewis@strcribs.com", brand: "STR Cribs", hook: "STR Cribs already pitches data-driven design with 40% ADR lift — Restay is the natural follow-on once the build is finished and the listing needs new hero shots.", unverified: true },
  { handle: "str-cribs-mlumpkin", firstName: "Mark", email: "mlumpkin@strcribs.com", brand: "STR Cribs", hook: "Saw your no-BS podcast appearance and Bed Breakfast & Business ep 048 on post-renovation guest experience — listings always need re-shot after renovations, that's exactly Restay's $79 SKU." },
  { handle: "showplace", firstName: "Justin", email: "justin@showplacehq.com", brand: "Showplace", hook: "Showplace designs and furnishes but doesn't reshoot — perfect adjacency for a $79 photo refresh once your finish-out is done. Saw the Boost VC 'Meet the Founder' feature.", unverified: true },
  { handle: "bnbcalc", firstName: "Jeremy", email: "jeremy@bnbcalc.com", brand: "BNBCalc / Short-Term Rental Pros Podcast", hook: "Saw your recent LinkedIn post 'After spending $34,234 furnishing three Durham apartments' — the hosts running BNBCalc deals need photos right after closing, Restay is exactly that finish line." },
  { handle: "vodyssey", firstName: "Shawn", email: "shawn@vodyssey.com", brand: "Vodyssey", hook: "Saw the Hospitable podcast episode and Rent Responsibly profile — Vodyssey students are actively launching new STRs and need launch-ready photos, Restay productizes the listing side of your coaching.", unverified: true },
  { handle: "million-dollar-host", firstName: "Julie", email: "julie@milliondollarhost.com.au", brand: "Million Dollar Host", hook: "Saw you just wrapped coaching the Legends X cohort (Get Paid For Your Pad recap) — those students are launching units right now, Restay is the $79 listing-launch SKU they need." },
  { handle: "alpha-geek-capital", firstName: "Tony", email: "hello@alphageekcapital.com", brand: "Alpha Geek Capital / Real Estate Rookie Podcast", hook: "Your Alpha Host Academy explicitly teaches identifying low-cost off-market Airbnbs — those new buyers need photos for their first listing, Restay is the day-one launch tool." },
  { handle: "coach-carson", firstName: "Chad", email: "chad@coachcarson.com", brand: "Coach Carson", hook: "Saw your contact page note that you reply fastest to article comments — Restay fits the 'simple, one-time, do-the-work-for-you' tools you've recommended to financial-independence hosts.", unverified: true },
  { handle: "real-estate-cpa", firstName: "Brandon", email: "contact@therealestatecpa.com", brand: "Hall CPA / The Real Estate CPA", hook: "Your STR-loophole content is the #1 driver of new STR purchases each Q4 — those clients need photos as soon as they close, Restay's $79 SKU is the natural plug-in to your Tax Smart Investors community." },
  { handle: "turno", firstName: "Assaf", email: "assaf@turno.com", brand: "Turno", hook: "Turno already powers the cleaning-fee discussion — Restay is the natural 'refresh listing photos seasonally' partner that sees every property turnover anyway through your platform." },
  { handle: "operto", firstName: "Steve", email: "steve@operto.com", brand: "Operto", hook: "Per the Phocuswire piece on your appointment — Operto is positioning around the inflection point for STR ops, and photos are the cheapest pro-grade upgrade your operator-tier hosts can make.", unverified: true },
];

// ─── Tier-5 cold-email prospects (sub-agent researched 2026-05-07 round 3) ──
// STR realtors (every closed buyer launches a listing) + boutique PMs
// (every onboarded property = listing setup work) + small coaches.

export const TIER_5_PROSPECTS: Tier3Prospect[] = [
  { handle: "kelli-haus", firstName: "Kelli", email: "kelliscabins@gmail.com", brand: "Kelli Haus / eXp Realty (Broken Bow)", hook: "You brand as 'Broken Bow / Hochatown Realtor & Investor' and your IG @brokenbowrealtor shows every closing is a fresh STR launch — Restay slots in as the day-1 listing setup for your buyers." },
  { handle: "paula-beauchamp", firstName: "Paula", email: "paula@brokenbowrealestate.com", brand: "SALT Real Estate (Broken Bow)", hook: "Your bio says 'specializes in the STR market for the Broken Bow/Hochatown area' — every closed buyer needs photos + listing copy day one, Restay is the $79 turnkey for that handoff.", unverified: true },
  { handle: "sylvia-murphy", firstName: "Sylvia", email: "sylvia@sylviamurphy.com", brand: "Platinum Realty (Broken Bow)", hook: "Your cabin pages (Bear Bluff Escape, Red Sunset, Harvest Moon, Pine Hut) show recurring named cabins flipping into STRs — perfect handoff workflow for $79 listing rewrite + photo restyle on every close." },
  { handle: "jt-modern", firstName: "Bryan", email: "bryan@jtmodern.com", brand: "Joshua Tree Modern", hook: "Joshua Tree was called 'one of the fastest growing STR markets in the nation' — every architectural-flip buyer you close needs a fresh Airbnb listing, not just an MLS one. Restay is the $79 SKU for that gap." },
  { handle: "savvy-str", firstName: "Tyler", email: "tyler@savvy.realty", brand: "Savvy STR Agents", hook: "Your savvy.realty/agent Calendly book-a-call page is built around investor onboarding — $24/referral on every closed-buyer-needs-listing-setup is a clean partner add for your expansion-agent team." },
  { handle: "jh-real-estate", firstName: "Greg", email: "gregwallace@kw.com", brand: "Jackson Hole Real Estate Investments", hook: "Your RSPS certification means every closed buyer is a second-home investor likely launching a new Airbnb listing the week after close — Restay is the $79 launch SKU you can hand them at closing." },
  { handle: "obx-realtor", firstName: "Stephen", email: "stephensmithobx@gmail.com", brand: "Stephen Smith OBX / SOLD On the Outer Banks", hook: "Your Substack post 'Home Prices On The OBX Keep Rising' positions you as the data guy for OBX investors — Restay is a natural value-add to your closed-buyer follow-up sequence at $79/listing." },
  { handle: "cure-designs", firstName: "Jessica", email: "jessica@curedesigns.com", brand: "Cure Designs / eXp (Joshua Tree)", hook: "Your blog post at curedesigns.com/blog/joshua-tree-short-term-rental-permits is about avoiding STR permit denials — clients who clear permits still need a launch-ready listing day one, that's exactly Restay's $79 SKU.", unverified: true },
  { handle: "hosting-savannah", firstName: "Alyssa", email: "alyssa@hostingsavannah.com", brand: "Hosting Savannah", hook: "You position Hosting Savannah as the boutique alternative to corporate PMs — $79 per onboarded property is cheaper than your time setting up listings yourself, and the brand polish stays on-brand.", unverified: true },
  { handle: "at-the-ready", firstName: "Joyner", email: "joyner@atthereadyco.com", brand: "At The Ready (Charleston)", hook: "Your 'Concierge Property Management' positioning means $79 listing polish on every new owner is on-brand, not a downgrade — Restay's photo restyle preserves your white-glove signal." },
  { handle: "short-and-sweet", firstName: "Evan", email: "evan@shortandsweetproperties.com", brand: "Short & Sweet Properties (Charleston)", hook: "Your Skool community ('strategy-room-2413') shows you already buy into the creator/coaching ecosystem — 30% rev-share on every onboarded owner is an easy partner pitch for your coaching audience.", unverified: true },
  { handle: "sol-path", firstName: "Kaitlin", email: "kaitlin@solpathproperties.com", brand: "Sol Path Properties (Bend)", hook: "Your LinkedIn post 'Here's some info on what I do!' shows you personally market the company — Restay's $79 listing rewrite + photo restyle slots into your onboarding checklist for new properties." },
  { handle: "shanti-mountain", firstName: "Johnny", email: "johnny@shantimountainproperties.com", brand: "Shanti Mountain Properties (Asheville)", hook: "16 years as owner-operator means you're the buyer for every new-property listing improvement, not a delegated team — Restay is the $79 SKU you can plug into onboarding without team overhead.", unverified: true },
  { handle: "mytripify", firstName: "Caleb", email: "caleb@mytripify.com", brand: "MyTripify / @Mytripify YouTube", hook: "You're both a coach (audience to refer to) AND a small PM (direct buyer for your own onboarding) — dual-fit for the 30% partner program; Restay covers the listing side of the launch.", unverified: true },
  { handle: "real-system", firstName: "Jorge", email: "jorge@therealsystem.com", brand: "The R.E.A.L. System", hook: "Your course students by definition are launching new listings post-purchase or arbitrage — a $79 listing-launch upgrade is a natural bolt-on your coaching can offer with a 30% kickback.", unverified: true },
  { handle: "academia-airbnb", firstName: "Mario", email: "mario@laacademiadeairbnb.com", brand: "La Academia de Airbnb", hook: "Your 350+ Spanish-language Academia students are launching their first listings monthly — Restay's $79 listing rewrite is sub-1-night-revenue for them, easy upsell from your curriculum.", unverified: true },
];

// ─── Tier-6 cold-email prospects (sub-agent researched 2026-05-07 round 4) ──
// Smaller media: design-IG creators, niche Substack writers, micro-podcasters
// covering tiny-homes/glamping/MTR/RV. Hungrier for sponsors than Tier-1/2.

export const TIER_6_PROSPECTS: Tier3Prospect[] = [
  { handle: "mamma-mode", firstName: "Andrea", email: "andrea@mammamode.com", brand: "Mamma Mode", hook: "Your April 2025 launch of 'Stylish Stays: The Complete Guide to Airbnb Setup' + 2025 design-trends post both flag listing optimization as the #1 booking lever — exactly Restay's pitch in $79 form." },
  { handle: "host-and-home", firstName: "Lauren", email: "hello@laurensaylor.com", brand: "Host & Home (Substack)", hook: "Your 'Dear Lauren' advice column already takes home/hosting reader questions — a Restay sponsored slot fits neatly between your seasonal-list and dinner-party series.", unverified: true },
  { handle: "host-in-your-home", firstName: "Becca", email: "hostinyourhome@notedtalent.co", brand: "Host in Your Home", hook: "Your recent Thanksgiving outdoor-vlog and scones posts show consistent weekly publishing — small enough that a $79 referral product sponsorship slot is approachable." },
  { handle: "glampaluza", firstName: "Sue", email: "hello@glampaluza.com", brand: "Glampaluza Podcast", hook: "Your host-interview format with glampsite owners is exactly Restay's target audience — could plug 30%/$24 referral as a recurring sponsor segment alongside the new-glampsite-owner episodes." },
  { handle: "rv-rental-secrets", firstName: "Stacy", email: "stacy@thecamperconnection.com", brand: "RV Rental Secrets / Escaping the Ordinary (~9.8K subs)", hook: "You publicly built a 20-vehicle RV rental business from scratch in upstate NY — RV/glamping hosts who also list cabins on Airbnb are a perfect cross-sell for Restay's $79 listing tune-up." },
  { handle: "outdoor-hospitality-weekly", firstName: "Matt", email: "foundry@freewyld.com", brand: "Outdoor Hospitality Weekly", hook: "Your post 'New Camping Data, Hotels, and RV Market Signals' shows you cover the full outdoor-hospitality stack — Restay listing optimization for cabin/glamping operators is a natural sponsor fit.", unverified: true },
  { handle: "kaye-freewyld", firstName: "Kaye", email: "kaye@kayeputnam.com", brand: "Freewyld Foundry / GPFYP", hook: "You publicly handle brand/marketing for the longest-running STR podcast — pitch is partnership angle (audit + sponsor segment), not a cold ad buy." },
  { handle: "mtr-show", firstName: "Bailey", email: "bailey@baileykramer.com", brand: "The Mid-Term Rental Show", hook: "Your 'Lowball Sellers' + Hospitable Hosts crossover episodes show MTR ops is your focus — Restay's $79 listing tune-up is a low-friction add-on for your MTR-pivoting audience.", unverified: true },
  { handle: "airbrindy", firstName: "Brindy", email: "hello@airbrindy.com", brand: "AirBrindy (~25K IG)", hook: "Your 'Tech PM to Airbnb Ambassador / $45K COVID setback' interview positions you as a story-driven coach — Restay $79 fits as the 'first step' you recommend to your students.", unverified: true },
  { handle: "sukkha-interiors", firstName: "Sarah", email: "sarah@sukkhainteriordesign.com", brand: "Sukkha Interior Design / Nomadic Spaces Podcast", hook: "Your 2026 blog post 'Designing for ROI: What Airbnb Hosts Need to Know to Stay Fully Booked' is the exact framing Restay uses — pitch as a partner referral for hosts not ready for full design.", unverified: true },
  { handle: "brianna-michele", firstName: "Brianna", email: "hello@briannamicheleinteriors.com", brand: "Brianna Michele Interiors (~15K IG)", hook: "Your IG content emphasizes 'data-driven design strategies that turn standard rentals into high-performing assets' — Restay's listing audit is the analytics layer that complements your design service.", unverified: true },
  { handle: "zoey-berghoff", firstName: "Zoey", email: "zoey@zoeyberghoff.com", brand: "Unique Stay Coach (~16K IG)", hook: "Your bio 'helping you build lifestyle-aligned real estate and unique STR stays' — Restay's optimization for unique-stay listings (cabins, glampsites, A-frames) is a direct content fit." },
  { handle: "kylee-and-steven", firstName: "Kylee and Steven", email: "kyleeandsteven@gmail.com", brand: "Short Term Rental Experts / Arrivls", hook: "Your flagship video 'Setting Up An Airbnb? Start Here' + 'We Knew Nothing' series is the exact funnel a $79 listing audit fits at the bottom of." },
  { handle: "tiny-house-lifestyle", firstName: "Ethan", email: "ethan@thetinyhouse.net", brand: "Tiny House Lifestyle Podcast (1.1M+ downloads)", hook: "You just announced the wind-down of regular eps — perfect transition moment to be the 'recommended tools' sponsor in your final eps + email list of tiny-house Airbnb hosts.", unverified: true },
  { handle: "stand-out-podcast", firstName: "John", email: "john@staydockside.com", brand: "Stand Out! STR Hosting Podcast", hook: "Your podcast tagline 'Stand Out' maps 1:1 with Restay's listing-optimization promise — could pitch as the on-pod-recommended tool to actually execute the standout-listing strategies.", unverified: true },
  { handle: "airbnb-data-guy", firstName: "John", email: "john@strsearch.com", brand: "The Airbnb Data Guy / STR Search (~12K)", hook: "Your audience are buyers right at the moment they're about to launch a listing — Restay's $79 listing setup is the natural 'after you close, do this' upsell on your data report.", unverified: true },
  { handle: "lodge-social", firstName: "Scott", email: "scott@thelodgesocial.com", brand: "The Lodge Social", hook: "Your Q1 2025 recap post detailed the 90-day test that turned The Lodge Social into your agency funnel — Restay slots into the 'things every host should do before chasing direct bookings' content angle.", unverified: true },
];
