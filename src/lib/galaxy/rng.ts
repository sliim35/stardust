/**
 * Tiny deterministic primitives shared by the galaxy's seeded generators
 * (backdrop geometry #4, per-star twinkle, the seed corpus). Seeded on purpose:
 * the same input always yields the same sky, so SSR and the client agree and a
 * Cloudflare Worker never touches a module-scope `Math.random()` (ADR-0003).
 *
 * NOTE: `src/lib/starfield.ts` and `src/lib/galaxy/seed.ts` still carry their own
 * copies of these; folding them onto this module is tracked as bug #45 (R1).
 */

/** mulberry32 — fast 32-bit PRNG. Same seed → same sequence of [0, 1) floats. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** FNV-1a 32-bit hash → a stable unsigned seed from a string (e.g. a star id). */
export const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Clamp `v` to `[lo, hi]`. Shared numeric helper (was duplicated per #45). */
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
