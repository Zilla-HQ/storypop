import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { sendComplianceEmail } from "@/lib/resend";

export const runtime = "nodejs";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (
  process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io,zilla.so"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const SENDER_DOMAIN = process.env.SENDER_DOMAIN ?? "resend.dev";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, msg: "unauthorized" };
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return { ok: false, status: 401, msg: "unauthorized" };
  const domain = email.split("@")[1];
  const allowed =
    email === ADMIN_EMAIL || (domain ? ADMIN_DOMAINS.includes(domain) : false);
  if (!allowed) return { ok: false, status: 403, msg: "forbidden" };
  return { ok: true };
}

/**
 * POST /api/admin/conversations/send
 *
 * Send a manual reply from the admin /admin/conversations/[email]
 * thread view. Goes through sendComplianceEmail (CAN-SPAM compliant +
 * blacklist gate + auto-logged into inbound_emails as direction=outbound
 * so it shows up in the thread).
 *
 * Body:
 *   { to: string, subject: string, text: string, inReplyTo?: string }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: auth.status });
  }

  let body: { to?: unknown; subject?: unknown; text?: unknown; inReplyTo?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.to !== "string" || !body.to.includes("@")) {
    return NextResponse.json({ error: "to (email) required" }, { status: 400 });
  }
  if (typeof body.subject !== "string" || !body.subject.trim()) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "text body required" }, { status: 400 });
  }

  const inReplyTo = typeof body.inReplyTo === "string" ? body.inReplyTo : undefined;

  // Convert plaintext to MJML — paragraphs separated by blank lines.
  const paragraphs = body.text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const mjml = `
<mjml>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 16px">
      <mj-column>
        ${paragraphs
          .map(
            (p) =>
              `<mj-text font-size="14px" color="#0f172a" line-height="1.55">${escapeHtml(
                p,
              ).replace(/\n/g, "<br/>")}</mj-text>`,
          )
          .join("\n        ")}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  // listingId is the unsubscribe key in CAN-SPAM headers. For an
  // admin-typed reply we use a stable per-recipient key so the
  // recipient can unsubscribe future sends to the same address.
  const listingId = `conv_${body.to.toLowerCase().replace(/[^a-z0-9]/gi, "_")}`;

  try {
    const result = await sendComplianceEmail({
      to: body.to,
      fromDomain: SENDER_DOMAIN,
      fromName: "Sitebeat",
      subject: body.subject,
      mjml,
      text: body.text,
      inReplyTo,
      references: inReplyTo,
      listingId,
      tags: [
        { name: "kind", value: "manual_reply" },
        { name: "channel", value: "admin_conversations" },
      ],
    });
    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message.slice(0, 200) },
      { status: 500 },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
