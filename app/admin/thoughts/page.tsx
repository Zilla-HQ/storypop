import { db, agentThoughts } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { spectacleEnabled, loadPersona } from "@/lib/spectacle";

/**
 * Operator curation page for the spectacle agent_thoughts queue.
 *
 * Workflow:
 *   1. Every build-pipeline run optionally emits a row into
 *      `agent_thoughts` (isPublic=false). These are Claude's
 *      narratable thoughts from the run.
 *   2. Auto-flagged thoughts (heuristic match on trigger words like
 *      "broke", "surprised", "first time", etc.) get
 *      flaggedForReview=true and float to the top of the queue.
 *   3. Operator skims, picks the best 1–3, hits "Publish". Selected
 *      rows get isPublic=true + publishedAt=now and start showing on
 *      /live as the agent's status line.
 *   4. (Optional) The diary auto-tweet cron can also surface from
 *      published thoughts if you wire it up.
 *
 * Guarded by Clerk admin middleware (assumes /admin/* is already
 * protected). For extra safety in non-Clerk merchants, gate via a
 * shared header secret — example shown commented out below.
 */
export const dynamic = "force-dynamic";

async function publishAction(formData: FormData): Promise<void> {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(agentThoughts)
    .set({ isPublic: true, publishedAt: new Date() })
    .where(eq(agentThoughts.id, id));
  revalidatePath("/admin/thoughts");
  revalidatePath("/live");
}

async function unpublishAction(formData: FormData): Promise<void> {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(agentThoughts)
    .set({ isPublic: false, publishedAt: null })
    .where(eq(agentThoughts.id, id));
  revalidatePath("/admin/thoughts");
  revalidatePath("/live");
}

async function deleteAction(formData: FormData): Promise<void> {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(agentThoughts).where(eq(agentThoughts.id, id));
  revalidatePath("/admin/thoughts");
}

export default async function AdminThoughtsPage() {
  if (!spectacleEnabled()) {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 560, margin: "auto" }}>
        <h1>Spectacle disabled</h1>
        <p>Set <code>SPECTACLE_ENABLED=true</code> to use this page.</p>
      </main>
    );
  }
  const persona = loadPersona();
  // Order: flagged-for-review first, then by recency.
  const rows = await db
    .select()
    .from(agentThoughts)
    .orderBy(
      desc(agentThoughts.flaggedForReview),
      desc(agentThoughts.createdAt),
    )
    .limit(200);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${agentThoughts.isPublic})::int`,
      flagged: sql<number>`count(*) filter (where ${agentThoughts.flaggedForReview})::int`,
    })
    .from(agentThoughts);

  return (
    <main style={{ padding: 48, fontFamily: "system-ui", maxWidth: 880, margin: "auto", lineHeight: 1.6 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
        Curation queue
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 8px 0" }}>
        {persona.name}&apos;s thoughts
      </h1>
      <p style={{ color: "#64748b", margin: 0 }}>
        {counts?.total ?? 0} total · {counts?.flagged ?? 0} flagged · {counts?.published ?? 0} live on{" "}
        <a href="/live" style={{ color: "#0f766e" }}>/live</a>
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #1e293b" }}>
            <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b" }}>
              State
            </th>
            <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b" }}>
              Content
            </th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", width: 220 }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0", verticalAlign: "top" }}>
              <td style={{ padding: "12px 8px", fontSize: 13 }}>
                {r.isPublic ? <span style={{ color: "#047857" }}>● live</span> : <span style={{ color: "#94a3b8" }}>○ draft</span>}
                {r.flaggedForReview && <span style={{ marginLeft: 6, color: "#ca8a04" }}>🟡</span>}
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                  {new Date(r.createdAt).toISOString().slice(0, 10)}
                </div>
              </td>
              <td style={{ padding: "12px 8px", fontSize: 14, whiteSpace: "pre-wrap" }}>
                {r.content}
                {r.source && (
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>
                    source: {r.source}
                  </div>
                )}
              </td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}>
                {r.isPublic ? (
                  <form action={unpublishAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" style={btn}>Unpublish</button>
                  </form>
                ) : (
                  <form action={publishAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" style={primaryBtn}>Publish</button>
                  </form>
                )}{" "}
                <form action={deleteAction} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" style={dangerBtn}>Delete</button>
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: "32px 8px", color: "#64748b", textAlign: "center" }}>
                <em>No thoughts yet. Run a build to populate the queue.</em>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

const btn: React.CSSProperties = {
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  ...btn,
  background: "#0f172a",
  color: "#fff",
  border: "1px solid #0f172a",
};
const dangerBtn: React.CSSProperties = {
  ...btn,
  color: "#dc2626",
};
