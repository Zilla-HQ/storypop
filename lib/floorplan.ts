import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const apiKey = env("ANTHROPIC_API_KEY");
const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")!;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface RenovationRecommendation {
  title: string; // "Convert den to 4th bedroom"
  rationale: string; // 1-2 sentence why
  complexity: "easy" | "medium" | "hard";
  estCostLowCents: number;
  estCostHighCents: number;
  estValueLiftLowCents: number;
  estValueLiftHighCents: number;
  /** Returns true if this rec needs permits / structural work */
  permitRequired: boolean;
}

export interface FloorPlanAnalysis {
  bedroomCount: number;
  bathroomCount: number;
  recommendations: RenovationRecommendation[];
}

const PROMPT = `You're an expert real estate appraiser and remodeler reviewing a home's floor plan.

Given the floor plan image, identify 3-5 specific renovation or layout opportunities that would meaningfully increase the home's value. Be specific to what you see — name the rooms involved, propose a concrete change.

Cost and value-lift ranges should reflect a US mid-market home (assume 2024-2026 prices). Express in WHOLE DOLLARS.

For each opportunity:
- "title" — short imperative phrase (under 10 words)
- "rationale" — 1-2 sentences naming the specific rooms/walls and why this adds value
- "complexity" — "easy" (cosmetic, no permits), "medium" (some structural or wet work, may need permits), "hard" (load-bearing, additions, full permitting)
- "estCostLowCents" / "estCostHighCents" — cost range in CENTS
- "estValueLiftLowCents" / "estValueLiftHighCents" — projected home-value increase in CENTS
- "permitRequired" — boolean

Return ONLY this JSON, no surrounding text or markdown:
{
  "bedroomCount": <number>,
  "bathroomCount": <number>,
  "recommendations": [
    { "title": "...", "rationale": "...", "complexity": "easy"|"medium"|"hard",
      "estCostLowCents": 0, "estCostHighCents": 0,
      "estValueLiftLowCents": 0, "estValueLiftHighCents": 0,
      "permitRequired": true|false }
  ]
}

Only suggest changes that:
1. The floor plan visibly supports (don't invent rooms that aren't there)
2. Have a positive ROI (value lift > cost) at the high estimate
3. Are realistic for the home type shown`;

async function fetchAsBase64(imageUrl: string) {
  const res = await fetch(imageUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`fetch ${imageUrl} failed: ${res.status}`);
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  const mediaType = (
    ct.startsWith("image/png")
      ? "image/png"
      : ct.startsWith("image/webp")
        ? "image/webp"
        : ct.startsWith("image/gif")
          ? "image/gif"
          : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType };
}

export async function analyzeFloorPlan(imageUrl: string): Promise<FloorPlanAnalysis | null> {
  if (!client) return null;
  let img: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
  try {
    img = await fetchAsBase64(imageUrl);
  } catch {
    return null;
  }
  const resp = await client.messages.create({
    model,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as FloorPlanAnalysis;
    if (!Array.isArray(parsed.recommendations)) return null;
    // Defensive: clamp recommendation count + filter out invalid entries
    parsed.recommendations = parsed.recommendations
      .filter(
        (r) =>
          typeof r.title === "string" &&
          typeof r.rationale === "string" &&
          typeof r.estCostLowCents === "number" &&
          typeof r.estValueLiftHighCents === "number",
      )
      .slice(0, 5);
    return parsed;
  } catch {
    return null;
  }
}
