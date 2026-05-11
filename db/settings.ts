import { db, adminSettings, type AdminSettings, type StylePreset } from "@/db";

const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  {
    id: "modern",
    label: "Modern",
    description: "Clean lines, neutral palette, contemporary furniture.",
    promptFragment:
      "modern contemporary interior, clean lines, neutral palette, natural light, minimalist furniture",
  },
  {
    id: "farmhouse",
    label: "Farmhouse",
    description: "Warm woods, shiplap, cozy textiles.",
    promptFragment:
      "modern farmhouse interior, warm wood tones, shiplap accents, cozy textiles, natural light",
  },
  {
    id: "midcentury",
    label: "Mid-Century",
    description: "Walnut, teak, atomic-era silhouettes.",
    promptFragment:
      "mid-century modern interior, walnut and teak furniture, atomic-era silhouettes, warm palette",
  },
  {
    id: "coastal",
    label: "Coastal",
    description: "Light, airy, whites and blues.",
    promptFragment:
      "coastal interior, light airy whites and blues, driftwood accents, natural linen, ocean light",
  },
];

/**
 * Fetch the single-row admin settings, lazily initializing it on first call.
 * Idempotent and safe to call from any Inngest step.
 */
export async function getSettings(): Promise<AdminSettings> {
  const rows = await db.select().from(adminSettings).limit(1);
  if (rows.length > 0) return rows[0];

  const [inserted] = await db
    .insert(adminSettings)
    .values({
      id: 1,
      stylePresets: DEFAULT_STYLE_PRESETS,
      senderDomains: (process.env.SENDER_DOMAINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;
  const again = await db.select().from(adminSettings).limit(1);
  return again[0];
}

export { DEFAULT_STYLE_PRESETS };
