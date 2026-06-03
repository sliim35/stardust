import type { CSSProperties } from "react";
import {
  PALETTE_LABELS,
  PALETTE_ORDER,
  paletteFor,
} from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

/**
 * The backdrop theme picker — three swatches tinted by each palette's accent
 * (sea glass · amber · moonlit). Picking re-tones only the disk/haze/core; the
 * agent's memory-star colors never change. Resolves #44 by offering both.
 *
 * Proof-of-pattern for #75: this DOM chrome is Tailwind utilities (layout, sizing,
 * focus ring, states), reading the @theme tokens. The per-swatch tint stays the
 * data-driven inline `--swatch` var (it's `paletteFor(p).accent`, not a static
 * token). The fieldset / legend.sr-only / aria-pressed semantics are unchanged.
 */

type Props = { value: Palette; onChange: (p: Palette) => void };

export const PaletteSwitcher = ({ value, onChange }: Props) => (
  <fieldset className="pointer-events-auto absolute top-[50px] right-panel z-[6] m-0 flex min-inline-size:0 gap-row border-0 p-0">
    <legend className="sr-only">Backdrop theme</legend>
    {PALETTE_ORDER.map((p) => (
      <button
        key={p}
        type="button"
        className="size-4 cursor-pointer rounded-full border border-white/25 bg-(--swatch) p-0 opacity-[0.55] transition-[opacity,transform,box-shadow] duration-200 hover:opacity-[0.85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--swatch) motion-reduce:transition-none data-active:scale-[1.15] data-active:opacity-100 data-active:shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_10px_1px_var(--swatch)]"
        data-active={p === value || undefined}
        aria-pressed={p === value}
        aria-label={`${PALETTE_LABELS[p]} backdrop`}
        title={PALETTE_LABELS[p]}
        style={{ "--swatch": paletteFor(p).accent } as CSSProperties}
        onClick={() => onChange(p)}
      />
    ))}
  </fieldset>
);
