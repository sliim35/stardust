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
 */

type Props = { value: Palette; onChange: (p: Palette) => void };

export const PaletteSwitcher = ({ value, onChange }: Props) => (
  <fieldset className="galaxy-themes">
    <legend className="sr-only">Backdrop theme</legend>
    {PALETTE_ORDER.map((p) => (
      <button
        key={p}
        type="button"
        className="galaxy-themes__swatch"
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
