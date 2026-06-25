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
 * AstroHub (#250, ADR-0017) — ASTRO's single interaction surface, hosted inside
 * `Astro.tsx`'s `.galaxy-astro` frame. Two affordances:
 *
 * 1. **An always-visible compact search combobox** — the `StarSearch` (#113)
 *    combobox a11y wiring extracted *verbatim* (`role="combobox"`,
 *    `aria-expanded`/`controls`/`activedescendant` over a `role="listbox"` of
 *    `role="option"` buttons, the `<output aria-live>` count, Arrow/Enter/Escape).
 *    Search stays `searchStars(stars, query)` → on select `onSelect(id)` (the #111
 *    `focusStar` primitive, unchanged) AND ASTRO speaks the found/notFound line.
 * 2. **A row of fast-action pills** — real `<button>`s from the pure `pillsFor(ctx)`
 *    selector (`astro-pills.ts`), in a labelled `role="group"`. A `nav` pill drives
 *    the existing tier-nav spine (`onTierSelect` / `onDive`); a `prompt` pill makes
 *    ASTRO speak ONE bubble response (`speakLore` → `narrate` with the
 *    `lore[key].line` fallback; `sayLine` → the canned `astroHub.lines.*` line) —
 *    NO chat thread / multi-turn state / new backend (ADR-0017 §4/§6).
 *
 * The spoken response is announced by the EXISTING `AstroBubble` `aria-live` region
 * via `onSpeak` (the `showNarration` seam, last-writer-wins through `Astro`) — no
 * second live region (the #72 invariant).
 *
 * **Composition (owner pick, 2026-06-25):** the FIXED contract (always-visible
 * input, combobox semantics, real-button pills, pointer-events discipline) plus the
 * chosen layout — the **pill row on top**, then the search input, then a **compact
 * count + first-result** (not the full browsable listbox). On `max-[620px]` the pill
 * row scrolls horizontally. (ADR-0017 §1 spec'd a code-first composition bake-off;
 * the owner picked this one and the toggle scaffold + the other layouts were removed.)
 *
 * SSR/Workers-safe (ADR-0003): no module-scope clock/random; ids via `useId`; the
 * `narrate` fetch fires only in a click handler (request scope). i18n (#103): all
 * copy from the `search.*` + `astroHub.*` catalog, never inline. Styling (#75):
 * Tailwind utilities reading `@theme` tokens; no hardcoded hex. Pointer-events
 * (#243/#245): the hub is a frame-hosted child whose interactive elements carry
 * `pointer-events-auto` so they stay clickable under any `pointer-events:none` host.
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
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setActive(-1); // a new query resets the roving cursor
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Enter") {
        // Type-and-Enter on a no-match: ASTRO says "nothing found" (BR37/AC4).
        e.preventDefault();
        onSpeak(hub.notFound);
      } else if (e.key === "Escape") onQueryChange("");
      return;
    }
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setActive((i) => (i + 1) % results.length);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
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
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={m.label}
        aria-expanded="true"
        aria-controls={listboxId}
        aria-describedby={statusId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        placeholder={m.placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="pointer-events-auto w-full rounded border border-accent-soft bg-surface px-3 py-2 pr-9 font-mono text-count text-text placeholder:text-dim-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {query !== "" && (
        <button
          type="button"
          aria-label={m.clear}
          onClick={() => onQueryChange("")}
          className="pointer-events-auto absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 font-mono text-[14px] leading-none text-dim-2 transition-colors duration-200 hover:text-text focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
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

  // The compact result list — the count line above + the FIRST result only (the
  // chosen "B" composition keeps the corner light). The listbox is always present
  // (the combobox `aria-controls` target); the roving cursor stays on the input via
  // `aria-activedescendant`, and the option is a real <button> out of the tab order
  // (the ARIA 1.2 combobox pattern, extracted verbatim from #113).
  const listEl = (
    <div
      id={listboxId}
      role="listbox"
      aria-label={m.results}
      className="m-0 flex max-h-[24vh] list-none flex-col gap-px overflow-y-auto p-0"
    >
      {results.slice(0, 1).map((star, i) => {
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
  );

  // A `<fieldset>` + sr-only `<legend>` is the semantic labelled-control group (it
  // carries the implicit `role="group"` the ADR §5 calls for, with the legend as its
  // accessible name) — the SAME native pattern `PaletteSwitcher` uses, and what
  // Biome's `useSemanticElements` requires over a `role="group"` div. On `max-[620px]`
  // the row scrolls horizontally so the pills never wrap/clip in the corner.
  const pillRow = (
    <fieldset className="m-0 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto border-0 p-0 pb-0.5 [scrollbar-width:none]">
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
  );

  // The owner-picked composition: the pill row on top, then (where memory stars live)
  // the search input → compact count → first result.
  return (
    <div className="galaxy-astro__hub flex w-[min(320px,72vw)] flex-col gap-row">
      {pillRow}
      {showSearch && (
        <>
          {inputEl}
          {statusEl}
          {listEl}
        </>
      )}
    </div>
  );
};
