import { describe, expect, it, vi } from "vitest";
import { createInMemoryStore } from "#/lib/galaxy/store";
import type { GalaxySky, MemoryStar } from "#/lib/galaxy/types";

function sampleStar(over: Partial<MemoryStar> = {}): MemoryStar {
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
}

describe("createInMemoryStore", () => {
  it("exposes getSky and addStar", () => {
    const store = createInMemoryStore();
    expect(typeof store.getSky).toBe("function");
    expect(typeof store.addStar).toBe("function");
  });

  it("seeds a backdrop and >=3 stars spanning >=2 moods", () => {
    const sky = createInMemoryStore().getSky();
    expect(sky.backdrop).toBeDefined();
    expect(sky.stars.length).toBeGreaterThanOrEqual(3);
    expect(new Set(sky.stars.map((s) => s.mood)).size).toBeGreaterThanOrEqual(
      2,
    );
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
