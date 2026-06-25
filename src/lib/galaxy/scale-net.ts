/**
 * The tier-aware scale net model (interaction spec §5.3) — a pure, headless
 * description of the bottom-left concentric range rings. The net relabels per
 * tier so the visitor always knows the scale they're reading; this module owns
 * the *what* (ring radii + their real-distance labels), the `<ScaleNet>`
 * component owns the *how* (the SVG/CSS render).
 *
 * **Indicative, authored constants — NOT derived (spec §5.3).** The rings are
 * hand-authored to roughly match the close-to-real radial layout (§5.2), not
 * computed from a projection engine. The `radius` is relative (0..1) — the net's
 * own geometry, decoupled from the canvas; `value`/`unit` carry the real
 * light-year distance the ring marks, formatted by `formatRingLabel`.
 *
 * **Solar-System tier is deferred (#127):** it exists in the `Tier` union but is
 * not built in v1, so `ringsForTier('solarSystem')` returns `[]` — the net
 * degrades to nothing rather than throwing (the visitor never reaches it).
 *
 * The unit abbreviations (`ly`/`Mly`) mirror `RealDistance.unit` in `types.ts`:
 * international scientific notation carried as data, not translated (consistent
 * with the realdata module + the i18n rule's "formatted from values" allowance).
 */

import type { RealDistance, Tier } from "#/lib/galaxy/types";

/**
 * One concentric ring: its relative radius (0..1, the net's geometry) plus the
 * real distance it marks (for the mono label). Extends `RealDistance` so the
 * `value`/`unit` pair stays the same shape the lore cards already carry.
 */
export type Ring = RealDistance & {
  /** Relative radius within the net, 0..1 (outermost = 1, the net's edge). */
  radius: number;
};

/**
 * The authored rings per tier (spec §5.3 table). Local Group = the LG range
 * centred on the Milky Way; Milky Way = the disk scale centred on Sol/galactic
 * centre; Solar System = the AU ladder centred on Sol (ADR-0016 §2). `ly` values
 * ≥ 1000 collapse to a `k` magnitude in the label (`200000 → "200k ly"`); `Mly`
 * and `AU` render verbatim (the data stays in the base unit, real figures). Radii
 * are spaced to roughly echo the close-to-real layout (compressed on the LG tier
 * where the range spans ~17×; the AU tier marks ~1 / ~5 / ~30 AU on the ring
 * ladder), outermost pinned to 1.
 */
const RINGS_BY_TIER = {
  localGroup: [
    { radius: 0.38, value: 200000, unit: "ly" },
    { radius: 0.68, value: 1, unit: "Mly" },
    { radius: 1, value: 2.5, unit: "Mly" },
  ],
  galaxy: [
    { radius: 0.34, value: 10000, unit: "ly" },
    { radius: 0.66, value: 50000, unit: "ly" },
    { radius: 1, value: 100000, unit: "ly" },
  ],
  // Solar System (ADR-0016 §2): three rings on the AU ladder — ~1 AU (Earth's
  // orbit), ~5 AU (Jupiter), ~30 AU (Neptune). Radii map to the inner / mid /
  // outer of the even ring ladder; AU carries the real semi-major axis the lore
  // card + the relabelled net read. No `k` collapse for AU.
  solarSystem: [
    { radius: 0.45, value: 1, unit: "AU" },
    { radius: 0.7, value: 5, unit: "AU" },
    { radius: 1, value: 30, unit: "AU" },
  ],
} as const satisfies Partial<Record<Tier, readonly Ring[]>>;

/**
 * The rings for a tier — relabels the net per the §5.3 / ADR-0016 §2 table. Pure;
 * the same tier always yields equal data. Returns `[]` for any tier with no
 * authored ring set so the net renders nothing instead of crashing.
 */
export const ringsForTier = (tier: Tier): readonly Ring[] =>
  RINGS_BY_TIER[tier as keyof typeof RINGS_BY_TIER] ?? [];

/**
 * Format a ring's authored real distance into its display label, e.g.
 * `200k ly` · `1 Mly` · `2.5 Mly` · `10k ly` · `1 AU` · `30 AU`. `ly` values
 * ≥ 1000 collapse to a `k` magnitude (`10000 → "10k"`); `Mly`, `AU`, and sub-kilo
 * values render verbatim (no `k` collapse for AU — ADR-0016 §2). Round values
 * carry no trailing `.0`. The unit is appended with a space.
 */
export const formatRingLabel = (ring: Ring): string =>
  ring.unit === "ly" && ring.value >= 1000
    ? `${ring.value / 1000}k ${ring.unit}`
    : `${ring.value} ${ring.unit}`;
