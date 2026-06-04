import { describe, expect, it } from "vitest";
import { nextClickIndex } from "#/lib/galaxy/astro-voice";

/**
 * The rotation is index-based and locale-agnostic (#103): it advances an index
 * through a click set of length `total`, so the same rule drives the en and ru
 * `clickLines` arrays. A representative `total` of 5 (the shipped set size) is
 * used here; the copy itself is asserted in the i18n catalog tests.
 */
describe("nextClickIndex — deterministic, locale-agnostic rotation (AC3)", () => {
  const TOTAL = 5;

  it("returns the first line index when there is no previous (mount/greeting/dismissed)", () => {
    expect(nextClickIndex(null, TOTAL)).toBe(0);
  });

  it("advances one and wraps at the end", () => {
    expect(nextClickIndex(0, TOTAL)).toBe(1);
    expect(nextClickIndex(TOTAL - 1, TOTAL)).toBe(0);
  });

  it("walks the whole set in order, then wraps back to the first", () => {
    let cur = nextClickIndex(null, TOTAL); // 0
    for (let i = 1; i < TOTAL; i++) {
      cur = nextClickIndex(cur, TOTAL);
      expect(cur).toBe(i);
    }
    expect(nextClickIndex(cur, TOTAL)).toBe(0);
  });

  it("never returns the same index twice in a row (every click changes the bubble)", () => {
    let cur = nextClickIndex(null, TOTAL);
    for (let i = 0; i < TOTAL * 3; i++) {
      const next = nextClickIndex(cur, TOTAL);
      expect(next).not.toBe(cur);
      cur = next;
    }
  });

  it("is deterministic — same input always yields the same next (SSR-safe)", () => {
    for (let i = 0; i < TOTAL; i++) {
      expect(nextClickIndex(i, TOTAL)).toBe(nextClickIndex(i, TOTAL));
    }
  });
});
