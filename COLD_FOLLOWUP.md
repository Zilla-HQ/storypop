# Cold-outbound follow-up sequence

The original template shipped single-touch outreach by design (one cold send per lead, no follow-up). The reference [Sitebeat](https://github.com/Zilla-HQ/sitebeat) merchant pushed past this — **50%+ of replies arrive after the first follow-up** when the cadence is tuned, so the template now ships a 3-touch sequence by default. Flip it off if your merchant disagrees.

This is `lib/cold-followup.ts` + `lib/cold-followup-templates.ts` + `inngest/functions/cold-followup-sweep.ts`.

---

## Stage windows

| Stage | Days since first send | Tone | Default copy |
|---|---|---|---|
| **DAY2** | 1–3 days | Soft nudge | "Quick check — did the audit reach you?" |
| **DAY5** | 4–7 days | Convert with friction-killer | Promo code OR free-trial mention (see below) |
| **DAY10** | 8–30 days | Break-up | "Closing the loop — last note" |

> Leads older than 30 days are skipped. They're stale and re-engaging them lowers sender reputation more than it converts. Don't extend the window past 30.

Each stage is **once per lead, ever**. Idempotency is enforced by checking `inbound_emails` rows where `direction=outbound`, `to_address=lead_email`, `tag=<stage_tag>`. Re-running the sweep is safe.

---

## Trial vs. promo — the friction-killer choice

The DAY5 stage is the hottest conversion lever. Two ways to lower the cold-ask friction:

### Option A — promo code at DAY5

Default in the template. The sweep calls `ensureSharedPromoCode()` on startup, which idempotently creates a `FIRST50` Stripe coupon (50% off first month, cap of 200 redemptions). The DAY5 email mentions the code; the customer applies it at checkout.

```ts
const SHARED_PROMO_CODE = "FIRST50";  // lib/cold-followup.ts:42
```

### Option B — free trial (recommended for SaaS subscriptions)

Sitebeat originally shipped DAY5 with `FIRST50` (50% off first month). After two weeks of cold-volume data, **a 14-day free trial converted measurably better than the 50%-off promo**. Reason: "$29 today, with this code" still asks the customer to commit at the cold-ask step. "No charge today" doesn't.

If your merchant sells a recurring subscription, switch DAY5 copy to mention the trial and add `trial_period_days` to the Stripe Checkout session:

```ts
// app/api/checkout/route.ts
const isMonthly = body.plan === "<your-monthly-plan>";
const session = await stripe.checkout.sessions.create({
  // ...
  subscription_data: {
    metadata: sharedMetadata,
    ...(isMonthly ? { trial_period_days: 14 } : {}),
  },
});
```

> Apply the trial **only to the monthly plan**. Annual customers are already showing high commitment and a free trial there confuses pricing math.

The DAY5 template copy at `lib/cold-followup-templates.ts` already includes both phrasings — uncomment the trial line and comment out the promo line if you go this route. Keep the underlying `FIRST50` plumbing in case you want to A/B them.

---

## Threading

Follow-ups thread into the original cold email by matching `In-Reply-To` and `References` against the `audit_report` (or your merchant's equivalent first-touch tag) outbound message ID in `inbound_emails`. Gmail / Outlook will group all four touches as one conversation in the recipient's inbox — substantially higher reply rate than four orphan threads.

If the original send predates the outbound-logging change, threading falls back to none. That's fine — the email still sends, just as a fresh thread.

---

## What skips a lead

`findFollowupCandidates()` excludes:

1. **No customer_email** — nothing to send to.
2. **Last audit / first-touch < 1 day or > 30 days old** — outside the window.
3. **Active or trialing subscription** — they already converted.
4. **Any inbound reply from the customer's email** — they're a live conversation, don't blast templated copy at them.
5. **Already-sent this stage** — `inbound_emails` row with `direction=outbound, to=customer_email, tag=<stage_tag>` exists.

---

## Configuration

### Cron

The sweep runs as `inngest/functions/cold-followup-sweep.ts`. Default schedule is once daily; tune in the function definition. Don't schedule more often than 12h — the stage logic gates on whole-day windows so faster cadence is wasted work.

### Per-stage caps

There's no built-in per-stage cap; the sweep sends to every eligible candidate. If your volume spikes, add a cap in `runFollowupSweep` after `findFollowupCandidates()` returns:

```ts
const MAX_PER_STAGE = 100;  // pull from env if you want
```

### Disabling individual stages

Wrap `sendFollowupEmail` calls in an env check:

```ts
if (env("FOLLOWUP_DAY5_ENABLED") === "false") continue;
```

### Tags (don't rename)

```ts
FOLLOWUP_TAG.day2  = "audit_followup_day2"
FOLLOWUP_TAG.day5  = "audit_followup_day5"
FOLLOWUP_TAG.day10 = "audit_followup_day10"
```

These tags are how the idempotency check finds prior sends. Renaming them resets the "already sent" check and the next sweep will re-send everything.

---

## Why this is on by default now

The original template comment (`Per spec: no third touch ever.`) was a conservative choice based on the original Realscale build's experience. The Sitebeat data overrode it: with a tuned 3-touch sequence at the right cadence (day 2 / day 5 / day 10), follow-ups out-converted first-touches by 2.4× over a 60-day window. The single-touch comment is removed.

If your merchant doesn't want follow-ups, the cleanest opt-out is to disable the Inngest cron:

```ts
// inngest/functions/cold-followup-sweep.ts
// comment out the { cron: ... } trigger entry
```

---

## Don't touch

- The 30-day upper bound — extending past it lowers sender reputation.
- The "no active subscription" + "no inbound reply" gates — a single send to a converted or replying lead is the difference between "templated touchpoint" and "spam from a vendor I just paid."
- The `FOLLOWUP_TAG` values. See above.
- The `idempotencyKey` shape `${FOLLOWUP_TAG[stage]}_${siteId}` — uniqueness on `(stage, site)` is the contract.
