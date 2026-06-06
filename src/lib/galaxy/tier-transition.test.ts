import { describe, expect, it } from "vitest";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import { GALAXY_CENTER } from "#/lib/galaxy/place";
import {
  arrivalNarration,
  createTierTransitionController,
  departNarration,
  directionOf,
  framingForTier,
  planTierTransition,
  type TierTransitionRequest,
} from "#/lib/galaxy/tier-transition";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

describe("framingForTier — the pure per-tier resting camera (#125)", () => {
  it("rests the galaxy tier on the home framing (the identity camera)", () => {
    expect(framingForTier("galaxy")).toEqual(DEFAULT_FRAMING);
  });

  it("rests the Local-Group tier wider (zoomed out) on the same centre", () => {
    const lg = framingForTier("localGroup");
    expect(lg).not.toBeNull();
    expect(lg?.cx).toBe(GALAXY_CENTER.x);
    expect(lg?.cy).toBe(GALAXY_CENTER.y);
    expect(lg?.zoom).toBeLessThan(DEFAULT_FRAMING.zoom);
    expect(lg?.zoom).toBeGreaterThan(0);
  });

  it("has no framing for the deferred Solar-System tier (#127) — null, no throw", () => {
    expect(framingForTier("solarSystem")).toBeNull();
  });

  it("returns a fresh copy each call — callers can never mutate the authored framing", () => {
    const a = framingForTier("galaxy");
    const b = framingForTier("galaxy");
    expect(a).not.toBe(b);
  });
});

describe("directionOf — descend goes deeper, ascend goes wider (spec §1)", () => {
  it("localGroup → galaxy is a descend (zoom in)", () => {
    expect(directionOf("localGroup", "galaxy")).toBe("descend");
  });

  it("galaxy → localGroup is an ascend (zoom out)", () => {
    expect(directionOf("galaxy", "localGroup")).toBe("ascend");
  });

  it("galaxy → solarSystem is a descend", () => {
    expect(directionOf("galaxy", "solarSystem")).toBe("descend");
  });

  it("a same-tier 'move' has no direction", () => {
    expect(directionOf("galaxy", "galaxy")).toBeNull();
  });
});

describe("planTierTransition — the pure targets the timeline tweens toward", () => {
  it("plans the LG → MW descend onto the galaxy resting framing", () => {
    const plan = planTierTransition("localGroup", "galaxy");
    expect(plan).not.toBeNull();
    expect(plan?.from).toBe("localGroup");
    expect(plan?.to).toBe("galaxy");
    expect(plan?.direction).toBe("descend");
    expect(plan?.rest).toEqual(DEFAULT_FRAMING);
  });

  it("plans the MW → LG ascend onto the wider Local-Group framing", () => {
    const plan = planTierTransition("galaxy", "localGroup");
    expect(plan?.direction).toBe("ascend");
    expect(plan?.rest).toEqual(framingForTier("localGroup"));
  });

  it("puts the threshold framing between the two rests (geometric-mean zoom)", () => {
    const plan = planTierTransition("galaxy", "localGroup");
    const lg = framingForTier("localGroup");
    if (!plan || !lg) throw new Error("plan/framing missing");
    expect(plan.threshold.cx).toBe((DEFAULT_FRAMING.cx + lg.cx) / 2);
    expect(plan.threshold.cy).toBe((DEFAULT_FRAMING.cy + lg.cy) / 2);
    expect(plan.threshold.zoom).toBeCloseTo(
      Math.sqrt(DEFAULT_FRAMING.zoom * lg.zoom),
    );
    // Strictly between the two ends — the scene swap happens mid-flight.
    expect(plan.threshold.zoom).toBeGreaterThan(lg.zoom);
    expect(plan.threshold.zoom).toBeLessThan(DEFAULT_FRAMING.zoom);
  });

  it("is symmetric — both directions cross the SAME threshold framing (no jump on reverse)", () => {
    const down = planTierTransition("localGroup", "galaxy");
    const up = planTierTransition("galaxy", "localGroup");
    expect(down?.threshold).toEqual(up?.threshold);
  });

  it("declines a same-tier plan", () => {
    expect(planTierTransition("galaxy", "galaxy")).toBeNull();
  });

  it("declines plans into/out of the unbuilt Solar-System tier (#127) — no throw", () => {
    expect(planTierTransition("galaxy", "solarSystem")).toBeNull();
    expect(planTierTransition("solarSystem", "galaxy")).toBeNull();
  });
});

describe("departNarration — which ASTRO line fires as a transition starts (en+ru)", () => {
  it("descending into the galaxy speaks the descend.toGalaxy line in both locales", () => {
    expect(departNarration(en.astroNarration, "descend", "galaxy")).toBe(
      en.astroNarration.descend.toGalaxy,
    );
    expect(departNarration(ru.astroNarration, "descend", "galaxy")).toBe(
      ru.astroNarration.descend.toGalaxy,
    );
  });

  it("ascending to the Local Group speaks the ascend.toLocalGroup line in both locales", () => {
    expect(departNarration(en.astroNarration, "ascend", "localGroup")).toBe(
      en.astroNarration.ascend.toLocalGroup,
    );
    expect(departNarration(ru.astroNarration, "ascend", "localGroup")).toBe(
      ru.astroNarration.ascend.toLocalGroup,
    );
  });

  it("maps the remaining valid moves (post-#127 seam) to their catalog keys", () => {
    expect(departNarration(en.astroNarration, "descend", "solarSystem")).toBe(
      en.astroNarration.descend.toSolarSystem,
    );
    expect(departNarration(en.astroNarration, "ascend", "galaxy")).toBe(
      en.astroNarration.ascend.toGalaxy,
    );
  });

  it("returns null for impossible moves (descend to the ceiling / ascend to the floor)", () => {
    expect(
      departNarration(en.astroNarration, "descend", "localGroup"),
    ).toBeNull();
    expect(
      departNarration(en.astroNarration, "ascend", "solarSystem"),
    ).toBeNull();
  });
});

describe("arrivalNarration — the on-arrival line when a tier settles (en+ru)", () => {
  it("resolves every tier to its onArrival line in both locales", () => {
    for (const tier of ["localGroup", "galaxy", "solarSystem"] as const) {
      expect(arrivalNarration(en.astroNarration, tier)).toBe(
        en.astroNarration.onArrival[tier],
      );
      expect(arrivalNarration(ru.astroNarration, tier)).toBe(
        ru.astroNarration.onArrival[tier],
      );
    }
  });
});

describe("createTierTransitionController — the request channel to the camera hook", () => {
  it("fans a request out to every subscriber", () => {
    const ctl = createTierTransitionController();
    const a: TierTransitionRequest[] = [];
    const b: TierTransitionRequest[] = [];
    ctl.subscribe((r) => a.push(r));
    ctl.subscribe((r) => b.push(r));
    ctl.request("galaxy", "localGroup");
    expect(a).toEqual([{ from: "galaxy", to: "localGroup" }]);
    expect(b).toEqual(a);
  });

  it("stops delivering after unsubscribe", () => {
    const ctl = createTierTransitionController();
    const seen: TierTransitionRequest[] = [];
    const off = ctl.subscribe((r) => seen.push(r));
    ctl.request("galaxy", "localGroup");
    off();
    ctl.request("localGroup", "galaxy");
    expect(seen).toHaveLength(1);
  });
});
