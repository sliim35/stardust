import { describe, expect, it } from "vitest";
import {
  type AstroPill,
  type PillContext,
  pillsFor,
  promptNarrationRequest,
} from "#/lib/galaxy/astro-pills";
import { en } from "#/lib/i18n/messages/en";

// The live nav slice the selector reads. `galaxyId: null` ≡ the Local-Group
// overview / un-entered; `"home"` is the Milky Way (the only galaxy with the
// Solar-System tier). Mirrors `TierNavState`.
const ctx = (over: Partial<PillContext> = {}): PillContext => ({
  tier: "galaxy",
  galaxyId: "home",
  ...over,
});

const ids = (pills: readonly AstroPill[]): string[] => pills.map((p) => p.id);

describe("pillsFor — tier-aware nav availability (AC9)", () => {
  it("includes the Sol dive pill at the home galaxy tier", () => {
    expect(ids(pillsFor(ctx({ tier: "galaxy", galaxyId: "home" })))).toContain(
      "nav-sol",
    );
  });

  it("omits the Sol dive pill at the local-group overview (Sol unreachable there)", () => {
    expect(
      ids(pillsFor(ctx({ tier: "localGroup", galaxyId: null }))),
    ).not.toContain("nav-sol");
  });

  it("omits the Sol dive pill inside a neighbour galaxy (no Solar-System tier)", () => {
    // Andromeda has no Sol tier — a Sol pill would clamp to a no-op.
    expect(
      ids(pillsFor(ctx({ tier: "galaxy", galaxyId: "andromeda" }))),
    ).not.toContain("nav-sol");
  });

  it("at the Solar-System tier includes 'Back out' but not 'Sol'", () => {
    const got = ids(pillsFor(ctx({ tier: "solarSystem", galaxyId: "home" })));
    expect(got).toContain("nav-back");
    expect(got).not.toContain("nav-sol");
  });

  it("omits the 'Back out' pill at the local-group ceiling (nothing wider)", () => {
    expect(
      ids(pillsFor(ctx({ tier: "localGroup", galaxyId: null }))),
    ).not.toContain("nav-back");
  });

  it("includes 'Back out' inside a galaxy (ascend to the local group is available)", () => {
    expect(ids(pillsFor(ctx({ tier: "galaxy", galaxyId: "home" })))).toContain(
      "nav-back",
    );
  });
});

describe("pillsFor — every returned pill is well-formed", () => {
  it("references a real catalog label key and a real action", () => {
    for (const pill of pillsFor(ctx())) {
      expect(en.astroHub.pills[pill.labelKey]).toBeTypeOf("string");
      expect(pill.kind === "nav" || pill.kind === "prompt").toBe(true);
    }
  });

  it("ships prompt pills (a conversational suggested-prompt is always present)", () => {
    expect(
      pillsFor(ctx({ tier: "galaxy", galaxyId: "home" })).some(
        (p) => p.kind === "prompt",
      ),
    ).toBe(true);
  });
});

describe("promptNarrationRequest — speakLore request build (AC9)", () => {
  it("resolves a speakLore loreKey to its catalog {key, subject}", () => {
    expect(promptNarrationRequest("earth", en.lore)).toEqual({
      key: "earth",
      subject: en.lore.earth.name,
    });
  });
});
