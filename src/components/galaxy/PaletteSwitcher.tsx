import type { CSSProperties } from "react";
import { PALETTE_ORDER, paletteFor } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";

/**
 * The backdrop theme switcher — redesigned per the owner pass 2026-06-10
 * (research: `docs/research/2026-06-10-theme-switcher.md`, direction V1 "quiet
 * dots + reveal"). The old three bare dots read as decoration, not a control;
 * the fix is a containing pill that stays near-invisible at rest and reveals
 * `dot · LABEL` triplets on hover/focus — discoverable when approached, quiet
 * otherwise (the minimal-chrome rule). Picking re-tones only the backdrop
 * disk/haze/core; memory-star colors never change (#44).
 *
 * A11y: NATIVE radios (a `fieldset` + sr-only `legend`, one sr-only
 * `<input type="radio">` per palette behind a styled label) — exclusive
 * selection, group-tab and Arrow-key move-and-select come from the browser,
 * no hand-rolled roving tabindex. Labels are catalog copy (en+ru) — the former
 * hardcoded `PALETTE_LABELS` retired (#103 rule). Tailwind utilities on the
 * @theme tokens (#75); the per-swatch tint stays the data-driven inline
 * `--swatch` var (it's `paletteFor(p).accent`, not a static token). The reveal
 * is display-only (no motion), so it needs no reduced-motion fork.
 */

type Props = { value: Palette; onChange: (p: Palette) => void };

export const PaletteSwitcher = ({ value, onChange }: Props) => {
  const m = getMessages(useLocale());
  return (
    <fieldset className="group pointer-events-auto absolute top-[46px] right-[max(24px,env(safe-area-inset-right))] z-[6] m-0 flex items-center gap-[10px] rounded-pill border border-transparent px-[10px] py-[6px] transition-colors duration-200 hover:border-accent/20 hover:bg-surface/60 focus-within:border-accent/20 focus-within:bg-surface/60 motion-reduce:transition-none">
      <legend className="sr-only">{m.chrome.backdrop.label}</legend>
      {PALETTE_ORDER.map((p) => (
        <label
          key={p}
          title={m.chrome.backdrop[p]}
          style={{ "--swatch": paletteFor(p).accent } as CSSProperties}
          className="flex cursor-pointer items-center gap-[6px]"
        >
          <input
            type="radio"
            name="backdrop-theme"
            // The explicit accname: at rest the label text is display:none, so
            // name-from-content computes empty and the accname would fall back
            // to the label's title tooltip — the weakest mechanism in the
            // algorithm (review nit). aria-label is stable in every state.
            aria-label={m.chrome.backdrop[p]}
            className="peer sr-only"
            checked={p === value}
            onChange={() => onChange(p)}
          />
          <span
            aria-hidden="true"
            data-active={p === value || undefined}
            className="size-3 rounded-full border border-white/25 bg-(--swatch) opacity-40 transition-[opacity,transform,box-shadow] duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--swatch) hover:opacity-75 motion-reduce:transition-none data-active:scale-[1.2] data-active:opacity-100 data-active:shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_10px_1px_var(--swatch)]"
          />
          {/* The reveal: hidden at rest, surfaces with the pill on hover/focus. */}
          <span
            data-active={p === value || undefined}
            className="hidden font-mono text-[9px] tracking-[0.15em] text-dim-2 uppercase group-focus-within:inline group-hover:inline data-active:text-accent"
          >
            {m.chrome.backdrop[p]}
          </span>
        </label>
      ))}
    </fieldset>
  );
};
