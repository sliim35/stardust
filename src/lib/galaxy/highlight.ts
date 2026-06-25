/**
 * The highlight-star request channel (ADR-0018 §3 — deep-link contextual zoom +
 * temporary highlight). Mirrors the `FocusController` pattern from `focus.ts`:
 * a small pure request channel threaded from `GalaxyStage` into the star layers
 * so WHICH star is highlighted and WHETHER it is highlighted is headless-decidable.
 *
 * The **clear timer** is component-side (like the existing ignite timers in
 * `GalaxyStage`) — the CSS animation plays the visual cue; this seam carries
 * only the on/off state. SSR-safe: no module-scope state.
 */

/**
 * A highlight request: set a specific star as highlighted (`highlight`), or
 * clear the current highlight (`clear`). The kind mirrors `FocusRequest`'s
 * discriminated union pattern.
 */
export type HighlightRequest =
  | { kind: "highlight"; id: string }
  | { kind: "clear" };

/**
 * The highlight request channel: the component owning the clear-timer calls
 * `highlight(id)` on arrival and `clear()` after the timer fires. Star layers
 * subscribe and set `data-highlighted` on the matching `MemoryStarView`.
 */
export type HighlightController = {
  /** Mark a star as highlighted by id (used on deep-link arrival). */
  highlight(id: string): void;
  /** Remove the current highlight (called by the component's clear timer). */
  clear(): void;
  /** Subscribe to requests; returns an unsubscribe fn. */
  subscribe(fn: (req: HighlightRequest) => void): () => void;
};

export const createHighlightController = (): HighlightController => {
  const subscribers = new Set<(req: HighlightRequest) => void>();
  const emit = (req: HighlightRequest): void => {
    for (const fn of subscribers) fn(req);
  };
  return {
    highlight: (id) => emit({ kind: "highlight", id }),
    clear: () => emit({ kind: "clear" }),
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
};
