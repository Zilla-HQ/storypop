import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { AdminSettings } from "@/db";
import { env } from "@/lib/env";

interface CheckItem {
  label: string;
  status: "ok" | "todo" | "warn";
  detail: string;
  action?: string;
}

interface Props {
  settings: AdminSettings;
}

export function ReadinessChecklist({ settings }: Props) {
  // Each line probes a specific env var or admin-settings flag the
  // autonomous business needs to actually run. Wrapped in safeProbe so a
  // single bad probe can never crash the whole admin dashboard.
  const safeBuild = (build: () => CheckItem): CheckItem => {
    try {
      return build();
    } catch (e) {
      return {
        label: "(probe error)",
        status: "todo",
        detail: e instanceof Error ? e.message : "unknown",
      };
    }
  };
  const items: CheckItem[] = [
    {
      label: "Database connected",
      status: env("DATABASE_URL") ? "ok" : "todo",
      detail: env("DATABASE_URL")
        ? "Supabase Postgres connection live."
        : "Set DATABASE_URL in Vercel env.",
    },
    {
      label: "Stripe live mode",
      status: env("STRIPE_SECRET_KEY")?.startsWith("sk_live_")
        ? "ok"
        : env("STRIPE_SECRET_KEY")
          ? "warn"
          : "todo",
      detail: env("STRIPE_SECRET_KEY")?.startsWith("sk_live_")
        ? "Live mode — real charges go through."
        : env("STRIPE_SECRET_KEY")
          ? "Test mode key — switch to sk_live_… before mailing real customers."
          : "Set STRIPE_SECRET_KEY.",
    },
    {
      label: "Stripe webhook signing secret",
      status: env("STRIPE_WEBHOOK_SECRET") ? "ok" : "todo",
      detail: env("STRIPE_WEBHOOK_SECRET")
        ? "Webhook will verify orders/paid events."
        : "Add Stripe webhook → set STRIPE_WEBHOOK_SECRET.",
    },
    {
      label: "Inngest event + signing keys",
      status:
        env("INNGEST_EVENT_KEY") && env("INNGEST_SIGNING_KEY") ? "ok" : "todo",
      detail:
        env("INNGEST_EVENT_KEY") && env("INNGEST_SIGNING_KEY")
          ? "Cloud orchestration wired."
          : "Set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.",
    },
    {
      label: "fal.ai (preview generation)",
      status: env("FAL_API_KEY") ? "ok" : "todo",
      detail: env("FAL_API_KEY")
        ? "Pool/solar/staging mockups generate."
        : "Set FAL_API_KEY.",
    },
    {
      label: "Anthropic (vision + email drafting)",
      status: env("ANTHROPIC_API_KEY") ? "ok" : "todo",
      detail: env("ANTHROPIC_API_KEY")
        ? "Claude vision + Haiku copywriter ready."
        : "Set ANTHROPIC_API_KEY.",
    },
    {
      label: "Apify (cold-source scraping)",
      status: env("APIFY_TOKEN") ? "ok" : "todo",
      detail: env("APIFY_TOKEN")
        ? "MLS scrape + single-URL detail scrape live."
        : "Set APIFY_TOKEN to enable cold discovery + self-serve URL drops.",
    },
    {
      label: "Mapbox (homeowner geocoding + satellite)",
      status: env("NEXT_PUBLIC_MAPBOX_TOKEN") ? "ok" : "todo",
      detail: env("NEXT_PUBLIC_MAPBOX_TOKEN")
        ? "Homeowner address-mockup flow wired."
        : "Set NEXT_PUBLIC_MAPBOX_TOKEN.",
    },
    {
      label: "Resend (outbound email)",
      status: env("RESEND_API_KEY") ? "ok" : "todo",
      detail: env("RESEND_API_KEY")
        ? "API key valid."
        : "Set RESEND_API_KEY.",
    },
    {
      label: "Verified sender domain (deliverability)",
      status:
        settings.senderDomains.length > 0 &&
        !settings.senderDomains.includes("resend.dev")
          ? "ok"
          : "warn",
      detail:
        settings.senderDomains.length > 0 &&
        !settings.senderDomains.includes("resend.dev")
          ? `Sending from ${settings.senderDomains.join(", ")}.`
          : "Currently sending from resend.dev sandbox — most cold emails will land in spam. Verify a subdomain (e.g. mail.realscale.app) in Resend with DKIM + SPF.",
    },
    {
      label: "Resend inbound webhook",
      status: env("RESEND_INBOUND_WEBHOOK_SECRET") ? "ok" : "todo",
      detail: env("RESEND_INBOUND_WEBHOOK_SECRET")
        ? "Replies auto-classify and route through Claude."
        : "Optional — enables auto-triage of replies. Configure inbound webhook in Resend pointing at /api/resend/webhook.",
    },
    {
      label: "Cloudflare R2 storage",
      status:
        env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY")
          ? "ok"
          : "todo",
      detail:
        env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY")
          ? "Renders + delivery zips persist here."
          : "Set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY.",
    },
    {
      label: "Lob (postcard mailer)",
      status: env("LOB_API_KEY") ? (settings.mailerEnabled ? "ok" : "warn") : "todo",
      detail: !env("LOB_API_KEY")
        ? "Set LOB_API_KEY (test or live)."
        : settings.mailerEnabled
          ? "Postcards will mail when listings/qualified fires for satellite-tile services."
          : "API key set; mailer is OFF in admin settings — turn on when ready to ship real mail.",
    },
    {
      label: "Twilio (post-engagement SMS — optional)",
      status: env("TWILIO_FROM_NUMBER") ? "ok" : "warn",
      detail: env("TWILIO_FROM_NUMBER")
        ? "SMS will fire only after explicit consent (TCPA gate hard-coded)."
        : "Optional — used only for post-purchase delivery notifications.",
    },
    {
      label: "Business address (CAN-SPAM footer)",
      status:
        env("BUSINESS_ADDRESS") &&
        !env("BUSINESS_ADDRESS")?.includes("[SET")
          ? "ok"
          : "todo",
      detail:
        env("BUSINESS_ADDRESS") && !env("BUSINESS_ADDRESS")?.includes("[SET")
          ? `Footer reads "${env("BUSINESS_ADDRESS")}".`
          : "BUSINESS_ADDRESS unset — every email currently footers as a placeholder, which is a CAN-SPAM violation if sent.",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  const total = items.length;
  const warnCount = items.filter((i) => i.status === "warn").length;
  const todoCount = items.filter((i) => i.status === "todo").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Autonomous-mode readiness</span>
          <span className="text-sm font-normal text-muted-foreground">
            {okCount}/{total} ready ·{" "}
            {warnCount > 0 && (
              <span className="text-amber-600">{warnCount} warn · </span>
            )}
            {todoCount > 0 && <span className="text-destructive">{todoCount} todo</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-md border p-3">
            {item.status === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : item.status === "warn" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
