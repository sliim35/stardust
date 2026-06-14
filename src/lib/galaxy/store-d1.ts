/**
 * The D1-backed `GalaxyStore` factory (ADR-0012 §4). Pure + synchronous: the
 * async D1 read is the route loader's job — this builds the store from the
 * already-fetched + mapped `MemoryStar[]` snapshot, exactly mirroring how
 * `createInMemoryStore(initial?)` accepts an optional seeded `GalaxySky`.
 *
 * Seeded fixtures (`buildSeedSky()`) are NEVER written to D1 — they are merged in
 * here, at store construction, with the persisted user stars onto one flat sky.
 * The in-memory engine is reused verbatim, so the renderer/camera/constellation/
 * tier-nav code stays untouched and the `GalaxyStore` seam is unchanged.
 *
 * No binding access, no fetch, no module-scope clock/random here (SSR-safe,
 * ADR-0003) — call this from the loader AFTER the rows are fetched + mapped.
 */

import { buildSeedSky } from "#/lib/galaxy/seed";
import { createInMemoryStore } from "#/lib/galaxy/store";
import type { GalaxySky, GalaxyStore, MemoryStar } from "#/lib/galaxy/types";

export const createD1Store = (userStars: MemoryStar[]): GalaxyStore => {
  const seededSky = buildSeedSky(); // seeded fixtures, never stored in D1
  const mergedSky: GalaxySky = {
    backdrop: seededSky.backdrop,
    stars: [...seededSky.stars, ...userStars], // seeded + user, one flat list
  };
  return createInMemoryStore(mergedSky); // reuse the in-memory engine
};
