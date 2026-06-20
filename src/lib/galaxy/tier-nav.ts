/**
 * The guided-navigation spine (interaction spec §1) — a pure tier-zoom state
 * machine above the camera (ADR-0008 §4). Scroll/click mutate `{ tier, focusedId }`;
 * slice F (#125) eases the camera between framings off this state. Parameterised by
 * the *available* tier set so #127 (Solar-System tier) extends it with no edits —
 * in v1 only `localGroup` + `galaxy` are built (ADR-0010 §4-③).
 *
 * A clamped action returns the SAME state reference, so callers detect a no-op
 * (the soft end-bounce) by identity.
 */
import type { Tier } from "#/lib/galaxy/types";

/** Canonical zoom ladder, widest → deepest (ADR-0008 §4). */
export const TIER_ORDER = [
  "localGroup",
  "galaxy",
  "solarSystem",
] as const satisfies readonly Tier[];

/** Tiers buildable in v1 — Solar System is deferred to #127. */
export const V1_AVAILABLE_TIERS: readonly Tier[] = ["localGroup", "galaxy"];

/** The home Milky Way is the ONLY galaxy with a third (Solar-System) tier (BR22). */
const HOME_AVAILABLE_TIERS: readonly Tier[] = [
  "localGroup",
  "galaxy",
  "solarSystem",
];

/**
 * The per-galaxy *available* tier set (BR22, spike #192). Every Local-Group galaxy is
 * enterable, but only the home Milky Way owns the third (Solar-System) tier — Sol is the
 * one tier-3 gateway. A neighbour stops at its `galaxy` tier. Callers without a focused
 * galaxy keep `V1_AVAILABLE_TIERS` (the 2-tier fallback), so this is additive: pass
 * `availableTiersFor(state.galaxyId ?? "home")` into the reducer / `resolveClick` to get
 * the asymmetry. Any non-`home` id (incl. a typo) defaults to the 2-tier neighbour set.
 */
export const availableTiersFor = (galaxyId: string): readonly Tier[] =>
  galaxyId === "home" ? HOME_AVAILABLE_TIERS : V1_AVAILABLE_TIERS;

/**
 * The tier the visitor lands on. Owner decision (PR #167, 2026-06-06),
 * deliberately **overriding interaction-spec §1's "the Milky Way is home"**:
 * the page opens on the Local-Group overview and the first gesture is the
 * scroll-up dive INTO the Milky Way (memory stars appear after the dive).
 */
export const HOME_TIER: Tier = "localGroup";

/**
 * `galaxyId` (BR22, spike #192) remembers WHICH Local-Group galaxy the visitor is
 * inside, surviving the `focusedId → null` reset that `descend`/`ascend` apply at
 * tier-2+. It is `null` at the `localGroup` overview, set on `diveTo(→galaxy)`, carried
 * through `descend` to `solarSystem` (MW only) and `ascend` from `solarSystem` back to
 * `galaxy`, and cleared on `ascend` back to `localGroup`. Additive + back-compat.
 * `availableTiersFor(galaxyId)` reads it to pick the asymmetric per-galaxy tier set.
 */
export type TierNavState = {
  tier: Tier;
  focusedId: string | null;
  galaxyId: string | null;
};

export type TierNavAction =
  | { type: "descend" } // scroll up — one tier deeper (zoom in)
  | { type: "ascend" } // scroll down — one tier wider (zoom out)
  | { type: "diveTo"; id: string; tier: Tier }; // gateway click — into a specific object

export const initialTierNav: TierNavState = {
  tier: HOME_TIER,
  focusedId: null,
  galaxyId: null,
};

/** The next deeper *available* tier, or null at the floor. */
export const descendTier = (
  tier: Tier,
  available: readonly Tier[] = V1_AVAILABLE_TIERS,
): Tier | null => {
  for (let j = TIER_ORDER.indexOf(tier) + 1; j < TIER_ORDER.length; j++) {
    if (available.includes(TIER_ORDER[j])) return TIER_ORDER[j];
  }
  return null;
};

/** The next wider *available* tier, or null at the ceiling. */
export const ascendTier = (
  tier: Tier,
  available: readonly Tier[] = V1_AVAILABLE_TIERS,
): Tier | null => {
  for (let j = TIER_ORDER.indexOf(tier) - 1; j >= 0; j--) {
    if (available.includes(TIER_ORDER[j])) return TIER_ORDER[j];
  }
  return null;
};

export const tierNavReducer = (
  state: TierNavState,
  action: TierNavAction,
  available: readonly Tier[] = V1_AVAILABLE_TIERS,
): TierNavState => {
  switch (action.type) {
    case "descend": {
      const next = descendTier(state.tier, available);
      // Carry the entered galaxy down to its Solar System (MW only); clamp by identity.
      return next === null
        ? state
        : { tier: next, focusedId: null, galaxyId: state.galaxyId };
    }
    case "ascend": {
      const next = ascendTier(state.tier, available);
      if (next === null) return state;
      // Returning to the Local-Group overview leaves every galaxy → clear the id.
      // Ascending solarSystem → galaxy stays inside the same galaxy → carry it.
      return {
        tier: next,
        focusedId: null,
        galaxyId: next === "localGroup" ? null : state.galaxyId,
      };
    }
    case "diveTo":
      if (!available.includes(action.tier)) return state;
      return {
        tier: action.tier,
        focusedId: action.id,
        // Diving INTO a galaxy records its id; diving deeper (e.g. Sol → solarSystem)
        // keeps the galaxy already entered.
        galaxyId: action.tier === "galaxy" ? action.id : state.galaxyId,
      };
  }
};
