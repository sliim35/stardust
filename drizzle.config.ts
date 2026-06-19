import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit — SQL migration GENERATION ONLY (ADR-0012 §5). No `driver`, no
 * `dbCredentials`: wrangler stays the single migration authority (the `d1-http`
 * driver is deliberately NOT used — it would need a Cloudflare API token +
 * account/database ids and bypass wrangler).
 *
 * Workflow:
 *   pnpm drizzle-kit generate                          # diff schema → numbered SQL
 *   wrangler d1 migrations apply STARS_DB --remote      # apply to remote D1
 *   wrangler d1 migrations apply STARS_DB --local       # …or a local D1
 *
 * `out` matches `migrations_dir` in wrangler.jsonc so wrangler finds what Drizzle
 * writes.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/galaxy/schema.ts",
  out: "./drizzle/migrations",
});
