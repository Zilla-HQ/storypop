import { env } from "@/lib/env";

/**
 * Lulu xPress print-fulfillment client. Submits a print-job from a final
 * book PDF; polls status; emits tracking number once shipped.
 *
 * Swappable by design — `lib/print-provider.ts` could later abstract Lulu
 * vs. an alternative (Printful for books, Blurb, IngramSpark). For now,
 * Lulu is the only print path.
 *
 * Sandbox vs production:
 *   LULU_BASE_URL=https://api.sandbox.lulu.com   (default for non-prod)
 *   LULU_BASE_URL=https://api.lulu.com           (prod)
 * Flip via env after one verified sandbox print + one verified live print.
 */

const BASE_URL = env("LULU_BASE_URL", "https://api.sandbox.lulu.com");
const CLIENT_KEY = env("LULU_CLIENT_KEY");
const CLIENT_SECRET = env("LULU_CLIENT_SECRET");

const POD_PACKAGES = {
  // Lulu Standard 8.5x8.5 softcover, 60lb white paper, premium color.
  softcover: "0850X0850BWSTDLW060UW444MXX",
  // Lulu Standard 8.5x11 hardcover, 80lb white paper, premium color, cloth.
  hardcover: "0850X1100FCSTDCW080UW444MXX",
} as const;

export type LuluLineItem = keyof typeof POD_PACKAGES;

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  stateCode: string;
  postcode: string;
  countryCode: string; // ISO-3166-1 alpha-2
  phone?: string;
}

export interface CreateJobInput {
  externalId: string; // our orderId
  lineItem: LuluLineItem;
  pageCount: 12 | 14 | 16;
  interiorPdfUrl: string;
  coverPdfUrl: string;
  shipping: ShippingAddress;
  /** "MAIL" cheap, "GROUND" standard, "EXPEDITED" rush */
  shippingLevel: "MAIL" | "GROUND" | "EXPEDITED";
}

export interface LuluJob {
  id: string;
  externalId: string;
  status: LuluStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedShipDate: string | null;
}

export type LuluStatus =
  | "CREATED"
  | "UNPAID"
  | "PAYMENT_IN_PROGRESS"
  | "PRODUCTION_DELAYED"
  | "PRODUCTION_READY"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "REJECTED"
  | "CANCELED";

interface LuluTokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const credentials = Buffer.from(`${CLIENT_KEY}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE_URL}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Lulu auth failed: ${res.status}`);
  }
  const data = (await res.json()) as LuluTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function createPrintJob(input: CreateJobInput): Promise<LuluJob> {
  const token = await getToken();
  const body = {
    contact_email: env("REPLIES_EMAIL", "hello@storypop.shop"),
    external_id: input.externalId,
    line_items: [
      {
        external_id: input.externalId,
        printable_normalization: {
          cover: { source_url: input.coverPdfUrl },
          interior: { source_url: input.interiorPdfUrl },
          pod_package_id: POD_PACKAGES[input.lineItem],
        },
        quantity: 1,
        title: "StoryPop personalized book",
      },
    ],
    shipping_address: {
      name: input.shipping.name,
      street1: input.shipping.street1,
      street2: input.shipping.street2 ?? "",
      city: input.shipping.city,
      state_code: input.shipping.stateCode,
      postcode: input.shipping.postcode,
      country_code: input.shipping.countryCode,
      phone_number: input.shipping.phone ?? "",
    },
    shipping_level: input.shippingLevel,
  };
  const res = await fetch(`${BASE_URL}/print-jobs/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Lulu createPrintJob failed: ${res.status} ${errText}`);
  }
  const data = (await res.json()) as {
    id: number;
    external_id: string;
    status: { name: LuluStatus };
  };
  return {
    id: String(data.id),
    externalId: data.external_id,
    status: data.status.name,
    trackingNumber: null,
    trackingUrl: null,
    estimatedShipDate: null,
  };
}

export async function getPrintJob(luluJobId: string): Promise<LuluJob> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/print-jobs/${luluJobId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Lulu getPrintJob failed: ${res.status}`);
  const data = (await res.json()) as {
    id: number;
    external_id: string;
    status: { name: LuluStatus };
    estimated_shipping_dates?: { dispatch?: string };
    line_items?: { tracking_id?: string | null; tracking_urls?: string[] }[];
  };
  const li = data.line_items?.[0];
  return {
    id: String(data.id),
    externalId: data.external_id,
    status: data.status.name,
    trackingNumber: li?.tracking_id ?? null,
    trackingUrl: li?.tracking_urls?.[0] ?? null,
    estimatedShipDate: data.estimated_shipping_dates?.dispatch ?? null,
  };
}

/**
 * Q4 holiday cutoff. Hardcoded so the create-form can refuse hardcover orders
 * past this date for guaranteed-by-Christmas delivery and offer PDF instead.
 */
export function shippingCutoff(yearMonth: { year: number }): {
  hardcover: Date;
  softcover: Date;
} {
  return {
    hardcover: new Date(yearMonth.year, 11, 12), // Dec 12
    softcover: new Date(yearMonth.year, 11, 15), // Dec 15
  };
}
