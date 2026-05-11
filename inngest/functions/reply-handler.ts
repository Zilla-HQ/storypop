import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { db, listings, messages, outreachEvents, adminSettings } from "@/db";
import { eq, sql } from "drizzle-orm";
import { classifyReply, type ReplyClassification } from "@/lib/claude";
import { sendComplianceEmail } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { trackEvent } from "@/lib/posthog";
import { renderReply, CLASSIFICATION_EMOJI } from "@/lib/reply-templates";

/**
 * Reply handler — triggered by Resend inbound webhook.
 * 1. Classifies inbound into 1 of 6 buckets.
 * 2. Sends a deterministic auto-reply for interested/price_question/style_question/decline.
 * 3. Logs unsubscribe to blacklist; flags complex for human.
 * 4. Always notifies the operator with reply body + auto-reply (if any).
 */
export const replyHandlerFn = inngest.createFunction(
  {
    id: "reply-handler",
    name: "Reply handler — inbound email triage",
    retries: 2,
  },
  { event: "inbound/email" },
  async ({ event, step, logger }) => {
    const { from, to, subject, text, html, messageId, inReplyTo } = event.data;
    const bodyText = text ?? stripHtml(html ?? "");

    const fromEmail = from.toLowerCase();
    const [listing] = await step.run("match-listing", async () => {
      return db
        .select()
        .from(listings)
        .where(eq(listings.agentEmail, fromEmail))
        .limit(1);
    });

    if (!listing) {
      logger.warn(`Inbound email from unknown ${fromEmail} — flagging for human review`);
      await step.run("notify-operator-orphan", async () => {
        await notifyOperator({
          classification: "complex",
          fromEmail,
          listingAddress: "(no matching listing)",
          subject: subject ?? "(no subject)",
          bodyText,
          autoReplyText: null,
          listingId: null,
          previewUrl: null,
        });
      });
      return { skipped: true, reason: "no listing match" };
    }

    const [priorOutreach] = await step.run("find-prior-outreach", async () => {
      return db
        .select()
        .from(outreachEvents)
        .where(eq(outreachEvents.listingId, listing.id))
        .orderBy(sql`${outreachEvents.sentAt} DESC`)
        .limit(1);
    });

    await step.run("mark-outreach-replied", async () => {
      if (!priorOutreach) return;
      await db
        .update(outreachEvents)
        .set({ status: "replied", repliedAt: new Date() })
        .where(eq(outreachEvents.id, priorOutreach.id));
    });

    const classification = await step.run("classify", () => classifyReply(bodyText));

    const inboundId = await step.run("record-inbound", async () => {
      const [row] = await db
        .insert(messages)
        .values({
          listingId: listing.id,
          direction: "inbound",
          from,
          to,
          subject,
          bodyText,
          bodyHtml: html,
          messageIdHeader: messageId,
          inReplyTo,
          classification,
        })
        .returning({ id: messages.id });
      return row.id;
    });

    // Build the variables once — used by both the auto-reply template and operator-notify.
    const settings = await getSettings();
    const senderDomain = priorOutreach?.senderDomain ?? settings.senderDomains[0] ?? "mail.realscale.app";
    const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
    const promoCode = env("OUTREACH_PROMO_CODE") ?? null;
    const promoDiscountPct = parseInt(env("OUTREACH_PROMO_PCT", "10") ?? "10", 10);
    const promoExpiryDays = parseInt(env("OUTREACH_PROMO_EXPIRY_DAYS", "7") ?? "7", 10);
    const supportEmail = env("REPLIES_EMAIL", "replies@realscale.app")!;
    const previewUrl = `${appUrl}/l/${listing.slug}`;
    const purchaseUrl = promoCode
      ? `${appUrl}/l/${listing.slug}?code=${promoCode}#pricing`
      : `${appUrl}/l/${listing.slug}#pricing`;
    const firstName = (listing.agentName ?? "there").split(" ")[0];

    // Branch by classification.
    let autoReplyText: string | null = null;
    let action: string;

    if (classification === "unsubscribe") {
      await step.run("blacklist-email", async () => {
        await db
          .update(adminSettings)
          .set({
            emailBlacklist: sql`(
              select jsonb_agg(distinct elem)
              from jsonb_array_elements_text(${adminSettings.emailBlacklist} || to_jsonb(${fromEmail}::text)) elem
            )`,
            updatedAt: new Date(),
          })
          .where(eq(adminSettings.id, 1));
      });
      await step.run("mark-unsubscribed", async () => {
        if (!priorOutreach) return;
        await db
          .update(outreachEvents)
          .set({ status: "unsubscribed" })
          .where(eq(outreachEvents.id, priorOutreach.id));
      });
      action = "unsubscribed";
    } else if (classification === "complex") {
      await step.run("flag-for-human", async () => {
        await db.update(messages).set({ humanFlag: true }).where(eq(messages.id, inboundId));
      });
      action = "flagged for human";
    } else {
      // interested | price_question | style_question | decline → deterministic template.
      const rendered = renderReply(classification, subject, {
        firstName,
        listingAddress: listing.address,
        previewUrl,
        purchaseUrl,
        standardPriceUsd: Math.round(settings.pricingStandardCents / 100),
        premiumPriceUsd: Math.round(settings.pricingPremiumCents / 100),
        rushPriceUsd: Math.round(settings.pricingRushCents / 100),
        promoCode,
        promoDiscountPct: promoCode ? promoDiscountPct : null,
        promoExpiryDays,
        supportEmail,
        senderName: "Realscale",
      });

      if (!rendered) {
        action = "no template available";
      } else {
        const sendResult = await step.run("send-autoreply", () =>
          sendComplianceEmail({
            to: fromEmail,
            fromDomain: senderDomain,
            subject: rendered.subject,
            mjml: rendered.mjml,
            text: rendered.text,
            listingId: listing.id,
            idempotencyKey: `reply_${inboundId}`,
          }),
        );
        await step.run("record-outbound", async () => {
          await db.insert(messages).values({
            listingId: listing.id,
            direction: "outbound",
            from: `outreach@${senderDomain}`,
            to: fromEmail,
            subject: rendered.subject,
            bodyText: rendered.text,
            inReplyTo: messageId,
            aiReplyGenerated: false,
          });
        });
        autoReplyText = rendered.text;
        action = `auto-replied (resend_id=${sendResult.id})`;
      }
    }

    // Always notify operator — every classification, every reply.
    await step.run("notify-operator", () =>
      notifyOperator({
        classification,
        fromEmail,
        listingAddress: listing.address,
        subject: subject ?? "(no subject)",
        bodyText,
        autoReplyText,
        listingId: listing.id,
        previewUrl,
      }),
    );

    await trackEvent({
      distinctId: listing.id,
      event: "reply_handled",
      properties: { classification, action },
    });

    return { classification, action };
  },
);

/**
 * Send the operator a notification about an inbound reply.
 * To: ADMIN_EMAIL · From: outreach domain · Reply-To: prospect email.
 * Hitting Reply on this notification replies to the prospect directly.
 */
async function notifyOperator(args: {
  classification: ReplyClassification;
  fromEmail: string;
  listingAddress: string;
  subject: string;
  bodyText: string;
  autoReplyText: string | null;
  listingId: string | null;
  previewUrl: string | null;
}): Promise<void> {
  const adminEmail = env("ADMIN_EMAIL", "jack@seifdn.org")!;
  const settings = await getSettings();
  const senderDomain = settings.senderDomains[0] ?? "mail.realscale.app";
  const emoji = CLASSIFICATION_EMOJI[args.classification] ?? "📬";
  const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

  const subject = `${emoji} ${args.classification} reply — ${args.listingAddress}`;
  const adminLink = args.listingId ? `${appUrl}/admin/outreach` : null;

  const text = `New inbound reply on the cold-outreach loop.

CLASSIFICATION:  ${args.classification}
LISTING:         ${args.listingAddress}
FROM:            ${args.fromEmail}
SUBJECT:         ${args.subject}

THEIR MESSAGE:
${args.bodyText.slice(0, 4000)}

${
  args.autoReplyText
    ? `AUTO-REPLY WE SENT:
${args.autoReplyText.slice(0, 4000)}`
    : "(No auto-reply was sent — this classification requires manual handling.)"
}

${args.previewUrl ? `Their preview: ${args.previewUrl}` : ""}
${adminLink ? `Conversation thread: ${adminLink}` : ""}

— Realscale agent
`;

  const mjml = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f9fafb">
    <mj-section padding="20px" background-color="#ffffff">
      <mj-column>
        <mj-text font-size="13px" color="#6b7280" font-weight="700" text-transform="uppercase" letter-spacing="1px">
          ${emoji} Inbound reply — ${args.classification}
        </mj-text>
        <mj-text font-size="18px" font-weight="700" color="#0f172a">
          ${escape(args.listingAddress)}
        </mj-text>
        <mj-text font-size="13px" color="#6b7280">
          From <strong style="color:#0f172a">${escape(args.fromEmail)}</strong> · ${escape(args.subject)}
        </mj-text>
        <mj-divider border-color="#e5e7eb" />
        <mj-text font-size="14px" font-weight="700" color="#0f172a">Their message</mj-text>
        <mj-text font-size="14px" line-height="1.55" color="#374151">
          ${escape(args.bodyText.slice(0, 4000)).replace(/\n/g, "<br/>")}
        </mj-text>
        ${
          args.autoReplyText
            ? `<mj-divider border-color="#e5e7eb" />
        <mj-text font-size="14px" font-weight="700" color="#0f172a">Auto-reply we sent</mj-text>
        <mj-text font-size="13px" line-height="1.5" color="#6b7280" background-color="#f9fafb">
          ${escape(args.autoReplyText.slice(0, 4000)).replace(/\n/g, "<br/>")}
        </mj-text>`
            : `<mj-text font-size="13px" line-height="1.5" color="#b45309">
          (No auto-reply sent — manual handling required.)
        </mj-text>`
        }
        ${
          args.previewUrl
            ? `<mj-button href="${args.previewUrl}" background-color="#0ea5e9" color="#ffffff" font-weight="700" border-radius="6px">Open their preview</mj-button>`
            : ""
        }
        ${
          adminLink
            ? `<mj-text font-size="12px" color="#6b7280">
          <a href="${adminLink}" style="color:#0ea5e9">View conversation thread →</a>
        </mj-text>`
            : ""
        }
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  await sendComplianceEmail({
    to: adminEmail,
    fromDomain: senderDomain,
    fromName: "Realscale Agent",
    subject,
    mjml,
    text,
    listingId: args.listingId ?? "operator-notify",
    // Hitting Reply on this notification replies to the prospect directly.
    replyTo: args.fromEmail,
    // Each inbound is unique; idempotency key is the listingId+from+timestamp-bucket.
    idempotencyKey: `notify_${args.listingId ?? "orphan"}_${args.fromEmail}_${Date.now()}`,
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
