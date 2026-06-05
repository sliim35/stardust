/**
 * The one place a galaxy click is turned into an effect (interaction spec §1):
 * resolve it (`resolveClick`), then either dive (gateway → `nav.diveTo`) or open a
 * card (`openCard`, from the `<CardHost>` context). Memory stars wire it now (Task
 * 4); the real-object layer (slice I / #112) adopts the same hook when it lands — no
 * new branching. MUST be used inside a `<CardHost>` (it reads the card context).
 */
import { useCallback } from "react";
import { type ClickTarget, resolveClick } from "#/lib/galaxy/click-router";
import type { Tier } from "#/lib/galaxy/types";
import { useCardContext } from "./CardHost";

export const useObjectClick = (diveTo: (id: string, tier: Tier) => void) => {
  const { openCard } = useCardContext();
  return useCallback(
    (target: ClickTarget) => {
      const outcome = resolveClick(target);
      if (outcome.kind === "dive") diveTo(outcome.id, outcome.tier);
      else openCard(outcome.target);
    },
    [openCard, diveTo],
  );
};
