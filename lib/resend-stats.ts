import { env } from "@/lib/env";

const RESEND_KEY = env("RESEND_API_KEY");

export interface ResendEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  last_event: string;
  created_at: string;
}

export interface ResendStats {
  total: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  complained: number;
  unsubscribed: number;
  pending: number;
  byDomain: { domain: string; count: number }[];
  recent: ResendEmail[];
}

/**
 * Fetch a snapshot of recent Resend emails + aggregate stats.
 * Filters to a specific sender-domain prefix (e.g. "restay.agency") if given.
 */
export interface ResendEmailDetail extends ResendEmail {
  html: string | null;
  text: string | null;
  reply_to?: string[];
  cc?: string[];
  bcc?: string[];
}

/**
 * Fetch a single email's full content (including html + text body) from Resend.
 * Used by /admin/email/[resendId] to render the rich email view.
 */
export async function fetchResendEmail(id: string): Promise<ResendEmailDetail | null> {
  if (!RESEND_KEY) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${RESEND_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ResendEmailDetail;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[resend-stats] fetchEmail error:", (e as Error).message);
    return null;
  }
}

export async function fetchResendSnapshot(senderFilter?: string): Promise<ResendStats | null> {
  if (!RESEND_KEY) return null;
  try {
    const res = await fetch("https://api.resend.com/emails?limit=100", {
      headers: { Authorization: `Bearer ${RESEND_KEY}` },
      // Don't cache — admin panel should always be fresh
      cache: "no-store",
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[resend-stats] HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { data?: ResendEmail[] } | ResendEmail[];
    const emails = Array.isArray(body) ? body : body.data ?? [];

    const filtered = senderFilter
      ? emails.filter((e) => (e.from ?? "").toLowerCase().includes(senderFilter.toLowerCase()))
      : emails;

    const byEvent: Record<string, number> = {};
    const domainCounts: Record<string, number> = {};
    for (const e of filtered) {
      const ev = e.last_event ?? "unknown";
      byEvent[ev] = (byEvent[ev] ?? 0) + 1;
      // Extract sender domain from "Name <user@domain>"
      const m = (e.from ?? "").match(/<[^@]+@([^>]+)>/) ?? (e.from ?? "").match(/@([\w.-]+)/);
      if (m) {
        const d = m[1].toLowerCase();
        domainCounts[d] = (domainCounts[d] ?? 0) + 1;
      }
    }

    return {
      total: filtered.length,
      delivered: byEvent.delivered ?? 0,
      bounced: byEvent.bounced ?? 0,
      opened: byEvent.opened ?? 0,
      clicked: byEvent.clicked ?? 0,
      complained: byEvent.complained ?? 0,
      unsubscribed: byEvent.unsubscribed ?? 0,
      pending: (byEvent.queued ?? 0) + (byEvent.sent ?? 0) + (byEvent.delivery_delayed ?? 0),
      byDomain: Object.entries(domainCounts)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count),
      recent: filtered
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 25),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[resend-stats] error:", (e as Error).message);
    return null;
  }
}
