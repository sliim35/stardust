/**
 * The SSR read path (ADR-0012 §4) — fetch all persisted user Memory Stars from
 * D1, ordered by `created_at`, and map them to `MemoryStar[]` for the route
 * loader. Returned as serialized loader data so the user stars are in the initial
 * HTML (no client-visible loading flash; the first paint already has them).
 *
 * SSR-safe (ADR-0003): the Drizzle connection is constructed per-request INSIDE
 * the handler from `env.STARS_DB` — never at module scope. The pure row→star
 * mapper (`rowToMemoryStar`) is unit-tested without a binding.
 *
 * If the binding is unavailable (local dev without a bound D1, a transient
 * error), the loader degrades to an empty user list — the seed sky still renders
 * (the in-memory engine merges seeded + user in `createD1Store`).
 */

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { memoryStars } from "#/lib/galaxy/schema";
import { rowToMemoryStar } from "#/lib/galaxy/star-mapper";
import type { MemoryStar } from "#/lib/galaxy/types";

export const loadUserStarsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MemoryStar[]> => {
    try {
      const { drizzle } = await import("drizzle-orm/d1");
      const db = drizzle(env.STARS_DB);
      const rows = await db
        .select()
        .from(memoryStars)
        .orderBy(memoryStars.createdAt);
      return rows.map(rowToMemoryStar);
    } catch {
      // No bound D1 (dev) or a transient read error → render the seed sky only.
      return [];
    }
  },
);
