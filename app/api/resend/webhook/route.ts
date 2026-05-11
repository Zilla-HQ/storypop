import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { inngest } from "@/inngest/client";
import { db, outreachEvents } from "@/db";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

const SECRET = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();

/**
 * Resend uses Svix under the hood for outbound webhook signing. The
 * canonical Svix verification protocol:
 *   1. Read svix-id / svix-timestamp / svix-signature headers
 *   2. signed_payload = `${svix_id}.${svix_timestamp}.${raw_body}`
 *   3. Strip the "whsec_" prefix from the secret, base64-decode the rest
 *   4. HMAC-SHA256(decoded_secret, signed_payload), base64-encode result
 *   5. Compare to one of the `v1,<sig>` entries in svix-signature
 *      (multiple sigs may be present during key rotation)
 *
 * The previous implementation used naïve HMAC over the raw body which is
 * incompatible with Svix and silently 401'd every event — leaving every
 * outreach_events row stuck on status='sent' with no open/click tracking.
 */
function verifySvixSignature(args: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
}): boolean {
  if (!args.secret.startsWith("whsec_")) return false;
  const secretBytes = Buffer.from(args.secret.replace(/^whsec_/, ""), "base64");
  const signedPayload = `${args.svixId}.${args.svixTimestamp}.${args.rawBody}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64");
  // Svix sends one or more "v1,<sig>" pairs separated by spaces.
  const candidates = args.svixSignature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice(3));
  const expectedBuf = Buffer.from(expected);
  for (const c of candidates) {
    const cBuf = Buffer.from(c);
    if (cBuf.length === expectedBuf.length && timingSafeEqual(cBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (SECRET && svixId && svixTimestamp && svixSignature) {
    const ok = verifySvixSignature({
      secret: SECRET,
      svixId,
      svixTimestamp,
      svixSignature,
      rawBody: raw,
    });
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn(`[resend-webhook] signature mismatch — rejecting`);
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else if (SECRET) {
    // Headers missing — log and reject. Resend always sets the svix-* headers.
    // eslint-disable-next-line no-console
    console.warn(`[resend-webhook] missing svix-* headers; rejecting`);
    return NextResponse.json({ error: "missing signature headers" }, { status: 401 });
  }
  // If no SECRET set, accept (dev mode only).

  const payload = JSON.parse(raw) as {
    type?: string;
    data?: Record<string, unknown>;
  };
  const type = payload.type ?? "";
  const data = payload.data ?? {};

  // Outbound event webhooks
  if (type.startsWith("email.")) {
    const emailId = (data.email_id as string | undefined) ?? (data.id as string | undefined);
    if (!emailId) return NextResponse.json({ ok: true });

    const newStatus = mapResendStatus(type);
    if (!newStatus) return NextResponse.json({ ok: true });

    const setObj: Record<string, unknown> = { status: newStatus };
    if (newStatus === "opened") setObj.firstOpenedAt = sql`coalesce(${outreachEvents.firstOpenedAt}, now())`;
    if (newStatus === "clicked") setObj.firstClickedAt = sql`coalesce(${outreachEvents.firstClickedAt}, now())`;

    await db
      .update(outreachEvents)
      .set(setObj)
      .where(eq(outreachEvents.resendId, emailId));

    return NextResponse.json({ ok: true });
  }

  // Inbound email webhook
  if (type === "inbound.email" || type === "email.received" || type === "inbound") {
    const from = extractAddress(data.from ?? data.sender ?? "");
    const to = extractAddress(data.to ?? data.recipient ?? "");

    await inngest.send({
      name: "inbound/email",
      data: {
        from,
        to,
        subject: (data.subject as string | null) ?? null,
        text: (data.text as string | null) ?? (data.plain as string | null) ?? null,
        html: (data.html as string | null) ?? null,
        messageId: (data.message_id as string | null) ?? (data.messageId as string | null) ?? null,
        inReplyTo:
          (data.in_reply_to as string | null) ?? (data.inReplyTo as string | null) ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: type });
}

function mapResendStatus(
  type: string,
):
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | null {
  switch (type) {
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    default:
      return null;
  }
}

function extractAddress(raw: unknown): string {
  if (typeof raw === "string") {
    const match = raw.match(/<([^>]+)>/);
    return (match?.[1] ?? raw).trim().toLowerCase();
  }
  if (Array.isArray(raw) && raw.length > 0) return extractAddress(raw[0]);
  if (typeof raw === "object" && raw && "email" in raw) {
    return extractAddress((raw as { email: unknown }).email);
  }
  return "";
}
