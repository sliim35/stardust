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
 * Two-arg adapter for React's `useReducer`. The pure reducer carries an optional
 * 3rd `available` param (parameterised for #127 + the headless tests), which trips
 * React 19's `AnyActionArg` reducer signature — so the hook supplies it here.
 *
 * BR22 (#197): the `available` set is derived from the FOCUSED galaxy
 * (`availableTiersFor(state.galaxyId ?? "home")`) on every dispatch, so the
 * asymmetric per-galaxy ladder (only the home Milky Way owns the third
 * Solar-System tier) drives `descend`/`ascend`/`diveTo` — not the global v1
 * default. `galaxyId` is `null` at the LG overview, where the fallback to
 * `"home"` keeps the wheel-driven dive INTO the Milky Way following the home
 * ladder.
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
