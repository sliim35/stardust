import { describe, expect, it } from "vitest";
import {
  figureSegments,
  figureState,
  ghostSegments,
} from "#/lib/galaxy/constellation";
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

describe("CONSTELLATIONS — retired prototypes, anchor-model shape (AC8)", () => {
  it("retires the prototype figures (brightDays / quietAche removed)", () => {
    expect("brightDays" in CONSTELLATIONS).toBe(false);
    expect("quietAche" in CONSTELLATIONS).toBe(false);
  });

  it("every entry (if any) satisfies the structural floor: anchors >= 10 && threshold >= 10", () => {
    for (const figure of Object.values(CONSTELLATIONS)) {
      expect(figure.anchors.length).toBeGreaterThanOrEqual(10);
      expect(figure.threshold).toBeGreaterThanOrEqual(10);
    }
  });
});

// ── The Joy smile renders FORMING in the seed sky (#231) ─────────────────────
// The first authored figure: its 3 grouped seed stars (s01/s07/s08) fill the first
// 3 mouth anchors → forming (< 14 members), real lines for the filled run + the
// faint full 11-edge ghost silhouette behind them (BR27).
describe("Joy smile — forms in the seed sky", () => {
  const joy = CONSTELLATIONS.joyful;
  const members = () =>
    buildSeedSky().stars.filter((s) => s.group === "joyful");

  it("the seed groups exactly 3 Joy members (below the 14 threshold)", () => {
    expect(members()).toHaveLength(3);
    expect(members().length).toBeLessThan(joy.threshold);
  });

  it("the figure is FORMING, not finished, with the seed members", () => {
    expect(figureState(members(), joy)).toBe("forming");
  });

  it("draws real connect-lines for the filled run (forming, non-empty)", () => {
    // 3 members fill mouth-0..mouth-2 → the 2 edges between them draw (BR27: only
    // edges whose BOTH endpoints are filled).
    const segs = figureSegments(members(), joy);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs).toHaveLength(2);
  });

  it("draws the faint full ghost silhouette (all 11 mouth edges)", () => {
    expect(ghostSegments(joy)).toHaveLength(joy.edges.length);
    expect(ghostSegments(joy)).toHaveLength(11);
  });
});

describe("buildSeedSky", () => {
  it("seeds a backdrop and at least 3 stars spanning at least 2 moods", () => {
    const sky = buildSeedSky();
    expect(sky.backdrop).toBeDefined();
    expect(sky.stars.length).toBeGreaterThanOrEqual(3);
    expect(new Set(sky.stars.map((s) => s.mood)).size).toBeGreaterThanOrEqual(
      2,
    );
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
      expect(s.r).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.angle)).toBe(true);
      expect(s.brightness).toBeGreaterThanOrEqual(0);
      expect(s.brightness).toBeLessThanOrEqual(1);
    }
  });

  // ── Joy figure membership (#231) ──────────────────────────────────────────
  // The Joy smile is the first designed figure; the joyful seed stars (s01/s07/s08)
  // join its "joyful" group so it renders FORMING. Every other mood stays SOLO until
  // its own silhouette lands; Mom's deep star (irina) is figure-exempt forever.
  it("groups exactly the joyful seed stars into the Joy figure (mood-joyful, non-deep)", () => {
    for (const s of buildSeedSky().stars) {
      if (s.deep) continue;
      const expected = s.mood === "joyful" ? "joyful" : undefined;
      expect(s.group, `star "${s.id}" (${s.mood})`).toBe(expected);
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
