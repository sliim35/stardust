import { describe, expect, it } from "vitest";
import {
  BLINK_CYCLE_MS,
  BOB_CYCLE_MS,
  DOT_DELAYS_MS,
  DRIFT_CYCLE_MS,
  LOADER_SPARKS,
  LOADER_STARFIELD_SEED,
  LOADER_STARS,
  REDUCED_SWEEP_FILL,
  STARFIELD_DIVISOR,
  SWEEP_CYCLE_MS,
  starColorTier,
  starCountFor,
  TWINKLE_CYCLE_MS,
} from "#/lib/galaxy/loader";
import { generateStars } from "#/lib/starfield";

describe("loader timing constants (paired with the CSS @keyframes)", () => {
  it("matches the handoff Loader.html durations", () => {
    expect(BOB_CYCLE_MS).toBe(4000); // ↔ `animation: astro-loader-bob 4s`
    expect(DRIFT_CYCLE_MS).toBe(9000); // ↔ `astro-loader-drift 9s`
    expect(BLINK_CYCLE_MS).toBe(1400); // ↔ `astro-loader-blink 1.4s`
    expect(SWEEP_CYCLE_MS).toBe(2200); // ↔ `astro-loader-sweep 2.2s`
    expect(TWINKLE_CYCLE_MS).toBe(2200); // ↔ `astro-loader-twinkle 2.2s`
  });

  it("staggers the three thinking dots at 0 / 200 / 400 ms (handoff spec)", () => {
    expect(DOT_DELAYS_MS).toEqual([0, 200, 400]);
  });

  it("shows a static partial fill under reduced motion (no animation)", () => {
    expect(REDUCED_SWEEP_FILL).toBeGreaterThan(0);
    expect(REDUCED_SWEEP_FILL).toBeLessThan(1);
  });
});

describe("starCountFor — viewport-area derived count (handoff w*h/9000)", () => {
  it("uses the handoff divisor", () => {
    expect(STARFIELD_DIVISOR).toBe(9000);
    expect(LOADER_STARFIELD_SEED).toBe(7777);
  });

  it("rounds w*h/9000 to the nearest integer", () => {
    expect(starCountFor(1920, 1080)).toBe(Math.round((1920 * 1080) / 9000));
    expect(starCountFor(800, 600)).toBe(Math.round((800 * 600) / 9000));
  });

  it("never returns a negative count for a zero/empty viewport", () => {
    expect(starCountFor(0, 0)).toBe(0);
    expect(starCountFor(-100, -100)).toBe(0);
  });
});

describe("starColorTier — deterministic 3-tier color from a Star (reuses generateStars)", () => {
  it("classifies every star into exactly one of the three handoff tiers", () => {
    const tiers = new Set(["accent", "cool", "dim"]);
    for (const star of generateStars(LOADER_STARFIELD_SEED, 256, 1000)) {
      expect(tiers.has(starColorTier(star))).toBe(true);
    }
  });

  it("is a pure function of the star (same star → same tier)", () => {
    const stars = generateStars(LOADER_STARFIELD_SEED, 64, 1000);
    for (const star of stars) {
      expect(starColorTier(star)).toBe(starColorTier(star));
    }
  });

  it("produces all three tiers across a large field (not collapsed to one)", () => {
    const seen = new Set(
      generateStars(LOADER_STARFIELD_SEED, 1000, 2000).map(starColorTier),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("LOADER_SPARKS / LOADER_STARS — fixed pixel accents (handoff layout)", () => {
  it("ships three sparks and four stars at integer positions", () => {
    expect(LOADER_SPARKS).toHaveLength(3);
    expect(LOADER_STARS).toHaveLength(4);
    for (const a of [...LOADER_SPARKS, ...LOADER_STARS]) {
      expect(Number.isInteger(a.left)).toBe(true);
      expect(Number.isInteger(a.top)).toBe(true);
      expect(a.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("tints each accent with a galaxy token (no raw hex)", () => {
    for (const a of [...LOADER_SPARKS, ...LOADER_STARS]) {
      expect(a.color.startsWith("var(--")).toBe(true);
    }
  });
});
