/**
 * Embeddable customer-site footer widget.
 *
 *   <script src="https://merchant.example/widget/footer.js"
 *           data-slug="<customer-slug>"></script>
 *
 * The script appends a small "Made by <Merchant>" footer to the
 * customer's page with an affiliate-style link back to the merchant.
 * Why this matters: every site built for a customer becomes an organic
 * acquisition surface — visitors who click the footer arrive at
 * /?ref=site-<slug> and get attributed via the same affiliate cookie
 * flow.
 *
 * The widget is intentionally tiny + cache-aggressive — sets a one-day
 * Cache-Control + edge-cacheable so customer sites don't take a
 * latency hit. CORS-permissive because customer domains will host the
 * script.
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").replace(/\/$/, "");
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";

const SCRIPT = `(function(){
  try {
    var scripts = document.getElementsByTagName('script');
    var me = scripts[scripts.length - 1];
    var slug = (me.getAttribute('data-slug') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var link = '${APP_URL}/?ref=' + encodeURIComponent('site-' + (slug || 'unknown'));
    var el = document.createElement('div');
    el.setAttribute('style', 'position:fixed;bottom:0;left:0;right:0;background:rgba(15,23,42,0.92);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;padding:8px 16px;text-align:center;z-index:99999;');
    el.innerHTML = 'Made by <a href="' + link + '" style="color:#fff;text-decoration:underline;" target="_blank" rel="noopener">${BRAND_NAME.replace(/[<>"']/g, "")}</a>';
    document.body.appendChild(el);
    // Fire an impression beacon (best-effort, fire-and-forget).
    if (navigator.sendBeacon) {
      navigator.sendBeacon('${APP_URL}/widget/impression', JSON.stringify({ slug: slug }));
    }
  } catch (e) {
    /* widget should never break the host page */
  }
})();`;

export async function GET() {
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
