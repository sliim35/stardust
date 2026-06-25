import { type KeyboardEvent, useId, useMemo, useState } from "react";
import {
  type AstroPill,
  type PillContext,
  pillsFor,
  promptNarrationRequest,
} from "#/lib/galaxy/astro-pills";
import { searchStars } from "#/lib/galaxy/star-search";
import type { MemoryStar, Tier } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";
import type { NarrateInput } from "#/server/narrate";

/**
 * AstroHub (#250 + redesign) — ASTRO's single interaction surface. Three peer
 * surfaces in the dock (not one stack):
 *
 * 1. **Pill rail** — a horizontally scrollable row of fast-action buttons with a
 *    right-edge gradient fade affordance so nothing clips. Nav pills drive the
 *    tier-nav spine; prompt pills make ASTRO speak ONE bubble response. The rail is
 *    a PEER of the search surface — NOT nested inside the speech bubble.
 * 2. **Disclosed search** — a slim combobox that is COLLAPSED by default
 *    (`aria-expanded="false"`). Focus/click expands it into the full combobox +
 *    live count + first result. Escape or clear collapses it back. `aria-expanded`
 *    tracks the real disclosure state (not hardcoded `"true"`).
 *    Active only where memory stars live (`showSearch`).
 * 3. **Spoken responses** route through the `AstroBubble` aria-live region via
 *    `onSpeak` (the `showNarration` seam, last-writer-wins through `Astro`) — no
 *    second live region (the #72 invariant).
 *
 * **Composition (redesign 2026-06-25):** the pill rail + search field are peers
 * of the speech bubble — they live OUTSIDE the bubble in the dock. The hub renders
 * the rail + search; Astro.tsx renders the bubble independently. This decouples the
 * three surfaces so the bubble stays speech-only and the rail never clips inside the
 * bubble's max-width.
 *
 * SSR/Workers-safe (ADR-0003): no module-scope clock/random; ids via `useId`; the
 * `narrate` fetch fires only in a click handler (request scope). i18n (#103): all
 * copy from the `search.*` + `astroHub.*` catalog, never inline. Styling (#75):
 * Tailwind utilities reading `@theme` tokens; no hardcoded hex. Pointer-events
 * (#243/#245): interactive elements carry `pointer-events-auto` so they stay
 * clickable under any `pointer-events:none` host.
 */

export type AstroHubProps = {
  /** The live sky's memory stars to index (filtered, never mutated). */
  stars: readonly MemoryStar[];
  /** The live nav slice — drives the tier-aware pill set (`pillsFor`). */
  ctx: PillContext;
  /**
   * Show the search combobox (ADR-0017 §1) — true only where memory stars live
   * (the MW galaxy interior); false at the Local-Group / Solar-System tiers, where
   * the index is meaningless. The tier-aware pill row always shows (it's the spine
   * that gets the visitor back). Default `true`.
   */
  showSearch?: boolean;
  /** Search select sink — wired to `focus.focusStar(id)` (#111), unchanged. */
  onSelect: (id: string) => void;
  /** Nav pill `ascendTo` sink — the breadcrumb's `onTierSelect(tier)` spine (§3). */
  onTierSelect: (tier: Tier) => void;
  /** Nav pill `dive` sink — `nav.diveTo(id, tier)` (the Sol dive path, §3). */
  onDive: (id: string, tier: Tier) => void;
  /** Spoken-response sink — the `showNarration` seam (found/notFound + prompts). */
  onSpeak: (line: string) => void;
  /**
   * The narration server fn (`narrateFn`), injected so the `speakLore` path is
   * unit-testable headless. Returns the cached AI fact, or `null` on any failure —
   * the handler then falls back to the authored `lore[key].line` (§4, AC8).
   */
  narrate: (input: NarrateInput) => Promise<string | null>;
};

export const AstroHub = ({
  stars,
  ctx,
  showSearch = true,
  onSelect,
  onTierSelect,
  onDive,
  onSpeak,
  narrate,
}: AstroHubProps) => {
  const messages = getMessages(useLocale());
  const m = messages.search;
  const hub = messages.astroHub;
  const [query, setQuery] = useState("");
  // The active option's index in `results`, or -1 for "none active" (Enter then
  // falls back to the first result — the common "type and hit Enter" path).
  const [active, setActive] = useState(-1);
  // Search disclosure state — false = collapsed slim affordance; true = expanded
  // combobox + results. `aria-expanded` tracks this (redesign: was hardcoded "true").
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => searchStars(stars, query), [stars, query]);
  const pills = useMemo(() => pillsFor(ctx), [ctx]);

  // Stable ids for the ARIA relationships (one listbox id, per-option ids built
  // from a stable base — SSR-safe via useId, no Math.random()).
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const activeId =
    active >= 0 && active < results.length ? optionId(active) : undefined;

  const labelFor = (star: MemoryStar): string =>
    interpolate(m.option, { name: star.name ?? star.text });

  // Select a result: frame the star (#111) AND speak the found line (BR37/AC4).
  const choose = (index: number) => {
    const star = results[index];
    if (!star) return;
    onSelect(star.id);
    onSpeak(interpolate(hub.found, { name: star.name ?? star.text }));
    // Collapse the search after a successful selection.
    setSearchOpen(false);
    setQuery("");
    setActive(-1);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setActive(-1); // a new query resets the roving cursor
  };

  const onSearchFocus = () => {
    setSearchOpen(true);
  };

  const onSearchBlur = () => {
    // Collapse on blur only if no query — a user who typed something should keep
    // the results visible. The results list uses onMouseDown preventDefault so
    // clicking a result doesn't trigger blur before the click fires.
    if (query === "") {
      setSearchOpen(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Enter") {
        // Type-and-Enter on a no-match: ASTRO says "nothing found" (BR37/AC4).
        e.preventDefault();
        onSpeak(hub.notFound);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onQueryChange("");
        setSearchOpen(false);
      }
      return;
    }
    switch (e.key) {
      // The compact layout renders only the first result (`results.slice(0, 1)`),
      // so the roving cursor is clamped to {-1, 0} — advancing past index 0 would
      // point `aria-activedescendant` at an option that isn't in the DOM (dangling IDREF).
      case "ArrowDown": {
        e.preventDefault();
        setActive(0);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActive(-1);
        break;
      }
      case "Enter": {
        e.preventDefault();
        // No active option ⇒ select the first result (type-and-Enter).
        choose(active >= 0 ? active : 0);
        break;
      }
      case "Escape": {
        e.preventDefault();
        onQueryChange("");
        setSearchOpen(false);
        break;
      }
    }
  };

  // Dispatch a pill's action to the right seam (§3/§4). The component owns NO pill
  // logic — `astro-pills.ts` owns the set/availability; this only routes the action.
  const onPill = (pill: AstroPill) => {
    const a = pill.action;
    switch (a.kind) {
      case "ascendTo":
        onTierSelect(a.tier);
        return;
      case "dive":
        onDive(a.id, a.tier);
        return;
      case "sayLine":
        onSpeak(hub.lines[a.lineKey]);
        return;
      case "speakLore": {
        // ONE spoken bubble via the narration seam: the cached AI fact, falling
        // back to the authored lore line so a prompt pill never speaks nothing
        // (§4, AC8). The fallback also covers a transport throw.
        const req = promptNarrationRequest(a.loreKey, messages.lore);
        const fallback = messages.lore[a.loreKey].line;
        void narrate(req)
          .then((line) =>
            onSpeak(line != null && line.length > 0 ? line : fallback),
          )
          .catch(() => onSpeak(fallback));
        return;
      }
    }
  };

  // ── sub-trees (one a11y wiring, composed in the single return below) ──────────

  const inputEl = (
    <div className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-label={m.label}
        aria-expanded={searchOpen ? "true" : "false"}
        aria-controls={listboxId}
        aria-describedby={statusId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        placeholder={m.placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onSearchFocus}
        onBlur={onSearchBlur}
        onKeyDown={onKeyDown}
        className="pointer-events-auto w-full rounded border border-accent-soft bg-surface px-3 py-2.5 pr-16 font-mono text-count text-text placeholder:text-dim-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {/* Right-edge affordances: the clear × (only with a query) + the Enter (↵)
          hint signalling "press Enter to ask/search". */}
      <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
        {query !== "" && (
          <button
            type="button"
            aria-label={m.clear}
            onClick={() => {
              onQueryChange("");
              setSearchOpen(false);
            }}
            className="pointer-events-auto grid size-5 place-items-center border-0 bg-transparent p-0 font-mono text-[14px] leading-none text-dim-2 transition-colors duration-200 hover:text-text focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
        {/* Enter affordance — a static kbd-style hint at the input's right. */}
        <span
          aria-hidden="true"
          className="grid h-5 min-w-5 place-items-center rounded-snug border border-dim-3 px-1 font-mono text-[11px] leading-none text-dim-2"
        >
          ↵
        </span>
      </div>
    </div>
  );

  const statusEl = (
    <output
      id={statusId}
      aria-live="polite"
      className="m-0 font-mono text-eyebrow text-dim-2"
    >
      {results.length === 0
        ? m.empty
        : interpolate(m.count, { count: results.length })}
    </output>
  );

  // The pill rail wrapper — an overflow-hidden relative container with a right-edge
  // gradient fade affordance (always-on mask) so the rail reads as scrollable and
  // nothing clips. The `data-pill-rail` attribute is the test/QA selector hook.
  // `[scrollbar-width:none]` keeps the scrollbar invisible; the fade takes its role.
  const pillRailEl = (
    <div data-pill-rail className="relative overflow-hidden">
      {/* Right-edge gradient fade — always visible, pointer-events:none so it
          doesn't block clicks. The fade fades out the last ~32px of the rail,
          signalling overflow / "more to scroll" without relying on OS scrollbars. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-[var(--color-space-deep)] to-transparent"
      />
      {/* A `<fieldset>` + sr-only `<legend>` is the semantic labelled-control group (it
          carries the implicit `role="group"` the ADR §5 calls for, with the legend as its
          accessible name) — the SAME native pattern `PaletteSwitcher` uses, and what
          Biome's `useSemanticElements` requires over a `role="group"` div. On `max-[620px]`
          the row scrolls horizontally so the pills never wrap/clip in the corner. */}
      <fieldset className="m-0 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto border-0 p-0 pb-0.5 pr-8 [scrollbar-width:none]">
        <legend className="sr-only">{hub.pillGroup}</legend>
        {pills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => onPill(pill)}
            className={`pointer-events-auto inline-flex shrink-0 cursor-pointer items-center rounded-full border px-2.5 py-1 font-sans text-eyebrow font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
              pill.kind === "nav"
                ? "border-accent-soft text-accent hover:bg-accent-soft"
                : "border-dim-3 text-dim-2 hover:border-accent-soft hover:text-text"
            }`}
          >
            {hub.pills[pill.labelKey]}
          </button>
        ))}
      </fieldset>
    </div>
  );

  // Inside the wide panel: a thin divider, then the pill rail, then (where memory
  // stars live) the disclosed search — full-width within the panel. The bubble is
  // a sibling ABOVE in Astro.tsx's panel — not nested here.
  //
  // The listbox is ALWAYS rendered (the combobox `aria-controls` target must be in
  // the DOM for the ARIA relationship to be valid). When search is collapsed, it
  // renders empty (no options). The status/count only renders when search is open.
  return (
    <div data-astro-hub className="flex w-full flex-col gap-row">
      {/* The divider that separates the speech bubble from the actions lives in
          Astro.tsx now — rendered only WITH the bubble, so dismissing the bubble
          (× ) doesn't leave an orphaned line atop an empty panel (#250 bug fix). */}
      {pillRailEl}
      {showSearch && (
        <>
          {inputEl}
          {/* Count + results visible only when search is disclosed */}
          {searchOpen && statusEl}
          {/* Listbox stays in DOM for ARIA contract; empty when closed */}
          <div
            id={listboxId}
            role="listbox"
            aria-label={m.results}
            className="m-0 flex max-h-[24vh] list-none flex-col gap-px overflow-y-auto p-0"
          >
            {searchOpen &&
              results.slice(0, 1).map((star, i) => {
                const isActive = i === active;
                return (
                  <button
                    type="button"
                    key={star.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isActive}
                    aria-label={labelFor(star)}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                    className={`pointer-events-auto flex cursor-pointer flex-col items-start gap-[2px] border-0 bg-transparent px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none ${
                      isActive ? "bg-accent-soft" : "hover:bg-accent-soft"
                    }`}
                  >
                    {star.name && (
                      <span className="font-sans text-count text-text">
                        {star.name}
                      </span>
                    )}
                    <span className="max-w-full truncate font-serif text-eyebrow text-dim-2">
                      {star.text}
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};
