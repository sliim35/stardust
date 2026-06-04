import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AC4 grep-gate: the composer never re-enables image smoothing anywhere in its
// source. Every offscreen must keep `imageSmoothingEnabled = false` so the grid
// stays a uniform nearest-neighbour upscale (no blurred edges).
const DIR = fileURLToPath(new URL(".", import.meta.url));

const sourceFiles = (): string[] =>
  readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => `${DIR}${f}`);

describe("composer integer-scale invariants (AC4)", () => {
  it("never sets imageSmoothingEnabled = true", () => {
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/imageSmoothingEnabled\s*=\s*true/);
    }
  });

  it("every getContext('2d') in the pipeline is followed by smoothing = false", () => {
    // Defensive: the composer + avatar path must disable smoothing on each ctx.
    const compose = readFileSync(`${DIR}composeScene.ts`, "utf8");
    const ctxCount = (compose.match(/getContext\("2d"\)/g) ?? []).length;
    const falseCount = (
      compose.match(/imageSmoothingEnabled\s*=\s*false/g) ?? []
    ).length;
    expect(ctxCount).toBeGreaterThan(0);
    expect(falseCount).toBeGreaterThanOrEqual(ctxCount);
  });
});
