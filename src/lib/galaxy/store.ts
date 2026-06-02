/**
 * The transport-agnostic store seam (ADR-0002 §1). In-memory now; a KV / Durable
 * Object impl can replace `createInMemoryStore` without touching callers
 * (ADR-0003+). Writes are **append-only**, which is what guarantees the renderer's
 * invariant: adding a star never moves an existing one.
 *
 * Construction is SSR-safe — no module-scope random or clock; the seed comes from
 * `buildSeedSky()` (deterministic) and `createdAt` is supplied by the caller.
 */

import { buildSeedSky } from "#/lib/galaxy/seed";
import type { GalaxySky, GalaxyStore, MemoryStar } from "#/lib/galaxy/types";

export function createInMemoryStore(initial?: GalaxySky): GalaxyStore {
  // Own our copy so a caller-supplied `initial` is never mutated under them.
  const sky: GalaxySky = initial
    ? { backdrop: initial.backdrop, stars: [...initial.stars] }
    : buildSeedSky();

  const subscribers = new Set<(sky: GalaxySky) => void>();

  // Fresh array each read so callers can't mutate stored state by reference.
  const snapshot = (): GalaxySky => ({
    backdrop: sky.backdrop,
    stars: [...sky.stars],
  });

  return {
    getSky() {
      return snapshot();
    },

    addStar(star: MemoryStar) {
      sky.stars.push(star); // append-only — existing entries are untouched
      const snap = snapshot();
      for (const fn of subscribers) fn(snap);
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}
