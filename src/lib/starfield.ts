/**
 * Deterministic pixel-art starfield generator for the Memory Galaxy backdrop.
 *
 * Pure + seeded on purpose: the same seed always yields the same sky, so server
 * and client render identical markup (no hydration mismatch) and Cloudflare
 * Workers never see a module-scope `Math.random()` / `Date.now()` call. The
 * bright, clickable *memory* stars are a later story (renderer, #4); this is the
 * dim decorative backdrop only.
 */

export interface Star {
  /** x offset in px from the field origin */
  x: number;
  /** y offset in px from the field origin */
  y: number;
  /** crisp pixel size: 1 or 2 px (no blur) */
  size: 1 | 2;
  /** 0..1 opacity, drives the faint twinkle of depth */
  alpha: number;
}

/** mulberry32 — tiny deterministic PRNG. Same seed → same sequence. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Scatter `count` stars across a `spread`×`spread` px square, deterministically. */
export const generateStars = (
  seed: number,
  count: number,
  spread: number,
): Star[] => {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.round(rand() * spread),
      y: Math.round(rand() * spread),
      size: rand() < 0.85 ? 1 : 2,
      alpha: Math.round((0.3 + rand() * 0.7) * 100) / 100,
    });
  }
  return stars;
};

/**
 * Build a CSS `box-shadow` value that paints every star as a crisp (blur 0)
 * pixel square. Applied to a single 1px element — one node, hundreds of stars.
 */
export const starfieldShadow = (
  stars: Star[],
  color = "255, 255, 255",
): string => {
  return stars
    .map((s) => {
      const spread = s.size === 2 ? " 0.5px" : "";
      return `${s.x}px ${s.y}px 0${spread} rgba(${color}, ${s.alpha})`;
    })
    .join(", ");
};
