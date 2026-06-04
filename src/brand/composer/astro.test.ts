import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPRESSIONS, POSES, spritePathFor } from "#/brand/composer/astro";

// AC5/AC6: ASTRO sprite selection supports BOTH the pose set (body gesture) and
// the expression set (face). Sprites are the committed copies under
// src/brand/assets/astro/ (not the gitignored astro/ source).
describe("spritePathFor", () => {
  it("resolves a pose to its committed 1x sprite", () => {
    const p = spritePathFor({ pose: "point" });
    expect(p).toMatch(/assets\/astro\/poses\/point\.png$/);
    expect(existsSync(p)).toBe(true);
  });

  it("resolves an expression (overrides the pose body) when given", () => {
    const p = spritePathFor({ pose: "idle", expression: "A_curious" });
    expect(p).toMatch(/assets\/astro\/expression\/A_curious\.png$/);
    expect(existsSync(p)).toBe(true);
  });

  it("every documented pose has a committed sprite on disk", () => {
    for (const pose of POSES) {
      expect(existsSync(spritePathFor({ pose }))).toBe(true);
    }
  });

  it("every documented expression has a committed sprite on disk", () => {
    for (const expression of EXPRESSIONS) {
      expect(existsSync(spritePathFor({ pose: "point", expression }))).toBe(
        true,
      );
    }
  });
});
