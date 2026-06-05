/**
 * What a click *means* (interaction spec §1) — pure, headless-testable. A gateway
 * real object (only the home Milky Way + Sol carry `gateway`) dives into its child
 * tier *iff that tier is built*; everything else (incl. Sol in v1, where the
 * Solar-System tier is deferred #127) opens a card. The wiring (Task 4) maps a
 * `dive` to `nav.diveTo` and a `card` to `openCard`.
 */
import { descendTier, V1_AVAILABLE_TIERS } from "#/lib/galaxy/tier-nav";
import type { MemoryStar, RealObject, Tier } from "#/lib/galaxy/types";

/** A click lands on a real object (lore) or a memory star (memory). */
export type ClickTarget = RealObject | MemoryStar;

export type ClickOutcome =
  | { kind: "dive"; id: string; tier: Tier }
  | { kind: "card"; target: ClickTarget };

/** Structural discriminant — only a `RealObject` carries `loreKey` (mirrors card-model). */
const isRealObject = (t: ClickTarget): t is RealObject =>
  typeof (t as RealObject).loreKey === "string";

export const resolveClick = (
  target: ClickTarget,
  available: readonly Tier[] = V1_AVAILABLE_TIERS,
): ClickOutcome => {
  if (isRealObject(target) && target.gateway === true) {
    const child = descendTier(target.tier, available);
    if (child !== null) return { kind: "dive", id: target.id, tier: child };
  }
  return { kind: "card", target };
};
