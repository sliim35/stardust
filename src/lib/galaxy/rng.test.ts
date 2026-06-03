import { describe, expect, it } from "vitest";
import { hashStr, mulberry32 } from "#/lib/galaxy/rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("diverges for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("hashStr", () => {
  it("is a stable 32-bit unsigned hash of its input", () => {
    expect(hashStr("irina")).toBe(hashStr("irina"));
    expect(hashStr("irina")).not.toBe(hashStr("egg"));
    const h = hashStr("s01");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});
