import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerLinkGenerator } from "@/components/admin/partner-link-generator";
import { PartnerPanel } from "@/components/admin/partner-panel";
import { getPartnerAttribution, type PartnerAttributionSummary } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ZERO_PARTNERS: PartnerAttributionSummary = {
  rows: [],
  totalLeads: 0,
  totalPaidOrders: 0,
  totalRevenueCents: 0,
  totalCommissionCents: 0,
};

export default async function AdminPartnersPage() {
  let partners: PartnerAttributionSummary;
  try {
    partners = await getPartnerAttribution();
  } catch {
    partners = ZERO_PARTNERS;
  }

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Partners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate referral links and track commission owed. The public marketing
          page lives at{" "}
          <Link href="/partners" className="underline hover:text-foreground">
            /partners
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a referral link</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerLinkGenerator />
        </CardContent>
      </Card>

      <PartnerPanel summary={partners} />
    </div>
  );
}
