import { db, agentCosts } from "@/db";
import { and, eq, sql } from "drizzle-orm";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increment the daily spend counter for an agent. Idempotent at the row level
 * (upsert), but the *increment* is not idempotent — call this only once per
 * actual spend event (inside a step.run so Inngest de-duplicates for you).
 */
export async function trackAgentCost(agent: string, costCents: number): Promise<void> {
  const date = today();
  await db
    .insert(agentCosts)
    .values({ date, agent, costCents })
    .onConflictDoNothing();

  await db
    .update(agentCosts)
    .set({ costCents: sql`${agentCosts.costCents} + ${costCents}` })
    .where(and(eq(agentCosts.date, date), eq(agentCosts.agent, agent)));
}

export async function getTodaySpendCents(agent: string): Promise<number> {
  const [row] = await db
    .select()
    .from(agentCosts)
    .where(and(eq(agentCosts.date, today()), eq(agentCosts.agent, agent)))
    .limit(1);
  return row?.costCents ?? 0;
}
