/**
 * Audience-specific landing pages. Each /for/[slug] page targets one
 * persona with copy tuned to that audience's concerns and pricing.
 *
 * High-conversion top-of-funnel surface — visitors who arrive on
 * /for/agencies are already segmented and reading copy designed for
 * them, which roughly doubles conversion vs. generic homepage.
 */

export interface AudienceDef {
  slug: string;
  name: string;
  // 1-sentence positioning for meta description + lede:
  positioning: string;
  // The pain point this audience faces that Sitebeat solves:
  pain: string;
  // 4–5 specific value props for this audience:
  valueProps: string[];
  // Price-relevance angle for this audience:
  pricingAngle: string;
  // FAQ items unique to this audience:
  faq: { q: string; a: string }[];
  // Related audiences to cross-link:
  related: string[];
}

export const AUDIENCES: AudienceDef[] = [
  {
    slug: "agencies",
    name: "Web design + SEO agencies",
    positioning:
      "Sitebeat is the post-launch SEO monitoring layer agencies bolt onto every client site — $29/mo per client, white-labelable via affiliate program, zero ongoing work.",
    pain: "You launched a beautiful site for a client. Six months later they email you in panic — organic traffic dropped 40%. You discover their dev pushed broken canonical tags during an unrelated update. The damage is done; rankings take three months to recover. You should have caught it the same week. You didn't, because you don't have time to manually audit every client site every Monday.",
    valueProps: [
      "Add Sitebeat to every client launch as a $29/mo line item — invisible against your retainer",
      "Get a regression alert email the same week SEO breaks, not three months later when traffic has dropped",
      "Forward the audit URL to the client's dev team — exact fix instructions included for every issue",
      "Earn 30% lifetime affiliate commission on every client you onboard via your referral link",
      "No dashboard for clients to log into — the email IS the deliverable",
    ],
    pricingAngle:
      "$29/mo per client × 20 clients = $580/mo total. With 30% affiliate kickback, your net cost is $406/mo to monitor 20 sites — less than a single hour of your billable time.",
    faq: [
      {
        q: "Can I white-label Sitebeat for my agency?",
        a: "Not currently — emails come from Sitebeat. We do offer 30% lifetime affiliate commission on every customer you refer, so the economics work even without white-label.",
      },
      {
        q: "Can I monitor multiple client sites under one account?",
        a: "Each site has its own subscription. Most agencies have the client own their subscription and pay directly — keeps the relationship clean. Some agencies bundle the cost into their retainer.",
      },
      {
        q: "Can my client see the audit reports?",
        a: "Yes — every audit has a public URL you can share. Clients don't need a Sitebeat account to view their report.",
      },
    ],
    related: ["freelancers", "wordpress-developers"],
  },
  {
    slug: "freelancers",
    name: "SEO freelancers + consultants",
    positioning:
      "Sitebeat is the always-on monitoring tool that proves your value after the engagement ends — and gives you a recurring revenue stream via the affiliate program.",
    pain: "You did a one-time SEO audit for a client. They paid you $1,500. Three months later they call: traffic is down. They're upset, and they think it's because of your work. It's not — their dev pushed broken schema in an unrelated deploy — but you have no logs and no way to prove it. The relationship sours. You don't get the referral.",
    valueProps: [
      "Recommend Sitebeat at engagement end — the client gets continuous monitoring, you get protected reputation",
      "Audit history is your evidence: when something regresses, you can prove it happened post-engagement",
      "Earn 30% lifetime commission on referrals — recurring revenue from past clients",
      "Use the free audit at /tools/* in your sales conversations as a needs-assessment",
      "Embed the free audit widget on your site to capture leads",
    ],
    pricingAngle:
      "Recommend Sitebeat to 30 past clients. 10 sign up via your ref link. 30% × $29/mo × 10 = $87/mo recurring. Compounds with every new client.",
    faq: [
      {
        q: "How do I become a Sitebeat affiliate?",
        a: "Email partners@sitebeat.tech with your name, business, and audience. We approve most applications within 24 hours.",
      },
      {
        q: "Can I bundle Sitebeat into my consulting fee?",
        a: "Yes — many freelancers add $50/mo to their retainer for monitoring, paying $29 to Sitebeat and pocketing the difference. Combined with the 30% affiliate kickback, it's strong margin.",
      },
      {
        q: "What audit data can I use in my proposals?",
        a: "Free audits run via /tools/* and the homepage are publicly shareable. Forward the URL to a prospect and you've demonstrated value before the first call.",
      },
    ],
    related: ["agencies", "consultants"],
  },
  {
    slug: "indie-founders",
    name: "Indie founders + solo SaaS",
    positioning:
      "Sitebeat is for founders who are too busy shipping to manually re-check 13 SEO signals every Monday. Cheap, single-purpose, email-first.",
    pain: "You're shipping the product. Marketing happens in the spaces between code reviews. You read about Core Web Vitals once, set up Search Console months ago, and haven't checked it since. Your traffic is steady, but you have no idea if it's because everything's healthy or because regressions haven't compounded into traffic loss yet.",
    valueProps: [
      "$29/mo — invisible against your AWS bill, much less than a single SEO consultant call",
      "Set up in 30 seconds: drop your URL, you're done",
      "No dashboard to log into — only email when something actually breaks",
      "Built by an indie founder, for indie founders",
      "Free audit first — see what's actually broken before paying anything",
    ],
    pricingAngle:
      "$29/mo. About what you'd pay for an extra t3.small EC2 instance you forgot to turn off. About 1/100th the cost of recovering from a 6-month silent SEO regression.",
    faq: [
      {
        q: "I'm using Vercel/Cloudflare/Netlify — is Sitebeat redundant?",
        a: "No — those platforms tell you about uptime and edge performance. They don't tell you when your meta description disappeared, your sitemap returned zero URLs, or your canonical tags pointed at staging.",
      },
      {
        q: "I already use Search Console — do I need this?",
        a: "Search Console reports problems weeks after they affect traffic. Sitebeat catches regressions the same week they happen.",
      },
      {
        q: "How does this compare to running PageSpeed Insights manually?",
        a: "PSI runs on demand and you have to remember to run it. Sitebeat runs automatically every Monday and emails you only when something changes. The tedium is the value.",
      },
    ],
    related: ["wordpress-developers", "shopify-merchants"],
  },
  {
    slug: "wordpress-developers",
    name: "WordPress developers",
    positioning:
      "Sitebeat catches the WordPress-specific regressions that plugin updates routinely cause — broken sitemaps, conflicting schema, accidentally-shipped staging configs.",
    pain: "WordPress is the largest source of silent SEO regressions on the web. Auto-updates push plugin changes overnight. Themes inject conflicting metadata. The Yoast → RankMath migration breaks 15 pages. You don't notice until traffic has been dropping for a month.",
    valueProps: [
      "Free Sitebeat WordPress plugin runs the audit from inside the WP admin dashboard",
      "Detects plugin-conflict-induced metadata duplicates the same week they happen",
      "Catches `Disallow: /` accidentally shipped from staging during deploys",
      "Flags broken Yoast/RankMath migrations before traffic drops",
      "Bulk-monitor 20 client sites at $29/mo each — affordable across an agency book",
    ],
    pricingAngle:
      "$29/mo per WordPress site monitored. With our 30% lifetime affiliate program, install on your client sites and earn $8.70/mo recurring per active install.",
    faq: [
      {
        q: "Where's the WordPress plugin?",
        a: "Install from the WordPress.org plugin directory: search 'Sitebeat'. Or install our free plugin manually — see the GitHub repo.",
      },
      {
        q: "Does the plugin add load to my client's site?",
        a: "No — it only runs in the WP admin dashboard. Zero frontend overhead for visitors.",
      },
      {
        q: "Can I install Sitebeat on a client's site without giving up control?",
        a: "Yes — the audit URL is shareable and the email is sent to whoever the customer specifies. You can be the recipient even if the WP install is theirs.",
      },
    ],
    related: ["agencies", "shopify-merchants"],
  },
  {
    slug: "shopify-merchants",
    name: "Shopify store owners",
    positioning:
      "Sitebeat watches your Shopify store every week and emails you when SEO regresses — the silent traffic killer of every theme update and app install.",
    pain: "Shopify ships great SEO defaults. The moment you install a third-party theme or app, those defaults get fought over. Apps inject duplicate Product schema. Themes override canonical tags. Variant URLs proliferate. You don't notice — your day is running the store, not auditing markup. Then organic traffic drops 30% over a quarter and you have no idea why.",
    valueProps: [
      "Audits your live storefront every Monday — no need to install another app",
      "Detects when theme updates conflict with Shopify's default markup",
      "Flags duplicate Product schema from competing apps (the #1 Shopify SEO mistake)",
      "$29/mo — less than most Shopify apps, with no impact on store performance",
      "Free first audit, no signup required",
    ],
    pricingAngle:
      "$29/mo. Roughly the cost of a single Shopify app, but instead of adding bloat to your storefront, Sitebeat is fully external — zero performance overhead.",
    faq: [
      {
        q: "Do I need to install a Shopify app?",
        a: "No — Sitebeat audits your store from the outside, the same way Google does. We don't need API access or app installation.",
      },
      {
        q: "Will Sitebeat slow down my store?",
        a: "No — we run external audits weekly. Your store has zero added overhead.",
      },
      {
        q: "Can Sitebeat audit individual product pages?",
        a: "Currently we audit your homepage. Multi-page coverage including PDPs is on the roadmap.",
      },
    ],
    related: ["indie-founders", "wordpress-developers"],
  },
];

export function getAudience(slug: string): AudienceDef | undefined {
  return AUDIENCES.find((a) => a.slug === slug);
}
