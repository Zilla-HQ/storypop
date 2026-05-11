/**
 * Lob postcard sending — direct REST integration.
 *
 * Lob bills per-piece (~$0.92 for 4x6 first-class as of mid-2026). We
 * never install the SDK; the REST surface is small enough that hand-
 * rolling the call keeps node_modules lean.
 *
 * Auth: HTTP Basic with LOB_API_KEY as the username, empty password.
 *
 * Docs: https://docs.lob.com/#tag/Postcards
 */

const LOB_BASE = "https://api.lob.com/v1";

export interface PostcardAddress {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressCountry?: string;
}

export interface SendPostcardArgs {
  description: string;
  to: PostcardAddress;
  from: PostcardAddress;
  /** HTML for the front of the postcard. Lob renders at 4.25" x 6.25". */
  frontHtml: string;
  backHtml: string;
  size?: "4x6" | "6x9" | "6x11";
  metadata?: Record<string, string>;
}

export interface SendPostcardResult {
  success: boolean;
  lobId?: string;
  costCents?: number;
  expectedDeliveryDate?: string;
  error?: string;
}

function authHeader(): string | null {
  const key = process.env.LOB_API_KEY;
  if (!key) return null;
  const token = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}

function toLobAddress(a: PostcardAddress): Record<string, string> {
  return {
    name: a.name,
    address_line1: a.addressLine1,
    ...(a.addressLine2 ? { address_line2: a.addressLine2 } : {}),
    address_city: a.addressCity,
    address_state: a.addressState,
    address_zip: a.addressZip,
    address_country: a.addressCountry || "US",
  };
}

export async function sendPostcard(args: SendPostcardArgs): Promise<SendPostcardResult> {
  const auth = authHeader();
  if (!auth) {
    return { success: false, error: "LOB_API_KEY not configured" };
  }

  const form = new URLSearchParams();
  form.append("description", args.description);
  form.append("size", args.size || "4x6");
  form.append("front", args.frontHtml);
  form.append("back", args.backHtml);

  const to = toLobAddress(args.to);
  for (const [k, v] of Object.entries(to)) form.append(`to[${k}]`, v);
  const from = toLobAddress(args.from);
  for (const [k, v] of Object.entries(from)) form.append(`from[${k}]`, v);

  if (args.metadata) {
    for (const [k, v] of Object.entries(args.metadata)) {
      form.append(`metadata[${k}]`, v);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${LOB_BASE}/postcards`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (err) {
    return {
      success: false,
      error: `network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: { id?: string; price?: string; expected_delivery_date?: string; error?: { message?: string } } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    return { success: false, error: msg };
  }

  const priceUsd = parseFloat(body?.price ?? "0");
  const costCents = Number.isFinite(priceUsd) ? Math.round(priceUsd * 100) : undefined;

  return {
    success: true,
    lobId: body?.id,
    costCents,
    expectedDeliveryDate: body?.expected_delivery_date,
  };
}

/**
 * Render the front of the postcard — full-bleed hero photo with the
 * unit/business name and a single overlay headline. Lob safe-zone for
 * 4x6 is 4" x 6" inside a 4.25" x 6.25" canvas with 0.125" bleed.
 */
export function renderPostcardFront(args: {
  brandName: string;
  cityLabel: string;
  heroPhotoUrl: string | null;
  headline?: string;
}): string {
  const { brandName, cityLabel, heroPhotoUrl, headline } = args;
  const photoBlock = heroPhotoUrl
    ? `<img src="${heroPhotoUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);"></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: 6.25in 4.25in; margin: 0; }
html, body { margin:0; padding:0; width:6.25in; height:4.25in; font-family:'Helvetica Neue',Arial,sans-serif; }
.canvas { position:relative; width:6.25in; height:4.25in; overflow:hidden; }
.scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.75) 100%); }
.text { position:absolute; bottom:0.5in; left:0.5in; right:0.5in; color:white; }
.headline { font-size:36pt; font-weight:700; line-height:1.0; letter-spacing:-0.02em; margin:0 0 8px 0; }
.sub { font-size:11pt; opacity:0.85; margin:0; }
</style></head><body>
<div class="canvas">
  ${photoBlock}
  <div class="scrim"></div>
  <div class="text">
    <p class="headline">${escape(headline ?? brandName)}</p>
    <p class="sub">${escape(cityLabel)} &middot; Open the preview &rarr;</p>
  </div>
</div>
</body></html>`;
}

/**
 * Render the back — message + URL + return address. Lob 4x6 reserves
 * the right half (3" x 4") for the recipient's address; we only fill
 * the left half.
 */
export function renderPostcardBack(args: {
  brandName: string;
  ctaTitle: string;
  ctaBody: string;
  previewUrl: string;
  priceLabel?: string;
}): string {
  const { brandName, ctaTitle, ctaBody, previewUrl, priceLabel } = args;
  const displayUrl = previewUrl.replace(/^https?:\/\//, "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: 6.25in 4.25in; margin: 0; }
html, body { margin:0; padding:0; width:6.25in; height:4.25in; font-family:'Helvetica Neue',Arial,sans-serif; color:#1a1a1a; }
.message { box-sizing:border-box; width:3.25in; height:4.25in; padding:0.5in 0.4in; float:left; }
.brand { font-size:10pt; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#a87c2c; margin:0 0 18px 0; }
.headline { font-size:18pt; font-weight:700; line-height:1.1; letter-spacing:-0.01em; margin:0 0 12px 0; }
.body { font-size:9pt; line-height:1.4; color:#374151; margin:0 0 14px 0; }
.url { font-size:11pt; font-weight:700; color:#1a1a1a; margin:0 0 6px 0; word-break:break-all; }
.price { display:inline-block; padding:6px 12px; border:2px solid #1a1a1a; border-radius:999px; font-size:10pt; font-weight:700; }
</style></head><body>
<div class="message">
  <p class="brand">${escape(brandName)}</p>
  <p class="headline">${escape(ctaTitle)}</p>
  <p class="body">${escape(ctaBody)}</p>
  <p class="url">${escape(displayUrl)}</p>
  ${priceLabel ? `<span class="price">${escape(priceLabel)}</span>` : ""}
</div>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Read the return-address envs into a PostcardAddress. Returns null if
 * any of the required fields are missing — the direct-mail cron uses
 * that to no-op silently when the operator hasn't configured Lob yet.
 */
export function readFromAddressEnv(): PostcardAddress | null {
  const name = process.env.LOB_FROM_NAME;
  const addressLine1 = process.env.LOB_FROM_LINE1;
  const addressCity = process.env.LOB_FROM_CITY;
  const addressState = process.env.LOB_FROM_STATE;
  const addressZip = process.env.LOB_FROM_ZIP;
  if (!name || !addressLine1 || !addressCity || !addressState || !addressZip) {
    return null;
  }
  return {
    name,
    addressLine1,
    addressLine2: process.env.LOB_FROM_LINE2,
    addressCity,
    addressState,
    addressZip,
    addressCountry: "US",
  };
}
