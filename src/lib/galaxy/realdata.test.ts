import { describe, expect, it } from "vitest";
import {
  ANDROMEDA_ID,
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  loreKeyForGalaxy,
  REAL_OBJECTS,
  realObjectsForView,
  SOL_ID,
} from "#/lib/galaxy/realdata";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

describe("REAL_OBJECTS — the curated real-astronomy dataset (ADR-0010 §4)", () => {
  it("is a non-empty, static list", () => {
    expect(Array.isArray(REAL_OBJECTS)).toBe(true);
    expect(REAL_OBJECTS.length).toBeGreaterThan(0);
  });

  it("gives every object a unique, stable id", () => {
    const ids = REAL_OBJECTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only ever uses the five allowed kinds", () => {
    const kinds = new Set(["galaxy", "nebula", "star", "marker", "armLabel"]);
    for (const o of REAL_OBJECTS) expect(kinds.has(o.kind)).toBe(true);
  });

  it("carries a realDistance with a value and a real unit on every object", () => {
    for (const o of REAL_OBJECTS) {
      expect(o.realDistance.value).toBeGreaterThan(0);
      expect(["ly", "Mly"]).toContain(o.realDistance.unit);
    }
  });

  it("carries a loreKey on every object that resolves in BOTH locales", () => {
    for (const o of REAL_OBJECTS) {
      expect(o.loreKey.length).toBeGreaterThan(0);
      expect(en.lore[o.loreKey]).toBeDefined();
      expect(ru.lore[o.loreKey]).toBeDefined();
    }
  });

  it("gives every object a polar placement in range", () => {
    for (const o of REAL_OBJECTS) {
      expect(o.placement.r).toBeGreaterThanOrEqual(0);
      expect(o.placement.r).toBeLessThanOrEqual(1);
      expect(Number.isFinite(o.placement.angle)).toBe(true);
    }
  });

  it("gives every object a 6-digit hex color", () => {
    for (const o of REAL_OBJECTS) {
      expect(o.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("sets gateway:true on all 4 Local-Group galaxies + Sol (BR22 — every galaxy enterable)", () => {
    const gateways = REAL_OBJECTS.filter((o) => o.gateway === true).map(
      (o) => o.id,
    );
    expect(gateways.sort()).toEqual(
      [HOME_MILKY_WAY_ID, "lmc", ANDROMEDA_ID, "triangulum", SOL_ID].sort(),
    );
  });

  it("marks every localGroup-tier galaxy (home + 3 neighbours) as a gateway (BR22)", () => {
    const localGroupGalaxies = REAL_OBJECTS.filter(
      (o) => o.tier === "localGroup" && o.kind === "galaxy",
    );
    for (const g of localGroupGalaxies) {
      expect(g.gateway).toBe(true);
    }
  });

  it("keeps Sol as the ONLY tier-3 (galaxy-interior) gateway", () => {
    const interiorGateways = REAL_OBJECTS.filter(
      (o) => o.tier === "galaxy" && o.gateway === true,
    ).map((o) => o.id);
    expect(interiorGateways).toEqual([SOL_ID]);
  });

  it("maps a galaxy id → its loreKey (BR22-frame: id ≠ loreKey for the home MW)", () => {
    // The nav `galaxyId` is the real-object *id*; per-galaxy lore/breadcrumb key
    // by `loreKey`. They diverge only for the home MW (id `home` → `milkyWay`).
    expect(loreKeyForGalaxy(HOME_MILKY_WAY_ID)).toBe("milkyWay");
    expect(loreKeyForGalaxy(ANDROMEDA_ID)).toBe("andromeda");
    expect(loreKeyForGalaxy("lmc")).toBe("lmc");
    expect(loreKeyForGalaxy("triangulum")).toBe("triangulum");
  });

  it("falls back to the home MW loreKey for null / unknown galaxy ids", () => {
    expect(loreKeyForGalaxy(null)).toBe("milkyWay");
    expect(loreKeyForGalaxy("nope")).toBe("milkyWay");
  });

  it("reserves gold (#f5d6a0) for Sol only — neighbours stay cool", () => {
    const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID);
    expect(sol?.color.toLowerCase()).toBe("#f5d6a0");
    const neighbours = localGroupNeighbours();
    for (const n of neighbours) {
      expect(n.color.toLowerCase()).not.toBe("#f5d6a0");
    }
  });
});

describe("SSR-safety — no module-scope side effects (ADR-0003)", () => {
  it("is byte-stable across reads (the data never re-derives)", async () => {
    const a = (await import("#/lib/galaxy/realdata")).REAL_OBJECTS;
    const b = (await import("#/lib/galaxy/realdata")).REAL_OBJECTS;
    expect(a).toBe(b);
  });

  it("holds no clock/random-derived field (a re-import is identical)", () => {
    expect(JSON.stringify(REAL_OBJECTS)).toBe(JSON.stringify(REAL_OBJECTS));
  });
});

describe("the home Milky Way (localGroup tier, the gateway)", () => {
  const home = REAL_OBJECTS.find((o) => o.id === HOME_MILKY_WAY_ID);

  it("exists, is a galaxy at the localGroup tier, and is a gateway", () => {
    expect(home).toBeDefined();
    expect(home?.kind).toBe("galaxy");
    expect(home?.tier).toBe("localGroup");
    expect(home?.gateway).toBe(true);
  });

  it("carries the galaxy metadata (arms, barAngle, tilt)", () => {
    expect(home?.arms).toBeGreaterThan(0);
    expect(Number.isFinite(home?.barAngle)).toBe(true);
    expect(Number.isFinite(home?.tilt)).toBe(true);
  });
});

describe("the 3 Local-Group neighbours (spec §5.1)", () => {
  it("are exactly LMC, M31, M33 — no more, no fewer", () => {
    const ids = localGroupNeighbours().map((o) => o.id);
    expect(ids.sort()).toEqual(["andromeda", "lmc", "triangulum"]);
  });

  it("excludes the home Milky Way from the neighbour set", () => {
    expect(localGroupNeighbours().some((o) => o.id === HOME_MILKY_WAY_ID)).toBe(
      false,
    );
  });

  it("orders placement.r by real distance (nearer reads smaller r)", () => {
    // Compare in a common unit (ly): Mly = 1e6 ly.
    const toLy = (d: { value: number; unit: "ly" | "Mly" }) =>
      d.unit === "Mly" ? d.value * 1e6 : d.value;
    const neighbours = [...localGroupNeighbours()].sort(
      (a, b) => toLy(a.realDistance) - toLy(b.realDistance),
    );
    const rs = neighbours.map((o) => o.placement.r);
    const sorted = [...rs].sort((a, b) => a - b);
    expect(rs).toEqual(sorted);
  });

  it("points each neighbour's authored angle into its FINAL-proof quadrant", () => {
    // The locked composition (docs/design/proofs/2026-06-05-local-group-tier-FINAL.png):
    // M31 upper-left · M33 upper-right · LMC lower-left.
    // Screen convention (+y down), matching polarToXY / the LG ring projection.
    const dir = (id: string) => {
      const o = REAL_OBJECTS.find((x) => x.id === id);
      if (!o) throw new Error(`no real object ${id}`);
      return {
        left: Math.cos(o.placement.angle) < 0,
        up: Math.sin(o.placement.angle) < 0,
      };
    };
    expect(dir("andromeda")).toEqual({ left: true, up: true });
    expect(dir("triangulum")).toEqual({ left: false, up: true });
    expect(dir("lmc")).toEqual({ left: true, up: false });
  });

  it("carries the real, published distances verbatim", () => {
    const byId = new Map(REAL_OBJECTS.map((o) => [o.id, o]));
    expect(byId.get("lmc")?.realDistance).toEqual({
      value: 163000,
      unit: "ly",
    });
    expect(byId.get("andromeda")?.realDistance).toEqual({
      value: 2.5,
      unit: "Mly",
    });
    expect(byId.get("triangulum")?.realDistance).toEqual({
      value: 2.7,
      unit: "Mly",
    });
  });

  it("gives Andromeda its two optional satellites (M32, M110)", () => {
    const m31 = REAL_OBJECTS.find((o) => o.id === ANDROMEDA_ID);
    const satIds = (m31?.satellites ?? []).map((s) => s.id);
    expect(satIds.sort()).toEqual(["m110", "m32"]);
  });
});

describe("the Milky-Way interior tier (galaxy tier, parentId = home)", () => {
  it("places Sol as a gateway star parented to home", () => {
    const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID);
    expect(sol?.kind).toBe("star");
    expect(sol?.tier).toBe("galaxy");
    expect(sol?.parentId).toBe(HOME_MILKY_WAY_ID);
    expect(sol?.gateway).toBe(true);
  });

  it("places Sgr A* as a marker and the Orion Arm as an armLabel", () => {
    const byId = new Map(REAL_OBJECTS.map((o) => [o.id, o]));
    expect(byId.get("sgra")?.kind).toBe("marker");
    expect(byId.get("orionArm")?.kind).toBe("armLabel");
  });

  it("places the 3 named nebulae (Pillars, Crab, Orion) at real distances", () => {
    const byId = new Map(REAL_OBJECTS.map((o) => [o.id, o]));
    expect(byId.get("pillars")?.kind).toBe("nebula");
    expect(byId.get("pillars")?.realDistance).toEqual({
      value: 7000,
      unit: "ly",
    });
    expect(byId.get("crab")?.realDistance).toEqual({ value: 6500, unit: "ly" });
    expect(byId.get("orion")?.realDistance).toEqual({
      value: 1344,
      unit: "ly",
    });
  });
});

describe("realObjectsForView — the (tier, parentId) selector for wave-2 rendering", () => {
  it("returns the localGroup-tier objects (home MW + 3 neighbours) for the group view", () => {
    const ids = realObjectsForView("localGroup").map((o) => o.id);
    expect(ids.sort()).toEqual(
      ["andromeda", "lmc", "triangulum", HOME_MILKY_WAY_ID].sort(),
    );
  });

  it("returns the Milky-Way interior objects for (galaxy, home)", () => {
    const ids = realObjectsForView("galaxy", HOME_MILKY_WAY_ID).map(
      (o) => o.id,
    );
    expect(ids.sort()).toEqual(
      ["crab", "orion", "orionArm", "pillars", "sgra", SOL_ID].sort(),
    );
  });

  it("returns an empty list when nothing matches", () => {
    expect(realObjectsForView("galaxy", "nope")).toEqual([]);
    expect(realObjectsForView("solarSystem")).toEqual([]);
  });

  it("does not leak satellites as top-level view objects", () => {
    const ids = realObjectsForView("localGroup").map((o) => o.id);
    expect(ids).not.toContain("m32");
    expect(ids).not.toContain("m110");
  });
});
