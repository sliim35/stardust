/**
 * The one place a galaxy click is turned into an effect (interaction spec §1):
 * resolve it (`resolveClick`), then either dive (gateway → `nav.diveTo`) or open a
 * card (`openCard`, from the `<CardHost>` context). Memory stars wire it now (Task
 * 4); the real-object layer (slice I / #112) adopts the same hook when it lands — no
 * new branching. MUST be used inside a `<CardHost>` (it reads the card context).
 *
 * `available` is the focused galaxy's built tier set (ADR-0016 §4, #248): the
 * Milky-Way tier passes `availableTiersFor('home')` (which includes `solarSystem`),
 * so a Sol click resolves to a DIVE into the Solar System; without it (the default
 * `V1_AVAILABLE_TIERS`) Sol's child tier is unbuilt and the click opens a lore card.
 */
import { useCallback } from "react";
import { type ClickTarget, resolveClick } from "#/lib/galaxy/click-router";
import { V1_AVAILABLE_TIERS } from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";
import { useCardContext } from "./CardHost";

export const useObjectClick = (
  diveTo: (id: string, tier: Tier) => void,
  available: readonly Tier[] = V1_AVAILABLE_TIERS,
) => {
  const { openCard } = useCardContext();
  return useCallback(
    (target: ClickTarget) => {
      const outcome = resolveClick(target, available);
      if (outcome.kind === "dive") diveTo(outcome.id, outcome.tier);
      else openCard(outcome.target);
    },
    [openCard, diveTo, available],
  );
};
