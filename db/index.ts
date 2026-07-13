// db/index.ts — Drizzle client (Neon Postgres)
// Connects lazily; when DATABASE_URL is absent (e.g. local preview) the app
// falls back to rich demo data through lib/queries.ts, so the UI always renders.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(connectionString);

let client: ReturnType<typeof postgres> | undefined;

export const db = (() => {
  if (!connectionString) {
    return undefined as unknown as ReturnType<typeof drizzle<typeof schema>>;
  }
  client =
    client ??
    postgres(connectionString, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
    });
  return drizzle(client, { schema });
})();

export { schema };
