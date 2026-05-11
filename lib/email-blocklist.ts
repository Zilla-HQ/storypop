import { db, emailBlocklist } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Permanent email opt-out list. Anything here must never be cold-emailed
 * again, regardless of how the outreach loop discovered the address.
 *
 * Populated by:
 *   - Resend complaint webhooks → reason='complained'
 *   - Inbound unsubscribe replies (List-Unsubscribe mailto + Claude
 *     classifier "unsubscribe" bucket) → reason='unsubscribed'
 *   - Manual operator additions → reason='manual'
 *
 * Use `isBlocked(email)` before every cold send. Use `block(email,
 * reason)` from the unsubscribe + complaint paths.
 */

export type BlockReason = "complained" | "unsubscribed" | "manual" | "bounced_hard";

export async function isBlocked(email: string): Promise<boolean> {
  const e = email.toLowerCase().trim();
  if (!e) return false;
  const [row] = await db
    .select({ email: emailBlocklist.email })
    .from(emailBlocklist)
    .where(eq(emailBlocklist.email, e))
    .limit(1);
  return !!row;
}

export async function block(email: string, reason: BlockReason): Promise<void> {
  const e = email.toLowerCase().trim();
  if (!e) return;
  await db
    .insert(emailBlocklist)
    .values({ email: e, reason })
    .onConflictDoNothing({ target: emailBlocklist.email });
}

export async function unblock(email: string): Promise<void> {
  const e = email.toLowerCase().trim();
  if (!e) return;
  await db.delete(emailBlocklist).where(eq(emailBlocklist.email, e));
}
