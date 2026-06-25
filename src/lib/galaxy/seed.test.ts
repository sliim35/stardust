import { describe, expect, it } from "vitest";
import {
  buildSeedSky,
  CONSTELLATIONS,
  EMOTION_GALAXY,
  EMOTION_VALUES,
  hostGalaxyFor,
  isMood,
  MOOD_VALUES,
  MOODS,
  placeStar,
} from "#/lib/galaxy/seed";
import { en } from "#/lib/i18n/messages/en";

describe("EMOTION_VALUES / MOOD_VALUES", () => {
  it("covers exactly the keys of MOODS (single source — no drift)", () => {
    expect([...EMOTION_VALUES].sort()).toEqual(Object.keys(MOODS).sort());
  });

  it("widened to all 12 emotions", () => {
    expect(EMOTION_VALUES).toHaveLength(12);
  });

  it("MOOD_VALUES is the back-compat alias of EMOTION_VALUES (same 12 literals)", () => {
    expect([...MOOD_VALUES].sort()).toEqual([...EMOTION_VALUES].sort());
  });

  it("isMood accepts every literal (all 12) and rejects anything else", () => {
    for (const emotion of EMOTION_VALUES) expect(isMood(emotion)).toBe(true);
    expect(isMood("ecstatic")).toBe(false);
    expect(isMood("")).toBe(false);
    expect(isMood(null)).toBe(false);
    expect(isMood(42)).toBe(false);
  });

  it("includes the 5 new emotions", () => {
    for (const e of ["hope", "gratitude", "courage", "pride", "longing"]) {
      expect((EMOTION_VALUES as readonly string[]).includes(e)).toBe(true);
    }
  });
});

describe("EMOTION_GALAXY — the emotion→host-galaxy partition (BR26)", () => {
  const GALAXY_IDS = new Set(["home", "andromeda", "triangulum", "lmc"]);

  it("is exhaustive over all 12 emotions", () => {
    expect(Object.keys(EMOTION_GALAXY)).toHaveLength(12);
    expect([...EMOTION_VALUES].sort()).toEqual(
      Object.keys(EMOTION_GALAXY).sort(),
    );
  });

  it("every value is a real galaxy id present in realdata.ts", () => {
    for (const id of Object.values(EMOTION_GALAXY)) {
      expect(GALAXY_IDS.has(id)).toBe(true);
    }
  });

  it("hostGalaxyFor returns a non-null galaxy id for every emotion", () => {
    for (const e of EMOTION_VALUES) {
      const galaxy = hostGalaxyFor(e);
      expect(galaxy).toBeTruthy();
      expect(GALAXY_IDS.has(galaxy)).toBe(true);
    }
  });

  it("matches the owner-approved partition (ADR-0014 §3)", () => {
    expect(EMOTION_GALAXY).toEqual({
      joyful: "home",
      tender: "home",
      grieving: "home",
      wonder: "andromeda",
      nostalgic: "andromeda",
      hope: "andromeda",
      peaceful: "triangulum",
      wistful: "triangulum",
      gratitude: "triangulum",
      courage: "lmc",
      pride: "lmc",
      longing: "lmc",
    });
  });
});

describe("CONSTELLATIONS — the 12 authored figures, anchor-model shape", () => {
  it("retires the prototype figures (brightDays / quietAche removed)", () => {
    expect("brightDays" in CONSTELLATIONS).toBe(false);
    expect("quietAche" in CONSTELLATIONS).toBe(false);
  });

  it("authors exactly one figure per emotion (all 12)", () => {
    expect(Object.keys(CONSTELLATIONS).sort()).toEqual(
      [...EMOTION_VALUES].sort(),
    );
    for (const e of EMOTION_VALUES) {
      expect(CONSTELLATIONS[e].emotion).toBe(e);
      expect(CONSTELLATIONS[e].group).toBe(e);
    }
  });

  it("every entry pins the BR27 contract: EXACTLY 10 anchors && threshold === anchor count", () => {
    for (const figure of Object.values(CONSTELLATIONS)) {
      expect(figure.anchors.length).toBe(10);
      expect(figure.threshold).toBe(figure.anchors.length);
    }
  });

  it("hosts each figure in the emotion's partition galaxy (BR26)", () => {
    for (const figure of Object.values(CONSTELLATIONS)) {
      expect(figure.hostGalaxyId).toBe(hostGalaxyFor(figure.emotion));
    }
  });
});

describe("buildSeedSky", () => {
  it("seeds a backdrop and ONLY Mom's lone star (the rest comes from D1)", () => {
    const sky = buildSeedSky();
    expect(sky.backdrop).toBeDefined();
    expect(sky.stars).toHaveLength(1);
    expect(sky.stars[0]?.id).toBe("irina");
    expect(sky.stars[0]?.deep).toBe(true);
  });

  it("defaults the backdrop palette to ember", () => {
    expect(buildSeedSky().backdrop.palette).toBe("ember");
  });

  it("is deterministic — no module-scope random or clock (same output every call)", () => {
    expect(buildSeedSky()).toEqual(buildSeedSky());
  });

  it("uses fixed backdated createdAt (no Date.now at seed time)", () => {
    expect(buildSeedSky().stars.map((s) => s.createdAt)).toEqual(
      buildSeedSky().stars.map((s) => s.createdAt),
    );
  });

  it("includes the deep 'fly-home' star (Mom's lone gold star)", () => {
    const stars = buildSeedSky().stars;
    expect(stars.some((s) => s.deep === true)).toBe(true);
  });

  it("retires the hidden egg star — exactly ONE 'for mom' star remains", () => {
    const stars = buildSeedSky().stars;
    expect(stars.some((s) => s.id === "egg")).toBe(false);
    expect(stars.some((s) => s.egg === true)).toBe(false);
  });

  it("colors seed memory stars from the mood map (agent palette)", () => {
    for (const s of buildSeedSky().stars) {
      if (s.egg || s.deep) continue;
      expect(s.color).toBe(MOODS[s.mood].color);
    }
  });

  it("keeps every star within valid ranges", () => {
    for (const s of buildSeedSky().stars) {
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.r).toBeGreaterThanOrEqual(0);
      // Disk-tier stars are normalised to the disk radius (r ≤ 1). A Solar-System
      // star may sit in the void BEYOND the ring ladder (Mom, upper-right corner —
      // r > 1; owner 2026-06-25), so only the disk normalisation is capped here.
      if (s.placement?.tier !== "solarSystem") {
        expect(s.r).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(s.angle)).toBe(true);
      expect(s.brightness).toBeGreaterThanOrEqual(0);
      expect(s.brightness).toBeLessThanOrEqual(1);
    }
  });

  // ── Figure membership (ADR-0014 §2) ───────────────────────────────────────
  // The seed carries no grouped stars now — figures form only from D1 memories.
  it("seeds NO grouped stars — figures form only from D1 memories (Mom stays solo)", () => {
    for (const s of buildSeedSky().stars) {
      expect(s.group).toBeUndefined();
    }
  });

  it("keeps Mom's gold star (irina) UNGROUPED and standalone (ADR-0010 §1)", () => {
    const irina = buildSeedSky().stars.find((s) => s.id === "irina");
    expect(irina).toBeDefined();
    expect(irina?.group).toBeUndefined();
  });

  it("makes Mom's star the biggest + brightest of the whole sky", () => {
    const stars = buildSeedSky().stars;
    const irina = stars.find((s) => s.id === "irina");
    expect(irina?.brightness).toBe(Math.max(...stars.map((s) => s.brightness)));
    for (const s of stars) {
      if (s.id === "irina") continue;
      expect(irina?.brightness).toBeGreaterThanOrEqual(s.brightness);
    }
  });

  // ── i18n content (ADR-0010 §4 — no inline user-facing strings) ───────────────
  it("resolves each seeded memory star's name + text from the i18n catalog (en source)", () => {
    for (const s of buildSeedSky().stars) {
      const copy = en.memoryStars[s.id as keyof typeof en.memoryStars];
      expect(copy, `catalog entry for "${s.id}"`).toBeDefined();
      expect(s.text).toBe(copy.text);
      if (s.name !== undefined) expect(s.name).toBe(copy.name);
    }
  });
});

describe("placeStar", () => {
  it("derives (r, angle) deterministically from the id", () => {
    expect(placeStar("s01", "joyful")).toEqual(placeStar("s01", "joyful"));
  });

  it("places different ids at different positions", () => {
    expect(placeStar("s01", "joyful")).not.toEqual(placeStar("s02", "joyful"));
  });

  it("places a star within its mood's angular wedge, r in 0..1", () => {
    const m = MOODS.peaceful;
    const { r, angle } = placeStar("xyz", "peaceful");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(Math.abs(angle - m.angle)).toBeLessThanOrEqual(m.spread / 2 + 1e-9);
  });

  it("places a star in a NEW (12-emotion) wedge too", () => {
    const m = MOODS.courage;
    const { r, angle } = placeStar("xyz", "courage");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(Math.abs(angle - m.angle)).toBeLessThanOrEqual(m.spread / 2 + 1e-9);
  });
});
