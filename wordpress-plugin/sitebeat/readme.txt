=== Sitebeat — SEO Audit & Weekly Monitoring ===
Contributors: sitebeat
Tags: seo, seo audit, site audit, monitoring, page speed
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Run a free 13-point SEO audit on your WordPress site. Subscribe for weekly automated re-checks with email alerts when SEO regresses.

== Description ==

Sitebeat is the simplest way to make sure your WordPress site stays healthy in search. Click a button — get a graded SEO report. Subscribe — we re-audit every Monday and only email you when something breaks.

**13 SEO checks per audit:**

* HTTPS
* Meta description
* Heading structure (H1/H2/H3)
* Page load speed (TTFB)
* Sitemap.xml
* Robots.txt
* Canonical tag
* Mobile viewport
* Language attribute
* Image alt text coverage
* Open Graph tags
* Broken internal links
* Structured data (JSON-LD)

**Why weekly monitoring matters:**

Most SEO regressions are silent. A theme update breaks your schema markup. A plugin conflict disables your sitemap. Your dev pushes broken canonicals. By the time you notice the traffic drop, three months are gone.

Sitebeat watches for regressions every Monday morning. If anything breaks since last week, you get a one-screen email with the diff. Otherwise — silence.

**Pricing:**

* Free first audit (no signup required, no credit card)
* $29/mo for weekly automated monitoring
* $290/yr (two months free)

== Installation ==

1. Install the plugin via the WordPress plugin directory or upload the `sitebeat` folder to `/wp-content/plugins/`.
2. Activate via the **Plugins** menu.
3. Find **Sitebeat SEO** in your admin sidebar.
4. Click "Run free audit now" — you'll get a graded report at sitebeat.com/audit/[id].

== Frequently Asked Questions ==

= Do I need an account to use the plugin? =

No. The free audit submits your site URL to Sitebeat's audit pipeline; no account, no credit card.

= Where does the report live? =

On sitebeat.com — you get a public URL you can share with your developer or marketing team. The plugin also stores the audit ID locally so you can re-open the most recent report from your WP admin.

= Can I cancel after subscribing? =

Yes — Sitebeat uses Stripe Checkout. You can manage billing and cancel from the Stripe customer portal at any time. No long-term contracts.

= Does the plugin slow down my site? =

No. The plugin only runs in the WP admin dashboard. It does not add any frontend scripts, CSS, or external resources to your public site.

= Does the audit hit my server hard? =

No. Sitebeat fetches your homepage once per audit (and once per week if you subscribe), the same way Google does. Negligible load.

== Screenshots ==

1. The Sitebeat dashboard inside WP admin.
2. A sample SEO audit report on sitebeat.com.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
First release.
