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
  /** Parent's free-form description ("super silly, loves dinosaurs"). */
  description?: string | null;
  /** Parent's free-form favorites ("Bluey, dragons, Frozen"). Claude maps
   *  trademarked names → generic archetypes per the translation map below. */
  favorites?: string | null;
}): Promise<DraftedStory> {
  const ageBand =
    args.childAge <= 4 ? "2-4 (very simple, rhyming, repetition)"
    : args.childAge <= 7 ? "5-7 (short sentences, vivid scenes)"
    : "8-10 (richer vocabulary, light arcs)";
  const pageCount = args.archetype === "bedtime" ? 14 : 16;

  // Trademark-safe translation map. When the parent's favorites field
  // mentions a specific franchise, render the *vibe* without naming it.
  // Same list maintained on storypop.shop's /create form chips so the
  // story always feels familiar to the kid.
  const translationMap = `TRANSLATION MAP — popular kids' franchises → trademark-safe archetypes:
- Bluey → sunny family backyard, family puppy, imaginative pretend games
- Paw Patrol → kid-sized rescue heroes with friendly puppy companions
- Peppa Pig → silly muddy-puddle family adventures with farm-animal friends (the hero stays a HUMAN child, animals are friends)
- Cocomelon / Baby Shark → bright nursery-rhyme world with simple sing-song adventures and friendly sea creatures
- Mickey Mouse / Sesame Street → enchanted neighborhood with friendly cartoon-creature pals (kid is human, visits them)
- Daniel Tiger / Thomas & Friends → cozy neighborhood / small-town railway adventure with personality-filled engines
- Frozen → snowy mountain palace, magical ice powers, friendly snowman, sibling bond
- Encanto → magical family in a colorful mountain house, each member with a tiny gift
- Moana → tropical island voyage, friendly sea creatures, brave-girl-meets-ocean spirit
- Lion King → sun-baked savanna, kid befriends a brave young lion-cub (kid stays HUMAN)
- Toy Story → bedroom toys come alive, friendly space-ranger toy companion
- Cars → bright town of friendly racing cars and trucks with personality
- Finding Nemo → coral reef adventure, lost-and-found friendly clownfish family
- Inside Out → colorful inner-feelings adventure with small emotion-creature helpers
- How to Train Your Dragon → cliffside viking village + young friendly dragon best friend
- Trolls / Minions → bright musical creature friends / silly yellow helper companions
- Barbie → glamorous pink dream-house adventures, kid as fashion-loving hero
- My Little Pony → magical winged-horse friends in a rainbow valley
- Hello Kitty / Sanrio → pastel cute-character pals
- Pokemon → tall-grass adventure, cute pocket-monster creature companions
- Mario → mushroom kingdom, warp pipes, friendly princess, plumber hero
- Sonic → super-fast running through bright green hills with a speedy blue friend
- Minecraft / Roblox → blocky cube-world building / playful imagination-game world
- Spider-Man / Avengers / Star Wars / Harry Potter → kid-sized superhero web-swinging / team of kid heroes / brave young space-knight + droids / magical castle-school
Animals & themes (dinosaurs, dragons, mermaids, unicorns, princesses, knights, pirates, space, wizards, superheroes, horses, trains, cars and trucks, robots, ninjas, monsters) → use literally.`;

  const system = `You are a children's book author and art director. Draft a ${pageCount}-page story for the given inputs. Both the prose AND the per-page illustration brief matter — the illustration is what sells the book.
Respect age-band reading level: ${ageBand}.
Output STRICT JSON: { "title": string, "dedication": string, "pages": [{ "sceneDescription": string, "body": string }] }.
No commentary, no markdown, just JSON.

ILLUSTRATION COMPOSITION (the conversion-critical part)
Each sceneDescription is a brief for one full-bleed picture-book spread. NEVER describe just the child standing alone — that's a boring landing-page sample and customers don't buy. Every spread MUST include:
  1. A clear ACTION the child is doing (running, leaping, hiding, baking, painting, riding, climbing, casting a spell, hugging, sleeping, peeking, splashing, dancing).
  2. At least ONE companion or interactive scene element BESIDE the child — a friendly animal, magical creature, sibling, parent, pet, glowing object, vehicle, friend. Never just the kid in an empty environment.
  3. A specific camera/composition cue that differs from prior pages. Cycle through: wide establishing shot, low-angle hero shot, close-up emotion, over-the-shoulder POV, action mid-leap, quiet bedtime moment, shared-laugh moment, peeking-around-corner moment.
  4. Concrete, visual sensory detail — colors, textures, weather, time of day, what the child is wearing, what they're holding. NOT abstractions.
  5. Vary the setting page-to-page. A 16-page story has 6-10 distinct scene-environments. NEVER repeat backgrounds 3 pages in a row.

PROSE
Each page body is 1-3 sentences (age-band ${ageBand}) and ends with a beat that hands the illustrator a clear scene. Use the child's name on most pages (not every page — feels forced). Build an arc: ordinary world → call to adventure → meet a friend/companion → small obstacle → child's trait saves the day → warm resolution. Bedtime archetype ends with the protagonist asleep.

HARD RULES
- The hero is ALWAYS a HUMAN CHILD. Never an animal or non-human creature; any animals appear as companions BESIDE the child, never AS the child.
- No violence beyond mild peril. No romance/sexuality. No real-world political figures.
- NEVER name copyrighted characters, places, or songs (Disney, Marvel, Pokémon, Bluey, Paw Patrol, Sesame Street, Frozen's Elsa, etc). Use generic archetypes.
- No weapons, no substance use, no scary monsters with realistic features.

${translationMap}`;

  const personalitySection = args.description?.trim()
    ? `- Personality (parent's own words): ${args.description.trim()}`
    : "";
  const favoritesSection = args.favorites?.trim()
    ? `- What this kid loves (translate the *vibe* without naming trademarks): ${args.favorites.trim()}`
    : "";

  const user = `Inputs:
- Name: ${args.childName}
- Age: ${args.childAge}
- Pronouns: ${args.pronouns}
- Archetype: ${args.archetype}
${personalitySection}
${favoritesSection}`.trim();

  const raw = await callClaude({ system, user, maxTokens: 2500 });
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as DraftedStory;
}
