import { NextRequest, NextResponse } from "next/server";

/**
 * Google Places autocomplete proxy for the self-serve funnel.
 *
 * Pattern (lifted from SiteGrid): a customer arrives on the marketing
 * site, types their business name into an autocomplete box, sees their
 * place suggested, picks it, and the merchant pulls full place details
 * + generates a preview in real-time. No cold-outreach loop required —
 * the customer self-serves.
 *
 *   GET /api/self-serve/search?q=<query>&lat=<lat>&lng=<lng>
 *
 * Returns: { suggestions: [{ placeId, name, address }] }
 *
 * Requires GOOGLE_PLACES_API_KEY. The key is server-side only — the
 * client never sees it.
 *
 * Rate-limit hint: Google's Places Autocomplete is billed per session.
 * A real implementation should pass a stable `sessiontoken` query
 * param from the client to batch keystrokes into a single billable
 * session. The stub here issues one autocomplete call per request,
 * which is fine for a low-traffic launch.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    input: q,
    key: apiKey,
    types: "establishment",
  });
  if (lat && lng) {
    params.set("location", `${lat},${lng}`);
    params.set("radius", "50000");
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "places api error", status: res.status },
      { status: 502 },
    );
  }
  const json = (await res.json()) as {
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting?: { main_text: string; secondary_text?: string };
    }>;
  };

  const suggestions = (json.predictions ?? []).slice(0, 8).map((p) => ({
    placeId: p.place_id,
    name: p.structured_formatting?.main_text ?? p.description,
    address: p.structured_formatting?.secondary_text ?? "",
  }));
  return NextResponse.json({ suggestions });
}
