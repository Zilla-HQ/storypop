import Script from "next/script";

/**
 * Conversion pixels — Google Ads, Meta Pixel, Reddit Pixel.
 * Each renders only if the corresponding `NEXT_PUBLIC_*_ID` env var is set,
 * so an unconfigured merchant has zero pixel overhead.
 *
 * Drop into root layout. Pixel IDs set per-merchant in Vercel env.
 *
 * Conversion events are fired from `lib/track.ts` helper:
 *   trackConversion('purchase', { value: 79, currency: 'USD' })
 */
export function AdPixels() {
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const redditPixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;

  return (
    <>
      {googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleAdsId}');`}
          </Script>
        </>
      )}

      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}

      {redditPixelId && (
        <Script id="reddit-pixel" strategy="afterInteractive">
          {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments)
            :p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src=
            "https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName(
            "script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
            rdt('init','${redditPixelId}');
            rdt('track', 'PageVisit');`}
        </Script>
      )}
    </>
  );
}
