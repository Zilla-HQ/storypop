import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminAuthRoute = createRouteMatcher(["/admin/sign-in(.*)", "/admin/sign-up(.*)"]);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
// Anyone with an email on one of these domains can access the admin area.
const ADMIN_DOMAINS = (process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const REFERRAL_COOKIE = "rs_ref";
const REFERRAL_TTL_DAYS = 30;
const REFERRAL_RE = /^[A-Za-z0-9_-]{4,32}$/;

// Clerk's middleware constructor reads CLERK_SECRET_KEY at module-init time
// and throws if missing. That would 500 EVERY public-page request on a fresh
// deploy where the operator hasn't wired Clerk yet. Gate the heavy middleware
// behind a key check; serve a no-op middleware (referral capture only) when
// Clerk isn't configured. /admin/* will 503 with a clear message in that mode.
const CLERK_CONFIGURED = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function captureReferral(req: NextRequest): NextResponse | undefined {
  const refParam = req.nextUrl.searchParams.get("ref");
  if (refParam && REFERRAL_RE.test(refParam)) {
    const existing = req.cookies.get(REFERRAL_COOKIE)?.value;
    if (!existing) {
      const res = NextResponse.next();
      res.cookies.set(REFERRAL_COOKIE, refParam, {
        path: "/",
        maxAge: REFERRAL_TTL_DAYS * 24 * 60 * 60,
        sameSite: "lax",
        httpOnly: false,
        secure: true,
      });
      return res;
    }
  }
  return undefined;
}

const noClerkMiddleware = (req: NextRequest) => {
  const res = captureReferral(req);
  if (isAdminRoute(req) && !isAdminAuthRoute(req)) {
    // Admin area is gated by Clerk; without it we refuse the request rather
    // than rendering an open admin surface.
    return new NextResponse(
      "Admin area requires CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be set.",
      { status: 503 },
    );
  }
  return res;
};

const realMiddleware = clerkMiddleware(async (auth, req) => {
  // ─── Affiliate / referral capture ──────────────────────────────────
  // Any page hit with ?ref=CODE persists a 30-day cookie. The checkout
  // API later reads this cookie and stamps it onto the order, so we get
  // first-touch attribution even if the visitor lands on / but converts
  // after a cold-email click days later.
  const res = captureReferral(req);

  if (!isAdminRoute(req)) return res;
  // Sign-in / sign-up pages render themselves — don't gate them.
  if (isAdminAuthRoute(req)) return res;

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  // Fetch from Clerk — session claims don't include email unless you
  // customize the session token template in the Clerk dashboard.
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();

  const domain = email?.split("@")[1];
  const allowed = email === ADMIN_EMAIL || (domain ? ADMIN_DOMAINS.includes(domain) : false);
  if (!allowed) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return res;
});

export default CLERK_CONFIGURED ? realMiddleware : noClerkMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
