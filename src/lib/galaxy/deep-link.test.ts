import { describe, expect, it } from "vitest";
import {
  type DeepLinkSearch,
  parseAt,
  resolveDeepLink,
  validateDeepLinkSearch,
} from "#/lib/galaxy/deep-link";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import type { MemoryStar, RealObject, Tier } from "#/lib/galaxy/types";

// The full (post-#127) tier ladder — drives the at=system path that the v1
// default set deliberately can't enter.
const FULL: readonly Tier[] = ["localGroup", "galaxy", "solarSystem"];

const realById = (id: string): RealObject | undefined =>
  REAL_OBJECTS.find((o) => o.id === id);

// A tiny seeded-sky stand-in: a galaxy-tier star (the flat back-compat default —
// no `placement` ⇒ lives in the Milky Way) and an explicitly local-group-placed
// star, so cross-tier resolution (AC2) is covered both ways.
const galaxyStar: MemoryStar = {
  id: "s01",
  text: "the kitchen radio.",
  mood: "joyful",
  color: "#ffd166",
  r: 0.3,
  angle: 1,
  brightness: 0.8,
  createdAt: 1,
};
const lgStar: MemoryStar = {
  ...galaxyStar,
  id: "lg-star",
  placement: { tier: "localGroup", r: 0.2, angle: 0.5 },
};
const STARS: readonly MemoryStar[] = [galaxyStar, lgStar];
const starById = (id: string): MemoryStar | undefined =>
  STARS.find((s) => s.id === id);

describe("parseAt — `at=<kind>:<id>` syntax", () => {
  it("parses a galaxy target", () => {
    expect(parseAt("galaxy:home")).toEqual({ kind: "galaxy", id: "home" });
  });

  it("parses a system target", () => {
    expect(parseAt("system:sol")).toEqual({ kind: "system", id: "sol" });
  });

  it("keeps a colon inside the id (only the first colon splits)", () => {
    expect(parseAt("galaxy:home:extra")).toEqual({
      kind: "galaxy",
      id: "home:extra",
    });
  });

  it("rejects an unknown kind", () => {
    expect(parseAt("planet:earth")).toBeNull();
  });

  it("rejects a missing id", () => {
    expect(parseAt("galaxy:")).toBeNull();
    expect(parseAt("galaxy")).toBeNull();
  });

  it("rejects empty / non-string input (graceful, no throw)", () => {
    expect(parseAt("")).toBeNull();
    expect(parseAt(undefined)).toBeNull();
    expect(parseAt(42)).toBeNull();
    expect(parseAt({ kind: "galaxy" })).toBeNull();
  });
});

describe("validateDeepLinkSearch — the route's permissive search parser", () => {
  it("passes through string `at` / `star`", () => {
    expect(validateDeepLinkSearch({ at: "galaxy:home", star: "s01" })).toEqual({
      at: "galaxy:home",
      star: "s01",
    });
  });

  it("drops non-string params rather than throwing (no 404 on a bad link)", () => {
    expect(validateDeepLinkSearch({ at: 5, star: ["x"] })).toEqual({});
  });

  it("ignores unrelated params and an empty search", () => {
    expect(validateDeepLinkSearch({ foo: "bar" })).toEqual({});
    expect(validateDeepLinkSearch({})).toEqual({});
  });
});

describe("resolveDeepLink — pure URL → camera target", () => {
  const resolve = (search: DeepLinkSearch, available = FULL) =>
    resolveDeepLink(search, {
      findReal: realById,
      findStar: starById,
      available,
    });

  it("returns null for an empty search (default view)", () => {
    expect(resolve({})).toBeNull();
  });

  // AC1 — `?at=galaxy:<id>` focuses + ENTERS that node (the home MW is a gateway,
  // so its interior is the galaxy tier).
  it("at=galaxy:home dives into the Milky Way (gateway → galaxy tier)", () => {
    expect(resolve({ at: `galaxy:${HOME_MILKY_WAY_ID}` })).toEqual({
      dive: { id: HOME_MILKY_WAY_ID, tier: "galaxy" },
      star: null,
    });
  });

  // AC1 — `?at=system:<id>` focuses + enters when the Solar-System tier exists.
  it("at=system:sol dives into the solar system when that tier is built (#127)", () => {
    expect(resolve({ at: `system:${SOL_ID}` })).toEqual({
      dive: { id: SOL_ID, tier: "solarSystem" },
      star: null,
    });
  });

  // AC3 — graceful fallback: the v1 ladder has no Solar-System tier, so Sol's
  // interior can't be entered yet.
  it("at=system:sol falls back to no dive in v1 (solarSystem deferred)", () => {
    expect(
      resolveDeepLink(
        { at: `system:${SOL_ID}` },
        { findReal: realById, findStar: starById },
      ),
    ).toBeNull();
  });

  // BR22 (#196) — every Local-Group galaxy is now a gateway, so `?at=galaxy:andromeda`
  // ENTERS Andromeda (dives into its galaxy interior), like the home MW does. The
  // per-galaxy asymmetric `available` set (a neighbour has no solarSystem tier) is
  // threaded through the resolver in slice 2 (#197); here the galaxy interior is built.
  it("at=galaxy:andromeda dives into Andromeda (gateway → galaxy tier, BR22)", () => {
    expect(resolve({ at: "galaxy:andromeda" })).toEqual({
      dive: { id: "andromeda", tier: "galaxy" },
      star: null,
    });
  });

  // AC3 — invalid ids fall back gracefully (no crash, default view).
  it("at=galaxy:<unknown> resolves to null", () => {
    expect(resolve({ at: "galaxy:nope" })).toBeNull();
  });

  it("at with malformed syntax resolves to null", () => {
    expect(resolve({ at: "garbage" })).toBeNull();
  });

  // AC2 — `?star=<id>` still focuses the star, resolved across tiers.
  it("star=<galaxy-tier id> dives into the Milky Way and focuses the star", () => {
    expect(resolve({ star: "s01" })).toEqual({
      dive: { id: HOME_MILKY_WAY_ID, tier: "galaxy" },
      star: "s01",
    });
  });

  it("star=<localGroup-tier id> stays on the Local Group and focuses the star", () => {
    expect(resolve({ star: "lg-star" })).toEqual({
      dive: { id: HOME_MILKY_WAY_ID, tier: "localGroup" },
      star: "lg-star",
    });
  });

  it("star=<unknown> resolves to null (graceful)", () => {
    expect(resolve({ star: "ghost" })).toBeNull();
  });

  // `at` + `star` compose: `at` owns the dive, `star` adds the focus.
  it("at=galaxy:home & star=s01 dives into the MW and focuses the star", () => {
    expect(resolve({ at: "galaxy:home", star: "s01" })).toEqual({
      dive: { id: HOME_MILKY_WAY_ID, tier: "galaxy" },
      star: "s01",
    });
  });

  // A bad `at` next to a good `star` degrades to the star's own resolution —
  // a single broken param can't strand the whole link.
  it("at=<garbage> & star=s01 falls back to the star dive", () => {
    expect(resolve({ at: "garbage", star: "s01" })).toEqual({
      dive: { id: HOME_MILKY_WAY_ID, tier: "galaxy" },
      star: "s01",
    });
  });

  // Determinism / SSR purity: same URL + same dataset ⇒ identical target,
  // call after call (no module-scope clock/random in the mapping).
  it("is a pure function of its inputs (deterministic across calls)", () => {
    const a = resolve({ at: "galaxy:home", star: "s01" });
    const b = resolve({ at: "galaxy:home", star: "s01" });
    expect(a).toEqual(b);
  });
});
