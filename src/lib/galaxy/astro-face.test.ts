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

/* ── D4 / AC3 — frame fidelity ───────────────────────────────────────────── */

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
    const EYE_ROWS = new Set([2, 3, 4]);
    const calm = ASTRO_FRAMES.calm;
    for (const mood of ASTRO_MOODS) {
      const grid = ASTRO_FRAMES[mood];
      for (let r = 0; r < ASTRO_GRID_SIZE; r++) {
        if (EYE_ROWS.has(r)) continue;
        expect(grid[r]).toBe(calm[r]);
      }
    }
  });

  it("shares the locked body (rows 6+) with the #70 idle pose", () => {
    // Below the visor the emotion frames and the idle sprite are the same figure.
    for (let r = 6; r < ASTRO_GRID_SIZE; r++) {
      expect(ASTRO_FRAMES.calm[r]).toBe(ASTRO_IDLE[r]);
    }
  });

  it("keeps the visor band clean navy in calm with two soft eye-lights (e)", () => {
    // calm = two level eye-lights inside the dark `v` band (canonical source).
    const flat = ASTRO_FRAMES.calm.join("");
    expect(flat).toContain("e");
  });

  it("brightens curious/happy with the hotspot key (E)", () => {
    expect(ASTRO_FRAMES.curious.join("")).toContain("E");
    expect(ASTRO_FRAMES.happy.join("")).toContain("E");
  });

  it("dims blink + tender with the dim eye-glow key (d)", () => {
    expect(ASTRO_FRAMES.blink.join("")).toContain("d");
    expect(ASTRO_FRAMES.tender.join("")).toContain("d");
  });

  it("sets curious eyes higher than calm (row 2 lights, taller open)", () => {
    // curious is wide-open: bright cells reach up into row 2 where calm has none.
    expect(ASTRO_FRAMES.curious[2]).toContain("E");
    expect(ASTRO_FRAMES.calm[2]).not.toMatch(/[eEd]/);
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
