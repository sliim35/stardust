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

/**
 * The tier the visitor lands on. Owner decision (PR #167, 2026-06-06),
 * deliberately **overriding interaction-spec §1's "the Milky Way is home"**:
 * the page opens on the Local-Group overview and the first gesture is the
 * scroll-up dive INTO the Milky Way (memory stars appear after the dive).
 */
export const HOME_TIER: Tier = "localGroup";

export type TierNavState = { tier: Tier; focusedId: string | null };

export type TierNavAction =
  | { type: "descend" } // scroll up — one tier deeper (zoom in)
  | { type: "ascend" } // scroll down — one tier wider (zoom out)
  | { type: "diveTo"; id: string; tier: Tier }; // gateway click — into a specific object

export const initialTierNav: TierNavState = {
  tier: HOME_TIER,
  focusedId: null,
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
      return next === null ? state : { tier: next, focusedId: null };
    }
    case "ascend": {
      const next = ascendTier(state.tier, available);
      return next === null ? state : { tier: next, focusedId: null };
    }
    case "diveTo":
      return available.includes(action.tier)
        ? { tier: action.tier, focusedId: action.id }
        : state;
  }
};
