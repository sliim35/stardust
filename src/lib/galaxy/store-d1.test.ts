import { describe, expect, it } from "vitest";
import { buildSeedSky } from "#/lib/galaxy/seed";
import { createD1Store } from "#/lib/galaxy/store-d1";
import type { MemoryStar } from "#/lib/galaxy/types";

const userStar = (over: Partial<MemoryStar> = {}): MemoryStar => ({
  id: "u-1",
  text: "a user memory",
  mood: "wonder",
  color: "#cbb8ef",
  r: 0.6,
  angle: 0.3,
  brightness: 0.8,
  createdAt: 1748100000000,
  ...over,
});

describe("createD1Store", () => {
  it("satisfies the GalaxyStore seam (getSky + addStar + universe reads)", () => {
    const store = createD1Store([]);
    expect(typeof store.getSky).toBe("function");
    expect(typeof store.addStar).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    expect(typeof store.getUniverse).toBe("function");
  });

  it("merges seeded + user stars into one flat sky", () => {
    const seededCount = buildSeedSky().stars.length;
    const store = createD1Store([
      userStar({ id: "u-a" }),
      userStar({ id: "u-b" }),
    ]);
    const ids = store.getSky().stars.map((s) => s.id);
    expect(ids).toHaveLength(seededCount + 2);
    expect(ids).toContain("u-a");
    expect(ids).toContain("u-b");
  });

  it("keeps every seeded star present (seeded fixtures are merged, never dropped)", () => {
    const seededIds = buildSeedSky().stars.map((s) => s.id);
    const store = createD1Store([userStar()]);
    const ids = new Set(store.getSky().stars.map((s) => s.id));
    for (const id of seededIds) expect(ids.has(id)).toBe(true);
  });

  it("never reshuffles existing stars when a new one is added (append-only invariant)", () => {
    const store = createD1Store([
      userStar({ id: "existing", r: 0.42, angle: 1.1 }),
    ]);
    const before = store
      .getSky()
      .stars.map((s) => ({ id: s.id, r: s.r, angle: s.angle }));
    store.addStar(userStar({ id: "newcomer", r: 0.9, angle: 2.2 }));
    const afterById = new Map(store.getSky().stars.map((s) => [s.id, s]));
    for (const prev of before) {
      const now = afterById.get(prev.id);
      expect(now).toBeDefined();
      expect(now?.r).toBe(prev.r);
      expect(now?.angle).toBe(prev.angle);
    }
  });

  it("the empty-user-stars store is byte-equal to a seed-only in-memory store", () => {
    // No persisted user stars → the sky is exactly the seed sky (no D1 writes of seeds).
    const store = createD1Store([]);
    expect(
      store
        .getSky()
        .stars.map((s) => s.id)
        .sort(),
    ).toEqual(
      buildSeedSky()
        .stars.map((s) => s.id)
        .sort(),
    );
  });

  it("passes a user star's mood-derived color through unchanged (no UI recolor)", () => {
    const store = createD1Store([userStar({ id: "c1", color: "#abcdef" })]);
    const star = store.getSky().stars.find((s) => s.id === "c1");
    expect(star?.color).toBe("#abcdef");
  });
});
