import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * F2 guard — the native `@napi-rs/canvas` (build/CLI-only) must never enter the
 * Worker runtime graph. Two structural checks keep it out:
 *
 *  1. No route (anything under `src/routes`) may import `brand/composer`.
 *  2. No composer source may *statically value-import* `@napi-rs/canvas`. The
 *     native lib is reachable only via a lazy `await import("@napi-rs/canvas")`
 *     (or an erased `import type`), so it stays out of every module's runtime
 *     graph and can only be pulled in on the CLI/compose path.
 */

const ROUTES_DIR = fileURLToPath(new URL("../../routes/", import.meta.url));
const COMPOSER_DIR = fileURLToPath(new URL(".", import.meta.url));

const filesIn = (dir: string, exts: string[]): string[] =>
  readdirSync(dir)
    .filter((f) => exts.some((e) => f.endsWith(e)))
    .map((f) => `${dir}${f}`);

/** Strip block + line comments so prose mentioning a package never trips a guard. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("@napi-rs/canvas never leaks to a Worker route (F2)", () => {
  it("no route imports brand/composer", () => {
    for (const file of filesIn(ROUTES_DIR, [".ts", ".tsx"])) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not import brand/composer`).not.toMatch(
        /brand\/composer/,
      );
    }
  });

  it("composer source never static value-imports @napi-rs/canvas", () => {
    // A bare `import … from "@napi-rs/canvas"` (no `type` modifier on the
    // statement) pins the native lib into that module's runtime graph. Allowed:
    // `import type … from "@napi-rs/canvas"` and `await import("@napi-rs/canvas")`.
    // Comments are stripped first so JSDoc prose never trips the guard. The
    // clause body excludes `from`/`import`/`;` so a match can't bridge two
    // statements (a preceding `import …` then this one's `from "@napi-rs/canvas"`),
    // while still spanning newlines for a multi-line `import { … }`.
    const offending =
      /\bimport\s+(?!type\b)(?:(?!\bfrom\b|\bimport\b|;)[\s\S])*?\bfrom\s+["']@napi-rs\/canvas["']/;
    for (const file of filesIn(COMPOSER_DIR, [".ts"])) {
      if (file.endsWith(".test.ts")) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      expect(
        offending.test(src),
        `${file} must lazy-import or type-import @napi-rs/canvas, not static value-import it`,
      ).toBe(false);
    }
  });
});
