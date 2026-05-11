import { db, previews } from "@/db";
import { desc, isNotNull } from "drizzle-orm";

async function main() {
  const r = await db.select().from(previews).where(isNotNull(previews.enhancedPhotoUrls)).orderBy(desc(previews.createdAt)).limit(8);
  for (const p of r) {
    const orig = (p.originalPhotoUrls as string[])?.[0];
    const enh = (p.enhancedPhotoUrls as string[])?.[0];
    console.log(p.id, p.listingId);
    console.log("  ORIG:", orig);
    console.log("  ENH: ", enh);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
