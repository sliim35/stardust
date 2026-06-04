import { describe, expect, it } from "vitest";
import {
  ASTRO_FRAMES,
  ASTRO_GRID_SIZE,
  ASTRO_IDLE,
  ASTRO_MOODS,
  ASTRO_PALETTE_KEYS,
  ASTRO_TRANSPARENT,
  type AstroMood,
  BLINK_DIP_MS,
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  CLICK_MOOD_CYCLE,
  DEFAULT_MOOD,
  EMOTE_SETTLE_MS,
  nextBlinkDelay,
  nextClickMood,
} from "#/lib/galaxy/astro";

/* ── D4 / AC3 — frame fidelity (exact to the showcase `build()` overrides) ── */

/**
 * The eye region is rows 2–4 × cols 5–10 (0-indexed) on the locked clean-navy
 * figure. Outside it every cell is the body/helmet/clean-navy visor and is
 * byte-identical across moods.
 */
const EYE_ROWS = [2, 3, 4] as const;
const EYE_COLS = [5, 6, 7, 8, 9, 10] as const;
/** The navy visor key — an eye cell holding `v` is "off" (no light). */
const VISOR_KEY = "v";

/** Every lit (non-navy) eye cell of a frame as a `r,c,key` set, sorted. */
const litEyeCells = (grid: readonly string[]): string[] => {
  const out: string[] = [];
  for (const r of EYE_ROWS) {
    for (const c of EYE_COLS) {
      const ch = grid[r][c];
      if (ch !== VISOR_KEY) out.push(`${r},${c},${ch}`);
    }
  }
  return out.sort();
};

const asSet = (cells: readonly [number, number, string][]): string[] =>
  cells.map(([r, c, k]) => `${r},${c},${k}`).sort();

/**
 * The six owner-approved eye override sets — the SOURCE OF TRUTH, taken EXACTLY
 * from the showcase `Astro Expression Frames.html` `build()` overrides (the
 * six-mood "glowing pixel-eyes" reference; the variant-A PNGs were the previous,
 * wrong reference and are superseded). Coordinates are `[row, col, char]`,
 * 0-indexed, painted over the locked clean-navy visor band. SHAPE comes from the
 * showcase; the eye COLOR wiring (`e`/`E`/`d` → the live accent derivations) is
 * kept as-is, so the showcase's fixed amber renders accent-colored here — same
 * shapes, sky-tinted eyes.
 */
const SHOWCASE_EYES = {
  calm: asSet([
    [3, 6, "e"],
    [3, 9, "e"],
  ]),
  curious: asSet([
    [2, 6, "E"],
    [3, 6, "E"],
    [2, 9, "E"],
    [3, 9, "E"],
  ]),
  thinking: asSet([
    [2, 6, "e"],
    [2, 8, "e"],
  ]),
  happy: asSet([
    [3, 5, "E"],
    [2, 6, "E"],
    [3, 7, "E"],
    [3, 8, "E"],
    [2, 9, "E"],
    [3, 10, "E"],
  ]),
  tender: asSet([
    [3, 6, "d"],
    [3, 9, "d"],
    [4, 6, "e"],
    [4, 9, "e"],
  ]),
  blink: asSet([
    [3, 6, "d"],
    [3, 7, "d"],
    [3, 8, "d"],
    [3, 9, "d"],
  ]),
} as const;

describe("ASTRO_FRAMES (recreated showcase expression grids, not copied)", () => {
  it("covers exactly the six owner-approved moods", () => {
    expect(Object.keys(ASTRO_FRAMES).sort()).toEqual([...ASTRO_MOODS].sort());
    expect(ASTRO_MOODS).toEqual([
      "calm",
      "blink",
      "curious",
      "happy",
      "thinking",
      "tender",
    ]);
  });

  it("renders every mood as a 16×16 char grid", () => {
    for (const mood of ASTRO_MOODS) {
      const grid = ASTRO_FRAMES[mood];
      expect(grid).toHaveLength(ASTRO_GRID_SIZE);
      for (const row of grid) expect(row).toHaveLength(ASTRO_GRID_SIZE);
    }
  });

  it("uses only known palette keys or the transparent marker", () => {
    const allowed = new Set<string>([ASTRO_TRANSPARENT, ...ASTRO_PALETTE_KEYS]);
    for (const mood of ASTRO_MOODS) {
      for (const row of ASTRO_FRAMES[mood]) {
        for (const ch of row) expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("never shifts the figure — only the eye band (rows 2–4) differs between moods", () => {
    // Everything OUTSIDE the eye region must be byte-identical to `calm` in every
    // frame (the recreate mandate: the figure never moves, only the eyes change).
    const eyeRows = new Set<number>(EYE_ROWS);
    const calm = ASTRO_FRAMES.calm;
    for (const mood of ASTRO_MOODS) {
      const grid = ASTRO_FRAMES[mood];
      for (let r = 0; r < ASTRO_GRID_SIZE; r++) {
        if (eyeRows.has(r)) continue;
        expect(grid[r]).toBe(calm[r]);
      }
    }
  });

  it("keeps the clean-navy visor frame (cols 4 & 11 are helmet) in every eye row", () => {
    // The eye region is cols 5–10; cols 4/11 stay helmet, cols 12+ transparent.
    for (const mood of ASTRO_MOODS) {
      for (const r of EYE_ROWS) {
        const row = ASTRO_FRAMES[mood][r];
        expect(row[4]).toBe("h");
        expect(row[11]).toBe("h");
      }
    }
  });

  it("shares the locked body (rows 6+) with the #70 idle pose", () => {
    // Below the visor the emotion frames and the idle sprite are the same figure.
    for (let r = 6; r < ASTRO_GRID_SIZE; r++) {
      expect(ASTRO_FRAMES.calm[r]).toBe(ASTRO_IDLE[r]);
    }
  });

  // ── Every mood reproduces its showcase `build()` overrides exactly ─────────
  // thinking/tender are now FIRST-CLASS (they ship in the showcase) — no longer
  // "derived / pending owner review", asserted with exact expected cells.
  it.each([
    ...ASTRO_MOODS,
  ])("reproduces the showcase %s eyes exactly (from the html build() overrides)", (mood) => {
    expect(litEyeCells(ASTRO_FRAMES[mood])).toEqual(SHOWCASE_EYES[mood]);
  });

  it("keeps every lit cell inside the eye region (rows 2–4, cols 5–10) for every mood", () => {
    const eyeRows = new Set<number>(EYE_ROWS);
    const eyeCols = new Set<number>(EYE_COLS);
    for (const mood of ASTRO_MOODS) {
      for (let r = 0; r < ASTRO_GRID_SIZE; r++) {
        for (let c = 0; c < ASTRO_GRID_SIZE; c++) {
          const ch = ASTRO_FRAMES[mood][r][c];
          if (ch === "e" || ch === "E" || ch === "d") {
            expect(eyeRows.has(r)).toBe(true);
            expect(eyeCols.has(c)).toBe(true);
          }
        }
      }
    }
  });

  it("brightens curious/happy with the hotspot key (E)", () => {
    expect(ASTRO_FRAMES.curious.join("")).toContain("E");
    expect(ASTRO_FRAMES.happy.join("")).toContain("E");
  });

  it("dims blink + tender with the dim key (d), and keeps no E in either", () => {
    expect(ASTRO_FRAMES.blink.join("")).toContain("d");
    expect(ASTRO_FRAMES.blink.join("")).not.toContain("E");
    expect(ASTRO_FRAMES.tender.join("")).toContain("d");
    expect(ASTRO_FRAMES.tender.join("")).not.toContain("E");
  });

  it("keeps happy symmetric (∧∧ upward squint) across the visor centre", () => {
    // happy's upper hotspots sit at 2,6 + 2,9 and the lower row spans 3,5..3,10
    // symmetrically — the showcase's symmetric ∧∧ shape (no lone asymmetric dot).
    expect(litEyeCells(ASTRO_FRAMES.happy)).toEqual(
      asSet([
        [3, 5, "E"],
        [2, 6, "E"],
        [3, 7, "E"],
        [3, 8, "E"],
        [2, 9, "E"],
        [3, 10, "E"],
      ]),
    );
  });

  it("lifts thinking's pair up to row 2, drifted aside (subtle, no bright E)", () => {
    expect(ASTRO_FRAMES.thinking.join("")).toContain("e");
    expect(ASTRO_FRAMES.thinking.join("")).not.toContain("E");
    expect(litEyeCells(ASTRO_FRAMES.thinking)).toEqual(
      asSet([
        [2, 6, "e"],
        [2, 8, "e"],
      ]),
    );
  });

  it("renders tender as half-lidded dim lids (d) over lowered soft lights (e)", () => {
    // dim `d` half-lids on row 3 sit above the lowered soft `e` lights on row 4.
    expect(ASTRO_FRAMES.tender[3]).toContain("d");
    expect(ASTRO_FRAMES.tender[4]).toContain("e");
    expect(litEyeCells(ASTRO_FRAMES.tender)).toEqual(
      asSet([
        [3, 6, "d"],
        [3, 9, "d"],
        [4, 6, "e"],
        [4, 9, "e"],
      ]),
    );
  });
});

/* ── AC2 — click → emotion cycle (pure rotation) ─────────────────────────── */

describe("nextClickMood (deterministic click rotation)", () => {
  it("opens on the first click mood from the resting/unknown state", () => {
    expect(nextClickMood(null)).toBe(CLICK_MOOD_CYCLE[0]);
    expect(nextClickMood("calm")).toBe(CLICK_MOOD_CYCLE[0]);
    expect(nextClickMood("blink")).toBe(CLICK_MOOD_CYCLE[0]);
  });

  it("advances through the cycle, wrapping at the end", () => {
    let mood: AstroMood = nextClickMood(null);
    expect(mood).toBe(CLICK_MOOD_CYCLE[0]);
    for (let i = 1; i < CLICK_MOOD_CYCLE.length; i++) {
      mood = nextClickMood(mood);
      expect(mood).toBe(CLICK_MOOD_CYCLE[i]);
    }
    // wraps back to the first
    expect(nextClickMood(mood)).toBe(CLICK_MOOD_CYCLE[0]);
  });

  it("never returns calm/blink — only situational click moods", () => {
    let mood: AstroMood = nextClickMood(null);
    for (let i = 0; i < CLICK_MOOD_CYCLE.length * 2; i++) {
      expect(mood).not.toBe("calm");
      expect(mood).not.toBe("blink");
      mood = nextClickMood(mood);
    }
  });

  it("always changes the visible mood (no repeat in a row)", () => {
    let mood: AstroMood = nextClickMood(null);
    for (let i = 0; i < CLICK_MOOD_CYCLE.length * 2; i++) {
      const next = nextClickMood(mood);
      expect(next).not.toBe(mood);
      mood = next;
    }
  });

  it("the click cycle is the situational set (curious/happy/thinking/tender)", () => {
    expect([...CLICK_MOOD_CYCLE].sort()).toEqual(
      ["curious", "happy", "tender", "thinking"].sort(),
    );
  });
});

/* ── AC1 — blink scheduler (jittered, never a metronome) ─────────────────── */

describe("nextBlinkDelay (jittered idle-blink interval)", () => {
  it("returns the minimum when rand = 0", () => {
    expect(nextBlinkDelay(() => 0)).toBe(BLINK_MIN_MS);
  });

  it("returns just under the maximum as rand → 1", () => {
    // rand is [0,1); at the top end the delay approaches BLINK_MAX_MS.
    expect(nextBlinkDelay(() => 0.999999)).toBeGreaterThan(BLINK_MAX_MS - 10);
    expect(nextBlinkDelay(() => 0.999999)).toBeLessThanOrEqual(BLINK_MAX_MS);
  });

  it("stays within the 4–8s window for any rand in [0,1)", () => {
    for (const v of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.9999]) {
      const d = nextBlinkDelay(() => v);
      expect(d).toBeGreaterThanOrEqual(BLINK_MIN_MS);
      expect(d).toBeLessThanOrEqual(BLINK_MAX_MS);
    }
  });

  it("is not a metronome — different rand yields different delays", () => {
    expect(nextBlinkDelay(() => 0.2)).not.toBe(nextBlinkDelay(() => 0.8));
  });

  it("locks the spec's blink-timing constants", () => {
    expect(BLINK_MIN_MS).toBe(4000); // every 4–8 s
    expect(BLINK_MAX_MS).toBe(8000);
    expect(BLINK_DIP_MS).toBe(120); // ~120 ms dip
    expect(BLINK_MIN_MS).toBeLessThan(BLINK_MAX_MS);
  });
});

/* ── AC2 — settle constant + default mood ────────────────────────────────── */

describe("emotion-state constants", () => {
  it("rests on calm by default (~95% of the time)", () => {
    expect(DEFAULT_MOOD).toBe("calm");
  });

  it("settles a click emote back to calm after ~5 s", () => {
    expect(EMOTE_SETTLE_MS).toBe(5000);
  });
});
