import { describe, expect, it, vi } from "vitest";
import type { NarrationDeps } from "#/lib/galaxy/narration";
import {
  cachedNarration,
  narrationCacheKey,
  normalizeNarrationKey,
} from "#/lib/galaxy/narration";

/** Default deps: a fake KV (a Map) + a spy generator. */
const deps = (over: Partial<NarrationDeps> = {}): NarrationDeps => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    generate: vi.fn(async () => "Andromeda drifts toward us across the dark."),
    ...over,
  };
};

describe("normalizeNarrationKey (the pure key normalizer)", () => {
  it("lowercases, trims, and slugifies a raw key", () => {
    expect(normalizeNarrationKey("  MilkyWay  ")).toBe("milkyway");
    expect(normalizeNarrationKey("Sgr A*")).toBe("sgr-a");
    expect(normalizeNarrationKey("Pillars of Creation")).toBe(
      "pillars-of-creation",
    );
  });

  it("collapses runs of non-alphanumerics and strips leading/trailing dashes", () => {
    expect(normalizeNarrationKey("--a__b  c--")).toBe("a-b-c");
    expect(normalizeNarrationKey("M31 / M110")).toBe("m31-m110");
  });

  it("is idempotent (normalizing a normalized key is a no-op)", () => {
    const once = normalizeNarrationKey("Sgr A*");
    expect(normalizeNarrationKey(once)).toBe(once);
  });
});

describe("narrationCacheKey (the `narration:{key}` shape — no locale segment in the MVP)", () => {
  it("prefixes the normalized key with `narration:`", () => {
    expect(narrationCacheKey("milkyWay")).toBe("narration:milkyway");
    expect(narrationCacheKey("Sgr A*")).toBe("narration:sgr-a");
  });
});

describe("cachedNarration (the write-through KV cache orchestrator)", () => {
  it("on a cache MISS: generates once, writes through to KV, and returns the text", async () => {
    const d = deps();
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBe("Andromeda drifts toward us across the dark.");
    expect(d.generate).toHaveBeenCalledTimes(1);
    expect(d.get).toHaveBeenCalledWith("narration:milkyway");
    expect(d.put).toHaveBeenCalledTimes(1);
    expect(d.put).toHaveBeenCalledWith(
      "narration:milkyway",
      "Andromeda drifts toward us across the dark.",
    );
  });

  it("CACHE HIT: the SECOND request for the same key reads from KV — generate runs exactly ONCE", async () => {
    const d = deps();
    const first = await cachedNarration("milkyWay", d);
    const second = await cachedNarration("milkyWay", d);

    expect(first).toBe(second);
    // The defining cache invariant: one generation total for a recurring key.
    expect(d.generate).toHaveBeenCalledTimes(1);
    // The second call wrote nothing new (served from the hit).
    expect(d.put).toHaveBeenCalledTimes(1);
  });

  it("a stored value is returned WITHOUT generating (a pre-seeded / earlier-populated hit)", async () => {
    const store = new Map([["narration:milkyway", "a cached fact"]]);
    const d = deps({
      get: vi.fn(async (k: string) => store.get(k) ?? null),
    });
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBe("a cached fact");
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.put).not.toHaveBeenCalled();
  });

  it("two raw keys that normalize to the same slug share ONE cache entry", async () => {
    const d = deps();
    await cachedNarration("milkyWay", d);
    await cachedNarration("  MILKYWAY  ", d);

    expect(d.generate).toHaveBeenCalledTimes(1);
  });

  it("GRACEFUL: a KV READ failure falls back to a fresh generation (no throw)", async () => {
    const d = deps({
      get: vi.fn(async () => {
        throw new Error("KV down");
      }),
    });
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBe("Andromeda drifts toward us across the dark.");
    expect(d.generate).toHaveBeenCalledTimes(1);
  });

  it("GRACEFUL: a KV WRITE failure still returns the generated text (no throw)", async () => {
    const d = deps({
      put: vi.fn(async () => {
        throw new Error("KV write down");
      }),
    });
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBe("Andromeda drifts toward us across the dark.");
  });

  it("GRACEFUL: a GENERATION failure returns null (no narration, never a crash)", async () => {
    const d = deps({
      generate: vi.fn(async () => {
        throw new Error("AI down");
      }),
    });
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBeNull();
    expect(d.put).not.toHaveBeenCalled();
  });

  it("GRACEFUL: a generator that yields empty text returns null and caches nothing", async () => {
    const d = deps({ generate: vi.fn(async () => "   ") });
    const text = await cachedNarration("milkyWay", d);

    expect(text).toBeNull();
    expect(d.put).not.toHaveBeenCalled();
  });

  it("the generator is given the ORIGINAL key (so the prompt can name the real object)", async () => {
    const d = deps();
    await cachedNarration("milkyWay", d);
    expect(d.generate).toHaveBeenCalledWith("milkyWay");
  });
});
