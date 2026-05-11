import { Resend } from "resend";
import { db, outboundContacts, outboundContactMessages } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Sponsor / partner / press outreach.
 *
 * Distinct from the lead-driven cold outreach loop (`outreach.ts`):
 *   - The recipient is NOT a small-business owner / homeowner / lead, so
 *     the unsubscribe-token footer + List-Unsubscribe headers are kept
 *     light. Sponsors don't deserve a one-click unsub button on a sponsor
 *     pitch — they hit reply or ignore.
 *   - Sends are operator-triggered OR cron-driven, never auto-triggered
 *     by a downstream event. There's no `preview/ready` → outreach chain
 *     because there's no preview for a sponsor.
 *   - Inbound replies route to the contact's thread instead of the
 *     listing auto-classifier (sponsors get human responses, never
 *     auto-replies).
 *
 * From: <SPONSOR_FROM_LOCAL>@<SPONSOR_SEND_DOMAIN>  (defaults to
 *   hello@partners.<merchant-domain>). The split sender keeps a sponsor
 *   flagging spam from poisoning the deliverability of the main
 *   cold-outreach domain (which is the revenue engine).
 *
 * Reply-To: SPONSOR_REPLY_TO  (lands in the existing inbound webhook
 *   so the operator sees the reply without touching their personal
 *   inbox).
 */

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

interface SenderConfig {
  sendDomain: string;
  fromLocal: string;
  fromName: string;
  replyTo: string;
}

function resolveSenderConfig(): SenderConfig {
  return {
    sendDomain:
      process.env.SPONSOR_SEND_DOMAIN ??
      process.env.RESEND_SEND_DOMAIN ??
      "partners.example.com",
    fromLocal:
      process.env.SPONSOR_FROM_LOCAL ?? process.env.RESEND_FROM_LOCAL ?? "hello",
    fromName:
      process.env.SPONSOR_FROM_NAME ?? process.env.RESEND_FROM_NAME ?? "Merchant",
    replyTo:
      process.env.SPONSOR_REPLY_TO ??
      process.env.RESEND_REPLY_TO ??
      "hello@example.com",
  };
}

export interface ContactSendArgs {
  contactId: string;
  subject: string;
  bodyText: string;
}

export interface ContactSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a templated or custom message to an outbound contact.
 *
 * Inserts the message row BEFORE the network call so a Resend timeout
 * doesn't lose the operator's draft — it stays in the thread with
 * status='failed' so they can retry.
 */
export async function sendContactMessage(
  args: ContactSendArgs,
): Promise<ContactSendResult> {
  const [contact] = await db
    .select()
    .from(outboundContacts)
    .where(eq(outboundContacts.id, args.contactId))
    .limit(1);
  if (!contact) return { success: false, error: "contact not found" };

  const [messageRow] = await db
    .insert(outboundContactMessages)
    .values({
      contactId: contact.id,
      direction: "out",
      subject: args.subject,
      bodyText: args.bodyText,
      status: "sent",
    })
    .returning();

  const sender = resolveSenderConfig();
  const html = renderHtml(args.bodyText);
  const from = `${sender.fromName} <${sender.fromLocal}@${sender.sendDomain}>`;
  const resend = getResend();

  if (!resend) {
    // Dev-mode stub: log + update contact, return ok.
    // eslint-disable-next-line no-console
    console.warn(
      `[sponsor-contacts] STUB send to ${contact.email}: ${args.subject} (no RESEND_API_KEY)`,
    );
    await db
      .update(outboundContacts)
      .set({ status: "sent", lastTouchedAt: new Date() })
      .where(eq(outboundContacts.id, contact.id));
    return { success: true, messageId: `sim_${messageRow.id}` };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: contact.email,
      replyTo: sender.replyTo,
      subject: args.subject,
      html,
      text: args.bodyText,
      tags: [
        { name: "kind", value: "sponsor_outreach" },
        { name: "contact_id", value: String(contact.id) },
      ],
    });

    if (result.error) {
      await db
        .update(outboundContactMessages)
        .set({ status: "failed" })
        .where(eq(outboundContactMessages.id, messageRow.id));
      return { success: false, error: result.error.message };
    }

    await db
      .update(outboundContactMessages)
      .set({ providerMessageId: result.data?.id ?? null })
      .where(eq(outboundContactMessages.id, messageRow.id));

    await db
      .update(outboundContacts)
      .set({
        status: contact.status === "queued" ? "sent" : contact.status,
        lastTouchedAt: new Date(),
      })
      .where(eq(outboundContacts.id, contact.id));

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(outboundContactMessages)
      .set({ status: "failed" })
      .where(eq(outboundContactMessages.id, messageRow.id));
    return { success: false, error: msg };
  }
}

function renderHtml(bodyText: string): string {
  const escaped = bodyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#059669;">$1</a>')
    .replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;font-size:15px;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">${escaped}</body></html>`;
}

/**
 * Templates the operator can pick when composing. Customize per merchant
 * — these are the SiteGrid examples ported as a starting point.
 *
 * Placeholders: {{firstName}}, {{name}}, {{organization}}, {{role}} are
 * substituted at send time via `applyTemplate`.
 */
export interface ContactTemplate {
  id: string;
  label: string;
  kind: string; // matched against contact.kind for default suggestions
  subject: string;
  bodyText: string;
}

export const CONTACT_TEMPLATES: ContactTemplate[] = [
  {
    id: "podcast_generic",
    label: "Podcast — generic",
    kind: "podcast",
    subject: "Sponsor slot — {{organization}}?",
    bodyText: `Hi {{firstName}},

[Merchant intro — what you build, who buys it, what makes the price point unusual].

Your audience at {{organization}} is exactly our buyer. Curious what a single-episode mid-roll runs and whether you have an open slot in the next 4–6 weeks.

If you want to see the product before deciding, happy to spin one up complimentary for someone on your team.

— Merchant`,
  },
  {
    id: "newsletter_generic",
    label: "Newsletter — generic",
    kind: "newsletter",
    subject: "Sponsor a one-line mention in {{organization}}?",
    bodyText: `Hi {{firstName}},

Quick note — [merchant intro, one sentence]. Different price point than anything else in the space.

Curious about a sponsored line in your next {{organization}} issue. Happy to provide custom copy for your audience + a tracking link.

What's your sponsor rate?

— Merchant`,
  },
  {
    id: "partner_affiliate",
    label: "Partner — affiliate",
    kind: "partner",
    subject: "Earn $50–$250 per referral — affiliate program",
    bodyText: `Hi {{firstName}},

We just shipped a tiered affiliate program with real money behind it:

  Sales 1–4:  $50 per sale  (Standard tier)
  Sales 5+:   $100 per sale (Silver tier)
  Sales 10+:  $250 per sale (Gold tier)

You get a personalized link that auto-tracks clicks → checkouts → payouts on the 1st of each month. Plus a copy-paste affiliate kit (email, social, blog templates).

Worth a quick look?

— Merchant`,
  },
  {
    id: "press_generic",
    label: "Press / blogger pitch",
    kind: "press",
    subject: "Story idea: [angle]",
    bodyText: `Hi {{firstName}},

Quick pitch — [merchant intro]. The interesting angle is [the unique price point / speed / approach]. If you cover [topic], happy to send numbers and a few customer case studies.

— Merchant`,
  },
];

export function findTemplate(id: string): ContactTemplate | undefined {
  return CONTACT_TEMPLATES.find((t) => t.id === id);
}

export interface ApplyTemplateArgs {
  template: ContactTemplate;
  contact: Pick<typeof outboundContacts.$inferSelect, "name" | "organization" | "role">;
}

export function applyTemplate(args: ApplyTemplateArgs): {
  subject: string;
  bodyText: string;
} {
  const { template, contact } = args;
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "there";
  const orgFallback =
    template.kind === "podcast"
      ? "your show"
      : template.kind === "newsletter"
        ? "your newsletter"
        : template.kind === "press"
          ? "your publication"
          : "your team";
  const organization = (contact.organization || "").trim() || orgFallback;
  const name = (contact.name || "").trim() || firstName;
  const role = (contact.role || "").trim() || "team";

  const subst = (s: string): string =>
    s
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{name\}\}/g, name)
      .replace(/\{\{organization\}\}/g, organization)
      .replace(/\{\{role\}\}/g, role);

  return {
    subject: subst(template.subject),
    bodyText: subst(template.bodyText),
  };
}

/**
 * Light follow-up copy used by the sponsor-follow-up cron at touches
 * 2 and 3. Intentionally terse — sponsors are pattern-matchers, and a
 * one-line bump usually outperforms a full repitch.
 */
export const SPONSOR_FOLLOWUPS: Record<2 | 3, {
  subject: (org: string) => string;
  body: (firstName: string, org: string) => string;
}> = {
  2: {
    subject: (org) => `Re: ${org} sponsor slot`,
    body: (firstName) =>
      `Hi ${firstName},

Bumping this in case it slipped — would love to chat sponsor slot. No pressure if it's not a fit.

— Merchant`,
  },
  3: {
    subject: () => `One last note`,
    body: (firstName) =>
      `Hi ${firstName},

Last bump from me — if there's interest, drop me a line; if not, I'll close the loop on my end and won't email again.

— Merchant`,
  },
};
