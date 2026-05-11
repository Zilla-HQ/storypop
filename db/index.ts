import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // eslint-disable-next-line no-console
  console.warn("DATABASE_URL is not set — database calls will fail at runtime.");
}

// Supabase recommends the Supavisor *transaction* pooler (port 6543) for
// serverless. Transaction mode is incompatible with prepared statements, so we
// disable them globally. Use the session-mode pooler (5432) if you need them.
const client = postgres(
  connectionString ?? "postgresql://user:pass@localhost:5432/postgres",
  {
    prepare: false,
    max: 1, // serverless: one connection per invocation
    idle_timeout: 20,
    connect_timeout: 10,
  },
);

export const db = drizzle(client, { schema });

export * from "./schema";
