import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  SCRIMMED_TYPE_ZONE,
  TYPE_COLORS,
} from "#/brand/composer/contrast";

// AC10: composited type clears WCAG AA over the mandatory L7 scrim.
describe("contrastRatio", () => {
  it("computes ~21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#f3f1ea", "#04050d")).toBeCloseTo(
      contrastRatio("#04050d", "#f3f1ea"),
      5,
    );
  });
});

describe("type colors over the scrimmed lower-left zone", () => {
  it("headline clears AA (>= 4.5:1)", () => {
    expect(
      contrastRatio(TYPE_COLORS.headline, SCRIMMED_TYPE_ZONE),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("eyebrow clears AA (>= 4.5:1)", () => {
    expect(
      contrastRatio(TYPE_COLORS.eyebrow, SCRIMMED_TYPE_ZONE),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gold emphasis word clears AA (>= 4.5:1)", () => {
    expect(
      contrastRatio(TYPE_COLORS.emphasis, SCRIMMED_TYPE_ZONE),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("fine print uses #8a8c96 (AA), never the failing #7a7c86", () => {
    expect(TYPE_COLORS.finePrint).toBe("#8a8c96");
    expect(TYPE_COLORS.finePrint).not.toBe("#7a7c86");
    expect(
      contrastRatio(TYPE_COLORS.finePrint, SCRIMMED_TYPE_ZONE),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
