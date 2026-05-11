# StoryPop

An autonomous AI merchant that creates personalized illustrated children's books. A parent enters a kid's name (and optionally uploads a photo); StoryPop generates a 12–16 page custom story with the child as the protagonist, illustrated end-to-end, delivered as a print-on-demand hardcover or instant PDF. Built on the [Zilla merchant template](https://github.com/Zilla-HQ/merchant-template).

The merchant runs B2C — no cold outreach to "agents" — but the same six-agent backbone powers it: a discovery layer pulls parent leads from paid ads, qualification scores intent (form completeness + photo quality), preview generates the first 3 pages free, outreach is the abandoned-cart + delivery email chain, payment is Stripe Checkout, fulfillment is the print partner's API.

```
Ad click → Generator → Preview (free pages) → [Payment] → Print fulfillment → Delivery
                                            ↘  Abandoned-cart email (24h)
```

Live at [storypop.shop](https://storypop.shop). Samples: [storypop.shop/samples](https://storypop.shop/samples).

---

## What StoryPop does

Each book is built from three inputs and three generators:

| Input | Source | Used by |
|---|---|---|
| Child's name + age + pronouns | Form on `/create` | Story + cover |
| (Optional) child photo | Form upload, R2 | Character lock-in for illustrations |
| Story archetype | Picker: "adventure / bedtime / first day / sibling / lost tooth / birthday" | Story skeleton + tone |

| Generator | Tool | Output |
|---|---|---|
| Story | Claude Sonnet | 12–16 page rhyming or prose narrative tuned to the age band (2–4, 5–7, 8–10) |
| Illustrations | fal.ai Nano Banana Pro + Flux character-lock LoRA | 1 image per page, plus cover + dedication |
| Layout | Sharp + react-pdf | Print-ready PDF + web-flippable preview |

Products:

- **Instant PDF** — $14.99. Delivered to email within 5 minutes of checkout.
- **Softcover (8.5×8.5)** — $29.99. Printed + shipped via Lulu xPress in 5–8 days.
- **Hardcover (8.5×11)** — $44.99. Printed + shipped via Lulu xPress in 7–10 days.
- **Gift bundle** (hardcover + matching plush) — $69.99. Plush pulled from Printful.

---

## Stack

Same as merchant-template — see [MERCHANT.md](MERCHANT.md) for the full StoryPop-specific delta.

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui |
| Database | Supabase Postgres + Drizzle ORM |
| Workflows | Inngest |
| Admin auth | Clerk (operator only) |
| Payments | Stripe Checkout + webhooks |
| Email | Resend (transactional + abandoned cart) |
| Storage | Cloudflare R2 |
| Story gen | Anthropic Claude Sonnet |
| Image gen | fal.ai (Nano Banana Pro + Flux character LoRA) |
| Print fulfillment | Lulu xPress API (books) + Printful (gift bundles) |
| Analytics | PostHog + Meta Pixel + CAPI |
| Ads | Meta (primary) + TikTok (secondary) — see `META_ADS.md` |

---

## Local development

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run dev          # http://localhost:3000

# In a separate terminal:
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

---

## First-time setup (manual steps)

1. **Domains** — `storypop.shop` (primary, live) + `storypop.co` (backup). Sender `mail.storypop.shop` warmed for transactional + abandoned-cart only (no cold outreach).
2. **LLC + bank** — Delaware LLC under Zilla parent. Mercury.
3. **Stripe** — live mode + tax + webhook → `POST /api/stripe/webhook` with `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`. Enable Stripe Tax — physical-goods nexus expands per state shipped to.
4. **Supabase** — create project. `npm run db:push`.
5. **Clerk** — operator-only app.
6. **fal.ai** — API key. Verify Nano Banana Pro + Flux LoRA access. Pre-train character-lock LoRA per book from the uploaded photo (3-shot, ~$0.18/book).
7. **Lulu xPress** — `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET`. Sandbox first; flip to prod after one verified printed proof.
8. **Printful** — only if shipping the gift bundle SKU. `PRINTFUL_API_KEY`.
9. **Resend** — sender subdomain DKIM/SPF/DMARC. Transactional templates only.
10. **R2** — bucket `storypop-books`. Public read on `pages/*` (previews); signed URLs on `final/*` (full books gated by paid order).
11. **Meta** — Pixel ID + CAPI token. **Ad account is provisioned under Zilla BM `1952475115474490`** (see `ZILLA_HQ_SETUP_META.md`). App ID `1237129394917034`.
12. **PostHog** — analytics project.

---

## Deploying

1. **Vercel** — push to GitHub, import. All envs.
2. **Inngest Cloud** — sync `/api/inngest`. Cron functions: `preview-stuck-watchdog`, `order-stuck-watchdog`, `abandoned-cart`.
3. **Stripe** — switch webhook URL.
4. **Lulu** — flip to production base URL.
5. **Meta** — flip Pixel from test to production events.

---

## Happy-path test

```bash
# 1. Open http://localhost:3000/create
#    Fill in: name="Lily", age=5, pronouns=she/her, archetype="bedtime", upload any kid photo.
#    Submit → /generating/<previewId>

# 2. Inngest dev UI fires:
#    preview/started → story/drafted → illustrations/in-progress (1–8 min) → preview/ready

# 3. /preview/<previewId> shows pages 1–3 free + Stripe checkout.

# 4. Click "Get the full book — $14.99 PDF" → Stripe test card 4242
#    → /delivery/<orderId>

# 5. orders/paid → fulfillment renders remaining pages → final PDF in R2 →
#    delivery email arrives with the signed PDF link.

# 6. (Optional) Pick the hardcover SKU → fulfillment hits Lulu sandbox →
#    /delivery/<orderId> shows tracking polling stub.
```

---

## Hardcoded guardrails (do not remove)

1. **COPPA stance** — StoryPop is a tool for **parents**, not children. The signup form requires the buyer affirm 18+. We collect the kid's first name and age; no other PII. **Photos** are stored 30 days then auto-purged; never used for training. See `app/(marketing)/privacy/page.tsx`.
2. **CAN-SPAM footer** — `lib/resend.ts` injects address + unsubscribe even on transactional. No marketing without prior purchase opt-in.
3. **Content safety gate** — Claude story drafts run through a refusal filter before image gen. Blocks: violence, romance/sexuality, real-world political figures, branded characters (Disney, Marvel, etc.). See `lib/claude.ts:storySafetyGate`.
4. **Image safety gate** — fal.ai prompts include a safety preamble + deny list. The child photo is used only to lock features (hair, skin, eye color, glasses, age) — never to render likenesses of other people in the photo. See `lib/falai.ts:lockCharacter`.
5. **Refund-on-fail** — if final book misses ≥2 image-gen retries, fulfillment auto-refunds and emails an apology with a manual override link to the operator.

---

## File tour

```
app/(marketing)/page.tsx           — Landing + "Make your book" CTA
app/(marketing)/create/page.tsx    — The book-builder form
app/(marketing)/samples/page.tsx   — Public examples
app/preview/[previewId]/page.tsx   — Free 3-page preview + checkout
app/delivery/[orderId]/page.tsx    — Post-purchase delivery + print tracking
db/                                — schema (books, orders, prints, previews)
inngest/functions/preview.ts       — Free-tier generation chain
inngest/functions/fulfillment.ts   — Full-book gen + Lulu submission
inngest/functions/abandoned-cart.ts — 24h email if preview didn't convert
inngest/functions/print-tracking.ts — Poll Lulu for shipment updates
lib/claude.ts                      — Story drafting + safety gate
lib/falai.ts                       — Nano Banana Pro + LoRA character-lock
lib/lulu.ts                        — Print partner wrapper
lib/printful.ts                    — Gift bundle wrapper
lib/r2.ts                          — Upload + signed URLs
lib/meta-capi.ts                   — Conversion event firing
```

See [MERCHANT.md](MERCHANT.md) for the full fork-and-config checklist.
