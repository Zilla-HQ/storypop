/**
 * For each (service → list of candidate Unsplash + Mapbox sources), use Claude
 * vision to rate suitability. Print the winner per service so we can lock it
 * into generate-service-samples.mjs.
 */
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const sat = (lng, lat, zoom = 19.5) =>
  `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/1024x768@2x?access_token=${MAPBOX}&attribution=false&logo=false`;

const POOL_CANDIDATES = [
  // Various Phoenix-area lat/lng — different residential subdivisions
  { id: "phx-eastmark", url: sat(-111.610, 33.300, 19) },
  { id: "phx-power-ranch", url: sat(-111.701, 33.281, 19) },
  { id: "scottsdale-dc-ranch", url: sat(-111.911, 33.674, 19) },
  { id: "phx-arcadia", url: sat(-111.985, 33.498, 19) },
  // Unsplash aerial residential photos (guesses — vision will validate)
  { id: "unsplash-aerial-1", url: "https://images.unsplash.com/photo-1518883361060-aa0fb5d04bad?auto=format&fit=crop&w=1200&q=80" },
  { id: "unsplash-aerial-2", url: "https://images.unsplash.com/photo-1591474200742-8e512e6f98f8?auto=format&fit=crop&w=1200&q=80" },
  { id: "unsplash-drone-suburb", url: "https://images.unsplash.com/photo-1567459169668-95d355371bda?auto=format&fit=crop&w=1200&q=80" },
];

const SOLAR_CANDIDATES = [
  { id: "phx-eastmark", url: sat(-111.610, 33.300, 19.5) },
  { id: "phx-arcadia", url: sat(-111.985, 33.498, 19.5) },
  { id: "scottsdale-dc-ranch", url: sat(-111.911, 33.674, 19.5) },
  { id: "phx-tempe", url: sat(-111.940, 33.425, 19.5) },
  { id: "unsplash-modern-home-1", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80" },
  { id: "unsplash-modern-home-2", url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80" },
];

async function fetchB64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}: ${url.slice(0, 60)}`);
  const ct = r.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());
  return { mediaType: ct.split(";")[0], data: buf.toString("base64") };
}

async function rate(url, criterion) {
  try {
    const img = await fetchB64(url);
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
            {
              type: "text",
              text: `${criterion}\n\nReturn ONLY: {"score": 1-5, "reason": "<one line>"}\n5=perfect candidate. 1=not what we want.`,
            },
          ],
        },
      ],
    });
    const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { score: 0, reason: "no parse" };
  } catch (e) {
    return { score: 0, reason: e.message?.slice(0, 80) };
  }
}

async function pick(label, candidates, criterion) {
  console.log(`\n=== ${label} ===`);
  const results = [];
  for (const c of candidates) {
    const r = await rate(c.url, criterion);
    console.log(`  ${c.id.padEnd(28)} score=${r.score} | ${r.reason}`);
    results.push({ ...c, ...r });
  }
  results.sort((a, b) => b.score - a.score);
  const winner = results[0];
  console.log(`\n  WINNER: ${winner.id} (${winner.score}/5)`);
  console.log(`  URL: ${winner.url.slice(0, 130)}`);
}

await pick(
  "POOL — suburban residential, clearly empty backyard with grass/dirt",
  POOL_CANDIDATES,
  "Is this an aerial/overhead view of a single-family suburban residential home with a clearly EMPTY backyard (grass, no pool, no patio)? It should look like a typical American home where adding an in-ground pool would make sense.",
);

await pick(
  "SOLAR — house with clean, mostly-unobstructed roof",
  SOLAR_CANDIDATES,
  "Is this a view (aerial or oblique) of a single-family home where the roof is clearly visible, large, mostly unobstructed by trees, and has NO existing solar panels? It should be a typical American home where adding solar panels would make sense.",
);
