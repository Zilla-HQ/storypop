import { inngest } from "@/inngest/client";

async function main() {
  const r = await inngest.send({
    name: "listings/qualified",
    data: { listingId: "25d2467f-6ea5-4674-96e4-7e713a07aa84" },
  });
  console.log("Sent:", JSON.stringify(r, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
export {};
