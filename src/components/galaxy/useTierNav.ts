/**
 * React adapter over the pure `tierNavReducer` (interaction spec §1). Owns the
 * wheel debounce so one scroll *gesture* = one tier step (a continuous wheel would
 * otherwise blow through every tier). `now` is injectable for deterministic tests.
 * Slice F (#125) will additionally lock the wheel while a transition is in flight.
 */
import { useCallback, useReducer, useRef } from "react";
import {
  availableTiersFor,
  initialTierNav,
  type TierNavAction,
  type TierNavState,
  tierNavReducer,
} from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";

/** Min ms between wheel-driven tier steps. */
export const WHEEL_COOLDOWN_MS = 500;

/**
 * Two-arg adapter for React's `useReducer` (the reducer's 3rd `available` param
 * trips React 19's `AnyActionArg` signature, so the hook supplies it).
 * `available` is per-galaxy asymmetric: home gets the Sol tier, neighbours stop
 * at galaxy. `null → "home"` fallback at the LG overview keeps the wheel dive INTO
 * the Milky Way on the home ladder.
 */
const reduce = (state: TierNavState, action: TierNavAction): TierNavState =>
  tierNavReducer(state, action, availableTiersFor(state.galaxyId ?? "home"));

export const useTierNav = (now: () => number = () => performance.now()) => {
  const [state, dispatch] = useReducer(reduce, initialTierNav);
  const lastStep = useRef(Number.NEGATIVE_INFINITY);

  const descend = useCallback(() => dispatch({ type: "descend" }), []);
  const ascend = useCallback(() => dispatch({ type: "ascend" }), []);
  const diveTo = useCallback(
    (id: string, tier: Tier) => dispatch({ type: "diveTo", id, tier }),
    [],
  );

  const onWheel = useCallback(
    (e: { deltaY: number }) => {
      if (e.deltaY === 0) return;
      const t = now();
      if (t - lastStep.current < WHEEL_COOLDOWN_MS) return;
      lastStep.current = t;
      // Scroll up (deltaY < 0) descends (zoom in); scroll down ascends (zoom out).
      dispatch(e.deltaY < 0 ? { type: "descend" } : { type: "ascend" });
    },
    [now],
  );

  return { state, descend, ascend, diveTo, onWheel };
};
