/**
 * The card system's pure core (interaction spec §4, ADR-0010 §1) — the headless
 * half of the `Card` component, so every rule is unit-testable in node.
 *
 * **One component, two skins.** Clicking an object opens a soft-glass panel in
 * place; *which* skin it wears is decided here, purely from the target's shape:
 *  - a **`RealObject`** (Layer A — the real setting) → a **lore** card (ASTRO's
 *    "FIELD LOG": name · real distance · the `loreKey` lore line);
 *  - a **`MemoryStar`** (Layer B — a memory entity) → a **memory** card (the full
 *    memory text + its mood eyebrow in the mood colour).
 *
 * The view-model carries **i18n keys** (`loreKey`) and the agent-owned data
 * (`text` / `mood` / `color` / `who`) — never resolved copy. The component
 * resolves the catalog via `getMessages(useLocale())`, keeping this module pure,
 * SSR-safe, and locale-agnostic (no React, no router, no I/O).
 */

import type { LoreKey, MemoryStar, Mood, RealObject } from "#/lib/galaxy/types";

/** What `openCard(target)` accepts — a real object (lore) or a memory star (memory). */
export type CardTarget = RealObject | MemoryStar;

/**
 * A real object is the lore target. The discriminant is structural — a `RealObject`
 * carries a `loreKey`; a `MemoryStar` carries a `mood` + `text`. We test `loreKey`
 * (present only on Layer A) so the resolution never depends on identity/lookup.
 */
const isRealObject = (t: CardTarget): t is RealObject =>
  typeof (t as RealObject).loreKey === "string";

/** The lore skin's view-model — name + real distance + the i18n lore line key. */
export type LoreCardModel = {
  skin: "lore";
  id: string;
  loreKey: LoreKey;
  realDistance: RealObject["realDistance"];
  /** The cool/decorative real colour (gold only for Sol) — for the panel accent. */
  color: string;
};

/** The memory skin's view-model — the full memory text + mood + attribution. */
export type MemoryCardModel = {
  skin: "memory";
  id: string;
  text: string;
  mood: Mood;
  /** Hover/panel title (optional — the egg/anon stars may omit it). */
  name?: string;
  /** Opt-in attribution; `null`/absent = anonymous. */
  who?: string | null;
  /** The agent-owned mood colour — drives the eyebrow tint (never recoloured). */
  color: string;
};

/** The discriminated card view-model — one of the two skins. */
export type CardModel = LoreCardModel | MemoryCardModel;

/**
 * Resolve a click target into its card view-model (the spec §4 "lore vs memory"
 * decision). Pure: `RealObject` → lore, `MemoryStar` → memory.
 */
export const resolveCardTarget = (target: CardTarget): CardModel =>
  isRealObject(target)
    ? {
        skin: "lore",
        id: target.id,
        loreKey: target.loreKey,
        realDistance: target.realDistance,
        color: target.color,
      }
    : {
        skin: "memory",
        id: target.id,
        text: target.text,
        mood: target.mood,
        name: target.name,
        who: target.who,
        color: target.color,
      };

// ── the open/close state machine (one card at a time) ──────────────────────────

/** The card host's state — at most one open target (spec §4 "one at a time"). */
export type CardState = { target: CardTarget | null };

/** Open a target (replacing any current one) or close the open card. */
export type CardAction =
  | { type: "open"; target: CardTarget }
  | { type: "close" };

/** The closed initial state — no card showing. */
export const initialCardState: CardState = { target: null };

/**
 * Pure reducer. `open` always replaces the current target (so a second open
 * dismisses the first — one card at a time); `close` clears it (idempotent when
 * already closed). Never mutates the input.
 */
export const cardReducer = (
  state: CardState,
  action: CardAction,
): CardState => {
  switch (action.type) {
    case "open":
      return { target: action.target };
    case "close":
      return state.target === null ? state : { target: null };
  }
};
