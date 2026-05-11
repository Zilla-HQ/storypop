# EMAILS.md — Template library + copy guidelines

Templates the merchant sends, organized by funnel stage. Each one has variables, a test checklist, and a copy guideline. Ported from SiteGrid's `TEMPLATE.md` — adapt per merchant, but the patterns are general.

## Stages

```
cold outreach (touch 1)
↓
followup (touch 2, day 3)
↓
followup (touch 3, day 7)             ← longer cadence than touch 2
↓
followup (touch 4, day 14, final)
↓
abandoned-checkout (special path, 4h after Stripe checkout)
↓
inbound-classified replies (interested / price / objection / unsub)
↓
post-purchase fulfillment
↓
unsubscribe confirmations
```

Per-vertical variation lives inline in templates as `{{verticalFeature}}` substitutions.

## Variables

Standard variables across every cold-outreach template:

| Variable | Source | Example |
|---|---|---|
| `{{firstName}}` | listing.agentName (first token) | "Sarah" |
| `{{businessName}}` | listing.businessName / address | "Sarah's Dental" |
| `{{cityLabel}}` | listing.city + state | "Austin, TX" |
| `{{previewUrl}}` | merchant.appUrl + /l/<slug> | https://merchant/l/sarahs-dental |
| `{{photoCount}}` | listing.photos.length | 23 |
| `{{verticalFeature}}` | per-vertical feature paragraph | "Online booking that talks to your existing PMS." |

For the post-purchase fulfillment email, add:

| Variable | Source |
|---|---|
| `{{customizeUrl}}` | post-purchase HMAC-gated editor URL |
| `{{unmuteUrl}}` | spectacle opt-in link |
| `{{deliveryUrl}}` | live-site URL |

## Per-vertical concerns

The most important per-vertical customization is the **concern list** that goes into the abandoned-checkout email + the objection-handling reply template. Different verticals fear different things:

| Vertical | Top concerns |
|---|---|
| Restaurants | Online reservations breaking; Google/Yelp/DoorDash link continuity; menu copy |
| Healthcare | Patient portal continuity; HIPAA on intake forms; appointment booking |
| Legal | Referral-partner link continuity; ethics rules on testimonials; SEO inheritance |
| Fitness | Class signup continuity; member-portal logins; schedule embed |
| Trades | Lead-form integrations; pricing display; before/after photo handling |
| Beauty | Booking platform integration; service menu rendering; gallery aspect ratios |

Use these as the **bullets** in the abandoned-checkout email and as the **opening question** in the inbound-classified-objection reply.

## Reply classifier buckets

The inbound webhook routes replies through Claude (`lib/claude.ts`). Six buckets:

| Bucket | Action |
|---|---|
| `interested` | Auto-reply with payment link + answer their question briefly. |
| `price_question` | Auto-reply with pricing email (and optional time-bound code). |
| `objection` | Auto-reply with vertical-aware objection-handler. |
| `not_interested` | Mark and silence — no further sends. |
| `unsubscribe` | Add to `email_blocklist` + send a one-line "got it" confirmation. |
| `complex` / `ambiguous` | Flag for human — operator notification with the reply quoted. |

Customize the system prompt in `lib/claude.ts:classifyInboundEmail`. The classifier should be conservative on `interested` (false positives waste the buyer's time) and aggressive on `unsubscribe` (false negatives create complaints).

## Tone & copy guidelines (port from SiteGrid; adapt)

1. **First-person from a real human.** Use the founder's name + actual reply email. Even though Claude wrote it, signing it from a known person makes the response read as a hand-typed reply.

2. **Charset UTF-8 everywhere.** The em-dash (`—`) and curly quotes break in Latin-1. SiteGrid had a stretch of "â€"" garbage characters in production because `Content-Type: text/html` wasn't `; charset=utf-8`. Make sure the HTML renderer sets it.

3. **No emoji unless the customer used one first.** Hard rule. Easier to enforce than a "sometimes" heuristic.

4. **One specific question, then "or something else?"** Open-ended replies get ignored. A specific question forces an answer or a deflection — both are useful.

5. **Don't repeat the value prop in followups.** Touch 1 has the pitch. Touch 2 is "bumping this in case it slipped." Touch 3 is "last note from me." Re-pitching is a tell that the sender is a robot.

6. **Promo codes only on price-question replies — never on initial sends.** Discount-front-loading trains buyers to wait. If you offer a discount, it should be in response to a real signal.

## Test checklist (per-template, before shipping)

For each new template, verify:

- [ ] Renders correctly in Gmail web (default), Gmail iOS, Outlook web, Apple Mail iOS.
- [ ] HTML version + plain-text version both populated.
- [ ] `Reply-To` header lands in the inbound webhook, not the no-reply mailbox.
- [ ] `List-Unsubscribe` header present (mailto: + URL).
- [ ] HMAC tokens in URLs validate.
- [ ] Subject line under 60 chars.
- [ ] No em-dash garbling (`â€"`).
- [ ] No naked customer email or phone in the visible body (CCPA / privacy hygiene).
- [ ] Spam score: <3 on the dry-run check (use mail-tester.com).

## Open-source templates

The actual template bodies vary too much per merchant to ship in this template. Use SiteGrid's [TEMPLATE.md](https://github.com/Zilla-HQ/sitegrid/blob/main/TEMPLATE.md) as a reference for the SiteGrid-specific copy if you're building a similar vertical.
