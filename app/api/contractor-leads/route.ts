import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, contractorLeads, listings } from "@/db";
import { eq } from "drizzle-orm";
import { trackEvent } from "@/lib/posthog";
import { sendComplianceEmail } from "@/lib/resend";
import { env } from "@/lib/env";
import { getService } from "@/lib/services";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  serviceId: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional(),
  budgetBand: z.string().max(20),
  timeline: z.string().max(20),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, body.listingId))
    .limit(1);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const [lead] = await db
    .insert(contractorLeads)
    .values({
      listingId: body.listingId,
      serviceId: body.serviceId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      budgetBand: body.budgetBand,
      timeline: body.timeline,
      notes: body.notes,
    })
    .returning();

  await trackEvent({
    distinctId: lead.id,
    event: "contractor_lead_submitted",
    properties: {
      service_id: body.serviceId,
      listing_id: body.listingId,
      budget_band: body.budgetBand,
      timeline: body.timeline,
    },
  });

  // Kick the Yelp matching agent. Fire-and-forget — the operator-notification
  // email below stays as a belt-and-suspenders fallback in case the matching
  // function fails for any reason (Yelp down, no category mapping, etc.).
  await inngest.send({
    name: "lead/captured",
    data: { leadId: lead.id, listingId: body.listingId, serviceId: body.serviceId },
  });

  // Notify the operator immediately so they can route the lead
  const adminEmail = env("ADMIN_EMAIL", "jack@seifdn.org")!;
  const service = getService(body.serviceId);
  try {
    const senderDomains = (env("SENDER_DOMAINS", "resend.dev") ?? "resend.dev").split(",");
    await sendComplianceEmail({
      to: adminEmail,
      fromDomain: senderDomains[0],
      subject: `[LEAD] ${service?.name ?? body.serviceId} — ${listing.address}`,
      mjml: `<mjml><mj-body><mj-section padding="24px"><mj-column>
        <mj-text font-size="16px" font-weight="700">New contractor lead</mj-text>
        <mj-text font-size="14px"><b>Service</b>: ${service?.name ?? body.serviceId}</mj-text>
        <mj-text font-size="14px"><b>Property</b>: ${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}</mj-text>
        <mj-text font-size="14px"><b>Customer</b>: ${body.name} · ${body.email}${body.phone ? ` · ${body.phone}` : ""}</mj-text>
        <mj-text font-size="14px"><b>Budget</b>: ${body.budgetBand}</mj-text>
        <mj-text font-size="14px"><b>Timeline</b>: ${body.timeline}</mj-text>
      </mj-column></mj-section></mj-body></mjml>`,
      text: `New ${service?.name ?? body.serviceId} lead\n\nProperty: ${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}\nCustomer: ${body.name} · ${body.email}${body.phone ? ` · ${body.phone}` : ""}\nBudget: ${body.budgetBand}\nTimeline: ${body.timeline}\n`,
      listingId: body.listingId,
      idempotencyKey: `lead_${lead.id}`,
    });
  } catch {
    // Notification is best-effort; don't fail the lead capture.
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
