import type { CSSProperties } from "react";
import {
  ASTRO_GRID_SIZE,
  ASTRO_IDLE,
  ASTRO_PALETTE,
  type AstroPart,
  DEFAULT_CELL_PX,
  parseSprite,
} from "#/lib/galaxy/astro";

/**
 * The ASTRO sprite (#70) — the canonical STARLIGHT `idle` 16×16 pose rendered as a
 * CSS grid of `scale`-px cells (the prototype `PixelAstronaut` technique, recreated
 * per ADR-0002 §2 — output, not code). DOM-grid over `<canvas>` is deliberate: it is
 * SSR/Workers-safe with no client-only draw and no hydration mismatch (the markup is
 * fully deterministic), recolors purely via tokens, and needs no asset pipeline.
 *
 * Crisp at any DPR via `image-rendering: pixelated`. Draw-only: the char-grid → cell
 * math lives in the pure, unit-tested `#/lib/galaxy/astro` (the lib-pure rule).
 *
 * `#70` ships only `idle`; `wave`/`point`/`celebrate` are #71. Every material reads a
 * CSS var: neutral parts their `--astro-*` token, the visor-glow `V` + trim `t` the
 * shared `--color-accent` @theme var (published per-palette on the stage by
 * `paletteAccentVars` and inherited down to the cells), so the sprite tracks the live
 * sky with no prop threading — one accent source of truth.
 */

type Props = {
  /** Logical px per cell (default 4 → a 64×64 box at the prototype scale). */
  scale?: number;
};

/**
 * Sprite material → CSS color. Neutral parts read their `--astro-*` token; the `accent`
 * role reads the shared `--color-accent` @theme var (the live sky accent, inherited from
 * the stage root) — no JS-threaded accent.
 */
const PART_TOKENS = {
  helmet: "var(--astro-helmet)",
  visor: "var(--astro-visor)",
  accent: "var(--color-accent)",
  suit: "var(--astro-suit)",
  glove: "var(--astro-glove)",
  pack: "var(--astro-pack)",
  boot: "var(--astro-boot)",
} as const satisfies Record<AstroPart, string>;

/** Palette key → CSS color; unknown keys → null → dropped (never magenta). */
const resolveColor = (key: string): string | null => {
  const part = ASTRO_PALETTE[key as keyof typeof ASTRO_PALETTE];
  return part == null ? null : PART_TOKENS[part];
};

export const PixelAstronaut = ({ scale = DEFAULT_CELL_PX }: Props) => {
  const cells = parseSprite(ASTRO_IDLE, resolveColor);
  const box = ASTRO_GRID_SIZE * scale;

  return (
    <div
      className="galaxy-astro__sprite"
      style={
        {
          width: box,
          height: box,
          gridTemplateColumns: `repeat(${ASTRO_GRID_SIZE}, ${scale}px)`,
          gridTemplateRows: `repeat(${ASTRO_GRID_SIZE}, ${scale}px)`,
        } as CSSProperties
      }
    >
      {cells.map((cell) => (
        <span
          key={`${cell.x}-${cell.y}`}
          style={{
            gridColumnStart: cell.x + 1,
            gridRowStart: cell.y + 1,
            background: cell.color,
          }}
        />
      ))}
    </div>
  );
};
