import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const apiKey = env("ANTHROPIC_API_KEY");
const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")!;

const client = apiKey ? new Anthropic({ apiKey }) : null;

export async function callClaude(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn("[claude] stub — ANTHROPIC_API_KEY missing");
    return "";
  }

  const resp = await client.messages.create({
    model,
    max_tokens: args.maxTokens ?? 1024,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const block = resp.content[0];
  return block && block.type === "text" ? block.text : "";
}

export interface DraftedStory {
  title: string;
  dedication: string;
  pages: { sceneDescription: string; body: string }[];
}

/**
 * Draft a personalized children's story. Returns structured JSON with a
 * title, dedication, and 12–16 pages. Each page has a body (1–3 sentences,
 * age-appropriate) and a `sceneDescription` the illustrator agent uses
 * to render the page image.
 *
 * Caller must pass the output through `storySafetyGate` before image-gen.
 */
export async function draftStory(args: {
  childName: string;
  childAge: number;
  pronouns: string;
  archetype: string;
}): Promise<DraftedStory> {
  const ageBand =
    args.childAge <= 4 ? "2-4 (very simple, rhyming, repetition)"
    : args.childAge <= 7 ? "5-7 (short sentences, vivid scenes)"
    : "8-10 (richer vocabulary, light arcs)";
  const pageCount = args.archetype === "bedtime" ? 14 : 16;

  const system = `You are a children's book author. Draft a ${pageCount}-page story for the given inputs.
Every page is 1-3 sentences and ends with a beat that gives the illustrator a clear scene.
Respect age-band reading level: ${ageBand}.
Output STRICT JSON: { "title": string, "dedication": string, "pages": [{ "sceneDescription": string, "body": string }] }.
No commentary, no markdown, just JSON.
HARD RULES:
- No violence beyond mild peril. No romance/sexuality. No real-world political figures.
- No branded characters (Disney, Marvel, Pokémon, Bluey, Paw Patrol, Sesame Street, etc).
- No weapons, no substance use, no scary monsters with realistic features.
- Bedtime archetype ends with the protagonist asleep.`;

  const user = `Inputs:
- Name: ${args.childName}
- Age: ${args.childAge}
- Pronouns: ${args.pronouns}
- Archetype: ${args.archetype}`;

  const raw = await callClaude({ system, user, maxTokens: 2500 });
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as DraftedStory;
}
