import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { trackEvent } from "@/lib/posthog";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  audience: z.string().min(1).max(200),
  audienceSize: z.string().max(50).optional().default(""),
  pitch: z.string().min(10).max(1000),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  // Notify the operator. Failure is non-fatal — we always store the application
  // attempt in PostHog so nothing gets lost if Resend is down.
  const apiKey = env("RESEND_API_KEY");
  const operatorEmail = env("OPERATOR_EMAIL", env("REPLIES_EMAIL", "jack@seifdn.org"))!;
  const fromDomain = env("RESEND_FROM_DOMAIN", "mail.restay.agency")!;

  if (apiKey) {
    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from: `Restay Partners <noreply@${fromDomain}>`,
        to: operatorEmail,
        replyTo: body.email,
        subject: `[Partners] ${body.name} applied — ${body.audience}`,
        text: `New partner application:

Name: ${body.name}
Email: ${body.email}
Audience: ${body.audience}
Audience size: ${body.audienceSize || "(not provided)"}

Pitch:
${body.pitch}

— Reply to this email to talk to them directly.
`,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[partners/apply] resend failed:", e);
    }
  }

  void trackEvent({
    distinctId: body.email,
    event: "partner_application_submitted",
    properties: {
      name: body.name,
      audience: body.audience,
      audience_size: body.audienceSize,
    },
  });

  return NextResponse.json({ ok: true });
}
