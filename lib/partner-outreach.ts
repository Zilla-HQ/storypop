import { db, partnerOutreach } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendComplianceEmail } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import {
  initialPitchSubject,
  initialPitchText,
  initialPitchMjml,
  followupPitchSubject,
  followupPitchText,
  followupPitchMjml,
} from "@/lib/partner-pitch-template";

export interface SendPartnerEmailArgs {
  prospectId: string;
  variant: "initial" | "followup" | "custom";
  // For "custom" variant — operator-typed message body for follow-ups.
  customSubject?: string;
  customText?: string;
}

const SENDER_DOMAIN = process.env.SENDER_DOMAIN ?? "resend.dev";

/**
 * Send a partner-outreach email to a single prospect. Updates the
 * partner_outreach row with send count, last sent message ID, and
 * status. Idempotency is enforced on (prospectId, sendCount) so
 * accidental double-clicks don't double-send.
 */
export async function sendPartnerEmail(args: SendPartnerEmailArgs) {
  const [prospect] = await db
    .select()
    .from(partnerOutreach)
    .where(eq(partnerOutreach.id, args.prospectId))
    .limit(1);

  if (!prospect) throw new Error("Prospect not found");
  if (prospect.status === "unsubscribed") {
    throw new Error("Prospect is unsubscribed — refusing to send");
  }

  const variables = {
    recipientName: prospect.name,
    hook: null,
  };

  let subject: string;
  let text: string;
  let mjml: string;
  let inReplyTo: string | undefined;

  if (args.variant === "initial") {
    subject = initialPitchSubject(variables);
    text = initialPitchText(variables);
    mjml = initialPitchMjml(variables);
  } else if (args.variant === "followup") {
    subject = followupPitchSubject(variables);
    text = followupPitchText(variables);
    mjml = followupPitchMjml(variables);
    inReplyTo = prospect.lastOutboundMessageId ?? undefined;
  } else {
    if (!args.customSubject || !args.customText) {
      throw new Error("Custom variant requires customSubject and customText");
    }
    subject = args.customSubject;
    text = args.customText;
    mjml = customMjml(args.customText);
    inReplyTo = prospect.lastOutboundMessageId ?? undefined;
  }

  // Tag every send so Resend dashboard groups them and so we can
  // filter outbound events by partner-outreach later.
  const tags = [
    { name: "kind", value: "partner_outreach" },
    { name: "variant", value: args.variant },
    { name: "prospect_id", value: prospect.id },
  ];

  // Idempotency key includes sendCount so the next click after a
  // network blip doesn't dedupe with the first.
  const idempotencyKey = `partner_outreach_${prospect.id}_${prospect.sendCount + 1}`;

  const result = await sendComplianceEmail({
    to: prospect.email,
    fromDomain: SENDER_DOMAIN,
    fromName: "Jack at Sitebeat",
    fromUser: "partners",
    subject,
    text,
    mjml,
    inReplyTo,
    references: inReplyTo,
    tags,
    listingId: `partner_${prospect.id}`,
    idempotencyKey,
  });

  // Persist the message ID and update status. We mark "sent" only when
  // the variant is initial; follow-ups don't change status (still
  // "sent" until they actually reply).
  const newStatus =
    args.variant === "initial" && prospect.status === "queued" ? "sent" : prospect.status;

  await db
    .update(partnerOutreach)
    .set({
      status: newStatus,
      firstSentAt: prospect.firstSentAt ?? new Date(),
      lastSentAt: new Date(),
      sendCount: prospect.sendCount + 1,
      lastOutboundMessageId: result.id,
      updatedAt: new Date(),
    })
    .where(eq(partnerOutreach.id, prospect.id));

  return { messageId: result.id };
}

export async function bulkAddProspects(rows: { email: string; name?: string; company?: string; notes?: string }[]) {
  // Validate emails + dedupe within input + against blacklist.
  const settings = await getSettings();
  const blacklist = new Set(
    (settings.emailBlacklist ?? []).map((e) => e.trim().toLowerCase()),
  );

  const seen = new Set<string>();
  const cleaned: { email: string; name?: string; company?: string; notes?: string }[] = [];
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 254) continue;
    if (seen.has(email)) continue;
    if (blacklist.has(email)) continue;
    seen.add(email);
    cleaned.push({
      email,
      name: r.name?.trim() || undefined,
      company: r.company?.trim() || undefined,
      notes: r.notes?.trim() || undefined,
    });
  }

  if (cleaned.length === 0) return { inserted: 0 };

  const result = await db
    .insert(partnerOutreach)
    .values(cleaned.map((c) => ({ email: c.email, name: c.name ?? null, company: c.company ?? null, notes: c.notes ?? null })))
    .onConflictDoNothing({ target: partnerOutreach.email })
    .returning({ id: partnerOutreach.id });

  return { inserted: result.length, attempted: cleaned.length };
}

/**
 * Match an inbound reply (from `fromAddress`) to a partner_outreach
 * row. Updates `last_replied_at`, increments `reply_count`, and bumps
 * status to "replied" if currently "sent".
 *
 * Called from app/api/resend/webhook/route.ts after persisting the
 * inbound row.
 */
export async function recordPartnerReply(fromAddress: string): Promise<boolean> {
  const lower = fromAddress.trim().toLowerCase();
  const [match] = await db
    .select({ id: partnerOutreach.id, status: partnerOutreach.status })
    .from(partnerOutreach)
    .where(eq(partnerOutreach.email, lower))
    .limit(1);
  if (!match) return false;

  await db
    .update(partnerOutreach)
    .set({
      lastRepliedAt: new Date(),
      replyCount: sql`${partnerOutreach.replyCount} + 1`,
      status:
        match.status === "sent" || match.status === "queued" ? "replied" : match.status,
      updatedAt: new Date(),
    })
    .where(eq(partnerOutreach.id, match.id));
  return true;
}

function customMjml(text: string): string {
  // Convert plaintext paragraphs to MJML paragraphs. Operator wrote
  // the body — keep formatting minimal and faithful.
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return `
<mjml>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 16px">
      <mj-column>
        ${paragraphs
          .map(
            (p) => `<mj-text font-size="14px" color="#0f172a" line-height="1.55">${escapeHtml(
              p,
            ).replace(/\n/g, "<br/>")}</mj-text>`,
          )
          .join("\n        ")}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
