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

/* ── D4 / AC3 — frame fidelity (pixel-exact to the variant-A PNGs) ────────── */

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
 * The four owner-approved variant-A eye override sets — the SOURCE OF TRUTH.
 * Decoded pixel-for-pixel from `stardust/project/astro/expression/astro_A_*_1x.png`
 * (palette: `f5d6a0`→`e` soft amber, `fff6d0`→`E` cream hotspot, `1a2238`→navy `v`).
 * Each frame must reproduce its set exactly, including variant A's slight asymmetry.
 * (Replaces the prior assertions vs the now-wrong `Astro Expression Frames.html`.)
 */
const VARIANT_A_EYES = {
  calm: asSet([
    [2, 5, "e"],
    [2, 6, "e"],
    [3, 5, "e"],
    [3, 7, "e"],
    [3, 9, "e"],
  ]),
  curious: asSet([
    [2, 5, "e"],
    [2, 6, "e"],
    [2, 7, "E"],
    [2, 9, "E"],
    [3, 5, "e"],
    [3, 7, "E"],
    [3, 9, "E"],
  ]),
  happy: asSet([
    [2, 5, "e"],
    [2, 6, "e"],
    [2, 7, "E"],
    [2, 9, "E"],
    [3, 5, "e"],
    [3, 6, "e"],
    [3, 10, "e"],
  ]),
  blink: asSet([
    [2, 5, "e"],
    [2, 6, "e"],
    [3, 5, "e"],
  ]),
} as const;

/** The four moods that have approved variant-A PNG art. */
const PNG_MOODS = ["calm", "curious", "happy", "blink"] as const;
/** The two moods derived best-effort (no approved PNG — pending owner review). */
const DERIVED_MOODS = ["thinking", "tender"] as const;

describe("ASTRO_FRAMES (recreated variant-A expression grids, not copied)", () => {
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

  // ── The four PNG-backed moods reproduce variant A pixel-for-pixel ──────────
  it.each(
    PNG_MOODS,
  )("reproduces variant-A %s eyes exactly (decoded from astro_A_*_1x.png)", (mood) => {
    expect(litEyeCells(ASTRO_FRAMES[mood])).toEqual(VARIANT_A_EYES[mood]);
  });

  it("preserves variant A's slight asymmetry (happy's lone right-side dot at 3,10)", () => {
    // happy is asymmetric: left side has 3,5+3,6 but the right side has only 3,10.
    expect(litEyeCells(ASTRO_FRAMES.happy)).toContain("3,10,e");
    expect(ASTRO_FRAMES.happy[3][6]).toBe("e");
    expect(ASTRO_FRAMES.happy[3][7]).toBe("v");
  });

  it("brightens curious/happy with the hotspot key (E)", () => {
    expect(ASTRO_FRAMES.curious.join("")).toContain("E");
    expect(ASTRO_FRAMES.happy.join("")).toContain("E");
  });

  it("dims blink with the navy band (no E) and tender with the dim key (d)", () => {
    expect(ASTRO_FRAMES.blink.join("")).not.toContain("E");
    expect(ASTRO_FRAMES.tender.join("")).toContain("d");
  });

  // ── The two derived moods: structural invariants only (NOT owner-approved) ──
  it.each(
    DERIVED_MOODS,
  )("keeps every lit cell of derived mood %s inside the eye region (rows 2–4, cols 5–10)", (mood) => {
    const eyeRows = new Set<number>(EYE_ROWS);
    const eyeCols = new Set<number>(EYE_COLS);
    for (let r = 0; r < ASTRO_GRID_SIZE; r++) {
      for (let c = 0; c < ASTRO_GRID_SIZE; c++) {
        const ch = ASTRO_FRAMES[mood][r][c];
        if (ch === "e" || ch === "E" || ch === "d") {
          expect(eyeRows.has(r)).toBe(true);
          expect(eyeCols.has(c)).toBe(true);
        }
      }
    }
  });

  it.each(
    DERIVED_MOODS,
  )("derived mood %s keeps the body + visor frame identical to calm (only eyes derived)", (mood) => {
    const eyeRows = new Set<number>(EYE_ROWS);
    for (let r = 0; r < ASTRO_GRID_SIZE; r++) {
      if (eyeRows.has(r)) continue;
      expect(ASTRO_FRAMES[mood][r]).toBe(ASTRO_FRAMES.calm[r]);
    }
  });

  it("derives thinking from calm's amber lights drifted up & aside (subtle, pure amber)", () => {
    // No PNG exists — assert only the design intent: pure amber `e`, eyes lifted
    // to row 2, none of curious/happy's bright `E` hotspot.
    expect(ASTRO_FRAMES.thinking.join("")).toContain("e");
    expect(ASTRO_FRAMES.thinking.join("")).not.toContain("E");
    expect(ASTRO_FRAMES.thinking[2]).toContain("e");
  });

  it("derives tender as lowered, dim half-lidded eyes (d over e, downcast)", () => {
    // No PNG exists — assert only the design intent: dim `d` lids sit above the
    // lowered `e` lights (row 4), the lowest eye row of any mood.
    expect(ASTRO_FRAMES.tender.join("")).toContain("d");
    expect(ASTRO_FRAMES.tender[4]).toContain("e");
    expect(ASTRO_FRAMES.tender.join("")).not.toContain("E");
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
