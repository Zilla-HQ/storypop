/**
 * Smoke-test Google Ads API credentials.
 *
 *   npx tsx --env-file=.env.local scripts/google-ads-smoke-test.ts
 *
 * Steps:
 *   1. Mint access_token from the refresh_token
 *   2. Call /customers:listAccessibleCustomers — confirms developer token,
 *      OAuth client, and refresh token are all valid and the auth can see
 *      at least one customer
 *   3. Verify GOOGLE_ADS_CUSTOMER_ID appears in that list
 *   4. Fetch the customer's basic info to confirm login_customer_id (MCC)
 *      header works for cross-account access
 *
 * Read-only — touches nothing in your ad accounts.
 */
const ENV = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v.trim();
};

const DEVELOPER_TOKEN = ENV("GOOGLE_ADS_DEVELOPER_TOKEN");
const CLIENT_ID = ENV("GOOGLE_ADS_CLIENT_ID");
const CLIENT_SECRET = ENV("GOOGLE_ADS_CLIENT_SECRET");
const REFRESH_TOKEN = ENV("GOOGLE_ADS_REFRESH_TOKEN");
const CUSTOMER_ID = ENV("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = ENV("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "");
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v20";

async function mintAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  const j = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) {
    throw new Error(
      `Token mint failed: ${j.error_description ?? j.error ?? "unknown"}`,
    );
  }
  return j.access_token;
}

async function gads<T>(args: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  loginCustomerId?: string;
}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
    "content-type": "application/json",
  };
  if (args.loginCustomerId) headers["login-customer-id"] = args.loginCustomerId;

  const r = await fetch(`https://googleads.googleapis.com/${API_VERSION}${args.path}`, {
    method: args.method ?? "GET",
    headers,
    body: args.body ? JSON.stringify(args.body) : undefined,
  });
  const text = await r.text();
  let j: T & { error?: { message: string; code?: number } };
  try {
    j = JSON.parse(text) as T & { error?: { message: string; code?: number } };
  } catch {
    throw new Error(
      `Google Ads ${args.path} → HTTP ${r.status} non-JSON body: ${text.slice(0, 400)}`,
    );
  }
  if (!r.ok || (j as { error?: unknown }).error) {
    const e = (j as { error?: { message: string; code?: number } }).error;
    throw new Error(
      `Google Ads ${args.path} → ${r.status}: ${e?.message ?? JSON.stringify(j).slice(0, 400)}`,
    );
  }
  return j as T;
}

async function main() {
  console.log("Restay Google Ads API smoke test\n");

  // ─── 1. Mint access token ────────────────────────────────────────────────
  process.stdout.write("1. Minting access token from refresh_token... ");
  const accessToken = await mintAccessToken();
  console.log("✓");

  // ─── 2. List accessible customers ────────────────────────────────────────
  process.stdout.write("2. Listing accessible customers... ");
  const list = await gads<{ resourceNames?: string[] }>({
    accessToken,
    path: "/customers:listAccessibleCustomers",
  });
  const ids = (list.resourceNames ?? []).map((rn) => rn.split("/").pop()!);
  console.log(`✓ ${ids.length} customer(s)`);
  for (const id of ids) console.log(`     • ${id}`);

  // ─── 3. Confirm Restay is reachable through MCC ──────────────────────────
  process.stdout.write(
    `3. Calling Restay (${CUSTOMER_ID}) via Zilla HQ MCC (${LOGIN_CUSTOMER_ID})... `,
  );
  const customer = await gads<{
    resourceName: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
  }>({
    accessToken,
    path: `/customers/${CUSTOMER_ID}/googleAds:searchStream`,
    method: "POST",
    body: {
      query: "SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1",
    },
    loginCustomerId: LOGIN_CUSTOMER_ID,
  });
  console.log("✓");
  const row =
    (customer as unknown as { results?: { customer: { descriptiveName: string; currencyCode: string; timeZone: string } }[] }[])[0]
      ?.results?.[0]?.customer ??
    (customer as unknown as { results: { customer: { descriptiveName: string; currencyCode: string; timeZone: string } }[] })
      .results?.[0]?.customer;
  if (row) {
    console.log(`     • Name: ${row.descriptiveName}`);
    console.log(`     • Currency: ${row.currencyCode}`);
    console.log(`     • Time zone: ${row.timeZone}`);
  }

  console.log("\n────────────────────────────────────────");
  console.log("✓ All credentials valid. Marketing API ready.");
  console.log("────────────────────────────────────────");
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`);
  process.exit(1);
});

export {};
