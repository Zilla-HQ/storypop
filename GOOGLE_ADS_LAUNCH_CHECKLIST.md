# GOOGLE_ADS_LAUNCH_CHECKLIST.md — operator runbook

Day-0 checklist for getting Google Ads autonomy live for a new merchant. Goes alongside the engineer-side [GOOGLE_ADS.md](./GOOGLE_ADS.md) and the operator's-eye [GOOGLE_ADS_OPERATOR.md](./GOOGLE_ADS_OPERATOR.md).

## Before you start

You need:

- [ ] A Zilla-HQ MCC (Manager) account already set up. (One-time, platform-level — see [architecture/docs/01-ad-network-setup.md](./architecture/docs/01-ad-network-setup.md).)
- [ ] The merchant's brand domain already live + SEO bootstrap run (so branded-defense ads have something to defend).
- [ ] Stripe Connect Express provisioned for the merchant (so revenue tracking can flow back).
- [ ] Conversion tracking already firing via Meta Pixel / CAPI (Google Ads can piggyback on the same checkout success event).

## The 15 steps

### 1. Mint Google Ads OAuth refresh token

```bash
node scripts/google-ads-mint-refresh-token.ts
```

Prints the `GOOGLE_ADS_REFRESH_TOKEN`. Paste it into the merchant's Vercel env.

### 2. Get the developer token

Set on the Zilla-HQ Google Ads MCC under Tools → API Center → Developer token. Already set if any other merchant runs Google Ads — same token, all merchants share it.

```bash
GOOGLE_ADS_DEVELOPER_TOKEN=<...>
```

### 3. Create the merchant's customer client

Either:

```bash
node scripts/google-ads-bootstrap.ts --name "<merchant-name>"
```

…or use the SDK function:

```ts
import { createCustomerClient } from "@/lib/google-ads-client";
const { customerId } = await createCustomerClient({
  descriptiveName: "Merchant Inc.",
  currencyCode: "USD",
  timeZone: "America/New_York",
});
```

Returns the customer ID. Paste it as `GOOGLE_ADS_CUSTOMER_ID` in Vercel env.

```bash
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<MCC-id>     # the Zilla-HQ MCC ID
GOOGLE_ADS_CUSTOMER_ID=<merchant-customer-id>
```

### 4. Create the Purchase conversion action

```bash
node scripts/google-ads-launch-branded.ts --conversion-only
```

…or via SDK:

```ts
import { createConversionAction } from "@/lib/google-ads-client";
const result = await createConversionAction({
  name: "Purchase",
  defaultValueUsd: 199,
  urlMatchPattern: "/purchase/success",
});
```

Note the conversion-action ID for tracking.

### 5. Install the gtag snippet

Add to the merchant's root layout:

```tsx
<Script
  id="google-ads-gtag"
  src={`https://www.googletagmanager.com/gtag/js?id=AW-${process.env.NEXT_PUBLIC_GOOGLE_ADS_PIXEL_ID}`}
  strategy="afterInteractive"
/>
<Script id="google-ads-config" strategy="afterInteractive">
  {`window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-${process.env.NEXT_PUBLIC_GOOGLE_ADS_PIXEL_ID}');`}
</Script>
```

Fire the purchase event on `/purchase/success`:

```tsx
useEffect(() => {
  if (window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `AW-${PIXEL_ID}/${CONVERSION_LABEL}`,
      value: 199,
      currency: "USD",
    });
  }
}, []);
```

### 6. Verify the conversion fires

Tools → Conversions → \<your action\> → Status. Should flip to "Recording conversions" within an hour of the first real-life purchase.

### 7. Smoke-test the API connection

```bash
node scripts/google-ads-smoke-test.ts
```

Should return current campaign metadata (likely empty at this stage — that's fine).

### 8. Launch the branded-defense campaign

```bash
node scripts/google-ads-launch-branded.ts
```

This creates:
- A campaign named `<merchant>-branded`
- A single ad group with `[merchant brand name]`, `"merchant brand name"`, and `+brand +keyword` match types
- A $2/day budget
- A single responsive search ad with brand-positive copy

Why branded defense first: it's the cheapest, lowest-risk campaign. If a competitor bids on your brand name and you don't, they steal your search traffic for ~$0.30/click. Branded defense costs ~$60/month and recovers it.

### 9. Set negative keywords

Add as match-type "negative phrase" on the branded campaign:

```
free
job
career
review
```

Prevents "merchant brand free", "merchant brand job", etc. from chewing budget.

### 10. Enable the autonomy crons

Verify the Inngest functions are registered (`app/api/inngest/route.ts` includes `googleAdsSyncFn`, `googleAdsAutonomyFn`). Set the thresholds in env:

```bash
GOOGLE_TARGET_CAC_USD=75
GOOGLE_PURCHASE_VALUE_USD=199    # match your product price
GOOGLE_MIN_SPEND_USD=50          # don't make decisions before $50 spent
GOOGLE_MIN_CONVERSIONS_FOR_RESUME=3
```

### 11. Verify the hourly sync

After 1 hour, check `/admin/campaigns` (or `db:studio`). You should see a `campaigns` row with `platform='google'` and the branded-defense campaign's metrics.

### 12. Set up the budget scaler (optional)

The budget scaler cron (`google-ads-branded-scaler`) bumps the branded campaign's budget when CTR is healthy. Optional — branded defense at $2/day is fine for most merchants. Enable by setting `BRANDED_CAMPAIGN_ID=<id>` env.

### 13. Add a "lead-gen" campaign

This is the volume play. Manually create a Search campaign targeting your high-intent keywords (e.g. `[website for dentists]`, `[done for you website]`). Smart Bidding > Maximize Conversions. $20/day starter budget.

The autonomy cron will:
- Pause it if CAC > $75 after $50 spent.
- Resume it (if previously paused) when historical CAC < $99.50 and conv ≥ 3.

### 14. Watch the first week

Daily check:
- CTR > 5% on branded → healthy.
- CTR < 2% on lead-gen → pause + iterate keywords.
- Cost per conversion stable across days → autonomy will decide; you don't have to.

### 15. Wire the weekly digest

Make sure `OPERATOR_NOTIFY_EMAIL` is set so the Monday digest tells you:

```
Google Ads:           $X spend, Y conv → CAC $Z
```

If that line is consistently above $75, the autonomy will have paused it. If below $50, time to scale budget.

## Common failure modes

- **"Customer not found"**: The `GOOGLE_ADS_LOGIN_CUSTOMER_ID` header is missing or wrong. The merchant customer ID needs the Zilla-HQ MCC as its parent.
- **"Authorization failed"**: The refresh token expired (rare but happens after 6 months of disuse). Re-mint via the script.
- **Conversions show as zero forever**: The gtag firing on `/purchase/success` isn't actually loading on the success page. Open the page in Chrome → Network tab → search "googleads.g.doubleclick.net". If no request fires, the gtag isn't installed.
- **Branded campaign serves to nobody**: Your match types are too tight. Loosen `[brand]` to `"brand"` and `+brand`. Also check that you haven't accidentally added competitor brand names as negatives.

## When to graduate from branded defense to lead-gen

You're ready when:
- 4 weeks of branded-defense data showing CTR > 5%.
- Cold-outreach loop has reached "warm" status (touch-1 reply rate > 1.5%).
- Stripe revenue ≥ $5k/month — enough that a $20/day lead-gen test won't break the budget.

Below those thresholds, the lead-gen campaign will likely fail (insufficient brand recognition + insufficient buffer). Stay on branded only.
