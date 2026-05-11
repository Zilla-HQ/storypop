import { db, adminSettings } from "@/db";

async function main() {
  const settings = await db.select().from(adminSettings).limit(1);
  const s = settings[0];
  console.log("ADMIN SETTINGS (single-row config)");
  console.log("  paused:                ", s?.paused);
  console.log("  discoveryPaused:       ", s?.discoveryPaused);
  console.log("  qualificationPaused:   ", s?.qualificationPaused);
  console.log("  previewPaused:         ", s?.previewPaused);
  console.log("  outreachPaused:        ", s?.outreachPaused);
  console.log("  fulfillmentPaused:     ", s?.fulfillmentPaused);
  console.log("  followupPaused:        ", s?.followupPaused);
  console.log("  stylePresets count:    ", s?.stylePresets?.length ?? 0);
  if ((s?.stylePresets?.length ?? 0) === 0) {
    console.log("  ⚠ NO STYLE PRESETS — fulfillment short-circuits at fulfillment.ts:61-63");
  } else {
    console.log("    ids:", s?.stylePresets?.map((p) => p.id).join(", "));
  }
  console.log("  fulfillment budget:    $" + ((s?.fulfillmentDailyBudgetCents ?? 0) / 100).toFixed(2) + "/day");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

export {};
