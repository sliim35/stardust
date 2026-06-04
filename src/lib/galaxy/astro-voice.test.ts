import { describe, expect, it } from "vitest";
import {
  ASTRO_CLICK_LINES,
  ASTRO_GREETING,
  nextClickLine,
} from "#/lib/galaxy/astro-voice";

describe("ASTRO_GREETING (the confirmed opening line — AC2)", () => {
  it("is the exact confirmed memorial greeting", () => {
    expect(ASTRO_GREETING).toBe(
      "every star here is a memory someone left behind. the pulsing one is hers — but add your own, and i'll find its place.",
    );
  });

  it("keeps the lowercase, wistful voice (no leading capital)", () => {
    expect(ASTRO_GREETING[0]).toBe(ASTRO_GREETING[0].toLowerCase());
  });
});

describe("ASTRO_CLICK_LINES (the re-speak set — AC3)", () => {
  it("is a non-empty set of distinct lines", () => {
    expect(ASTRO_CLICK_LINES.length).toBeGreaterThan(0);
    expect(new Set(ASTRO_CLICK_LINES).size).toBe(ASTRO_CLICK_LINES.length);
  });

  it("keeps every line in the lowercase, wistful voice", () => {
    for (const line of ASTRO_CLICK_LINES) {
      expect(line).toBe(line.toLowerCase());
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("never reuses the greeting as a click line", () => {
    expect(ASTRO_CLICK_LINES).not.toContain(ASTRO_GREETING);
  });
});

describe("nextClickLine — deterministic rotation through the click set (AC3)", () => {
  it("returns the first click line when there is no previous message", () => {
    expect(nextClickLine(undefined)).toBe(ASTRO_CLICK_LINES[0]);
  });

  it("starts the rotation from the first line when the previous is the greeting", () => {
    // Mount shows the greeting; the FIRST click should advance to a click line,
    // not get stuck because the greeting isn't in the click set.
    expect(nextClickLine(ASTRO_GREETING)).toBe(ASTRO_CLICK_LINES[0]);
  });

  it("advances to the next line in order, wrapping at the end", () => {
    let cur = nextClickLine(undefined); // line[0]
    for (let i = 1; i < ASTRO_CLICK_LINES.length; i++) {
      cur = nextClickLine(cur);
      expect(cur).toBe(ASTRO_CLICK_LINES[i]);
    }
    // Wrap back to the first line after the last.
    expect(nextClickLine(cur)).toBe(ASTRO_CLICK_LINES[0]);
  });

  it("never returns the same line twice in a row", () => {
    let cur: string | undefined;
    for (let i = 0; i < ASTRO_CLICK_LINES.length * 3; i++) {
      const next = nextClickLine(cur);
      expect(next).not.toBe(cur);
      cur = next;
    }
  });

  it("is deterministic — same previous always yields the same next (SSR-safe)", () => {
    for (const line of ASTRO_CLICK_LINES) {
      expect(nextClickLine(line)).toBe(nextClickLine(line));
    }
  });

  it("falls back to the first line for an unknown previous message", () => {
    expect(nextClickLine("not a known line")).toBe(ASTRO_CLICK_LINES[0]);
  });
});
