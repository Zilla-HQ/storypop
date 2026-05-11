# SPONSORS.md — Sponsor / partner / press outreach

A second, distinct cold-outreach loop for pitching influential audiences (podcast hosts, newsletter editors, partners, press). Separate from the cold-outreach loop that pitches the product to small-business owners.

## Why a separate loop

Three reasons:

1. **Deliverability isolation.** A sponsor flagging spam can't poison the deliverability of your revenue-engine sending domain. Sponsor sends use `SPONSOR_SEND_DOMAIN` (defaults to a `partners.<merchant-domain>` separate from `mail.<merchant-domain>`).

2. **No auto-classification on inbound.** Sponsors who reply deserve human responses, not Claude auto-replies. The inbound webhook checks `outbound_contacts.email` BEFORE the listing-email match, so a sponsor's reply lands in the contact's thread without ever touching the auto-classifier.

3. **Different cadence.** Warmup curve is 3/day → 10/day over 14 days (vs cold outreach's 20→200). Smaller audience (≈80 seed-discovered max), higher per-recipient deliverability cost.

## The 3-touch cadence

```
Day 0   Touch 1 — initial pitch (from CONTACT_TEMPLATES)
Day 7   Touch 2 — brief "bumping this" follow-up
Day 14  Touch 3 — final "last bump from me" close-out
Day 21  Auto-archive
```

Status transitions:
- Operator/system inserts → `queued` (autoSendEnabled=true)
- Touch 1 sent → `sent`, touchNumber=1
- Touch 2 sent → touchNumber=2
- Touch 3 sent → touchNumber=3
- Day 21 → `archived`
- Inbound reply at any point → `replied` (operator handles manually)
- Operator marks → `declined` | `won` (terminal)

## Two safety gates

1. **`SPONSOR_OUTREACH_ENABLED` env must be `true`**. Defaults to `false`. Discovery alone produces a queue; sending is opt-in.

2. **Per-contact `autoSendEnabled` must be true.** An operator who adds a contact manually via the admin UI with this flag off keeps the contact human-curated forever.

## Discovery

`inngest/functions/sponsor-discover.ts` runs weekly (Sunday 18:00 UTC). Reads `SPONSOR_SEED_DOMAINS` (a comma-separated list of `domain|organization|kind|template_id` rows), calls Hunter's domain-search API for each domain, and upserts personas into `outbound_contacts`.

Example seed list:

```
SPONSOR_SEED_DOMAINS="thedentalpodcast.com|The Dental Podcast|podcast|podcast_dental,startupchat.fm|Startup Chat|podcast|podcast_generic,thingsinblack.io|Things In Black|newsletter|newsletter_generic"
```

Idempotency:
- Email already in DB: only the templateId is patched (when empty). Never clobbers a manual edit.
- Per-run cap (default 30 new contacts) prevents a Hunter quota refresh from drowning the queue in one run.

## Template registry

`lib/sponsor-contacts.ts:CONTACT_TEMPLATES` ships four starter templates:

| ID | Kind | Use |
|---|---|---|
| `podcast_generic` | podcast | Generic podcast mid-roll pitch |
| `newsletter_generic` | newsletter | One-line sponsored mention |
| `partner_affiliate` | partner | Affiliate program pitch |
| `press_generic` | press | Story-pitch to bloggers/journalists |

Customize per merchant by editing the array. Placeholders `{{firstName}}`, `{{name}}`, `{{organization}}`, `{{role}}` are substituted at send time via `applyTemplate()`.

## Operator UX

A typical sponsor admin page (`app/admin/outreach/page.tsx` — not auto-generated, build per merchant) shows:

- The discovery queue (`status='queued'`, sortable by `kind`).
- Active threads (`status='sent'`, with `lastSendAt` + touch number).
- The reply inbox (`status='replied'` — these need eyeballs).
- A "won/declined/archive" terminal-state filter.

The weekly digest email surfaces the reply inbox as a bulleted list under `OUTSTANDING REPLIES (need your eyeballs)`.

## Routing inbound replies

In your inbound webhook handler:

```ts
// FIRST: check outbound_contacts (sponsor table)
const [contact] = await db
  .select()
  .from(outboundContacts)
  .where(eq(outboundContacts.email, fromEmail.toLowerCase()))
  .limit(1);

if (contact) {
  await db.insert(outboundContactMessages).values({
    contactId: contact.id,
    direction: "in",
    subject,
    bodyText,
    bodyHtml,
    status: "received",
  });
  await db
    .update(outboundContacts)
    .set({ status: "replied", lastTouchedAt: new Date() })
    .where(eq(outboundContacts.id, contact.id));
  await notifyOperator({
    prefix: prefixForKind(contact.kind), // 🎙️ podcast / 📰 newsletter / 🤝 partner / 📨 press
    contact,
    subject,
    bodyText,
  });
  return; // do NOT fall through to listing-email match
}

// THEN: existing listing-email match + auto-classify
```

## Operator notification prefixes

Helpful for at-a-glance triage in the operator's inbox (the SiteGrid pattern):

- 🎙️ podcast
- 📰 newsletter
- 🤝 partner
- 📨 press
- 📩 other

Implement in your `notifyOperator()` helper.

## What this doesn't do

- No CRM-style stages beyond the 6 states. If you need pipeline-style management, export to Attio / a real CRM.
- No A/B testing of template variants. The discovery cron picks the seed's templateId; manual overrides happen at admin-edit time.
- No multi-recipient threads. Every reply lands in a single 1:1 thread per contact.
