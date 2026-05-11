/**
 * Competitor comparison content. Powers `/vs/[slug]` and
 * `/alternatives/[slug]`. Keep claims factual + sourced — comparison
 * pages get sued when they get sloppy.
 */

export interface CompetitorRow {
  feature: string;
  sitebeat: string;
  competitor: string;
}

export interface CompetitorDef {
  slug: string;
  name: string;
  // For meta titles + breadcrumbs:
  pricing: string;
  // One-line positioning of the competitor (factual, not snarky):
  positioning: string;
  // The angle of differentiation we lead with:
  angle: string;
  // 3-paragraph summary, neutral tone:
  intro: string[];
  // Feature comparison rows. Keep claims factual.
  rows: CompetitorRow[];
  // The "best for" + "consider [Competitor] if" honesty section.
  bestForSitebeat: string[];
  considerCompetitor: string[];
  faq: { q: string; a: string }[];
}

export const COMPETITORS: CompetitorDef[] = [
  {
    slug: "sitechecker",
    name: "Sitechecker",
    pricing: "$59+/mo",
    positioning:
      "Sitechecker is a long-running SEO audit tool with a public domain-checker, rank tracking, and on-page suggestions. Its lowest paid plan starts around $59/mo.",
    angle:
      "Sitebeat is half the price and is built around weekly regression alerts instead of always-on dashboards.",
    intro: [
      "Sitechecker and Sitebeat both run SEO audits against your site. The difference is in scope and price: Sitechecker is a full SEO platform with rank tracking, backlink monitoring, and a 100-page UI; Sitebeat is a single-purpose monitoring tool that emails you only when something breaks.",
      "If you're a marketing manager at a 50-person company who needs daily rank tracking and a dashboard for the team, Sitechecker is the right tool. If you're a founder, freelancer, or agency operator who just wants to know when SEO regresses on a site you don't log into every week, Sitebeat is built for you.",
      "Pricing is the other obvious gap: Sitebeat is $29/mo across the board. Sitechecker's lowest plan is around $59/mo, with serious feature limits below their $109/mo Standard tier.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$59/mo" },
      { feature: "Free first audit", sitebeat: "Yes — full report", competitor: "Limited preview" },
      { feature: "Re-audit cadence", sitebeat: "Weekly automated", competitor: "On-demand + scheduled" },
      { feature: "Alerts when something breaks", sitebeat: "Email — only on regressions", competitor: "Dashboard widgets + emails" },
      { feature: "Rank tracking", sitebeat: "Not included", competitor: "Included" },
      { feature: "Backlink monitoring", sitebeat: "Not included", competitor: "Included" },
      { feature: "Setup time", sitebeat: "30 seconds (URL only)", competitor: "5–15 min (account + project setup)" },
      { feature: "Dashboard required to use", sitebeat: "No — email-first", competitor: "Yes" },
    ],
    bestForSitebeat: [
      "You manage 1–20 client sites and don't want to log into yet another dashboard",
      "You want weekly automated checks without paying $59+/mo per site",
      "You only need to be alerted when SEO actively regresses",
      "You're a developer or technical founder — you just want signal, not a tool to live in",
    ],
    considerCompetitor: [
      "You need rank tracking for specific keywords",
      "You need backlink monitoring in the same product",
      "You want a full-featured SEO dashboard for a team of 5+",
      "You're at a company where a $100+/mo SaaS is invisible spend",
    ],
    faq: [
      {
        q: "Is Sitebeat a Sitechecker alternative?",
        a: "Yes — for the SEO audit and weekly monitoring use case. Sitebeat doesn't replace Sitechecker's rank tracking or backlink modules.",
      },
      {
        q: "Can I import data from Sitechecker?",
        a: "No — Sitebeat audits the live site directly, so there's nothing to import. Just submit your URL and we'll run the audit immediately.",
      },
      {
        q: "Does Sitebeat audit multiple pages?",
        a: "Currently one URL per site (the homepage). Multi-page coverage is on the roadmap. Sitechecker covers more pages per crawl by default.",
      },
    ],
  },
  {
    slug: "seoptimer",
    name: "SEOptimer",
    pricing: "$19+/mo",
    positioning:
      "SEOptimer is an SEO audit tool aimed at digital agencies. Strong on white-label reports and embeddable widgets. Pricing starts around $19/mo for solo users.",
    angle:
      "Sitebeat is for site owners who want to be told when something breaks — not agencies who need white-label sales collateral.",
    intro: [
      "SEOptimer's primary customer is a digital agency selling SEO services. Its biggest features are white-label PDF reports and an embeddable lead-capture widget that agencies use as a top-of-funnel tool.",
      "Sitebeat is built for the site owner. The free audit is the entire pitch; the paid plan is weekly regression alerts to your email. We don't have white-label features.",
      "If you're an agency, SEOptimer + a $50 affiliate kickback is probably better. If you're the actual founder/operator of the site, the always-on weekly monitoring at $29/mo is a tighter fit.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$19/mo" },
      { feature: "White-label reports", sitebeat: "No", competitor: "Yes (Pro tier)" },
      { feature: "Embeddable lead widget", sitebeat: "Yes (free)", competitor: "Yes (paid tier)" },
      { feature: "Weekly automated monitoring", sitebeat: "Yes (built-in)", competitor: "Manual / scheduled" },
      { feature: "Email alerts on regression", sitebeat: "Yes — only on regressions", competitor: "Configurable schedule" },
      { feature: "Built for", sitebeat: "Site owners + small agencies", competitor: "Digital agencies" },
      { feature: "Free first audit", sitebeat: "Full 13-check report", competitor: "Limited preview report" },
    ],
    bestForSitebeat: [
      "You own the site you're auditing",
      "You don't need white-label client-facing PDFs",
      "You want regression alerts, not on-demand reports",
      "You'd rather pay $29 than $19 for a tighter, simpler tool",
    ],
    considerCompetitor: [
      "You're an agency selling SEO services to 20+ clients",
      "You need white-label PDF reports with your branding",
      "You want a dedicated lead-capture funnel widget for prospect calls",
    ],
    faq: [
      {
        q: "Is Sitebeat a SEOptimer alternative?",
        a: "For founders and operators monitoring their own sites — yes. For agencies running white-label SEO services — no, that's still SEOptimer's lane.",
      },
      {
        q: "Can I white-label Sitebeat?",
        a: "Not currently. We focus on the site-owner use case where the report is for the owner directly, not for client deliverables.",
      },
      {
        q: "Does Sitebeat have an embed widget?",
        a: "Yes — see /embed. Anyone can embed the free Sitebeat audit widget on their own site at no cost.",
      },
    ],
  },
  {
    slug: "ubersuggest",
    name: "Ubersuggest",
    pricing: "$29+/mo",
    positioning:
      "Ubersuggest is Neil Patel's SEO toolkit — keyword research, content ideas, site audits, backlink data. Lifetime deals start around $290; monthly around $29.",
    angle:
      "Same price point, different focus: Sitebeat is monitoring-first, Ubersuggest is research-first.",
    intro: [
      "Ubersuggest is built around keyword research and content ideation — it's Neil Patel's answer to Ahrefs and Semrush at a fraction of the price. The site audit is one feature among many.",
      "Sitebeat does one thing: it watches your site and emails you when SEO regresses. There's no keyword research, no content ideas, no backlink graph. If that's all you need, the focus pays off.",
      "Both are $29/mo (Sitebeat monthly, Ubersuggest individual). Pick by primary use case: research → Ubersuggest, monitoring → Sitebeat.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$29/mo (or $290 lifetime)" },
      { feature: "Keyword research", sitebeat: "Not included", competitor: "Included" },
      { feature: "Content ideas", sitebeat: "Not included", competitor: "Included" },
      { feature: "Backlink data", sitebeat: "Not included", competitor: "Included" },
      { feature: "Weekly site audit", sitebeat: "Yes (automatic)", competitor: "Yes (on-demand)" },
      { feature: "Email alerts on regression", sitebeat: "Yes — only on regressions", competitor: "No equivalent" },
      { feature: "Surface area", sitebeat: "Single-purpose", competitor: "Full SEO toolkit" },
    ],
    bestForSitebeat: [
      "You already do keyword research elsewhere (or don't need to)",
      "You want SEO monitoring without all the other modules",
      "You prefer email-first over dashboard-first tools",
      "Smaller surface area is a feature, not a limitation, for you",
    ],
    considerCompetitor: [
      "You need keyword research + content ideas in the same product",
      "You're starting from zero on SEO and want everything in one place",
      "You prefer Neil Patel's content ecosystem and brand",
    ],
    faq: [
      {
        q: "Is Sitebeat cheaper than Ubersuggest?",
        a: "Same price ($29/mo). The difference is what's included.",
      },
      {
        q: "Can I use both?",
        a: "Yes — they're complementary. Use Ubersuggest for what to write, Sitebeat to make sure your site stays healthy while you write.",
      },
      {
        q: "Does Sitebeat track keyword rankings?",
        a: "No. Ubersuggest does. If keyword tracking is your primary need, that's the right tool.",
      },
    ],
  },
  {
    slug: "ahrefs",
    name: "Ahrefs",
    pricing: "$129+/mo",
    positioning:
      "Ahrefs is the gold-standard backlink + keyword research platform. Plans start around $129/mo for the Lite tier and scale to $1000+/mo enterprise.",
    angle:
      "Ahrefs is for SEO professionals; Sitebeat is for everyone else.",
    intro: [
      "Ahrefs is the most powerful general-purpose SEO platform available. If you're a full-time SEO consultant, an in-house SEO at a 200-person company, or running an SEO-first content operation, you probably need it.",
      "Sitebeat is for the 99% of site owners who are not full-time SEOs. Your site has SEO problems, but you're a founder or developer or marketer who has 11 other things to do. You need a tool that emails you when something breaks — not a $129/mo product with a 4-hour learning curve.",
      "We're not trying to be Ahrefs. We're trying to make sure your site doesn't quietly drop 30% of its organic traffic over a quarter because nobody noticed the sitemap broke after the last deploy.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$129/mo (Lite)" },
      { feature: "Site audit", sitebeat: "Yes — 13 checks", competitor: "Yes — hundreds of checks" },
      { feature: "Backlink index", sitebeat: "Not included", competitor: "World-class — primary feature" },
      { feature: "Keyword research", sitebeat: "Not included", competitor: "Included" },
      { feature: "Rank tracking", sitebeat: "Not included", competitor: "Included" },
      { feature: "Email alerts on regression", sitebeat: "Yes — built-in default", competitor: "Configurable in dashboard" },
      { feature: "Setup time", sitebeat: "30 seconds (URL only)", competitor: "30 minutes (account + project + verification)" },
      { feature: "Built for", sitebeat: "Site owners, founders, freelancers", competitor: "Full-time SEO professionals" },
    ],
    bestForSitebeat: [
      "You're not a full-time SEO and don't want to become one",
      "$129/mo per site is laughable for your business",
      "You need a watchman, not a microscope",
      "You'd rather get an email than read a dashboard",
    ],
    considerCompetitor: [
      "You're doing professional SEO consulting or in-house SEO",
      "You need backlink intelligence at scale",
      "You compete on keyword research and content gap analysis",
      "You can justify $129–500/mo per project",
    ],
    faq: [
      {
        q: "Is Sitebeat a cheap Ahrefs alternative?",
        a: "Sitebeat is a different category — monitoring instead of analytics. If you specifically need backlink data or keyword tracking, no tool at $29/mo replaces Ahrefs.",
      },
      {
        q: "Can I downgrade from Ahrefs to Sitebeat?",
        a: "If your only Ahrefs use was the Site Audit feature, yes — Sitebeat covers that at 1/4 the price. If you used backlinks, keyword tracking, or content explorer, you'd lose those features.",
      },
      {
        q: "Should I use Sitebeat AND Ahrefs?",
        a: "If your budget allows: yes. Use Ahrefs for offensive SEO (research, building rankings) and Sitebeat for defensive SEO (catching regressions before traffic drops).",
      },
    ],
  },
  {
    slug: "moz",
    name: "Moz Pro",
    pricing: "$99+/mo",
    positioning:
      "Moz Pro is a long-running SEO platform that pioneered domain authority scoring. Plans start around $99/mo for Standard and scale to $299/mo for Premium.",
    angle:
      "Moz is a research and reporting tool. Sitebeat is a regression alert. Different shape entirely.",
    intro: [
      "Moz Pro made its name on domain authority scoring, the open-source MozCast SERP volatility tracker, and one of the most-cited SEO blogs on the web. The product itself is a comprehensive SEO research platform — keyword tracking, link analysis, on-page optimization, site crawls.",
      "If you're an in-house SEO who needs domain authority data and weekly link reports, Moz is a fine choice. If you just want to know when your site breaks, Moz is overkill at 3× the price.",
      "Sitebeat is single-purpose: weekly site audit, regression alerts to email. We don't replace Moz Pro any more than a smoke detector replaces a fire department.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$99/mo (Standard)" },
      { feature: "Domain Authority score", sitebeat: "Not included", competitor: "Included" },
      { feature: "Keyword research", sitebeat: "Not included", competitor: "Included" },
      { feature: "Backlink data", sitebeat: "Not included", competitor: "Included" },
      { feature: "Site audit", sitebeat: "Yes — 13 weekly checks", competitor: "Yes — extensive crawl" },
      { feature: "Email alerts on regression", sitebeat: "Yes — default behavior", competitor: "Configurable" },
      { feature: "Built for", sitebeat: "Site owners + freelancers", competitor: "In-house + agency SEOs" },
    ],
    bestForSitebeat: [
      "You don't need DA scores or backlink intelligence",
      "$99/mo is too much for a single-site monitor",
      "You want email-first regression alerts",
      "Smaller surface area is a feature for you",
    ],
    considerCompetitor: [
      "You report Domain Authority to clients or stakeholders",
      "You need weekly keyword rank tracking",
      "You're an agency running 10+ client SEO programs",
      "You consume the Moz blog and trust their methodology",
    ],
    faq: [
      {
        q: "Is Sitebeat a Moz Pro alternative?",
        a: "For the site-audit + regression-monitoring slice, yes. For everything else Moz Pro does — DA scores, keyword tracking, link analysis — no.",
      },
      {
        q: "Does Sitebeat have a domain authority score?",
        a: "We use a 0–100 SEO health score that grades your site against 13 specific signals. It's not the same as Moz's Domain Authority — DA is about backlink graph strength; ours is about on-page health.",
      },
      {
        q: "Should I use Moz Pro AND Sitebeat?",
        a: "If your budget allows. Moz for offensive SEO research; Sitebeat for defensive monitoring against regressions.",
      },
    ],
  },
  {
    slug: "contentking",
    name: "ContentKing (Conductor)",
    pricing: "$179+/mo",
    positioning:
      "ContentKing (now part of Conductor) is enterprise-grade real-time SEO monitoring. Continuous crawl, change tracking, alerts. Plans start around $179/mo and scale to enterprise.",
    angle:
      "ContentKing is the Cadillac of SEO monitoring. Sitebeat is the smoke detector — same job, 1/6 the price.",
    intro: [
      "ContentKing is the premier real-time SEO monitoring platform. It crawls every page on your site continuously and alerts you the moment something changes. If you're at a 200-person company with a marketing team that needs full-page change tracking and detailed audit logs, this is the tool.",
      "Sitebeat does roughly 60% of what ContentKing does, weekly instead of real-time, on the homepage instead of every URL, for $29/mo instead of $179. The trade-off is real and explicit: you give up real-time and multi-page coverage in exchange for a 6× cheaper bill and a tool that takes 30 seconds to set up.",
      "If your business depends on catching SEO regressions within hours, ContentKing is the right call. If catching them within a week is enough, Sitebeat is the right call.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$179/mo+" },
      { feature: "Crawl frequency", sitebeat: "Weekly (homepage)", competitor: "Continuous (every page)" },
      { feature: "Pages covered", sitebeat: "Homepage", competitor: "Entire site" },
      { feature: "Setup time", sitebeat: "30 seconds (URL only)", competitor: "30+ minutes (account, project, verification)" },
      { feature: "Email alerts on regression", sitebeat: "Yes — default", competitor: "Yes — configurable" },
      { feature: "Slack / webhook alerts", sitebeat: "Roadmap", competitor: "Yes" },
      { feature: "Built for", sitebeat: "Site owners + freelancers", competitor: "Marketing teams at 100+ person companies" },
    ],
    bestForSitebeat: [
      "Weekly checks are enough for your business",
      "You only need homepage coverage today",
      "$29/mo is the right budget for SEO monitoring",
      "You want email-first, not dashboard-first",
    ],
    considerCompetitor: [
      "You need real-time alerts within hours of a regression",
      "You need every page crawled, not just the homepage",
      "You need Slack/webhook integrations + audit log compliance",
      "Your business can justify $200+/mo per project",
    ],
    faq: [
      {
        q: "Is Sitebeat a cheaper ContentKing alternative?",
        a: "Yes — for the slice of ContentKing that monitors your homepage and emails you on regression. Multi-page real-time monitoring is on Sitebeat's roadmap but not shipped yet.",
      },
      {
        q: "Why is Sitebeat so much cheaper?",
        a: "We crawl weekly instead of continuously, and one URL instead of every URL. That's a 100× reduction in crawl cost which translates to a 6× cheaper bill. Most small businesses don't need real-time.",
      },
      {
        q: "Does Sitebeat work for enterprise teams?",
        a: "Not yet. We're built for site owners, freelancers, and small agencies. ContentKing remains the right tool for enterprise marketing operations.",
      },
    ],
  },
  {
    slug: "woorank",
    name: "WooRank",
    pricing: "$60+/mo",
    positioning:
      "WooRank is an SEO audit tool with strong agency white-label features and on-demand audit reports. Plans start around $60/mo for the Pro tier.",
    angle:
      "Woorank competes with SEOptimer for the agency white-label market. Sitebeat doesn't compete in that lane.",
    intro: [
      "WooRank is one of the older audit tools on the market — they pioneered the public on-demand SEO checker that grades any URL. Their paid product wraps that into white-label PDF reports and ongoing crawls for agencies.",
      "Sitebeat is a different beast: monitoring-first, email-first, no white-label. We're built for the site owner, not the agency reselling SEO services.",
      "If you're picking between WooRank and SEOptimer, that's an agency-tool decision. If you're picking between WooRank and Sitebeat, you're probably the operator of a single business and Sitebeat will fit your workflow better.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$60/mo (Pro)" },
      { feature: "Free first audit", sitebeat: "Full 13-check report", competitor: "Limited preview" },
      { feature: "White-label reports", sitebeat: "No", competitor: "Yes (Pro+)" },
      { feature: "Weekly automated audit", sitebeat: "Yes — default", competitor: "Manual / scheduled" },
      { feature: "Email alerts on regression", sitebeat: "Yes — only on regressions", competitor: "Configurable" },
      { feature: "Built for", sitebeat: "Site owners + freelancers", competitor: "Digital agencies" },
    ],
    bestForSitebeat: [
      "You own the site you're auditing",
      "You don't need branded PDF reports",
      "You want regression-only alerts, not on-demand audits",
      "$29/mo is the right price",
    ],
    considerCompetitor: [
      "You're running an agency with white-label client reports",
      "You need a marketing-team SEO suite, not a single-purpose monitor",
      "You're already comfortable with WooRank's UI",
    ],
    faq: [
      {
        q: "Is Sitebeat a WooRank alternative?",
        a: "For founders and operators who own their own sites — yes. For agencies running white-label SEO services — no, that's still WooRank's lane.",
      },
      {
        q: "Can I export PDFs from Sitebeat?",
        a: "Each audit report has a print-friendly view at /audit/[id]/print — use ⌘P / Ctrl+P to save as PDF. Not white-label.",
      },
      {
        q: "Does Sitebeat track keyword rankings like WooRank?",
        a: "No. We're audit + monitoring only.",
      },
    ],
  },
  {
    slug: "seobility",
    name: "Seobility",
    pricing: "$50+/mo",
    positioning:
      "Seobility is a German-engineered SEO suite with site auditing, keyword tracking, and backlink analysis. Plans start around $50/mo. Free tier available with 1 project.",
    angle:
      "Seobility is the closest direct competitor to Sitebeat at this price tier.",
    intro: [
      "Seobility is one of the more underrated SEO platforms — it's not as flashy as Ahrefs or Semrush, but it covers most of the same ground at half the price. Site audits, weekly crawls, keyword tracking, backlink analysis. They have a free tier limited to one project.",
      "Sitebeat is more focused: just the site audit and weekly regression monitoring. We don't do keyword tracking or backlink analysis. The trade-off is a smaller surface area in exchange for a workflow built around 'email me when something breaks' rather than 'log into a dashboard'.",
      "Both are reasonable choices for the price-conscious operator. Pick by primary use case: full SEO suite at modest price → Seobility. Single-purpose regression monitoring → Sitebeat.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$50/mo (Premium)" },
      { feature: "Free tier", sitebeat: "First audit free", competitor: "1 project free forever" },
      { feature: "Site audit", sitebeat: "Yes — 13 checks weekly", competitor: "Yes — comprehensive" },
      { feature: "Keyword tracking", sitebeat: "Not included", competitor: "Included" },
      { feature: "Backlink analysis", sitebeat: "Not included", competitor: "Included" },
      { feature: "Email alerts on regression", sitebeat: "Yes — default", competitor: "Configurable" },
      { feature: "Setup time", sitebeat: "30 seconds (URL)", competitor: "5–10 minutes (account + project)" },
    ],
    bestForSitebeat: [
      "Audit + regression monitoring is all you need",
      "$29/mo is the right price",
      "You don't want a dashboard to live in",
      "Email-first workflow",
    ],
    considerCompetitor: [
      "You need keyword tracking + backlink analysis in the same product",
      "You want a free tier (Seobility's is generous)",
      "You're already comfortable in Seobility's UI",
    ],
    faq: [
      {
        q: "Is Sitebeat cheaper than Seobility?",
        a: "Yes — Seobility starts at ~$50/mo for the paid tier, Sitebeat is $29/mo flat. Seobility has a free tier, Sitebeat has a free first audit.",
      },
      {
        q: "Should I use both?",
        a: "If your budget allows. Seobility for keyword + backlink work, Sitebeat for the always-on regression alerts.",
      },
      {
        q: "Does Sitebeat work outside the US?",
        a: "Yes — we audit any public URL, anywhere. Seobility is German-headquartered which may matter for EU data residency preferences.",
      },
    ],
  },
  {
    slug: "screaming-frog",
    name: "Screaming Frog",
    pricing: "$259/yr",
    positioning:
      "Screaming Frog is the SEO industry's standard desktop crawler. Free up to 500 URLs; paid license is £199/yr (~$259) for unlimited.",
    angle:
      "Screaming Frog is a desktop tool you run; Sitebeat is a service that watches your site for you.",
    intro: [
      "Screaming Frog SEO Spider is the most respected desktop SEO crawler on the market. SEO consultants run it on every audit. It crawls your entire site and surfaces hundreds of issues — far more than Sitebeat's 13 checks.",
      "But Screaming Frog has one fatal flaw for non-SEOs: you have to run it. Manually. On your laptop. Reading the results. Every week. Forever. The vast majority of small business owners try it once, get overwhelmed by the 400-issue spreadsheet, and never run it again.",
      "Sitebeat is the opposite shape: a service that runs continuously, focuses on the 13 highest-leverage signals, and emails you when one breaks. You don't need to remember to do anything.",
    ],
    rows: [
      { feature: "Pricing", sitebeat: "$29/mo", competitor: "£199/yr (~$22/mo) — software license" },
      { feature: "How it runs", sitebeat: "Cloud service, automatic", competitor: "Desktop app — you run it" },
      { feature: "Pages crawled", sitebeat: "Homepage (weekly)", competitor: "Entire site (when you run it)" },
      { feature: "Issues surfaced", sitebeat: "13 prioritized checks", competitor: "Hundreds of granular issues" },
      { feature: "Email alerts on regression", sitebeat: "Yes — automatic", competitor: "No — you must run + check" },
      { feature: "Skill required", sitebeat: "None", competitor: "SEO familiarity recommended" },
    ],
    bestForSitebeat: [
      "You're not a full-time SEO and don't want to read a 400-row spreadsheet",
      "You want regressions caught automatically, not when you remember to run a crawl",
      "13 prioritized signals beat hundreds of unprioritized ones",
    ],
    considerCompetitor: [
      "You're an SEO consultant doing audits for clients",
      "You need granular page-level issue tracking",
      "You can dedicate weekly time to running and reading the crawls",
      "You need on-prem desktop (no cloud)",
    ],
    faq: [
      {
        q: "Should I use Screaming Frog instead of Sitebeat?",
        a: "If you're a professional SEO doing audits for clients, yes. If you're a small business owner who wants their site monitored without doing the work yourself, no — pick the service.",
      },
      {
        q: "Can I export my Sitebeat audits to Screaming Frog?",
        a: "No — they're different formats. But every Sitebeat audit has a print-friendly URL you can share with your developer or SEO consultant.",
      },
      {
        q: "Why does Sitebeat only check 13 things when Screaming Frog checks hundreds?",
        a: "Because most of the hundreds of Screaming Frog issues don't materially move organic traffic. We deliberately picked the 13 that do.",
      },
    ],
  },
  {
    slug: "semrush",
    name: "Semrush",
    pricing: "$139+/mo",
    positioning:
      "Semrush is an enterprise-grade SEO + competitive intelligence platform. Plans start around $139/mo for Pro and scale to $499+/mo for Business.",
    angle:
      "Semrush is a category platform; Sitebeat is a single-purpose tool. Both can be true.",
    intro: [
      "Semrush is one of the two SEO platforms (alongside Ahrefs) that dominate the enterprise market. If you're running paid SEO consulting or doing serious competitive analysis, Semrush is hard to beat.",
      "Sitebeat covers exactly one of Semrush's many features: the site audit, with weekly automation and email alerts when something regresses. We do that one thing for $29/mo instead of $139.",
      "Like with Ahrefs: most site owners don't need a category platform. They need a quiet tool that watches their site and emails them when something breaks.",
    ],
    rows: [
      { feature: "Starting price", sitebeat: "$29/mo", competitor: "$139/mo (Pro)" },
      { feature: "Site audit", sitebeat: "Yes — 13 checks weekly", competitor: "Yes — extensive crawl" },
      { feature: "Competitor research", sitebeat: "Not included", competitor: "Industry-leading" },
      { feature: "Keyword research", sitebeat: "Not included", competitor: "Included" },
      { feature: "PPC + paid search tools", sitebeat: "Not included", competitor: "Included" },
      { feature: "Email alerts on regression", sitebeat: "Yes — default", competitor: "Configurable" },
      { feature: "Built for", sitebeat: "Site owners, freelancers", competitor: "SEO/marketing teams at funded companies" },
    ],
    bestForSitebeat: [
      "You don't need competitive research or PPC tools",
      "$29/mo is the right price for a single-site monitor",
      "You want email-first regression alerts",
      "You want to ship and forget — not log into a dashboard daily",
    ],
    considerCompetitor: [
      "You manage SEO for a portfolio of 10+ funded sites",
      "You need PPC + organic in the same platform",
      "You compete on competitive intelligence",
      "Your team has a Semrush specialist already",
    ],
    faq: [
      {
        q: "Can Sitebeat replace Semrush?",
        a: "Only for the site audit / monitoring use case. Semrush's keyword research, competitor analysis, and PPC tools have no Sitebeat equivalent.",
      },
      {
        q: "Is Sitebeat a Semrush alternative for small businesses?",
        a: "For the audit + monitoring slice, yes. Many small businesses don't need the full Semrush platform — they need to know when their site breaks. That's all Sitebeat does.",
      },
      {
        q: "Does Sitebeat have a free tier?",
        a: "The first audit is free. Weekly monitoring is $29/mo. Semrush has a limited free plan with hard rate limits.",
      },
    ],
  },
];

export function getCompetitor(slug: string): CompetitorDef | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
