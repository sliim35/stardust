/**
 * Tests for §1 — lgFramingForGalaxy + lgPositionFor (AC1.1/AC1.2/AC1.3, ADR-0018 §1).
 *
 * lgFramingForGalaxy: pure LG-side camera that recenters on a galaxy's LG-stage
 * position at LG_ZOOM. For home (GALAXY_CENTER) it deep-equals LG_FRAMING.
 *
 * lgPositionFor: pure lookup returning GALAXY_CENTER for "home", the neighbour's
 * lgPlacementFor {cx,cy} for a neighbour id, GALAXY_CENTER fallback for unknown.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import {
  LG_FRAMING,
  lgFramingForGalaxy,
  lgPlacementFor,
  lgPositionFor,
} from "#/lib/galaxy/lg-composition";
import { GALAXY_CENTER } from "#/lib/galaxy/place";
import {
  ANDROMEDA_ID,
  HOME_MILKY_WAY_ID,
  REAL_OBJECTS,
} from "#/lib/galaxy/realdata";
import { planTierTransition } from "#/lib/galaxy/tier-transition";

// ─── lgFramingForGalaxy ───────────────────────────────────────────────────────

describe("lgFramingForGalaxy — galaxy-position-aware LG-side camera (AC1.1)", () => {
  it("for home MW (GALAXY_CENTER), deep-equals LG_FRAMING — the home dive is byte-identical", () => {
    const result = lgFramingForGalaxy(GALAXY_CENTER);
    expect(result).toEqual(LG_FRAMING);
  });

  it("has the same zoom as LG_FRAMING regardless of galaxy position (zoom is tier-level)", () => {
    const result = lgFramingForGalaxy({ x: 800, y: 300 });
    expect(result.zoom).toBeCloseTo(LG_FRAMING.zoom);
  });

  it("for an off-center pos, projects that position to its LG screen anchor (camera inverse)", () => {
    // Compute what screen position the off-center framing targets.
    // The formula: S = stage-centre + zoom·(W − camera) ⟹ camera = W − (S − stage-centre)/zoom
    // For lgFramingForGalaxy(pos), the pos should appear at the same screen position
    // as GALAXY_CENTER would under LG_FRAMING.
    const offCenter = { x: 750, y: 350 };
    const framing = lgFramingForGalaxy(offCenter);
    // The screen position of `offCenter` under the derived framing should equal
    // the screen position of GALAXY_CENTER under LG_FRAMING.
    const sxExpected =
      GALAXY_CENTER.x + LG_FRAMING.zoom * (GALAXY_CENTER.x - LG_FRAMING.cx);
    const syExpected =
      GALAXY_CENTER.y + LG_FRAMING.zoom * (GALAXY_CENTER.y - LG_FRAMING.cy);
    const sxActual =
      GALAXY_CENTER.x + framing.zoom * (offCenter.x - framing.cx);
    const syActual =
      GALAXY_CENTER.y + framing.zoom * (offCenter.y - framing.cy);
    expect(sxActual).toBeCloseTo(sxExpected, 5);
    expect(syActual).toBeCloseTo(syExpected, 5);
  });

  it("for Andromeda's LG position, projects Andromeda to its own LG-stage screen anchor", () => {
    const andromeda = REAL_OBJECTS.find((o) => o.id === ANDROMEDA_ID);
    if (!andromeda) throw new Error("andromeda not found");
    const androidPlace = lgPlacementFor(andromeda);
    const androPos = { x: androidPlace.cx, y: androidPlace.cy };

    const framing = lgFramingForGalaxy(androPos);

    // The screen position of Andromeda under the galaxy-aware framing should equal
    // the screen position of the MW (GALAXY_CENTER) under LG_FRAMING.
    // i.e., Andromeda appears where the MW appears in the standard LG view.
    const expectedScreenX =
      GALAXY_CENTER.x + LG_FRAMING.zoom * (GALAXY_CENTER.x - LG_FRAMING.cx);
    const expectedScreenY =
      GALAXY_CENTER.y + LG_FRAMING.zoom * (GALAXY_CENTER.y - LG_FRAMING.cy);

    const actualScreenX =
      GALAXY_CENTER.x + framing.zoom * (androPos.x - framing.cx);
    const actualScreenY =
      GALAXY_CENTER.y + framing.zoom * (androPos.y - framing.cy);

    expect(actualScreenX).toBeCloseTo(expectedScreenX, 5);
    expect(actualScreenY).toBeCloseTo(expectedScreenY, 5);
  });

  it("returns a fresh Camera object — callers cannot mutate the authored framing", () => {
    const a = lgFramingForGalaxy(GALAXY_CENTER);
    const b = lgFramingForGalaxy(GALAXY_CENTER);
    expect(a).not.toBe(b);
  });
});

// ─── lgPositionFor ───────────────────────────────────────────────────────────

describe("lgPositionFor — pure galaxy-id → LG stage position lookup (AC1.3)", () => {
  it("home MW ('home') returns GALAXY_CENTER", () => {
    expect(lgPositionFor(HOME_MILKY_WAY_ID)).toEqual(GALAXY_CENTER);
  });

  it("a neighbour id returns its lgPlacementFor {cx,cy}", () => {
    const andro = REAL_OBJECTS.find((o) => o.id === ANDROMEDA_ID);
    if (!andro) throw new Error("andromeda not found");
    const place = lgPlacementFor(andro);
    expect(lgPositionFor(ANDROMEDA_ID)).toEqual({ x: place.cx, y: place.cy });
  });

  it("lmc returns its lgPlacementFor position", () => {
    const lmc = REAL_OBJECTS.find((o) => o.id === "lmc");
    if (!lmc) throw new Error("lmc not found");
    const place = lgPlacementFor(lmc);
    expect(lgPositionFor("lmc")).toEqual({ x: place.cx, y: place.cy });
  });

  it("unknown id falls back to GALAXY_CENTER", () => {
    expect(lgPositionFor("totally-unknown-galaxy")).toEqual(GALAXY_CENTER);
  });

  it("null falls back to GALAXY_CENTER", () => {
    expect(lgPositionFor(null)).toEqual(GALAXY_CENTER);
  });
});

// ─── planTierTransition with galaxyPos ───────────────────────────────────────

describe("planTierTransition with galaxyPos — off-center dive anchor (AC1.1/AC1.2)", () => {
  it("with no galaxyPos, returns today's behaviour exactly (backward-compat)", () => {
    const plan = planTierTransition("localGroup", "galaxy");
    const planPos = planTierTransition("localGroup", "galaxy", GALAXY_CENTER);
    // Both should produce equivalent plans when galaxyPos === GALAXY_CENTER
    expect(plan).toEqual(planPos);
  });

  it("with an off-center galaxyPos, the LG endpoint differs from the default LG_FRAMING", () => {
    const androPos = lgPositionFor(ANDROMEDA_ID);
    const plan = planTierTransition("localGroup", "galaxy", androPos);
    const defaultPlan = planTierTransition("localGroup", "galaxy");
    if (!plan || !defaultPlan) throw new Error("plan missing");
    // The threshold should differ because the LG endpoint is galaxy-aware
    expect(plan.threshold).not.toEqual(defaultPlan.threshold);
  });

  it("interior rest is always DEFAULT_FRAMING regardless of galaxyPos", () => {
    const androPos = lgPositionFor(ANDROMEDA_ID);
    const plan = planTierTransition("localGroup", "galaxy", androPos);
    if (!plan) throw new Error("plan missing");
    expect(plan.rest).toEqual(DEFAULT_FRAMING);
  });

  it("threshold zoom is geometric mean of the LG-endpoint zoom and DEFAULT_FRAMING zoom", () => {
    const androPos = lgPositionFor(ANDROMEDA_ID);
    const plan = planTierTransition("localGroup", "galaxy", androPos);
    const lgEndpoint = lgFramingForGalaxy(androPos);
    if (!plan) throw new Error("plan missing");
    const expectedZoom = Math.sqrt(lgEndpoint.zoom * DEFAULT_FRAMING.zoom);
    expect(plan.threshold.zoom).toBeCloseTo(expectedZoom, 10);
  });

  it("threshold centre is arithmetic mid between LG-endpoint and DEFAULT_FRAMING", () => {
    const androPos = lgPositionFor(ANDROMEDA_ID);
    const plan = planTierTransition("localGroup", "galaxy", androPos);
    const lgEndpoint = lgFramingForGalaxy(androPos);
    if (!plan) throw new Error("plan missing");
    expect(plan.threshold.cx).toBeCloseTo(
      (lgEndpoint.cx + DEFAULT_FRAMING.cx) / 2,
      10,
    );
    expect(plan.threshold.cy).toBeCloseTo(
      (lgEndpoint.cy + DEFAULT_FRAMING.cy) / 2,
      10,
    );
  });

  it("descend and ascend plans cross the SAME threshold (symmetric — reverse retrace)", () => {
    const androPos = lgPositionFor(ANDROMEDA_ID);
    const descend = planTierTransition("localGroup", "galaxy", androPos);
    const ascend = planTierTransition("galaxy", "localGroup", androPos);
    if (!descend || !ascend) throw new Error("plan missing");
    expect(descend.threshold.cx).toBeCloseTo(ascend.threshold.cx, 10);
    expect(descend.threshold.cy).toBeCloseTo(ascend.threshold.cy, 10);
    expect(descend.threshold.zoom).toBeCloseTo(ascend.threshold.zoom, 10);
  });

  it("existing callers with omitted galaxyPos still produce valid plans (no regression)", () => {
    const plan = planTierTransition("localGroup", "galaxy");
    expect(plan).not.toBeNull();
    expect(plan?.rest).toEqual(DEFAULT_FRAMING);
  });
});
