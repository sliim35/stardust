import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  isPalette,
  PALETTE_LABELS,
  PALETTE_ORDER,
  PALETTES,
  paletteAccentVars,
  paletteFor,
} from "#/lib/galaxy/palette";

const keysOf = (p: Record<string, string>): string[] => Object.keys(p).sort();

describe("paletteFor", () => {
  it("defaults to ember (amber) — the owner-resolved sky (2026-06-04)", () => {
    expect(DEFAULT_PALETTE).toBe("ember");
    expect(paletteFor(DEFAULT_PALETTE).accent).toBe("#f5d6a0");
  });

  it("returns the concrete hex set for each palette (design-spec token table)", () => {
    expect(paletteFor("ember").accent).toBe("#f5d6a0"); // amber
    expect(paletteFor("ice").accent).toBe("#c8d4e8"); // moonlit
    expect(paletteFor("auroral").hazeNear).toBe("#3a8f7a"); // teal dust lane
  });

  it("exposes the same token keys for every palette", () => {
    expect(keysOf(paletteFor("ember"))).toEqual(keysOf(paletteFor("auroral")));
    expect(keysOf(paletteFor("ice"))).toEqual(keysOf(paletteFor("auroral")));
  });

  it("re-tones the sky between palettes (bg + accent + haze differ)", () => {
    expect(paletteFor("ember").bg).not.toBe(paletteFor("ice").bg);
    expect(paletteFor("ember").accent).not.toBe(paletteFor("auroral").accent);
    expect(paletteFor("ice").hazeNear).not.toBe(paletteFor("auroral").hazeNear);
  });

  it("covers exactly the three named palettes", () => {
    expect(Object.keys(PALETTES).sort()).toEqual(["auroral", "ember", "ice"]);
  });
});

describe("palette options (theme picker)", () => {
  it("orders the options auroral → ember → ice, every palette present", () => {
    expect(PALETTE_ORDER).toEqual(["auroral", "ember", "ice"]);
    expect([...PALETTE_ORDER].sort()).toEqual(Object.keys(PALETTES).sort());
  });

  it("labels each palette for the swatch", () => {
    expect(PALETTE_LABELS.auroral).toBe("sea glass");
    expect(PALETTE_LABELS.ember).toBe("amber");
    expect(PALETTE_LABELS.ice).toBe("moonlit");
  });
});

describe("paletteAccentVars (publishes the active accent onto shared CSS vars)", () => {
  it("maps the auroral accent family onto --color-accent / --color-accent-soft", () => {
    expect(paletteAccentVars("auroral")).toEqual({
      "--color-accent": "#9cd8c0",
      "--color-accent-soft": "#9cd8c030",
    });
  });

  it("flips --color-accent from auroral to ember (amber) on a palette switch", () => {
    expect(paletteAccentVars("auroral")["--color-accent"]).toBe("#9cd8c0");
    expect(paletteAccentVars("ember")["--color-accent"]).toBe("#f5d6a0");
    expect(paletteAccentVars("ice")["--color-accent"]).toBe("#c8d4e8");
  });

  it("publishes only the accent family — never canvas-only sky keys", () => {
    expect(Object.keys(paletteAccentVars("ice")).sort()).toEqual([
      "--color-accent",
      "--color-accent-soft",
    ]);
  });

  it("defaults to the ember sky when no palette is given", () => {
    expect(paletteAccentVars()).toEqual(paletteAccentVars(DEFAULT_PALETTE));
  });
});

describe("isPalette (guard for persisted/user input)", () => {
  it("accepts the three known palettes", () => {
    expect(isPalette("auroral")).toBe(true);
    expect(isPalette("ember")).toBe(true);
    expect(isPalette("ice")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPalette("amber")).toBe(false);
    expect(isPalette("")).toBe(false);
    expect(isPalette(null)).toBe(false);
    expect(isPalette(42)).toBe(false);
  });
});
