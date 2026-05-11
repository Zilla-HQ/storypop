/**
 * Meta CAPI verifier — fires one of each event type at Meta with a test_event_code
 * so they appear in real-time in Events Manager → Test Events tab.
 *
 *   npx tsx scripts/meta-capi-verify.ts TEST<NNNNN>
 *
 * Or set META_TEST_EVENT_CODE in env. The CAPI client (lib/meta-capi.ts) reads
 * that env var automatically.
 *
 * Run before every deploy that changes CAPI logic. Match quality with email +
 * phone fields should be visibly higher than IP-only events — that's the proof
 * that hashing and forwarding is working.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const testCode = process.argv[2] || process.env.META_TEST_EVENT_CODE;
if (!testCode) {
  console.error("Pass a test_event_code as the first arg, or set META_TEST_EVENT_CODE.");
  process.exit(1);
}
process.env.META_TEST_EVENT_CODE = testCode;

const { sendCapiEvent } = await import("../lib/meta-capi.js");

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://example.com";
const fakeIp = "203.0.113.42"; // RFC 5737 test IP
const fakeUa = "Mozilla/5.0 CAPIVerifier";

async function fire(name: string, fn: () => Promise<any>) {
  process.stdout.write(`→ ${name.padEnd(20)} `);
  const r = await fn();
  if (r.ok) console.log("ok");
  else console.log(`FAIL  ${r.error}`);
  return r.ok;
}

console.log(`\nFiring CAPI events to Meta with test_event_code=${testCode}\n`);

const results = await Promise.all([
  fire("ViewContent", () => sendCapiEvent({ eventName: "ViewContent", eventSourceUrl: `${baseUrl}/`, ip: fakeIp, userAgent: fakeUa, contentName: "Test" })),
  fire("Lead", () => sendCapiEvent({ eventName: "Lead", eventSourceUrl: `${baseUrl}/`, ip: fakeIp, userAgent: fakeUa, contentName: "Test" })),
  fire("InitiateCheckout", () => sendCapiEvent({ eventName: "InitiateCheckout", eventSourceUrl: `${baseUrl}/`, ip: fakeIp, userAgent: fakeUa, email: "verify+capi@example.com", phone: "+15555550100", externalId: "verify-1", value: 199, currency: "USD", contentName: "Test", contentIds: ["test-1"] })),
  fire("Purchase", () => sendCapiEvent({ eventName: "Purchase", eventSourceUrl: `${baseUrl}/`, ip: fakeIp, userAgent: fakeUa, email: "verify+capi@example.com", phone: "+15555550100", externalId: "verify-1", value: 199, currency: "USD", contentName: "Test", contentIds: ["test-1"] })),
  fire("Contact", () => sendCapiEvent({ eventName: "Contact", eventSourceUrl: `${baseUrl}/`, ip: fakeIp, userAgent: fakeUa })),
]);

const allOk = results.every(Boolean);
console.log("");
if (allOk) {
  console.log("All 5 events accepted by Meta.");
  console.log(`Now: Events Manager → your pixel → Test Events tab. Events should appear within ~30s.`);
  console.log(`Match quality: events with email/phone (InitiateCheckout, Purchase) should score higher than IP-only events.`);
  console.log(`The test code ${testCode} expires after 24h or after Meta sees ~50 events.`);
} else {
  console.log("Some events failed. See errors above.");
  process.exit(1);
}
