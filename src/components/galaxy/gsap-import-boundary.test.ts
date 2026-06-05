import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ADR-0009 import-boundary guard — `gsap` / `@gsap/react` are the galaxy's
 * **temporal engine** and may be imported **only** from `src/components/galaxy/*`,
 * **never** from anywhere under `src/lib/**`.
 *
 * Why: the standalone Node `vitest.config.ts` runs the `lib/` tests headless. A
 * GSAP value-import there would pull a browser-oriented dependency into the
 * pure-test path and break the "math lives in `lib/`, everything has a `.test.ts`"
 * contract. Keeping `lib/` GSAP-free keeps the spatial/coordinate math pure and
 * fully unit-testable.
 *
 * Pattern mirrors ADR-0006's `brand/composer/no-route-leak.test.ts` structural
 * guard: walk the source tree, strip comments (so prose mentioning the package
 * never trips the guard), and assert no offending static import survives.
 */

const LIB_DIR = fileURLToPath(new URL("../../lib/", import.meta.url));
const GSAP_SETUP = fileURLToPath(new URL("./gsap-setup.ts", import.meta.url));

/** Recursively collect every non-test source file under `dir`. */
const sourceFilesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}${entry.name}`;
    if (entry.isDirectory()) return sourceFilesUnder(`${full}/`);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });

/** Strip block + line comments so prose mentioning a package never trips a guard. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * Matches a static value-import of `gsap` or any `@gsap/*` subpath — bare
 * `import … from "gsap"` / `import "gsap"` (side-effect) — but NOT `import type`
 * and NOT a lazy `await import("gsap")`. The clause body excludes
 * `from`/`import`/`;` so a match can't bridge two statements, while still
 * spanning newlines for a multi-line `import { … }`.
 */
const offendingImport =
  /\bimport\s+(?!type\b)(?:(?!\bfrom\b|\bimport\b|;)[\s\S])*?\bfrom\s+["'](?:gsap|@gsap\/[^"']+)["']|\bimport\s+["'](?:gsap|@gsap\/[^"']+)["']/;

describe("gsap import boundary (ADR-0009)", () => {
  it("the offending-import matcher actually catches a gsap import (positive control)", () => {
    expect(offendingImport.test(`import gsap from "gsap";`)).toBe(true);
    expect(offendingImport.test(`import { useGSAP } from "@gsap/react";`)).toBe(
      true,
    );
    expect(offendingImport.test(`import "gsap";`)).toBe(true);
    // Allowed forms must NOT trip the guard:
    expect(offendingImport.test(`import type { GSAPTween } from "gsap";`)).toBe(
      false,
    );
    expect(offendingImport.test(`const g = await import("gsap");`)).toBe(false);
    // Unrelated packages whose name merely contains the substring must not trip:
    expect(offendingImport.test(`import x from "not-gsap-thing";`)).toBe(false);
  });

  it("no module under src/lib/** imports gsap or @gsap/*", () => {
    for (const file of sourceFilesUnder(LIB_DIR)) {
      const src = stripComments(readFileSync(file, "utf8"));
      expect(
        offendingImport.test(src),
        `${file} must not import gsap / @gsap/* — GSAP belongs to components/galaxy/* only (ADR-0009)`,
      ).toBe(false);
    }
  });

  it("gsap-setup registers GSAP plugins only at hook/component scope, never module-scope (ADR-0009 SSR/Workers safety)", () => {
    // The footgun class: a module-init side effect (cf. `crypto.randomUUID()` at
    // import). Registration must live *inside* the exported hook, so it runs at
    // component scope on the client — never as a top-level statement. A
    // module-scope call sits at column 0 (no leading whitespace); the legitimate
    // in-hook call is indented inside the function body. So a line-start
    // (unindented) `gsap.registerPlugin(` is the violation we forbid.
    const src = stripComments(readFileSync(GSAP_SETUP, "utf8"));
    const moduleScopeRegister = /^gsap\.registerPlugin\s*\(/m;
    expect(
      moduleScopeRegister.test(src),
      "gsap-setup.ts must call gsap.registerPlugin only inside the hook (indented), never at module scope",
    ).toBe(false);
  });
});
