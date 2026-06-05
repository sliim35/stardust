import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * GSAP registration seam for the galaxy stage (ADR-0009).
 *
 * GSAP is the galaxy's **temporal engine** (easing / inertia / sequencing). This
 * module is the single place `components/galaxy/*` reach for `gsap` + `useGSAP`,
 * so the import boundary stays trivially enforceable: GSAP is imported here (and
 * other `components/galaxy/*` consumers), **never** under `src/lib/**` — the pure,
 * headless-tested spatial seam. That boundary is asserted structurally by
 * `gsap-import-boundary.test.ts`.
 *
 * **Client-only, no module-scope side effects.** Per ADR-0009 (same footgun class
 * as the `crypto.randomUUID()`-at-import-time crash that `vite.config.ts`
 * neutralizes), nothing here registers a plugin or mutates GSAP at import time.
 * `gsap.registerPlugin(useGSAP)` runs **inside** {@link useGalaxyGsap}, at hook
 * (component) scope — and `useGSAP` itself falls back to `useEffect` when `window`
 * is undefined, so the whole path is SSR/Workers-safe.
 *
 * This is ADR-0009 migration step 1: it lands the engine + the import-boundary
 * guard only. No camera/animation is wired to GSAP yet (later waves).
 */

// Module-scope `let` (not a side effect — just a flag) so registration is
// idempotent across every galaxy component that mounts. The actual
// `registerPlugin` call only ever runs inside the hook below.
let registered = false;

/**
 * Registers the `useGSAP` hook as a GSAP plugin exactly once, client-side, at
 * component scope. Call this from any `components/galaxy/*` component/hook that
 * intends to use `gsap` / `useGSAP`. Returns the registered `useGSAP` so callers
 * can use one import.
 *
 * No-ops cleanly during SSR-prerender beyond the registration flag; `useGSAP`
 * defers its effect until the client.
 */
export const useGalaxyGsap = (): typeof useGSAP => {
  if (!registered) {
    gsap.registerPlugin(useGSAP);
    registered = true;
  }
  return useGSAP;
};

// Re-exported so galaxy components consume GSAP through this single seam.
export { gsap, useGSAP };
