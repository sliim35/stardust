/**
 * Backdrop palettes for the procedural galaxy (#4). `GalaxyBackdrop.palette`
 * selects one of three concrete hex sets, transcribed verbatim from the approved
 * design spec (`docs/design/2026-06-02-explorable-galaxy.md` §"Palettes").
 *
 * These tint the **backdrop, core, accent, and haze only** — never a memory
 * star's `color`, which the agent owns and the UI renders unchanged. The default
 * is `auroral` (sea-glass green), the owner's approved sky; `ember` (amber) and
 * `ice` (moonlit blue) are selectable alternates.
 */

import type { Palette } from "#/lib/galaxy/types";

export type PaletteTokens = {
  bg: string;
  bg2: string;
  coreHot: string;
  coreWarm: string;
  accent: string;
  accentSoft: string;
  hazeNear: string;
  hazeFar: string;
  starHot: string;
  starWarm: string;
  starCool: string;
  dust: string;
};

export const DEFAULT_PALETTE: Palette = "auroral";

export const PALETTES = {
  auroral: {
    bg: "#04080a",
    bg2: "#08120f",
    coreHot: "#e8fff0",
    coreWarm: "#9cd8c0",
    accent: "#9cd8c0",
    accentSoft: "#9cd8c030",
    hazeNear: "#3a8f7a",
    hazeFar: "#6abaa0",
    starHot: "#eafff4",
    starWarm: "#9cd8c0",
    starCool: "#b0c2bc",
    dust: "#0f1a16",
  },
  ember: {
    bg: "#050507",
    bg2: "#0a0a10",
    coreHot: "#fff6d0",
    coreWarm: "#f0c987",
    accent: "#f5d6a0",
    accentSoft: "#f5d6a030",
    hazeNear: "#5a6ea0",
    hazeFar: "#8898d0",
    starHot: "#fff0c0",
    starWarm: "#f0c987",
    starCool: "#b0b0c0",
    dust: "#1a1822",
  },
  ice: {
    bg: "#04060d",
    bg2: "#080c1a",
    coreHot: "#e8f0ff",
    coreWarm: "#b8c8e8",
    accent: "#c8d4e8",
    accentSoft: "#c8d4e830",
    hazeNear: "#4a5a8a",
    hazeFar: "#6a7aba",
    starHot: "#eaf2ff",
    starWarm: "#b8c8e8",
    starCool: "#aab4d0",
    dust: "#121826",
  },
} as const satisfies Record<Palette, PaletteTokens>;

/** The hex token set for a palette (defaults to the approved auroral sky). */
export const paletteFor = (palette: Palette = DEFAULT_PALETTE): PaletteTokens =>
  PALETTES[palette];

/**
 * The active palette's accent family, shaped as the `@theme` CSS vars the DOM
 * chrome reads (`text-accent`, `border-accent`, focus rings). Published onto the
 * stage root so a palette switch re-tints every chrome utility in one write —
 * `palette.ts` stays the canonical sky source; chrome borrows only its accent.
 */
export const paletteAccentVars = (palette: Palette = DEFAULT_PALETTE) => {
  const { accent, accentSoft } = paletteFor(palette);
  return {
    "--color-accent": accent,
    "--color-accent-soft": accentSoft,
  } as const;
};

/** Display order for the theme picker (auroral default first). */
export const PALETTE_ORDER = ["auroral", "ember", "ice"] as const;

/** Human swatch labels — resolves the #44 amber-vs-green call as a user choice. */
export const PALETTE_LABELS = {
  auroral: "sea glass",
  ember: "amber",
  ice: "moonlit",
} as const satisfies Record<Palette, string>;

/** Guard for persisted / user-supplied palette values (e.g. from localStorage). */
export const isPalette = (v: unknown): v is Palette =>
  typeof v === "string" && (PALETTE_ORDER as readonly string[]).includes(v);
