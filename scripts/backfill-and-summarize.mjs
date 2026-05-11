/**
 * Pulls all Restay-sent Resend emails, backfills outreach_events with
 * their delivery + open + click status, and prints a clean summary.
 */
import postgres from "postgres";

const RESEND_KEY = process.env.RESEND_API_KEY;
const DB_URL = process.env.DATABASE_URL;
if (!RESEND_KEY || !DB_URL) throw new Error("env missing");

const sql = postgres(DB_URL, { connect_timeout: 12, max: 1, prepare: false });

async function fetchAllResendEmails() {
  const r = await fetch("https://api.resend.com/emails?limit=100", {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const data = await r.json();
  return Array.isArray(data) ? data : (data.data ?? []);
}

async function fetchEmailDetail(id) {
  const r = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  if (!r.ok) return null;
  return r.json();
}

function mapStatus(lastEvent) {
  const valid = ["queued", "sent", "delivered", "opened", "clicked", "bounced", "complained", "replied", "unsubscribed", "failed"];
  return valid.includes(lastEvent) ? lastEvent : "sent";
}

async function main() {
  const emails = await fetchAllResendEmails();
  // Filter to Restay-originated (sender domain mail.restay.agency)
  const restay = emails.filter((e) => {
    const from = String(e.from || "");
    return from.includes("restay.agency") || from.includes("restay");
  });
  console.log(`fetched ${emails.length} total Resend emails; ${restay.length} from Restay senders`);

  // Get all existing resend_ids in our DB
  const existing = await sql`SELECT resend_id FROM restay.outreach_events WHERE resend_id IS NOT NULL`;
  const haveIds = new Set(existing.map((r) => r.resend_id));
  console.log(`existing outreach_events with resend_id: ${haveIds.size}`);

  // Map out missing emails — need a listing to associate them with
  // For backfill, attribute all to the test listing 5cbf335c-a278-4c3f-86d4-a901606aabe7 (has a known UUID)
  // OR pick the first listing if needed
  const [fallback] = await sql`SELECT id FROM restay.listings ORDER BY created_at ASC LIMIT 1`;
  const fallbackListingId = fallback?.id;

  let added = 0;
  let updated = 0;
  for (const email of restay) {
    const id = email.id;
    const lastEvent = email.last_event || "sent";
    const subject = email.subject || "";
    const created = email.created_at || new Date().toISOString();

    // Try to extract a listing ID by host name match
    // Subject pattern: "[Preview · would-go-to {Host}] {City} — your free 60-second Airbnb audit"
    const hostMatch = subject.match(/would-go-to ([^\]]+)\]/);
    let listingId = fallbackListingId;
    if (hostMatch) {
      const hostName = hostMatch[1].trim();
      const [match] = await sql`SELECT id FROM restay.listings WHERE agent_name = ${hostName} ORDER BY created_at DESC LIMIT 1`;
      if (match) listingId = match.id;
    }

    if (!listingId) continue;

    const status = mapStatus(lastEvent);
    const sentAt = email.created_at ? new Date(email.created_at) : new Date();

    if (haveIds.has(id)) {
      // Update status
      await sql`
        UPDATE restay.outreach_events
        SET status = ${status}::restay.outreach_status,
            sent_at = COALESCE(sent_at, ${sentAt})
        WHERE resend_id = ${id}
      `;
      updated++;
    } else {
      // Insert
      await sql`
        INSERT INTO restay.outreach_events (
          listing_id, channel, template_id, sender_domain, subject, body,
          resend_id, status, sent_at
        ) VALUES (
          ${listingId}, 'email', 'outreach_v1', 'mail.restay.agency',
          ${subject}, ${'(backfilled — body not preserved)'}, ${id}, ${status}::restay.outreach_status, ${sentAt}
        )
      `;
      added++;
    }
  }

  console.log(`\n✓ added ${added}, updated ${updated}`);

  // Summary stats
  console.log("\n========= SUMMARY =========");
  const [stats] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')) AS sent_or_better,
      COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked', 'replied')) AS delivered,
      COUNT(*) FILTER (WHERE status IN ('opened', 'clicked', 'replied')) AS opened,
      COUNT(*) FILTER (WHERE status IN ('clicked', 'replied')) AS clicked,
      COUNT(*) FILTER (WHERE status = 'replied') AS replied,
      COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
      COUNT(*) FILTER (WHERE status = 'complained') AS complained
    FROM restay.outreach_events
  `;
  console.log(`emails sent:       ${stats.sent_or_better}`);
  console.log(`emails delivered:  ${stats.delivered}`);
  console.log(`emails opened:     ${stats.opened}`);
  console.log(`emails clicked:    ${stats.clicked}`);
  console.log(`emails replied:    ${stats.replied}`);
  console.log(`emails bounced:    ${stats.bounced}`);
  console.log(`emails complained: ${stats.complained}`);

  const [listings] = await sql`SELECT COUNT(*) AS c FROM restay.listings`;
  console.log(`\nlistings in DB:    ${listings.c}`);

  const [orders] = await sql`SELECT COUNT(*) AS c FROM restay.orders`;
  console.log(`orders in DB:      ${orders.c}`);

  const utm = await sql`SELECT utm_source, COUNT(*) AS c FROM restay.listings GROUP BY utm_source ORDER BY c DESC`;
  console.log(`\nutm_source breakdown:`);
  utm.forEach((r) => console.log(`  ${r.utm_source ?? '(direct/none)'}: ${r.c}`));

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
