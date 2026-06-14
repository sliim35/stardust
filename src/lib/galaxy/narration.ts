/**
 * Cached ASTRO narration (ADR-0013 §2) — the PURE, injectable core of the
 * "narrate the cosmos" capability: normalize a key → read KV → on a miss,
 * generate once, write through, and serve. The `narration:{key}` cache means a
 * recurring narration is generated ONCE then served instantly + free on every
 * later view (the owner's caching requirement).
 *
 * Dependencies (the KV `get`/`put`, the Workers-AI `generate`) are INJECTED so
 * this stays headless-testable without bindings. The thin `createServerFn` edge
 * (`src/server/narrate.ts`) wires the real `env.NARRATION_KV` + `env.AI` — neither
 * exists at module scope (SSR-safe, ADR-0003) or in unit tests.
 *
 * Graceful degradation is the contract (ADR-0013 §5 "no v1 regression"): a KV
 * read/write or a generation failure NEVER throws — a read error falls back to a
 * fresh generation, a write error still returns the text, and a generation error
 * (or empty output) returns `null` so the caller simply shows no narration. The
 * read-only sky always renders.
 *
 * English-only MVP: the cache key carries NO `:{locale}` segment — that is added
 * back in #182 when ru narration lands (ADR-0013 §2/§4).
 */

/** The KV key prefix — `narration:{normalized-key}` (ADR-0013 §2). */
export const NARRATION_KEY_PREFIX = "narration:";

/**
 * Normalize a raw narration key into a stable cache slug: lowercase, then collapse
 * every run of non-alphanumeric characters to a single `-`, stripping leading and
 * trailing dashes. Pure + idempotent, so equivalent raw keys (`"milkyWay"`,
 * `"  MILKYWAY  "`) share ONE cache entry — the read-heavy hit rate the cache wants.
 */
export const normalizeNarrationKey = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The full KV key for a narration: `narration:{normalized}` (no locale, MVP). */
export const narrationCacheKey = (raw: string): string =>
  `${NARRATION_KEY_PREFIX}${normalizeNarrationKey(raw)}`;

export type NarrationDeps = {
  /** KV read → the cached narration, or `null` on a miss. */
  get: (key: string) => Promise<string | null>;
  /** KV write-through (with the chosen TTL, applied at the edge). */
  put: (key: string, value: string) => Promise<void>;
  /** Workers-AI text generation for the original (un-normalized) key. */
  generate: (rawKey: string) => Promise<string>;
};

/**
 * Resolve a narration for `rawKey` — a KV hit returns instantly; a miss generates
 * once, writes through, and serves. Returns `null` (no narration) on any failure,
 * never throws (the sky still renders, ADR-0013 §5).
 *
 * The generator receives the ORIGINAL key (so its prompt can name the real object),
 * while the cache is keyed by the NORMALIZED slug (so equivalent keys collapse).
 */
export const cachedNarration = async (
  rawKey: string,
  deps: NarrationDeps,
): Promise<string | null> => {
  const key = narrationCacheKey(rawKey);

  // 1. Cache read — a hit serves instantly. A read error is non-fatal: fall
  //    through to a fresh generation rather than failing the view.
  try {
    const hit = await deps.get(key);
    if (hit !== null && hit.trim().length > 0) return hit;
  } catch {
    // KV read unavailable → generate fresh below.
  }

  // 2. Cache miss — generate once. A generation failure → no narration (null);
  //    never a crash, never a guessed default.
  let generated: string;
  try {
    generated = await deps.generate(rawKey);
  } catch {
    return null;
  }
  const text = generated.trim();
  if (text.length === 0) return null;

  // 3. Write through so the next view is a hit. A write error is non-fatal —
  //    return the generated text anyway (a later view simply regenerates).
  try {
    await deps.put(key, text);
  } catch {
    // KV write unavailable → serve the generated text uncached.
  }
  return text;
};
