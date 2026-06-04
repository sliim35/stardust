/**
 * WCAG contrast for the composited type layer (#83 AC10). The L7 scrim is
 * mandatory in the pipeline so type contrast is **structural, not luck** — text
 * always lands on the scrimmed lower-left zone, never on whichever stars happened
 * to fall behind it. These helpers let a test assert AA cold.
 */

const channelLuminance = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ([r, g, b]: [number, number, number]): number =>
  0.2126 * channelLuminance(r) +
  0.7152 * channelLuminance(g) +
  0.0722 * channelLuminance(b);

const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};

/** WCAG 2.x contrast ratio between two solid hex colors (1..21). */
export const contrastRatio = (fg: string, bg: string): number => {
  const l1 = relativeLuminance(toRgb(fg));
  const l2 = relativeLuminance(toRgb(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The effective background under the headline: the `void` `#04050d` with the
 * lower-left scrim `rgba(3,4,10,.7)` composited over it (`out = src·α + dst·(1-α)`).
 * Both layers are near-black, so the zone is ≈ `#040509`.
 */
export const SCRIMMED_TYPE_ZONE = "#040509";

/** Composited type colors (spec §AC1 typography). */
export const TYPE_COLORS = {
  headline: "#f3f1ea",
  eyebrow: "#b0c2bc",
  emphasis: "#f5d6a0", // gold emphasis word
  hud: "#b0c2bc",
  finePrint: "#8a8c96", // AA; never regress to #7a7c86 (fails AA)
} as const;
