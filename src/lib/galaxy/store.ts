/**
 * The transport-agnostic store seam (ADR-0002 §1). In-memory now; a KV / Durable
 * Object impl can replace `createInMemoryStore` without touching callers
 * (ADR-0003+). Writes are **append-only**, which is what guarantees the renderer's
 * invariant: adding a star never moves an existing one.
 *
 * Construction is SSR-safe — no module-scope random or clock; the seed comes from
 * `buildSeedSky()` (deterministic) and `createdAt` is supplied by the caller.
 */

import {
  buildLocalGroup,
  starsForView as filterStarsForView,
  HOME_GALAXY_ID,
  homeGalaxyOf,
  withHomePlacement,
} from "#/lib/galaxy/scenegraph";
import { buildSeedSky } from "#/lib/galaxy/seed";
import type {
  GalaxyNode,
  GalaxySky,
  GalaxyStore,
  MemoryStar,
  Tier,
  Universe,
} from "#/lib/galaxy/types";

export const createInMemoryStore = (initial?: GalaxySky): GalaxyStore => {
  // Own a deep copy so a caller-supplied `initial` is never mutated under them
  // (and they can't reach in and edit our state after construction either).
  const sky: GalaxySky = initial
    ? {
        backdrop: { ...initial.backdrop },
        stars: initial.stars.map((s) => ({ ...s })),
      }
    : buildSeedSky(); // fresh allocation — nothing to copy

  // The home backdrop's seed roots the whole derived scene graph — one source of
  // truth (DEFAULT_BACKDROP.seed via buildSeedSky), not a re-declared constant.
  const universeSeed = sky.backdrop.seed;

  const subscribers = new Set<(sky: GalaxySky) => void>();

  // Deep snapshot each read so callers can't mutate stored state by reference.
  // A single spread is a full copy because `MemoryStar`/`GalaxyBackdrop` are flat
  // structs (no nested object fields), so `getSky().backdrop.seed = …` or editing a
  // returned star no longer leaks back into the store.
  const snapshot = (): GalaxySky => ({
    backdrop: { ...sky.backdrop },
    stars: sky.stars.map((s) => ({ ...s })),
  });

  // The full derived scene graph with live home stars merged in (ADR-0008 §5).
  // Closure-local so `getUniverse`/`homeNode` share one source of truth without a
  // `this` binding (a destructured `store.homeNode` would otherwise lose `this`).
  const buildUniverse = (): Universe => {
    const localGroup = buildLocalGroup(universeSeed);
    const liveHomeStars = snapshot().stars.map(withHomePlacement);
    return {
      seed: universeSeed,
      localGroup: {
        ...localGroup,
        galaxies: localGroup.galaxies.map((g) =>
          g.id === HOME_GALAXY_ID ? { ...g, stars: liveHomeStars } : g,
        ),
      },
    };
  };

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

    // ── universe-aware reads (ADR-0008 §5) — extend, never replace, getSky() ────
    // Scenery is *derived* on demand (memoized in scenegraph.ts); only the live
    // Memory Stars come from this store. The home galaxy's stars are the live sky.
    getUniverse(): Universe {
      return buildUniverse();
    },

    // The Local Group's focused/home tier-2 node (ADR-0008 §3, #126 AC2) — the
    // curated galaxy you land on entering the group. Resolved from the same live
    // universe read so its stars carry home placement and reflect appends (one
    // source of truth for the live-stars merge — no second projection to drift).
    homeNode(): GalaxyNode {
      return homeGalaxyOf(buildUniverse().localGroup);
    },

    skyFor(nodeId: string): GalaxySky {
      const galaxy = buildLocalGroup(universeSeed).galaxies.find(
        (g) => g.id === nodeId,
      );
      // The home galaxy projects to the live flat sky (the back-compat contract).
      if (nodeId === HOME_GALAXY_ID || !galaxy) return snapshot();
      return {
        backdrop: { ...galaxy.backdrop },
        stars: filterStarsForView(snapshot().stars, "galaxy", nodeId),
      };
    },

    starsForView(tier: Tier, parentId?: string): MemoryStar[] {
      return filterStarsForView(snapshot().stars, tier, parentId);
    },
  };
};
