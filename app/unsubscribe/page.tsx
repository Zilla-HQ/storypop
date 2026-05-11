import { db, listings, adminSettings } from "@/db";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ l?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { l } = await searchParams;
  let email: string | null = null;

  if (l) {
    const [listing] = await db.select().from(listings).where(eq(listings.id, l)).limit(1);
    if (listing?.agentEmail) {
      email = listing.agentEmail;
      await db
        .update(adminSettings)
        .set({
          emailBlacklist: sql`(
            select jsonb_agg(distinct elem)
            from jsonb_array_elements_text(${adminSettings.emailBlacklist} || to_jsonb(${listing.agentEmail}::text)) elem
          )`,
          updatedAt: new Date(),
        })
        .where(eq(adminSettings.id, 1));
    }
  }

  return (
    <div className="container max-w-lg py-20 text-center">
      <h1 className="text-2xl font-bold">You've been unsubscribed.</h1>
      <p className="mt-4 text-muted-foreground">
        {email ? (
          <>
            <span className="font-medium">{email}</span> won't receive further emails from us.
          </>
        ) : (
          "Your email address has been removed from our outreach list."
        )}
      </p>
      <p className="mt-8 text-xs text-muted-foreground">
        If this was a mistake, reply to any of our previous emails and we'll restore you.
      </p>
    </div>
  );
}
