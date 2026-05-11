import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { codeForEmail } from "@/lib/referral";
import { trackEvent } from "@/lib/posthog";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
});

const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const code = codeForEmail(body.email);
  const link = `${APP_URL}/agents?ref=${code}`;

  await trackEvent({
    distinctId: body.email,
    event: "referral_code_generated",
    properties: { code },
  });

  return NextResponse.json({ code, link });
}
