/**
 * Use Claude vision to grade each kitchen variant for room preservation.
 * Picks the winner so we don't ship a bad one.
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = "claude-haiku-4-5-20251001";

const SOURCES = {
  empty: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1400&q=85",
  furnished: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=85",
};

const variants = [
  { label: "A", source: SOURCES.empty, after: process.argv[2] },
  { label: "B", source: SOURCES.furnished, after: process.argv[3] },
  { label: "C", source: SOURCES.furnished, after: process.argv[4] },
];

async function fetchB64(url) {
  const r = await fetch(url);
  const ct = r.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());
  return { mediaType: ct.split(";")[0], data: buf.toString("base64") };
}

const PROMPT = `You are comparing two real-estate photos.

Image 1 = SOURCE photo. Image 2 = AFTER photo (the AI claims to have just restyled the source kitchen).

Rate (1-5) on each axis:
- preservation: how much the kitchen geometry, walls, cabinets, windows, floor, ceiling, and camera angle match the source. 5 = identical, 1 = completely different room.
- styling: how appealing the staging is. 5 = magazine-quality, 1 = bad/missing.

Return ONLY: {"preservation": <1-5>, "styling": <1-5>, "issue": "<one-line note if anything is wrong>"}`;

for (const v of variants) {
  if (!v.after) {
    console.log(`${v.label}: skipped (no URL)`);
    continue;
  }
  try {
    const [src, after] = await Promise.all([fetchB64(v.source), fetchB64(v.after)]);
    const resp = await client.messages.create({
      model,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: src.mediaType, data: src.data } },
            { type: "image", source: { type: "base64", media_type: after.mediaType, data: after.data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { preservation: 0, styling: 0, issue: "parse error" };
    console.log(
      `${v.label}: preservation=${parsed.preservation} styling=${parsed.styling} | ${parsed.issue}`,
    );
  } catch (e) {
    console.log(`${v.label}: error ${e.message?.slice(0, 100)}`);
  }
}
