import { env } from "@/lib/env";
import QRCode from "qrcode";

const apiKey = env("LOB_API_KEY");

const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://realscale.app")!;
const BUSINESS_NAME = env("BUSINESS_NAME", "Realscale")!;
const BUSINESS_ADDRESS = env("BUSINESS_ADDRESS", "");

const RETURN_ADDRESS = parseUSAddress(BUSINESS_ADDRESS ?? "");

export interface PostcardArgs {
  /** Used to dedupe — same listing won't be mailed twice */
  listingId: string;
  /** Mailing target (street, city, state, zip on the listing's property) */
  to: {
    name: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    state: string;
    zip: string;
  };
  /** Personalized landing page slug — becomes the QR target */
  listingSlug: string;
  /** Service the postcard is promoting */
  serviceId: string;
  serviceName: string;
  /** Address line shown in the headline */
  shortAddress: string;
  /** Public R2 URL of the "before" hero photo */
  beforeImageUrl: string;
  /** Public R2 URL of the "after" hero photo */
  afterImageUrl: string;
}

export interface PostcardResult {
  lobId: string;
  expectedDeliveryDate: string | null;
  trackingUrl: string | null;
}

function parseUSAddress(addr: string): {
  line1: string;
  city: string;
  state: string;
  zip: string;
} {
  // Best-effort parse for "123 Main St, City, ST ZIP" — refine later or
  // call Lob's address verification API in the actual mailer agent.
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return { line1: addr, city: "", state: "", zip: "" };
  const line1 = parts[0];
  const city = parts[1];
  const tail = parts[parts.length - 1];
  const tailMatch = tail.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  return tailMatch
    ? { line1, city, state: tailMatch[1], zip: tailMatch[2] }
    : { line1, city, state: "", zip: tail };
}

/**
 * Build the postcard's HTML — what Lob will print on the front and back.
 * Uses a minimal, print-safe MJML-free HTML so it works through Lob's
 * Chrome PDF renderer. Exported so admins can preview without sending.
 */
export async function renderPostcard(args: PostcardArgs): Promise<{ front: string; back: string }> {
  const target = `${APP_URL}/l/${args.listingSlug}?utm_source=postcard&utm_campaign=${args.serviceId}`;
  const qrDataUrl = await QRCode.toDataURL(target, {
    margin: 0,
    width: 220,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const baseStyle = `
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .card { width: 6in; height: 4in; }
  `;

  const front = `<!DOCTYPE html>
<html><head><style>
${baseStyle}
.front { background: #ffffff; position: relative; }
.row { display: flex; height: 4in; }
.col { width: 50%; height: 4in; overflow: hidden; position: relative; }
.col img { width: 100%; height: 100%; object-fit: cover; display: block; }
.label { position: absolute; bottom: 12px; left: 12px;
  background: rgba(15,23,42,0.85); color: #fff;
  padding: 4px 10px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: .08em; font-size: 10pt; font-weight: 700; }
.label-after { background: #047857; }
</style></head>
<body><div class="card front">
  <div class="row">
    <div class="col">
      <img src="${args.beforeImageUrl}" alt="Before"/>
      <div class="label">Before</div>
    </div>
    <div class="col">
      <img src="${args.afterImageUrl}" alt="After"/>
      <div class="label label-after">After</div>
    </div>
  </div>
</div></body></html>`;

  const back = `<!DOCTYPE html>
<html><head><style>
${baseStyle}
.back { background: #ffffff; padding: 0.4in 0.45in; box-sizing: border-box; }
.brand { font-size: 11pt; font-weight: 700; letter-spacing: .12em; color: #0f172a; }
.headline { font-size: 19pt; font-weight: 700; color: #0f172a; line-height: 1.15; margin: .14in 0 .08in; }
.address { font-size: 10pt; color: #64748b; margin-bottom: .18in; }
.body { font-size: 10pt; color: #0f172a; line-height: 1.45; max-width: 3in; }
.cta-row { display: flex; align-items: flex-end; justify-content: space-between; margin-top: .22in; }
.qr-box { text-align: center; }
.qr-box img { width: 1.1in; height: 1.1in; }
.qr-label { font-size: 8pt; color: #64748b; margin-top: 4px; }
.url { font-size: 10pt; color: #047857; font-weight: 600; }
.return { position: absolute; top: .35in; right: .45in; font-size: 8pt; color: #64748b; line-height: 1.4; }
</style></head>
<body><div class="card back" style="position: relative;">
  <div class="return">
    <div>${BUSINESS_NAME}</div>
    <div>${RETURN_ADDRESS.line1}</div>
    <div>${RETURN_ADDRESS.city}, ${RETURN_ADDRESS.state} ${RETURN_ADDRESS.zip}</div>
  </div>
  <div class="brand">REALSCALE</div>
  <div class="headline">Your home at ${escapeHtml(args.shortAddress)} —<br/>visualized.</div>
  <div class="address">${escapeHtml(args.shortAddress)}</div>
  <div class="body">
    We ran your property through our ${escapeHtml(args.serviceName)} pipeline.
    Scan the code or visit the link to see the full before / after for your address.
    No signup, free preview.
  </div>
  <div class="cta-row">
    <div>
      <div class="url">realscale.app/l/${escapeHtml(args.listingSlug)}</div>
      <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Free preview for this address</div>
    </div>
    <div class="qr-box">
      <img src="${qrDataUrl}" alt="QR"/>
      <div class="qr-label">Scan to view</div>
    </div>
  </div>
</div></body></html>`;

  return { front, back };
}

/**
 * Send a real (or test) postcard via Lob.
 * In test mode (LOB_API_KEY starts with `test_` or `live_test_`), Lob renders
 * the PDF and returns a Lob ID but doesn't actually print or mail.
 */
export async function sendPostcard(args: PostcardArgs): Promise<PostcardResult> {
  if (!apiKey) throw new Error("LOB_API_KEY not set");
  const { front, back } = await renderPostcard(args);

  const body = new URLSearchParams();
  body.set("description", `realscale-${args.serviceId}-${args.listingId.slice(0, 8)}`);
  body.set("front", front);
  body.set("back", back);
  body.set("size", "6x4");
  body.set("idempotency_key", `pc_${args.listingId}_${args.serviceId}`);

  // To address (the listing's property)
  body.set("to[name]", args.to.name.slice(0, 40));
  body.set("to[address_line1]", args.to.streetLine1);
  if (args.to.streetLine2) body.set("to[address_line2]", args.to.streetLine2);
  body.set("to[address_city]", args.to.city);
  body.set("to[address_state]", args.to.state);
  body.set("to[address_zip]", args.to.zip);
  body.set("to[address_country]", "US");

  // From address (Realscale return)
  body.set("from[name]", BUSINESS_NAME);
  body.set("from[address_line1]", RETURN_ADDRESS.line1);
  body.set("from[address_city]", RETURN_ADDRESS.city);
  body.set("from[address_state]", RETURN_ADDRESS.state);
  body.set("from[address_zip]", RETURN_ADDRESS.zip);
  body.set("from[address_country]", "US");

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `pc_${args.listingId}_${args.serviceId}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lob HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    id: string;
    expected_delivery_date?: string;
    tracking_events?: { url?: string }[];
    url?: string;
  };
  return {
    lobId: data.id,
    expectedDeliveryDate: data.expected_delivery_date ?? null,
    trackingUrl: data.url ?? null,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
