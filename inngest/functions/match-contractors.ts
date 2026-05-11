import { inngest } from "@/inngest/client";
import { db, listings, contractorLeads, contractorIntros } from "@/db";
import { eq } from "drizzle-orm";
import { findTopContractors, SERVICE_CATEGORY, type YelpBusiness } from "@/lib/yelp";
import { findContractorContact } from "@/lib/find-contractor-email";
import { sendComplianceEmail } from "@/lib/resend";
import { getSettings } from "@/db/settings";
import { getService } from "@/lib/services";
import { env } from "@/lib/env";
import { trackEvent } from "@/lib/posthog";

const REFERRAL_FEE_USD = Number(env("CONTRACTOR_REFERRAL_FEE_USD", "150"));
const TOP_N = 3;

/**
 * Yelp matching agent — fires when a homeowner submits the contractor-lead
 * form on /l/<slug>. Fully autonomous:
 *
 *   1. Yelp Fusion → top-rated contractors near the property
 *   2. For each, auto-discover their email by scraping their Yelp profile
 *      for a website link and / or running a Google search via Apify
 *   3. Cold-email each contractor (CAN-SPAM compliant: footer + unsubscribe
 *      auto-injected) with the lead details and referral terms
 *   4. Confirm to the homeowner that intros are happening
 *   5. Drop a digest email to the operator (FYI, no action required)
 *
 * No human in the loop on the contractor side.
 */
export const matchContractorsFn = inngest.createFunction(
  {
    id: "match-contractors",
    name: "Agent — contractor matching (Yelp + auto-email)",
    retries: 3,
    concurrency: { limit: 4 },
  },
  { event: "lead/captured" },
  async ({ event, step, logger }) => {
    const { leadId, listingId, serviceId } = event.data;

    const [lead] = await db
      .select()
      .from(contractorLeads)
      .where(eq(contractorLeads.id, leadId))
      .limit(1);
    if (!lead) {
      logger.warn(`No lead ${leadId}, skipping`);
      return { skipped: true, reason: "lead not found" };
    }

    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!listing) {
      logger.warn(`No listing ${listingId}, skipping`);
      return { skipped: true, reason: "listing not found" };
    }

    const category = SERVICE_CATEGORY[serviceId];
    if (!category) {
      logger.warn(`Service ${serviceId} has no Yelp category mapping`);
      return { skipped: true, reason: "no Yelp category for this service" };
    }

    const service = getService(serviceId);
    const location = listing.zip || `${listing.city}, ${listing.state}`;

    // 1) Yelp lookup
    const matches = await step.run("yelp-search", () =>
      findTopContractors({ category, location, count: TOP_N }),
    );

    if (matches.length === 0) {
      logger.warn(`Yelp returned no matches for ${category} near ${location}`);
      await db
        .update(contractorLeads)
        .set({ status: "no_matches" })
        .where(eq(contractorLeads.id, leadId));
      return { matched: 0, reason: "Yelp returned no contractors" };
    }

    // 2) Auto-discover each contractor's email — best effort.
    const enriched: Array<
      YelpBusiness & {
        email: string | null;
        website: string | null;
        emailSource: "yelp_page" | "google_search" | null;
      }
    > = [];
    for (const m of matches) {
      // One step per contractor so a slow Apify call on one doesn't time out
      // the others. Each step has its own retry budget.
      const contact = await step.run(`discover-email-${m.id}`, async () =>
        findContractorContact({
          name: m.name,
          city: listing.city,
          state: listing.state,
          yelpUrl: m.url,
        }),
      );
      enriched.push({ ...m, email: contact.email, website: contact.website, emailSource: contact.source });
    }

    // 3) Persist intros (one row per matched contractor, with discovered email)
    const intros = await step.run("insert-intros", async () => {
      return db
        .insert(contractorIntros)
        .values(
          enriched.map((m, i) => ({
            leadId,
            contractorName: m.name,
            contractorPhone: m.phone,
            contractorUrl: m.url,
            contractorAddress: m.address,
            contractorEmail: m.email,
            contractorWebsite: m.website,
            emailSource: m.emailSource,
            rating: m.rating,
            reviewCount: m.review_count,
            yelpId: m.id,
            rank: i + 1,
            status: m.email ? "queued" : "manual",
          })),
        )
        .returning();
    });

    const settings = await getSettings();
    const fromDomain = settings.senderDomains[0] ?? "mail.realscale.app";
    const adminEmail = env("ADMIN_EMAIL", "jack@seifdn.org")!;
    const appUrl = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

    // 4) Cold-email each contractor that has an email. CAN-SPAM compliance
    //    is enforced inside sendComplianceEmail (footer + unsubscribe).
    const emailedIntros: typeof intros = [];
    const skippedIntros: typeof intros = [];

    for (const intro of intros) {
      if (!intro.contractorEmail) {
        skippedIntros.push(intro);
        continue;
      }
      try {
        const subject = `${service?.name ?? serviceId} lead in ${listing.zip || listing.city} — ready to talk?`;
        const homeownerLine = lead.phone
          ? `${lead.name} · ${lead.email} · ${lead.phone}`
          : `${lead.name} · ${lead.email}`;
        const mockupUrl = `${appUrl}/l/${listing.slug}?service=${serviceId}`;

        await step.run(`email-contractor-${intro.id}`, () =>
          sendComplianceEmail({
            to: intro.contractorEmail!,
            fromDomain,
            subject,
            mjml: `<mjml><mj-body>
              <mj-section padding="24px"><mj-column>
                <mj-text font-size="16px" font-weight="700">New ${escapeHtml(service?.name ?? serviceId)} lead in ${escapeHtml(listing.zip || listing.city)}</mj-text>
                <mj-text>Hi ${escapeHtml(intro.contractorName)} team —</mj-text>
                <mj-text>A homeowner near you used Realscale to mock up a ${escapeHtml(service?.name?.toLowerCase() ?? serviceId)} for their property and asked us to introduce them to top-rated local contractors. You came up — ${intro.rating?.toFixed(1) ?? "?"}★ on Yelp with ${intro.reviewCount ?? 0} reviews.</mj-text>
                <mj-text><b>Property:</b> ${escapeHtml(listing.address)}, ${escapeHtml(listing.city)}, ${escapeHtml(listing.state)} ${escapeHtml(listing.zip)}</mj-text>
                <mj-text><b>Homeowner:</b> ${escapeHtml(homeownerLine)}</mj-text>
                <mj-text><b>Budget / timeline:</b> ${escapeHtml(lead.budgetBand ?? "?")} / ${escapeHtml(lead.timeline ?? "?")}</mj-text>
                <mj-text><b>Their mockup:</b> <a href="${mockupUrl}">${escapeHtml(mockupUrl)}</a></mj-text>
                <mj-text font-size="14px">If you'd like to follow up: reach out directly using the contact info above. We charge a flat <b>$${REFERRAL_FEE_USD}</b> referral fee per converted lead — invoiced after the homeowner signs a contract with you, no upfront cost. Reply to this email if you want intros from us regularly.</mj-text>
                <mj-text font-size="12px" color="#64748b">— Realscale</mj-text>
              </mj-column></mj-section>
            </mj-body></mjml>`,
            text: `Hi ${intro.contractorName} team —\n\nA homeowner used Realscale to mock up a ${service?.name ?? serviceId} for their property and asked us to introduce them to top-rated local contractors. You came up — ${intro.rating?.toFixed(1) ?? "?"}★ on Yelp with ${intro.reviewCount ?? 0} reviews.\n\nProperty: ${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}\nHomeowner: ${homeownerLine}\nBudget/timeline: ${lead.budgetBand ?? "?"} / ${lead.timeline ?? "?"}\nTheir mockup: ${mockupUrl}\n\nWe charge a flat $${REFERRAL_FEE_USD} referral fee per converted lead — invoiced after the homeowner signs, no upfront cost. Reply if you want regular intros.\n\n— Realscale`,
            listingId,
            idempotencyKey: `contractor_${intro.id}`,
          }),
        );

        await db
          .update(contractorIntros)
          .set({ status: "introduced" })
          .where(eq(contractorIntros.id, intro.id));
        emailedIntros.push(intro);
      } catch (e) {
        logger.warn(
          `Failed to email contractor ${intro.contractorName}: ${(e as Error).message}`,
        );
        await db
          .update(contractorIntros)
          .set({ status: "manual" })
          .where(eq(contractorIntros.id, intro.id));
        skippedIntros.push(intro);
      }
    }

    // 5) Mark lead as matched
    await step.run("mark-lead-matched", async () => {
      await db
        .update(contractorLeads)
        .set({ status: "matched" })
        .where(eq(contractorLeads.id, leadId));
    });

    // 6) Confirm to the homeowner that we've reached out to contractors
    await step.run("email-homeowner-confirm", async () => {
      const matchList = enriched
        .map(
          (m, i) =>
            `<mj-text><b>${i + 1}. ${escapeHtml(m.name)}</b><br/>${m.rating ?? "?"}★ — ${m.review_count ?? 0} reviews${m.phone ? `<br/>${escapeHtml(m.phone)}` : ""}<br/><a href="${m.url}">View on Yelp</a></mj-text>`,
        )
        .join("");
      await sendComplianceEmail({
        to: lead.email,
        fromDomain,
        subject: `Your ${service?.name ?? serviceId} contractor matches`,
        mjml: `<mjml><mj-body><mj-section padding="24px"><mj-column>
          <mj-text font-size="16px">Hi ${escapeHtml(lead.name.split(" ")[0])},</mj-text>
          <mj-text>Thanks for trying the ${escapeHtml(service?.name ?? serviceId)} mockup at <b>${escapeHtml(listing.address)}</b>.</mj-text>
          <mj-text>We've matched you to the ${enriched.length} top-rated local contractors and emailed each of them an introduction — they'll reach out within 24–48 hours with quotes. No obligation, no spam.</mj-text>
          ${matchList}
          <mj-text font-size="14px">Want to revisit your mockup any time? <a href="${appUrl}/l/${listing.slug}?service=${serviceId}">Open it here</a>.</mj-text>
          <mj-text font-size="14px" color="#64748b">— Realscale</mj-text>
        </mj-column></mj-section></mj-body></mjml>`,
        text: `Hi ${lead.name.split(" ")[0]},\n\nThanks for trying the ${service?.name ?? serviceId} mockup at ${listing.address}. We've matched you to the ${enriched.length} top-rated local contractors and emailed each of them an introduction — they'll reach out within 24–48 hours with quotes.\n\n${enriched.map((m, i) => `${i + 1}. ${m.name} — ${m.rating ?? "?"}★ (${m.review_count ?? 0}) — ${m.phone ?? ""} — ${m.url}`).join("\n")}\n\nRevisit your mockup: ${appUrl}/l/${listing.slug}?service=${serviceId}`,
        listingId,
        idempotencyKey: `match_homeowner_${leadId}`,
      });
    });

    // 7) FYI digest to operator (no action required)
    await step.run("email-operator-digest", async () => {
      const rowsHtml = intros
        .map(
          (i) =>
            `<tr><td><b>${i.rank}. ${escapeHtml(i.contractorName)}</b></td><td>${i.rating?.toFixed(1) ?? "?"}★ (${i.reviewCount ?? 0})</td><td>${i.contractorEmail ? `<span style="color:#059669">→ ${escapeHtml(i.contractorEmail)}</span>` : `<span style="color:#dc2626">no email found</span>`}</td><td><a href="${i.contractorUrl ?? "#"}">Yelp</a></td></tr>`,
        )
        .join("");
      await sendComplianceEmail({
        to: adminEmail,
        fromDomain,
        subject: `[FYI] Contractor matching done for ${listing.address} — ${emailedIntros.length}/${intros.length} emailed`,
        mjml: `<mjml><mj-body><mj-section padding="24px"><mj-column>
          <mj-text font-size="14px" font-weight="700">Match digest — ${escapeHtml(service?.name ?? serviceId)} lead at ${escapeHtml(listing.address)}</mj-text>
          <mj-text>Auto-emailed ${emailedIntros.length} of ${intros.length} contractors. ${skippedIntros.length > 0 ? `${skippedIntros.length} had no discoverable email — left as 'manual' on /admin/leads if you want to chase them.` : "All matched contractors got intros."}</mj-text>
          <mj-table>
            <tr><th align="left">Contractor</th><th align="left">Rating</th><th align="left">Email</th><th></th></tr>
            ${rowsHtml}
          </mj-table>
          <mj-text font-size="12px" color="#64748b">No action required.</mj-text>
        </mj-column></mj-section></mj-body></mjml>`,
        text: `Match digest — ${service?.name ?? serviceId} lead at ${listing.address}\n\nAuto-emailed ${emailedIntros.length}/${intros.length} contractors.\n\n${intros.map((i) => `${i.rank}. ${i.contractorName} — ${i.rating?.toFixed(1) ?? "?"}★ (${i.reviewCount ?? 0}) — ${i.contractorEmail ?? "no email"}`).join("\n")}`,
        listingId,
        idempotencyKey: `match_digest_${leadId}`,
      });
    });

    await trackEvent({
      distinctId: leadId,
      event: "contractor_matched",
      properties: {
        service_id: serviceId,
        match_count: enriched.length,
        emailed_count: emailedIntros.length,
        skipped_count: skippedIntros.length,
        zip: listing.zip,
      },
    });

    return {
      matched: enriched.length,
      emailed: emailedIntros.length,
      skipped: skippedIntros.length,
    };
  },
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
