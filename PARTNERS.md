# Partner outreach — B2B recruitment runbook

Two cold-outreach pipelines run side by side in the template:

1. **Customer outreach** — the main loop. Scrapes the vertical's directories (Yelp / Apify / etc.) → enriches contact email → audits or generates a preview → sends a personalized cold email. This is the merchant's primary acquisition channel. See `MERCHANT.md` §4.
2. **Partner outreach** — recruit agencies, consultants, and freelancers as referral partners. **This doc.**

The two pipelines share the same Resend / CAN-SPAM plumbing but differ on cadence, copy, table, and who they target. Partners are slower-moving than customers and benefit from a higher-margin offer (revenue share) rather than a discount.

This is the pattern running live for [Sitebeat](https://github.com/Zilla-HQ/sitebeat) (recruiting SEO agencies onto Rewardful) — it's generalizable to any merchant where a referral / affiliate side makes sense.

---

## Architecture

### Tables

- **`partner_outreach`** — one row per prospect. Columns include `email` (unique), `name`, `company`, `notes`, `status` (`queued` / `sent` / `replied` / `unsubscribed`), `send_count`, `first_sent_at`, `last_sent_at`, `last_outbound_message_id`, `last_replied_at`, `reply_count`.

### Code paths

- **`lib/partner-outreach.ts`** — the sender. `sendPartnerEmail({ prospectId, variant: "initial" | "followup" | "custom" })` is the only entry point. Idempotency key includes `send_count + 1` so accidental double-clicks don't double-send.
- **`lib/partner-pitch-template.ts`** — `initialPitchSubject/Text/Mjml`, `followupPitchSubject/Text/Mjml`. Edit these for your merchant's offer.
- **`lib/partner-import.ts`** — pulls candidate agency emails out of your existing audit/discovery data (sites the merchant already crawled, filtered to those whose URL or business name matches an agency-keyword whitelist). Avoids buying another scrape.
- **`app/api/partner-discover/route.ts`** — manual + cron endpoint that calls `runPartnerDiscovery()` to ingest into `partner_outreach`.
- **`app/admin/partner-outreach/page.tsx`** — operator UI: paste a CSV, click send, see send/reply counts, filter by status.

### Send-from address

Partner emails go out from `partners@<sender-domain>` (note the `fromUser: "partners"` arg). This separates partner replies from customer replies at the inbox level — operators can triage `partners@` differently and reply detection scopes correctly.

You'll need to configure `partners@` as a sending address on the merchant's verified Resend domain (auto-handled by Resend's domain verification — no per-mailbox setup needed) and as an inbound forwarder if you want operator visibility on replies.

---

## What makes partner outreach different from customer cold email

| | Customer outreach | Partner outreach |
|---|---|---|
| **Source** | Scraped directories per vertical | Filtered subset of your existing audit data (or imported list) |
| **Pitch angle** | The customer's problem + the merchant's free-audit / preview | Revenue share + reciprocal value (30% LTV is the Sitebeat default) |
| **Threading** | None on first touch | Follow-ups always thread via `In-Reply-To: last_outbound_message_id` |
| **Cadence** | Multi-touch (see `COLD_FOLLOWUP.md`) | Manual + 1 scheduled followup (5-day default) |
| **Reply handling** | Claude classifier into 6 buckets + auto-reply | Just bumps `status="replied"`; operator handles personally |
| **Status flow** | `queued → sent → opened → clicked → replied → unsubscribed` | `queued → sent → replied` |
| **Send-from** | `replies@` (default sender domain) | `partners@<sender-domain>` |
| **Volume** | Daily-send-cap (e.g. 500/day) | Single-digit batches, founder-touch pace |

The partner pipeline is intentionally **not auto-reply'd**. A replied agency is a 30-minute live conversation with the operator — that's the whole point. Don't bolt on Claude classification here.

---

## Setup

### 1. Edit `lib/partner-pitch-template.ts`

Two variants:

```ts
initialPitchSubject({ recipientName, hook })
initialPitchText({ recipientName, hook })
initialPitchMjml({ recipientName, hook })
followupPitchSubject({ recipientName, hook })
followupPitchText({ recipientName, hook })
followupPitchMjml({ recipientName, hook })
```

Rewrite the body for your merchant's offer. Keep the `recipientName` placeholder so the import script can personalize.

### 2. Add `partners@` to your Resend domain

In Resend → Domains → your verified subdomain, no per-mailbox config is needed; the domain itself accepts any local-part. Confirm with a test send.

For replies, add an inbound webhook (or forward `partners@<domain>` to your operator inbox via your DNS provider) — Resend's inbound webhook to `/api/resend/webhook` is the platform default.

### 3. Populate prospects

Two paths, both write into `partner_outreach`:

```bash
# Pull from your existing audit data — filters by agency keywords
curl -X POST https://<your-merchant>/api/partner-discover \
  -H "x-admin-secret: $CRON_SECRET"
```

Or paste a CSV into `/admin/partner-outreach`. The bulk-add path dedupes against the email blacklist and existing prospects.

### 4. Run a small batch

Open `/admin/partner-outreach`, filter to `status=queued`, send to 5–10 prospects manually. Watch open rates and reply rates for two days before scaling.

### 5. (Optional) Schedule the followup

Add an Inngest function that finds `status=sent` rows with `last_sent_at < NOW() - 5 days` and calls `sendPartnerEmail({ variant: "followup" })`. Keep the cap small (10/day) so partner volume never crowds out customer outreach.

---

## Operating the loop

### Customizing per-prospect

The `variant: "custom"` path lets the operator type a fully bespoke message (subject + text) and still get threading + tracking + idempotency for free. Use this for high-value prospects where the templated pitch isn't appropriate.

### Reply detection

`recordPartnerReply(fromAddress)` is called from the inbound-email webhook handler (`app/api/resend/webhook/route.ts`). It matches case-insensitively against `partner_outreach.email`, bumps `reply_count`, sets `last_replied_at`, and transitions `status` to `replied` if currently `sent` or `queued`. **It does not auto-reply.**

### Threading

`lastOutboundMessageId` is set on every send. Followups + custom variants pass it as both `inReplyTo` and `references` so the partner's email client groups the thread. Initial sends don't thread (there's nothing to reply to).

### Tags

Every send is tagged `kind=partner_outreach`, `variant=initial|followup|custom`, `prospect_id=<id>`. Filter Resend's dashboard by these tags to see partner outreach in isolation.

---

## Don't touch

- The `idempotencyKey` shape (`partner_outreach_${id}_${sendCount + 1}`) — it's what makes the "Send" button safe to double-click. If you rename, also rename historically because Resend keeps idempotency state ~24h.
- The status transition rule in `sendPartnerEmail`: only `queued → sent` happens on initial; followups don't touch status. That's so a replied partner doesn't get bumped back to "sent" by an accidental followup.
- The `onConflictDoNothing({ target: partnerOutreach.email })` upsert in `bulkAddProspects` — that's the dedupe.
- The `partners@` from-user. Customer auto-replies need to come from `replies@` (so the reply-handler can distinguish them).

---

## Reference implementation

Sitebeat recruits SEO agencies as Rewardful affiliates using exactly this stack. See [`Zilla-HQ/sitebeat`](https://github.com/Zilla-HQ/sitebeat) — same file paths.
