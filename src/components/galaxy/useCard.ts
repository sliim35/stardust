import { useCallback, useMemo, useReducer } from "react";
import {
  type CardModel,
  type CardTarget,
  cardReducer,
  initialCardState,
  resolveCardTarget,
} from "./card-model";

/**
 * The card open/close state hook (interaction spec §4). Exposes the **`openCard`
 * API** the rest of the galaxy calls — `openCard(target)` where `target` is a
 * `RealObject` (→ lore) or a `MemoryStar` (→ memory). One card at a time: opening a
 * second target replaces the first (the pure `cardReducer` guarantees it).
 *
 * Returns the resolved `model` (the discriminated lore|memory view-model the `Card`
 * renders) plus the raw `target` — kept so a later slice can reuse it for the
 * click-dive `focusOn` / deep-link without re-deriving. **Not wired to GalaxyStage
 * clicks here** — that wiring (tier-nav, slice E) is a later story; this hook +
 * `CardHost` provide the state and the rendered card, driven via `openCard`.
 */
export const useCard = () => {
  const [state, dispatch] = useReducer(cardReducer, initialCardState);

  const openCard = useCallback(
    (target: CardTarget) => dispatch({ type: "open", target }),
    [],
  );
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const model = useMemo<CardModel | null>(
    () => (state.target ? resolveCardTarget(state.target) : null),
    [state.target],
  );

  return { target: state.target, model, openCard, close };
};
