/**
 * Backfill the 25-email batch from 2026-04-29 (the demo send to jack@seifdn.org).
 * IDs preserved from script output. Fetches each individually from Resend
 * to capture current delivery + open status.
 */
import postgres from "postgres";

const RESEND_KEY = process.env.RESEND_API_KEY;
const DB_URL = process.env.DATABASE_URL;

const SENT_BATCH = [
  // First 5 (already in DB from earlier backfill — included for status refresh)
  ["884d6a22-a672-46b4-bf46-26ed875fbc10", "Scarlett"],
  ["ddf94de0-1785-4749-b304-d33665b3d505", "Lily And Jordan"],
  ["0b41197d-315a-4440-8b47-830cc823fd48", "Benjamin"],
  ["da8dac41-667e-4fb3-8b10-1b297641bd75", "Andrew"],
  ["6130fa64-2d30-4129-8f6c-2d95914f313b", "Christie"],
  // Second 25-batch
  ["d25891d1-4780-4e1a-88b8-4a86ff3d9150", "Kippie"],
  ["70124926-e328-4839-ade7-9b5026522e86", "Bethany"],
  ["4ce65c3a-11b8-4cfb-9dc9-f71c31983df3", "Carrie"],
  ["955b05ac-9c20-4c92-8798-898f1d5d01c8", "GoodNight"],
  ["4d68fabf-1472-4fef-8976-a5812de2bd84", "Taylor"],
  ["9d5981be-9884-430a-b985-6b374dc74444", "Leann"],
  ["81938b43-6480-4057-bc92-988bf32b4d7a", "Pamela Lash"],
  ["1ee4dc74-5aca-4daa-b838-6d5d56dc9d55", "Camila"],
  ["d1810ae8-f4fb-43c2-90b7-a91b130aa9f3", "Ben"],
  ["170c0d74-0829-4e05-bd2c-cbf7bde44324", "Element Nashville Vanderbit"],
  ["c4138dcd-4d3c-4e2f-ab90-9828898c5d11", "Rose"],
  ["bc9b875c-392a-4792-9f57-05b16274da6a", "Amy"],
  ["19ea8ee6-379f-4481-a893-82b0f19d5c2f", "Jessica"],
  ["a9455734-45e0-4a88-bb58-c8a218d46ffa", "Mark"],
  ["9d3323cd-3e9c-477b-9b02-c5ddde621ca5", "Mark"],
  ["8d5ddc4e-1a40-4e38-9514-3a6985ec62f8", "Andrew"],
  ["b21dd9ca-cde9-4df5-b251-5bf288a2d3bd", "Skylar"],
];

const sql = postgres(DB_URL, { connect_timeout: 12, max: 1, prepare: false });

async function fetchEmailDetail(id) {
  const r = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  if (!r.ok) return null;
  return r.json();
}

async function main() {
  let added = 0;
  let updated = 0;
  let opened = 0;

  for (const [resendId, hostName] of SENT_BATCH) {
    const email = await fetchEmailDetail(resendId);
    if (!email) {
      console.log(`  ✗ ${hostName} — not found in Resend`);
      continue;
    }
    const status = ["queued", "sent", "delivered", "opened", "clicked", "bounced", "complained", "replied", "unsubscribed", "failed"].includes(email.last_event)
      ? email.last_event : "sent";
    const subject = email.subject || "";
    const sentAt = email.created_at ? new Date(email.created_at) : new Date();

    // Try to find the listing for this host
    const [match] = await sql`SELECT id FROM restay.listings WHERE agent_name = ${hostName} ORDER BY created_at DESC LIMIT 1`;
    const [fallback] = await sql`SELECT id FROM restay.listings ORDER BY created_at ASC LIMIT 1`;
    const listingId = match?.id || fallback?.id;
    if (!listingId) { console.log(`  ✗ ${hostName} — no listing`); continue; }

    // Upsert
    const existing = await sql`SELECT id FROM restay.outreach_events WHERE resend_id = ${resendId}`;
    if (existing.length > 0) {
      await sql`
        UPDATE restay.outreach_events
        SET status = ${status}::restay.outreach_status,
            sent_at = COALESCE(sent_at, ${sentAt})
        WHERE resend_id = ${resendId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO restay.outreach_events (
          listing_id, channel, template_id, sender_domain, subject, body,
          resend_id, status, sent_at
        ) VALUES (
          ${listingId}, 'email', 'outreach_v1', 'mail.restay.agency',
          ${subject}, ${'(backfilled — preview routed to jack@seifdn.org)'}, ${resendId}, ${status}::restay.outreach_status, ${sentAt}
        )
      `;
      added++;
    }
    if (status === "opened" || status === "clicked") opened++;
    console.log(`  ${status === 'delivered' ? '📬' : status === 'opened' ? '👁' : status === 'clicked' ? '🖱' : status === 'bounced' ? '⚠' : '·'} ${hostName.slice(0, 25).padEnd(28)} ${status}`);
  }

  console.log(`\n✓ added ${added}, updated ${updated}, opened/clicked: ${opened}\n`);

  // Final summary
  const [s] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked','replied')) AS delivered,
      COUNT(*) FILTER (WHERE status IN ('opened','clicked','replied')) AS opened,
      COUNT(*) FILTER (WHERE status IN ('clicked','replied')) AS clicked,
      COUNT(*) FILTER (WHERE status = 'replied') AS replied,
      COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
      COUNT(*) FILTER (WHERE status = 'complained') AS complained
    FROM restay.outreach_events WHERE channel = 'email'
  `;
  const [l] = await sql`SELECT COUNT(*) AS c FROM restay.listings`;
  const [o] = await sql`SELECT COUNT(*) AS c FROM restay.orders`;
  console.log("FINAL:");
  console.log(`  emails total:     ${s.total}`);
  console.log(`  delivered:        ${s.delivered}`);
  console.log(`  opened:           ${s.opened}`);
  console.log(`  clicked:          ${s.clicked}`);
  console.log(`  replied:          ${s.replied}`);
  console.log(`  bounced:          ${s.bounced}`);
  console.log(`  complained:       ${s.complained}`);
  console.log(`  listings in DB:   ${l.c}`);
  console.log(`  orders in DB:     ${o.c}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
