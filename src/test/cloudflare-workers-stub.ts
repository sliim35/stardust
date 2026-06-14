/**
 * Test-only stand-in for the `cloudflare:workers` virtual module (Vitest's
 * standalone config has no Cloudflare Vite plugin, so the import is unresolved —
 * see `vitest.config.ts`'s alias). Server-fn modules import `{ env }` from here at
 * module scope; component tests render only the chrome (the closed composer's
 * trigger), never invoking the server fn, so `env` is never actually dereferenced.
 *
 * The pure write-path logic (moderation, mood parsing, field derivation, the
 * `addMemory` orchestrator) is unit-tested directly with injected deps — it never
 * touches this stub. Real D1/Workers-AI end-to-end is verified by QA on the
 * preview URL.
 */

/** A throwing proxy: any binding access in a test is a bug, not a silent no-op. */
export const env = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(
        `cloudflare:workers env.${String(prop)} is not available in unit tests — ` +
          "test the pure logic with injected deps, or verify bindings via QA.",
      );
    },
  },
);
