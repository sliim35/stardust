import { describe, expect, it, vi } from "vitest";
import { ANDROMEDA_ID } from "#/lib/galaxy/realdata";
import {
  buildLocalGroup,
  HOME_GALAXY_ID,
  starsForView,
} from "#/lib/galaxy/scenegraph";
import { createInMemoryStore } from "#/lib/galaxy/store";
import type { GalaxySky, MemoryStar } from "#/lib/galaxy/types";

const sampleStar = (over: Partial<MemoryStar> = {}): MemoryStar => {
  return {
    id: "new-1",
    text: "a new memory",
    mood: "wonder",
    color: "#abcdef",
    r: 0.5,
    angle: 1,
    brightness: 0.7,
    createdAt: 123,
    ...over,
  };
};

describe("createInMemoryStore", () => {
  it("exposes getSky and addStar", () => {
    const store = createInMemoryStore();
    expect(typeof store.getSky).toBe("function");
    expect(typeof store.addStar).toBe("function");
  });

  it("seeds a backdrop and ONLY Mom's star (the rest comes from D1)", () => {
    const sky = createInMemoryStore().getSky();
    expect(sky.backdrop).toBeDefined();
    expect(sky.stars).toHaveLength(1);
    expect(sky.stars[0]?.deep).toBe(true);
  });

  it("appends a star: length grows by one and the new star is present", () => {
    const store = createInMemoryStore();
    const before = store.getSky().stars.length;
    store.addStar(sampleStar({ id: "n42" }));
    const after = store.getSky().stars;
    expect(after).toHaveLength(before + 1);
    expect(after.some((s) => s.id === "n42")).toBe(true);
  });

  it("never moves existing stars when a new one is added (the core invariant)", () => {
    const store = createInMemoryStore();
    const before = store
      .getSky()
      .stars.map((s) => ({ id: s.id, r: s.r, angle: s.angle }));
    store.addStar(sampleStar({ id: "intruder", r: 0.11, angle: 0.11 }));
    const afterById = new Map(store.getSky().stars.map((s) => [s.id, s]));
    for (const prev of before) {
      const now = afterById.get(prev.id);
      expect(now).toBeDefined();
      expect(now?.r).toBe(prev.r);
      expect(now?.angle).toBe(prev.angle);
    }
  });

  it("passes the added star's color through unchanged (no UI recolor)", () => {
    const store = createInMemoryStore();
    store.addStar(sampleStar({ id: "c1", mood: "joyful", color: "#123456" }));
    const star = store.getSky().stars.find((s) => s.id === "c1");
    expect(star?.color).toBe("#123456"); // not snapped to the joyful mood color
  });

  it("accepts an explicit initial sky", () => {
    const initial: GalaxySky = {
      backdrop: {
        seed: 1,
        branches: 2,
        spin: 0,
        randomnessPower: 2,
        palette: "ice",
      },
      stars: [],
    };
    const store = createInMemoryStore(initial);
    expect(store.getSky().backdrop.palette).toBe("ice");
    expect(store.getSky().stars).toHaveLength(0);
  });

  it("getSky returns a snapshot — mutating it cannot move stored stars", () => {
    const store = createInMemoryStore();
    const snap = store.getSky();
    const n = snap.stars.length;
    snap.stars.push(sampleStar({ id: "ghost" }));
    expect(store.getSky().stars).toHaveLength(n);
  });

  it("getSky is a deep snapshot — mutating a returned star cannot change stored state", () => {
    const store = createInMemoryStore();
    const first = store.getSky().stars[0];
    const originalAngle = first.angle;
    first.angle = originalAngle + 99; // try to move a stored star by reference
    first.color = "#000000";
    const after = store.getSky().stars[0];
    expect(after.angle).toBe(originalAngle);
    expect(after.color).not.toBe("#000000");
  });

  it("getSky is a deep snapshot — mutating the returned backdrop cannot change stored state", () => {
    const store = createInMemoryStore();
    const originalSeed = store.getSky().backdrop.seed;
    store.getSky().backdrop.seed = originalSeed + 1; // try to mutate stored backdrop
    expect(store.getSky().backdrop.seed).toBe(originalSeed);
  });

  it("owns its copy — mutating the caller's initial sky after construction never leaks in", () => {
    const initial: GalaxySky = {
      backdrop: {
        seed: 1,
        branches: 2,
        spin: 0,
        randomnessPower: 2,
        palette: "ice",
      },
      stars: [sampleStar({ id: "seed-0", color: "#111111" })],
    };
    const store = createInMemoryStore(initial);
    initial.backdrop.seed = 999;
    initial.stars[0].color = "#999999";
    expect(store.getSky().backdrop.seed).toBe(1);
    expect(store.getSky().stars[0].color).toBe("#111111");
  });

  it("does not mutate a caller-supplied initial sky when adding stars", () => {
    const initial: GalaxySky = {
      backdrop: {
        seed: 1,
        branches: 2,
        spin: 0,
        randomnessPower: 2,
        palette: "ice",
      },
      stars: [],
    };
    const store = createInMemoryStore(initial);
    store.addStar(sampleStar({ id: "x" }));
    expect(initial.stars).toHaveLength(0);
  });

  it("notifies subscribers when a star is added, and stops after unsubscribe", () => {
    const store = createInMemoryStore();
    const fn = vi.fn();
    const unsub = store.subscribe?.(fn);
    store.addStar(sampleStar({ id: "sub1" }));
    expect(fn).toHaveBeenCalledTimes(1);
    unsub?.();
    store.addStar(sampleStar({ id: "sub2" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("constructs deterministically (SSR-safe — no random/clock at construction)", () => {
    expect(createInMemoryStore().getSky()).toEqual(
      createInMemoryStore().getSky(),
    );
  });
});

describe("createInMemoryStore — universe seam (ADR-0008)", () => {
  it("exposes getUniverse, skyFor and starsForView", () => {
    const store = createInMemoryStore();
    expect(typeof store.getUniverse).toBe("function");
    expect(typeof store.skyFor).toBe("function");
    expect(typeof store.starsForView).toBe("function");
  });

  it("getUniverse derives the local group with a home galaxy", () => {
    const u = createInMemoryStore().getUniverse?.();
    expect(u?.localGroup.galaxies.some((g) => g.id === HOME_GALAXY_ID)).toBe(
      true,
    );
  });

  it("getUniverse defaults every home-galaxy star to a home placement", () => {
    const u = createInMemoryStore().getUniverse?.();
    const home = u?.localGroup.galaxies.find((g) => g.id === HOME_GALAXY_ID);
    expect((home?.stars ?? []).length).toBeGreaterThan(0);
    for (const s of home?.stars ?? []) {
      expect(s.placement?.tier).toBe("galaxy");
      expect(s.placement?.parentId).toBe(HOME_GALAXY_ID);
    }
  });

  it("getUniverse reflects an added home star", () => {
    const store = createInMemoryStore();
    store.addStar(sampleStar({ id: "fresh-home" }));
    const home = store
      .getUniverse?.()
      ?.localGroup.galaxies.find((g) => g.id === HOME_GALAXY_ID);
    expect((home?.stars ?? []).some((s) => s.id === "fresh-home")).toBe(true);
  });

  it("skyFor('home') equals getSky() — the flat contract is the home projection", () => {
    const store = createInMemoryStore();
    expect(store.skyFor?.(HOME_GALAXY_ID)).toEqual(store.getSky());
  });

  it("skyFor('home') stays equal to getSky() after a star is added (#126 AC1 — stage parity)", () => {
    // The stage reads its GalaxySky via skyFor('home') instead of getSky(); the two
    // must remain byte-identical so routing through the projection is render-invisible.
    const store = createInMemoryStore();
    store.addStar(sampleStar({ id: "parity-1" }));
    expect(store.skyFor?.(HOME_GALAXY_ID)).toEqual(store.getSky());
  });

  it("homeNode() is the live home GalaxyNode of the Local Group (#126 AC2)", () => {
    const store = createInMemoryStore();
    const home = store.homeNode?.();
    expect(home?.id).toBe(HOME_GALAXY_ID);
    expect(home?.placement.tier).toBe("localGroup");
    // it IS the home node the universe read exposes
    const fromUniverse = store
      .getUniverse?.()
      ?.localGroup.galaxies.find((g) => g.id === HOME_GALAXY_ID);
    expect(home).toEqual(fromUniverse);
  });

  it("homeNode() carries the live seeded stars with home placement (#126 AC3)", () => {
    const store = createInMemoryStore();
    const skyIds = store
      .getSky()
      .stars.map((s) => s.id)
      .sort();
    const home = store.homeNode?.();
    expect((home?.stars ?? []).map((s) => s.id).sort()).toEqual(skyIds);
    for (const s of home?.stars ?? []) {
      expect(s.placement?.tier).toBe("galaxy");
      expect(s.placement?.parentId).toBe(HOME_GALAXY_ID);
    }
  });

  it("homeNode() reflects an added home star (live, not frozen)", () => {
    const store = createInMemoryStore();
    store.addStar(sampleStar({ id: "fresh-home-node" }));
    const ids = (store.homeNode?.()?.stars ?? []).map((s) => s.id);
    expect(ids).toContain("fresh-home-node");
  });

  it("starsForView('galaxy','home') returns the seeded home stars", () => {
    const store = createInMemoryStore();
    const viewIds = (store.starsForView?.("galaxy", HOME_GALAXY_ID) ?? [])
      .map((s) => s.id)
      .sort();
    const skyIds = store
      .getSky()
      .stars.map((s) => s.id)
      .sort();
    expect(viewIds).toEqual(skyIds);
  });

  it("a newly added star surfaces in its placement's view", () => {
    const store = createInMemoryStore();
    store.addStar(
      sampleStar({
        id: "sys-star",
        placement: { tier: "solarSystem", parentId: "sys-x", r: 0.5, angle: 1 },
      }),
    );
    const ids = (store.starsForView?.("solarSystem", "sys-x") ?? []).map(
      (s) => s.id,
    );
    expect(ids).toContain("sys-star");
  });

  it("adding a star never reshuffles others across the universe views (the core invariant)", () => {
    const store = createInMemoryStore();
    const snapshot = () =>
      (store.starsForView?.("galaxy", HOME_GALAXY_ID) ?? []).map((s) => ({
        id: s.id,
        r: s.r,
        angle: s.angle,
      }));
    const before = snapshot();
    // add a star in a DIFFERENT view…
    store.addStar(
      sampleStar({
        id: "elsewhere",
        placement: { tier: "localGroup", r: 0.1, angle: 0.1 },
      }),
    );
    // …and one in the SAME (home) view
    store.addStar(
      sampleStar({
        id: "home-extra",
        placement: { tier: "galaxy", parentId: "home", r: 0.9, angle: 2 },
      }),
    );
    const afterById = new Map(snapshot().map((s) => [s.id, s]));
    for (const prev of before) {
      const now = afterById.get(prev.id);
      expect(now).toBeDefined();
      expect(now?.r).toBe(prev.r);
      expect(now?.angle).toBe(prev.angle);
    }
  });
});

describe("skyFor — a valid neighbour returns ITS sky, not the home fallback (BR22)", () => {
  it("skyFor('andromeda') uses Andromeda's own backdrop, not the home snapshot", () => {
    const store = createInMemoryStore();
    const seed = store.getSky().backdrop.seed;
    const andromedaNode = buildLocalGroup(seed).galaxies.find(
      (g) => g.id === ANDROMEDA_ID,
    );
    expect(andromedaNode).toBeDefined();

    const sky = store.skyFor?.(ANDROMEDA_ID);
    expect(sky?.backdrop).toEqual(andromedaNode?.backdrop);
    // …and that is NOT the home snapshot (the line-108 fallback did not trigger).
    expect(sky?.backdrop).not.toEqual(store.getSky().backdrop);
  });

  it("skyFor('andromeda') filters stars to (tier:'galaxy', parentId:'andromeda')", () => {
    const store = createInMemoryStore();
    // An Andromeda-parented star vs a home star: only the former shows in Andromeda's sky.
    store.addStar(
      sampleStar({
        id: "andro-1",
        placement: {
          tier: "galaxy",
          parentId: ANDROMEDA_ID,
          r: 0.4,
          angle: 1,
        },
      }),
    );
    const sky = store.skyFor?.(ANDROMEDA_ID);
    const expected = starsForView(
      store.getSky().stars,
      "galaxy",
      ANDROMEDA_ID,
    ).map((s) => s.id);
    expect((sky?.stars ?? []).map((s) => s.id)).toEqual(expected);
    expect((sky?.stars ?? []).map((s) => s.id)).toContain("andro-1");
    // the home-seeded stars (no explicit placement → default home) are NOT here
    const homeStarIds = store.getSky().stars.map((s) => s.id);
    expect((sky?.stars ?? []).length).toBeLessThan(homeStarIds.length);
  });

  it("skyFor('andromeda') is empty of stars at launch (a real, figure-empty neighbour)", () => {
    // No Andromeda-parented memory stars seeded → empty figure layer, but the disk
    // (backdrop) still renders. Empty entry is a first-class state, not a fallback.
    const store = createInMemoryStore();
    const sky = store.skyFor?.(ANDROMEDA_ID);
    expect(sky?.stars).toEqual([]);
    expect(sky?.backdrop).toBeDefined();
  });
});
