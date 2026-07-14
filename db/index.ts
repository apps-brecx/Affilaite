// db/index.ts — Drizzle client over the standard Postgres wire protocol.
// Works with Neon (pooled connection) in production and any local Postgres in
// development. When DATABASE_URL is absent, `db` is undefined and the data layer
// returns empty results so the UI still renders.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(connectionString);

const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };

const client = connectionString
  ? (globalForDb._pg ??= postgres(connectionString, { max: 5, prepare: false }))
  : undefined;

export const db = client
  ? drizzle(client, { schema })
  : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>);

export { schema };
