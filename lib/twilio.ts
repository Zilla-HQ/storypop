import twilio from "twilio";
import { db, outreachEvents, orders } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { env } from "@/lib/env";

const sid = env("TWILIO_ACCOUNT_SID");
const token = env("TWILIO_AUTH_TOKEN");
const from = env("TWILIO_FROM_NUMBER");

const client = sid && token ? twilio(sid, token) : null;

/**
 * TCPA guardrail: we may only SMS a contact after they have given express
 * prior consent. For our purposes consent is established by EITHER:
 *   (a) the agent *replied* to one of our emails, OR
 *   (b) they have a Stripe Checkout session (started a purchase).
 *
 * A click alone is NOT sufficient consent under TCPA. A scraped phone number
 * from an MLS listing is NOT consent. There is no override for marketing SMS.
 *
 * This function throws on consent failure. Do not catch-and-ignore.
 */
async function hasTcpaConsent(listingId: string): Promise<boolean> {
  const [replied] = await db
    .select({ id: outreachEvents.id })
    .from(outreachEvents)
    .where(and(eq(outreachEvents.listingId, listingId), eq(outreachEvents.status, "replied")))
    .limit(1);
  if (replied) return true;

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.listingId, listingId), isNotNull(orders.stripeSessionId)))
    .limit(1);
  return !!order;
}

export interface SendSmsArgs {
  listingId: string;
  to: string; // E.164
  body: string;
}

export async function sendPostEngagementSms(args: SendSmsArgs): Promise<{ sid: string | null }> {
  const ok = await hasTcpaConsent(args.listingId);
  if (!ok) {
    throw new Error(
      `TCPA_CONSENT_MISSING: cannot SMS listing=${args.listingId}. Requires prior email reply or Stripe Checkout session.`,
    );
  }

  if (!client || !from) {
    // eslint-disable-next-line no-console
    console.warn("[twilio] stub send; credentials missing");
    return { sid: null };
  }

  const msg = await client.messages.create({
    from,
    to: args.to,
    body: args.body,
  });
  return { sid: msg.sid };
}
