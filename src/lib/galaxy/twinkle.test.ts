import { describe, expect, it } from "vitest";
import {
  BLINK_POW,
  kindFor,
  type TwinkleKind,
  twinkleAlpha,
} from "#/lib/galaxy/twinkle";

// Sample a full 2π cycle at fine resolution and return [min, max] of the curve.
const sweep = (kind: TwinkleKind): { min: number; max: number } => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 2000; i++) {
    const theta = (i / 2000) * Math.PI * 2;
    const v = twinkleAlpha(theta, kind);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
};

describe("twinkleAlpha — dim non-blinker subset (AC1: true 0 → full)", () => {
  it("fades to a true ~0 trough across the cycle", () => {
    expect(sweep("dim").min).toBeLessThanOrEqual(0.001);
  });

  it("rises back to full (~1) at the peak", () => {
    expect(sweep("dim").max).toBeCloseTo(1, 2);
  });

  it("is exactly 0 through the entire negative half of the sine (rectified)", () => {
    // For theta in (π, 2π) sin is negative → rectified curve clamps to 0.
    expect(twinkleAlpha(Math.PI * 1.5, "dim")).toBe(0);
    expect(twinkleAlpha(Math.PI * 1.25, "dim")).toBe(0);
    expect(twinkleAlpha(Math.PI * 1.75, "dim")).toBe(0);
  });

  it("peaks at exactly 1 when sin = 1 (theta = π/2)", () => {
    expect(twinkleAlpha(Math.PI / 2, "dim")).toBeCloseTo(1, 12);
  });

  it("is pow-shaped — most of the bright lobe sits below full (quick spark, not a plateau)", () => {
    // A pow>1 trough means the curve at 30° into the lobe is well under the
    // raw sine value (sin 30° = 0.5), so the star spends little time near full.
    expect(twinkleAlpha(Math.PI / 6, "dim")).toBeLessThan(
      0.5 ** BLINK_POW + 1e-9,
    );
    expect(BLINK_POW).toBeGreaterThan(1);
  });
});

describe("twinkleAlpha — blinker subset (AC3: crisp sharp accents, unchanged character)", () => {
  it("keeps the original shimmer band 0.10 .. 1.0 (never blinks fully out)", () => {
    const { min, max } = sweep("blinker");
    expect(min).toBeCloseTo(0.1, 2);
    expect(max).toBeCloseTo(1, 2);
  });

  it("matches the legacy 0.55 + 0.45·sin curve exactly", () => {
    for (const theta of [0, 0.7, 1.9, 3.3, 5.1]) {
      expect(twinkleAlpha(theta, "blinker")).toBeCloseTo(
        0.55 + 0.45 * Math.sin(theta),
        12,
      );
    }
  });
});

describe("twinkleAlpha — shimmer majority (AC2: gentle breathing, never fully dark)", () => {
  it("never blinks fully out — keeps a shallow breathing band well above 0", () => {
    const { min, max } = sweep("shimmer");
    expect(min).toBeCloseTo(0.4, 2); // gentle trough, never dark
    expect(min).toBeGreaterThan(0.3); // stays clearly present (no blink-out)
    expect(max).toBeCloseTo(1, 2);
  });
});

describe("kindFor — classifies a far star into its curve (AC1/AC3 subset split)", () => {
  it("routes the bright accents to the crisp blinker shimmer", () => {
    expect(kindFor(true, false)).toBe("blinker");
    expect(kindFor(true, true)).toBe("blinker"); // blinker flag wins
  });

  it("routes the dim blink-subset to the true-0 rectified curve", () => {
    expect(kindFor(false, true)).toBe("dim");
  });

  it("routes the rest of the field to the gentle shimmer", () => {
    expect(kindFor(false, false)).toBe("shimmer");
  });
});

describe("twinkleAlpha — shared (AC2: bounded, deterministic, phase-staggered)", () => {
  it("never returns a value outside [0, 1] for any kind", () => {
    for (const kind of ["blinker", "dim", "shimmer"] as const) {
      for (let i = 0; i < 1000; i++) {
        const v = twinkleAlpha((i / 1000) * Math.PI * 4 - Math.PI, kind);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is a pure function of (theta, kind) — same input, same output", () => {
    expect(twinkleAlpha(2.5, "dim")).toBe(twinkleAlpha(2.5, "dim"));
    expect(twinkleAlpha(2.5, "blinker")).toBe(twinkleAlpha(2.5, "blinker"));
  });

  it("is 2π-periodic so phase offsets stagger the troughs (no whole-field strobe)", () => {
    for (const kind of ["blinker", "dim", "shimmer"] as const) {
      for (const theta of [0.2, 1.1, 4.4]) {
        expect(twinkleAlpha(theta + Math.PI * 2, kind)).toBeCloseTo(
          twinkleAlpha(theta, kind),
          12,
        );
      }
    }
  });
});
