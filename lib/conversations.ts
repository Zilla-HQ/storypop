import { db, inboundEmails } from "@/db";
import { desc, sql, or, eq } from "drizzle-orm";

/**
 * Helpers for the /admin/conversations admin surface.
 *
 * A "conversation" is the merged set of all messages where the lead's
 * email is either the from_address (inbound) or the to_address
 * (outbound). We group by that lead email — meaning a single lead's
 * thread surfaces every audit report we sent them, every regression
 * alert, every cold pitch, and every reply they sent back, in one
 * chronological feed.
 */

export interface ConversationSummary {
  email: string;
  lastMessageAt: Date;
  lastDirection: "inbound" | "outbound";
  lastSubject: string | null;
  lastSnippet: string | null;
  inboundCount: number;
  outboundCount: number;
}

export interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  action: string;
  tag: string | null;
  createdAt: Date;
}

const SYSTEM_ADDRESSES = [
  // We never want to surface the platform's own service mailboxes as
  // "leads" — they're operator-side. Skip rows where the lead address
  // would be ours.
  "alerts@",
  "replies@",
  "noreply@",
  "no-reply@",
  "onboarding@",
  "partners@",
];

function isSystemAddress(addr: string): boolean {
  const lower = addr.toLowerCase();
  return SYSTEM_ADDRESSES.some((p) => lower.startsWith(p));
}

/**
 * The lead's email = the side of the message that *isn't* a system
 * address. Used to group inbound + outbound into per-lead threads.
 */
function leadAddress(fromAddr: string, toAddr: string): string | null {
  const fromIsSystem = isSystemAddress(fromAddr);
  const toIsSystem = isSystemAddress(toAddr);
  if (!fromIsSystem && toIsSystem) return fromAddr.toLowerCase();
  if (fromIsSystem && !toIsSystem) return toAddr.toLowerCase();
  // Neither is system (rare — operator-to-operator) or both are
  // (impossible). Skip.
  if (fromIsSystem && toIsSystem) return null;
  // Neither is system: use the from-address as the lead.
  return fromAddr.toLowerCase();
}

/**
 * List recent conversations grouped by lead email. Ordered by most
 * recent activity. Limit to ~100 leads for the index page.
 */
export async function listConversations(limit = 100): Promise<ConversationSummary[]> {
  // Pull a generous window of recent messages, group in JS to compute
  // lead-side address.
  const recent = await db
    .select()
    .from(inboundEmails)
    .orderBy(desc(inboundEmails.createdAt))
    .limit(2000);

  const groups = new Map<string, ConversationSummary>();
  for (const row of recent) {
    const email = leadAddress(row.fromAddress, row.toAddress);
    if (!email) continue;
    const existing = groups.get(email);
    if (existing) {
      // Already have a more recent message (rows are ordered DESC); just
      // bump counts.
      if (row.direction === "outbound") existing.outboundCount += 1;
      else existing.inboundCount += 1;
    } else {
      groups.set(email, {
        email,
        lastMessageAt: row.createdAt,
        lastDirection: row.direction === "outbound" ? "outbound" : "inbound",
        lastSubject: row.subject,
        lastSnippet: (row.text ?? "").trim().slice(0, 200) || null,
        inboundCount: row.direction === "outbound" ? 0 : 1,
        outboundCount: row.direction === "outbound" ? 1 : 0,
      });
    }
  }

  return [...groups.values()]
    .sort((a, b) => +b.lastMessageAt - +a.lastMessageAt)
    .slice(0, limit);
}

/**
 * Get all messages for a given lead email — both directions, sorted
 * chronologically (oldest first, like a conversation transcript).
 */
export async function getThread(email: string): Promise<ThreadMessage[]> {
  const lower = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(inboundEmails)
    .where(
      or(
        eq(sql`lower(${inboundEmails.fromAddress})`, lower),
        eq(sql`lower(${inboundEmails.toAddress})`, lower),
      )!,
    )
    .orderBy(inboundEmails.createdAt);

  return rows.map((r) => ({
    id: r.id,
    direction: (r.direction === "outbound" ? "outbound" : "inbound") as
      | "inbound"
      | "outbound",
    fromAddress: r.fromAddress,
    toAddress: r.toAddress,
    subject: r.subject,
    text: r.text,
    html: r.html,
    messageId: r.messageId,
    inReplyTo: r.inReplyTo,
    action: r.action,
    tag: r.tag,
    createdAt: r.createdAt,
  }));
}
