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

export const createInMemoryStore = (initial?: GalaxySky): GalaxyStore => {
  // Own a deep copy so a caller-supplied `initial` is never mutated under them
  // (and they can't reach in and edit our state after construction either).
  const sky: GalaxySky = initial
    ? {
        backdrop: { ...initial.backdrop },
        stars: initial.stars.map((s) => ({ ...s })),
      }
    : buildSeedSky(); // fresh allocation — nothing to copy

  const subscribers = new Set<(sky: GalaxySky) => void>();

  // Deep snapshot each read so callers can't mutate stored state by reference.
  // A single spread is a full copy because `MemoryStar`/`GalaxyBackdrop` are flat
  // structs (no nested object fields), so `getSky().backdrop.seed = …` or editing a
  // returned star no longer leaks back into the store.
  const snapshot = (): GalaxySky => ({
    backdrop: { ...sky.backdrop },
    stars: sky.stars.map((s) => ({ ...s })),
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
};
