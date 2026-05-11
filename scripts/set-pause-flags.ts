/**
 * Operator helper — toggle pipeline pause flags in admin_settings.
 *
 *   npx tsx --env-file=.env.local scripts/set-pause-flags.ts pause preview,fulfillment
 *   npx tsx --env-file=.env.local scripts/set-pause-flags.ts unpause all
 *   npx tsx --env-file=.env.local scripts/set-pause-flags.ts status
 */
import { db, adminSettings } from "@/db";
import { eq } from "drizzle-orm";

const ALL_FLAGS = [
  "discoveryPaused",
  "qualificationPaused",
  "previewPaused",
  "outreachPaused",
  "fulfillmentPaused",
  "followupPaused",
] as const;

type Flag = (typeof ALL_FLAGS)[number];

async function main() {
  const [verb, target] = process.argv.slice(2);
  if (!verb || (verb !== "pause" && verb !== "unpause" && verb !== "status")) {
    console.error("Usage: scripts/set-pause-flags.ts {pause|unpause|status} [preview,fulfillment|all]");
    process.exit(1);
  }

  if (verb === "status") {
    const [s] = await db.select().from(adminSettings).limit(1);
    console.log("Pipeline pause flags:");
    for (const f of ALL_FLAGS) console.log(`  ${f.padEnd(22)} ${s?.[f] ? "🔴 PAUSED" : "🟢 active"}`);
    console.log(`  paused (global)        ${s?.paused ? "🔴 PAUSED" : "🟢 active"}`);
    process.exit(0);
  }

  const flags: Flag[] =
    target === "all" || target === undefined
      ? [...ALL_FLAGS]
      : (target.split(",").map((t) => `${t.trim()}Paused` as Flag).filter((f) => ALL_FLAGS.includes(f)));

  if (flags.length === 0) {
    console.error(`No valid flags. Available: ${ALL_FLAGS.map((f) => f.replace("Paused", "")).join(", ")}, all`);
    process.exit(1);
  }

  const value = verb === "pause";
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of flags) update[f] = value;

  await db.update(adminSettings).set(update).where(eq(adminSettings.id, 1));
  console.log(`✓ ${verb}d: ${flags.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
