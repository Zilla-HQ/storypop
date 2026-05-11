import { inngest } from "@/inngest/client";
import { db, outboundContacts } from "@/db";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { sendContactMessage, SPONSOR_FOLLOWUPS } from "@/lib/sponsor-contacts";

/**
 * Sponsor follow-up cadence.
 *
 *   touch_number=1 + lastSendAt > 7d   →  send touch 2
 *   touch_number=2 + lastSendAt > 14d  →  send touch 3 (final)
 *   touch_number=3 + lastSendAt > 21d  →  archive
 *
 * Status='replied', 'declined', 'won', 'archived' are excluded — those
 * are terminal states owned by the operator or the inbound handler.
 */
export const sponsorFollowUpFn = inngest.createFunction(
  {
    id: "sponsor-follow-up",
    name: "Sponsors — touch 2/3 + archive",
    retries: 1,
  },
  [{ cron: "0 16 * * *" }, { event: "sponsor/follow-up" }],
  async ({ step }) => {
    if (process.env.SPONSOR_OUTREACH_ENABLED !== "true") {
      return { skipped: true, reason: "SPONSOR_OUTREACH_ENABLED != true" };
    }

    const touch2AfterDays = Number(process.env.SPONSOR_TOUCH2_AFTER_DAYS ?? "7");
    const touch3AfterDays = Number(process.env.SPONSOR_TOUCH3_AFTER_DAYS ?? "14");
    const archiveAfterDays = Number(process.env.SPONSOR_ARCHIVE_AFTER_DAYS ?? "21");
    const perRunCap = Number(process.env.SPONSOR_FOLLOWUP_PER_RUN_CAP ?? "10");

    const now = Date.now();
    const cutoff2 = new Date(now - touch2AfterDays * 86_400_000);
    const cutoff3 = new Date(now - touch3AfterDays * 86_400_000);
    const cutoffArchive = new Date(now - archiveAfterDays * 86_400_000);

    // ---- Touch 2 ----
    const dueTouch2 = await step.run("load-touch2", () =>
      db
        .select()
        .from(outboundContacts)
        .where(
          and(
            eq(outboundContacts.status, "sent"),
            eq(outboundContacts.autoSendEnabled, true),
            eq(outboundContacts.touchNumber, 1),
            isNotNull(outboundContacts.lastSendAt),
            lte(outboundContacts.lastSendAt, cutoff2),
          ),
        )
        .limit(perRunCap),
    );

    let touch2Sent = 0;
    for (const c of dueTouch2) {
      const firstName = (c.name ?? "").trim().split(/\s+/)[0] || "there";
      const org = (c.organization ?? "").trim() || "your show";
      const tpl = SPONSOR_FOLLOWUPS[2];
      const r = await sendContactMessage({
        contactId: c.id,
        subject: tpl.subject(org),
        bodyText: tpl.body(firstName, org),
      });
      if (r.success) {
        await db
          .update(outboundContacts)
          .set({ touchNumber: 2, lastSendAt: new Date() })
          .where(eq(outboundContacts.id, c.id));
        touch2Sent += 1;
      }
      await new Promise((r2) => setTimeout(r2, 800));
    }

    // ---- Touch 3 ----
    const dueTouch3 = await step.run("load-touch3", () =>
      db
        .select()
        .from(outboundContacts)
        .where(
          and(
            eq(outboundContacts.status, "sent"),
            eq(outboundContacts.autoSendEnabled, true),
            eq(outboundContacts.touchNumber, 2),
            isNotNull(outboundContacts.lastSendAt),
            lte(outboundContacts.lastSendAt, cutoff3),
          ),
        )
        .limit(perRunCap),
    );

    let touch3Sent = 0;
    for (const c of dueTouch3) {
      const firstName = (c.name ?? "").trim().split(/\s+/)[0] || "there";
      const org = (c.organization ?? "").trim() || "your show";
      const tpl = SPONSOR_FOLLOWUPS[3];
      const r = await sendContactMessage({
        contactId: c.id,
        subject: tpl.subject(org),
        bodyText: tpl.body(firstName, org),
      });
      if (r.success) {
        await db
          .update(outboundContacts)
          .set({ touchNumber: 3, lastSendAt: new Date() })
          .where(eq(outboundContacts.id, c.id));
        touch3Sent += 1;
      }
      await new Promise((r2) => setTimeout(r2, 800));
    }

    // ---- Archive ----
    const dueArchive = await step.run("load-archive", () =>
      db
        .select()
        .from(outboundContacts)
        .where(
          and(
            eq(outboundContacts.status, "sent"),
            eq(outboundContacts.autoSendEnabled, true),
            eq(outboundContacts.touchNumber, 3),
            isNotNull(outboundContacts.lastSendAt),
            lte(outboundContacts.lastSendAt, cutoffArchive),
          ),
        ),
    );
    let archived = 0;
    for (const c of dueArchive) {
      await db
        .update(outboundContacts)
        .set({ status: "archived" })
        .where(eq(outboundContacts.id, c.id));
      archived += 1;
    }

    return { touch2Sent, touch3Sent, archived };
  },
);
