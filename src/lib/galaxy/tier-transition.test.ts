import { describe, expect, it } from "vitest";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import { LG_FRAMING } from "#/lib/galaxy/lg-composition";
import { GALAXY_CENTER } from "#/lib/galaxy/place";
import { ANDROMEDA_ID, HOME_MILKY_WAY_ID } from "#/lib/galaxy/realdata";
import {
  arrivalNarration,
  createTierTransitionController,
  departNarration,
  directionOf,
  entryNarration,
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

  it("rests the Local-Group tier on the I-2 composed framing (zoomed out)", () => {
    const lg = framingForTier("localGroup");
    expect(lg).toEqual(LG_FRAMING); // the composition module owns the LG view
    expect(lg?.zoom).toBeLessThan(DEFAULT_FRAMING.zoom);
    expect(lg?.zoom).toBeGreaterThan(0);
  });

  // #248 (AC1) — the Solar-System tier is now BUILT: it rests on a real Camera
  // centred on GALAXY_CENTER (the world-invariant centre Sol is authored at) at
  // zoom ≥ 1, so the dive into Sol lands on the same world centre the MW did.
  it("rests the Solar-System tier on GALAXY_CENTER at zoom ≥ 1 (#248 AC1)", () => {
    const ss = framingForTier("solarSystem");
    expect(ss).not.toBeNull();
    expect(ss?.cx).toBe(GALAXY_CENTER.x);
    expect(ss?.cy).toBe(GALAXY_CENTER.y);
    // zoom ≥ 1, and strictly DEEPER than the galaxy rest so the descent reads as
    // a zoom-in (AC4) rather than a pure scene-swap with no camera move.
    expect(ss?.zoom).toBeGreaterThanOrEqual(1);
    expect(ss?.zoom).toBeGreaterThan(DEFAULT_FRAMING.zoom);
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

  // #248 (AC4) — the galaxy → Solar-System dive now PLANS (the tier is built): a
  // descend onto the solarSystem rest, zoom-in by construction.
  it("plans the MW → Solar-System descend onto the tier-3 rest (#248 AC4)", () => {
    const plan = planTierTransition("galaxy", "solarSystem");
    expect(plan).not.toBeNull();
    expect(plan?.from).toBe("galaxy");
    expect(plan?.to).toBe("solarSystem");
    expect(plan?.direction).toBe("descend");
    expect(plan?.rest).toEqual(framingForTier("solarSystem"));
    // The threshold zoom sits strictly between the galaxy rest and the deeper
    // solarSystem rest — the scene swaps mid zoom-in.
    const ss = framingForTier("solarSystem");
    if (!plan || !ss) throw new Error("plan/framing missing");
    expect(plan.threshold.zoom).toBeGreaterThan(DEFAULT_FRAMING.zoom);
    expect(plan.threshold.zoom).toBeLessThan(ss.zoom);
  });

  // #248 (AC6) — the reverse Solar-System → galaxy ascend plans symmetrically and
  // crosses the SAME threshold framing (no jump on a mid-flight reverse).
  it("plans the Solar-System → MW ascend, symmetric with the descend (#248 AC6)", () => {
    const up = planTierTransition("solarSystem", "galaxy");
    const down = planTierTransition("galaxy", "solarSystem");
    expect(up?.direction).toBe("ascend");
    expect(up?.rest).toEqual(DEFAULT_FRAMING);
    expect(up?.threshold).toEqual(down?.threshold);
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

describe("entryNarration — per-galaxy ASTRO entry line keyed by galaxyId (BR22-frame #198)", () => {
  it("entering the home Milky Way keeps the existing MW-worded arrival line (unchanged)", () => {
    // AC5: the MW entry is unchanged — the curated onArrival.galaxy line, not a lore line.
    expect(entryNarration(en.astroNarration, en.lore, HOME_MILKY_WAY_ID)).toBe(
      en.astroNarration.onArrival.galaxy,
    );
    expect(entryNarration(ru.astroNarration, ru.lore, HOME_MILKY_WAY_ID)).toBe(
      ru.astroNarration.onArrival.galaxy,
    );
  });

  it("null galaxyId (the LG overview / home fallback) speaks the MW arrival line", () => {
    expect(entryNarration(en.astroNarration, en.lore, null)).toBe(
      en.astroNarration.onArrival.galaxy,
    );
  });

  it("entering a neighbour speaks THAT galaxy's lore line, not the MW string (en+ru)", () => {
    // AC5: Andromeda entry → lore.andromeda.line ("a trillion stars drifting…"), reusing
    // the authored catalog entry — no new i18n keys.
    expect(entryNarration(en.astroNarration, en.lore, ANDROMEDA_ID)).toBe(
      en.lore.andromeda.line,
    );
    expect(entryNarration(ru.astroNarration, ru.lore, ANDROMEDA_ID)).toBe(
      ru.lore.andromeda.line,
    );
    expect(entryNarration(en.astroNarration, en.lore, "lmc")).toBe(
      en.lore.lmc.line,
    );
    expect(entryNarration(en.astroNarration, en.lore, "triangulum")).toBe(
      en.lore.triangulum.line,
    );
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
    expect(a).toEqual([{ from: "galaxy", to: "localGroup", galaxyId: null }]);
    expect(b).toEqual(a);
  });

  it("carries the focused galaxyId through the request (BR22-frame #198)", () => {
    const ctl = createTierTransitionController();
    const seen: TierTransitionRequest[] = [];
    ctl.subscribe((r) => seen.push(r));
    // The node-aware dive: the request remembers WHICH galaxy so the scene-swap at the
    // threshold renders the right disk + lore (identity, not geometry).
    ctl.request("localGroup", "galaxy", ANDROMEDA_ID);
    expect(seen).toEqual([
      { from: "localGroup", to: "galaxy", galaxyId: ANDROMEDA_ID },
    ]);
  });

  it("defaults galaxyId to null when the caller omits it (back-compat)", () => {
    const ctl = createTierTransitionController();
    const seen: TierTransitionRequest[] = [];
    ctl.subscribe((r) => seen.push(r));
    ctl.request("galaxy", "localGroup");
    expect(seen[0].galaxyId).toBeNull();
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
