/**
 * jsdom test setup (component `.test.tsx` only). jsdom ships no `matchMedia`, so we
 * default it to "no preference" (`matches:false`) — the animated default. Tests that
 * exercise `prefers-reduced-motion` override it per-case via `vi.stubGlobal`.
 *
 * Also unmounts each test's React tree after it runs (Testing Library `cleanup`),
 * so successive renders don't pile up in the shared `document.body` (which would
 * make `getByRole` find duplicates).
 *
 * Loaded by `vitest.config.ts` via `test.setupFiles`; harmless under the node
 * environment (the pure suite never touches `window`).
 */

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
