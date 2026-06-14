import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { searchStars } from "#/lib/galaxy/star-search";
import type { MemoryStar } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";

/**
 * StarSearch (#113, galaxy:discovery) — the discovery combobox: find a memory
 * star by its `text` / `mood` / `color` / `name` and **frame it** by handing the
 * selected id to the focus-on-star primitive (#111) via `onSelect`. Card-open is
 * the caller's choice (optional per the story); this component owns only the
 * search index UI + the select gesture.
 *
 * **Pure search, thin UI.** The matching rule lives in `lib/galaxy/star-search`
 * (`searchStars`, unit-tested headless); this component is the accessible shell
 * around it: an editable combobox (ARIA 1.2 combobox + listbox pattern) with a
 * roving `aria-activedescendant`, arrow-key + Enter navigation, and a live result
 * count. The listbox is always present (the at-rest state shows the full index),
 * so it reads as a browsable directory, not a hidden popup.
 *
 * **Accessibility:** the input is `role="combobox"` `aria-expanded`
 * `aria-controls`/`aria-activedescendant`; each result is `role="option"` with an
 * `aria-selected` active marker and a catalog-templated accessible name; the
 * result count is an `aria-live` status. Keyboard: ArrowDown/Up move the active
 * option (wrapping), Enter selects it (or the first result when none is active),
 * Escape clears the query.
 *
 * **i18n (#103):** every user-facing string — labels, placeholder, the per-result
 * "Go to {name}" name, the "{count} memories found" status, the empty line — is
 * read from the `search.*` catalog (en+ru), never inline. **Styling (#75):**
 * Tailwind utilities reading the `@theme` tokens / the runtime accent vars; no
 * hardcoded hex.
 */

type Props = {
  /** The live sky's memory stars to index (filtered, never mutated). */
  stars: readonly MemoryStar[];
  /**
   * Selection sink — called with the chosen star id. The stage wires this to the
   * focus controller's `focusStar(id)` (#111); a card-open is optional on top.
   */
  onSelect: (id: string) => void;
};

export const StarSearch = ({ stars, onSelect }: Props) => {
  const m = getMessages(useLocale()).search;
  const [query, setQuery] = useState("");
  // The active option's index in `results`, or -1 for "none active" (Enter then
  // falls back to the first result — the common "type and hit Enter" path).
  const [active, setActive] = useState(-1);

  const results = useMemo(() => searchStars(stars, query), [stars, query]);

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

  const choose = (index: number) => {
    const star = results[index];
    if (star) onSelect(star.id);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setActive(-1); // a new query resets the roving cursor
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Escape") onQueryChange("");
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

  return (
    <div className="pointer-events-auto flex w-[min(320px,72vw)] flex-col gap-row">
      {/* The editable combobox input. `aria-expanded` is always true: the listbox
          is a persistent directory, not a pop-up — the at-rest state is the full
          index. */}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-label={m.label}
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          placeholder={m.placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full rounded border border-accent-soft bg-surface px-3 py-2 pr-9 font-mono text-count text-text placeholder:text-dim-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        {query !== "" && (
          <button
            type="button"
            aria-label={m.clear}
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 font-mono text-[14px] leading-none text-dim-2 transition-colors duration-200 hover:text-text focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {/* The live result-count status — announced to AT on every query change.
          `<output>` is the semantic status element (implicit role="status"). */}
      <output
        id={statusId}
        aria-live="polite"
        className="m-0 font-mono text-eyebrow text-dim-2"
      >
        {results.length === 0
          ? m.empty
          : interpolate(m.count, { count: results.length })}
      </output>

      {/* The results listbox — always present; the at-rest state is the full
          index, so it reads as a browsable directory. Each option is a real
          <button> (focusable + keyboard-activatable), but the roving cursor is
          driven via the input's `aria-activedescendant` so keyboard nav stays on
          the text field (the ARIA 1.2 combobox pattern). */}
      <div
        id={listboxId}
        role="listbox"
        aria-label={m.results}
        className="m-0 flex max-h-[40vh] list-none flex-col gap-px overflow-y-auto p-0"
      >
        {results.map((star, i) => {
          const isActive = i === active;
          return (
            <button
              type="button"
              key={star.id}
              id={optionId(i)}
              role="option"
              aria-selected={isActive}
              aria-label={labelFor(star)}
              // Options aren't in the tab order — focus stays on the combobox
              // input, which moves the cursor via aria-activedescendant.
              tabIndex={-1}
              // Pointer hover previews the roving cursor; mousedown only
              // prevents the input from losing focus, the click does the select.
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(star.id)}
              className={`flex cursor-pointer flex-col items-start gap-[2px] border-0 bg-transparent px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none ${
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
    </div>
  );
};
