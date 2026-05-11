import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { inngest } from "@/inngest/client";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (
  process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
const TRIGGER_SECRET = process.env.TRIGGER_SECRET?.trim();

async function isAdminViaClerk(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return false;
  if (email === ADMIN_EMAIL) return true;
  const domain = email.split("@")[1];
  return domain ? ADMIN_DOMAINS.includes(domain) : false;
}

function isAuthedBySecret(req: NextRequest): boolean {
  if (!TRIGGER_SECRET) return false;
  const provided = req.headers.get("x-trigger-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== TRIGGER_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(TRIGGER_SECRET));
}

/**
 * Admin-only trigger for otherwise-cron-only discovery agents + ad-hoc
 * listing requalification.
 *
 * Auth: either Clerk admin session, or X-Trigger-Secret header matching
 * the TRIGGER_SECRET env var. The secret-header path is for ops scripts
 * (CI, on-call CLI) that don't have a browser session.
 *
 * Usage:
 *   POST /api/admin/trigger?target=realtor
 *   POST /api/admin/trigger?target=homeowner
 *   POST /api/admin/trigger?target=requalify&listingId=<uuid>&serviceId=<id>
 */
export async function POST(req: NextRequest) {
  const authedClerk = await isAdminViaClerk();
  if (!authedClerk && !isAuthedBySecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const target = url.searchParams.get("target");

  if (target === "realtor") {
    await inngest.send({ name: "discovery/manual", data: {} });
    return NextResponse.json({ ok: true, fired: "discovery/manual" });
  }
  if (target === "homeowner") {
    await inngest.send({ name: "homeowner-discovery/manual", data: {} });
    return NextResponse.json({ ok: true, fired: "homeowner-discovery/manual" });
  }
  if (target === "requalify") {
    const listingId = url.searchParams.get("listingId");
    const serviceId = url.searchParams.get("serviceId") ?? undefined;
    if (!listingId) {
      return NextResponse.json({ error: "missing listingId" }, { status: 400 });
    }
    await inngest.send({
      name: "listings/qualified",
      data: { listingId, ...(serviceId ? { serviceId } : {}) },
    });
    return NextResponse.json({ ok: true, fired: "listings/qualified", listingId, serviceId });
  }
  if (target === "fulfill") {
    const orderId = url.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "missing orderId" }, { status: 400 });
    }
    await inngest.send({ name: "orders/paid", data: { orderId } });
    return NextResponse.json({ ok: true, fired: "orders/paid", orderId });
  }
  if (target === "social-poster") {
    await inngest.send({ name: "social-poster/manual", data: {} });
    return NextResponse.json({ ok: true, fired: "social-poster/manual" });
  }
  return NextResponse.json(
    { error: "missing ?target=realtor|homeowner|requalify|fulfill|social-poster" },
    { status: 400 },
  );
}
