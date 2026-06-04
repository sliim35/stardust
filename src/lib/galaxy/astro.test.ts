import { describe, expect, it } from "vitest";
import {
  ASTRO_GRID_SIZE,
  ASTRO_IDLE,
  ASTRO_PALETTE_KEYS,
  ASTRO_TRANSPARENT,
  ASTRO_TRIM_KEY,
  ASTRO_VISOR_GLOW_KEY,
  BOB_CYCLE_MS,
  BOB_PEAK_ROTATE_DEG,
  BOB_PEAK_TRANSLATE_PX,
  bobTransform,
  DEFAULT_CELL_PX,
  DRIFT_CYCLE_MS,
  parseSprite,
} from "#/lib/galaxy/astro";

describe("ASTRO_IDLE grid (recreated STARLIGHT output, not copied)", () => {
  it("is a 16×16 char grid", () => {
    expect(ASTRO_IDLE).toHaveLength(ASTRO_GRID_SIZE);
    for (const row of ASTRO_IDLE) expect(row).toHaveLength(ASTRO_GRID_SIZE);
  });

  it("uses only known palette keys or the transparent marker", () => {
    const allowed = new Set<string>([ASTRO_TRANSPARENT, ...ASTRO_PALETTE_KEYS]);
    for (const row of ASTRO_IDLE) {
      for (const ch of row) expect(allowed.has(ch)).toBe(true);
    }
  });

  it("carries the single amber accent (visor-glow V + trim t are present)", () => {
    const flat = ASTRO_IDLE.join("");
    expect(flat).toContain(ASTRO_VISOR_GLOW_KEY);
    expect(flat).toContain(ASTRO_TRIM_KEY);
  });
});

describe("parseSprite", () => {
  // A tiny resolver: every key maps to a sentinel color so we can assert mapping
  // without depending on the real token hexes.
  const resolve = (key: string) => `color-${key}`;

  it("skips transparent (.) cells and emits one cell per painted char", () => {
    const grid = ["..", ".s"] as const;
    expect(parseSprite(grid, resolve)).toEqual([
      { x: 1, y: 1, color: "color-s" },
    ]);
  });

  it("maps each painted char through the resolver, preserving x/y", () => {
    expect(parseSprite(["sh"], resolve)).toEqual([
      { x: 0, y: 0, color: "color-s" },
      { x: 1, y: 0, color: "color-h" },
    ]);
  });

  it("is deterministic — same grid yields the same cells in the same order", () => {
    const a = parseSprite(ASTRO_IDLE, resolve);
    const b = parseSprite(ASTRO_IDLE, resolve);
    expect(a).toEqual(b);
  });

  it("emits one cell per non-transparent char in the idle grid", () => {
    const painted = ASTRO_IDLE.join("").replace(/\./g, "").length;
    expect(parseSprite(ASTRO_IDLE, resolve)).toHaveLength(painted);
  });

  it("scans in row-major (y outer, x inner) order", () => {
    const cells = parseSprite(ASTRO_IDLE, resolve);
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1];
      const cur = cells[i];
      const before = prev.y < cur.y || (prev.y === cur.y && prev.x < cur.x);
      expect(before).toBe(true);
    }
  });

  it("drops cells whose resolver returns null/undefined (unknown char handling)", () => {
    const partial = (key: string) => (key === "s" ? "color-s" : null);
    // "z" is not a known key → resolver returns null → cell is dropped.
    expect(parseSprite(["sz"], partial)).toEqual([
      { x: 0, y: 0, color: "color-s" },
    ]);
  });
});

describe("bob animation curve (pure, unit-testable timing)", () => {
  it("rests at the cycle endpoints (0 and 1)", () => {
    expect(bobTransform(0)).toEqual({ translateY: 0, rotate: 0 });
    expect(bobTransform(1)).toEqual({ translateY: 0, rotate: 0 });
  });

  it("reaches the spec peak at the midpoint (-6px / -1.5deg)", () => {
    expect(bobTransform(0.5)).toEqual({
      translateY: BOB_PEAK_TRANSLATE_PX,
      rotate: BOB_PEAK_ROTATE_DEG,
    });
  });

  it("locks the spec's canonical peak values", () => {
    expect(BOB_PEAK_TRANSLATE_PX).toBe(-6);
    expect(BOB_PEAK_ROTATE_DEG).toBe(-1.5);
  });

  it("rises (lifts up) through the first half of the cycle", () => {
    // translateY is negative = upward; it should decrease toward the peak.
    expect(bobTransform(0.25).translateY).toBeLessThan(0);
    expect(bobTransform(0.25).translateY).toBeGreaterThan(
      BOB_PEAK_TRANSLATE_PX,
    );
  });
});

describe("layout constants", () => {
  it("renders 16 cells at 4 logical px = a 64px box", () => {
    expect(DEFAULT_CELL_PX).toBe(4);
    expect(ASTRO_GRID_SIZE * DEFAULT_CELL_PX).toBe(64);
  });

  // The lib timing constants and the CSS animation durations are one number split
  // across two files: `astro-bob 4s` / `astro-drift 9s` in src/styles.css must equal
  // these (ms → s). This pins the pairing so a change to one side fails here until the
  // other is updated — the silent-drift class of bug flagged on #49 (IGNITE_MS vs CSS).
  it("keeps the bob/drift timings paired with the CSS @keyframes durations", () => {
    expect(BOB_CYCLE_MS).toBe(4000); // ↔ `animation: astro-bob 4s` (styles.css)
    expect(DRIFT_CYCLE_MS).toBe(9000); // ↔ `animation: astro-drift 9s` (styles.css)
  });
});
