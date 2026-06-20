/**
 * BR30 gate-1 — the automated **structural-test harness** for emotion figures
 * (ADR-0014 §5.1). Every authored `ConstellationFigure` must pass `assertFigureValid`
 * before it ships; the second gate (owner legibility sign-off on the preview URL) is a
 * human QA step, out of scope for this pure, headless test.
 *
 * The bar (issue #212 AC1, mirroring ADR-0014 §5.1):
 *  - `anchors.length >= 10`;
 *  - `threshold >= 10`;
 *  - `hostGalaxyId === hostGalaxyFor(figure.emotion)`;
 *  - anchor ids are unique;
 *  - every `edges` endpoint is a declared anchor id;
 *  - a fixture of exactly `threshold` valid members **resolves** — `assignAnchors`
 *    fills EVERY anchor and `figureState` returns `'finished'`.
 *
 * `CONSTELLATIONS` is currently EMPTY (the per-emotion silhouette geometries are a
 * downstream design-role deliverable, BR30-gated), so the iterate-the-real-figures
 * suite passes vacuously today. An `it.todo(<emotion>)` placeholder per emotion holds
 * a slot for each authored figure — flip a `todo` to a real `assertFigureValid` call
 * once that emotion's silhouette lands.
 */

import { describe, expect, it } from "vitest";
import { assignAnchors, figureState } from "#/lib/galaxy/constellation";
import { polarToXY } from "#/lib/galaxy/place";
import {
  CONSTELLATIONS,
  EMOTION_VALUES,
  hostGalaxyFor,
} from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  FigureAnchor,
  MemoryStar,
} from "#/lib/galaxy/types";

/**
 * Build a fixture of exactly `count` valid members for a figure: same `emotion`,
 * not `deep`, distinct ascending `createdAt` so the binding order is total + stable.
 * Pure — no `Date.now()` / `Math.random()`.
 */
const membersFor = (figure: ConstellationFigure, count: number): MemoryStar[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${figure.group}-m${String(i).padStart(3, "0")}`,
    text: `member ${i}`,
    mood: figure.emotion,
    color: "#000000",
    r: 0.5,
    angle: 1,
    brightness: 0.7,
    createdAt: i,
    group: figure.group,
  }));

/**
 * The reusable BR30 gate-1 assertion. Throws (via vitest `expect`) with a clear,
 * figure-scoped message on the first violated structural rule. Reused by both the
 * real-`CONSTELLATIONS` iteration and the self-test of broken variants. Kept module-
 * local (not exported): Biome forbids exports from a test file, and nothing outside
 * this harness consumes it — when a future story authors a figure it imports its
 * geometry HERE and re-runs the gate, it does not import the gate elsewhere.
 */
const assertFigureValid = (figure: ConstellationFigure): void => {
  const where = `figure "${figure.group}" (${figure.emotion})`;

  // ── anchors.length >= 10 ──────────────────────────────────────────────────
  expect(
    figure.anchors.length,
    `${where}: needs >= 10 anchors, has ${figure.anchors.length}`,
  ).toBeGreaterThanOrEqual(10);

  // ── threshold >= 10 ───────────────────────────────────────────────────────
  expect(
    figure.threshold,
    `${where}: threshold must be >= 10, is ${figure.threshold}`,
  ).toBeGreaterThanOrEqual(10);

  // ── hostGalaxyId === hostGalaxyFor(emotion) (derived, never drifts) ────────
  expect(
    figure.hostGalaxyId,
    `${where}: hostGalaxyId must equal hostGalaxyFor("${figure.emotion}")`,
  ).toBe(hostGalaxyFor(figure.emotion));

  // ── anchor ids are unique ─────────────────────────────────────────────────
  const ids = figure.anchors.map((a) => a.id);
  const uniqueIds = new Set(ids);
  expect(
    uniqueIds.size,
    `${where}: anchor ids must be unique, found ${ids.length - uniqueIds.size} duplicate(s) in [${ids.join(", ")}]`,
  ).toBe(ids.length);

  // ── every edge endpoint is a declared anchor id ───────────────────────────
  for (const [a, b] of figure.edges) {
    expect(
      uniqueIds.has(a),
      `${where}: edge endpoint "${a}" is not a declared anchor id`,
    ).toBe(true);
    expect(
      uniqueIds.has(b),
      `${where}: edge endpoint "${b}" is not a declared anchor id`,
    ).toBe(true);
  }

  // ── a `threshold`-member fixture resolves: every anchor filled + finished ──
  const members = membersFor(figure, figure.threshold);
  const bound = assignAnchors(members, figure.anchors);
  expect(
    bound.size,
    `${where}: a ${figure.threshold}-member fixture must fill all ${figure.anchors.length} anchors, filled ${bound.size}`,
  ).toBe(figure.anchors.length);
  expect(
    figureState(members, figure),
    `${where}: a ${figure.threshold}-member fixture must reach 'finished'`,
  ).toBe("finished");
};

// ── AC2 — iterate the REAL figures + an it.todo per emotion ──────────────────
describe("CONSTELLATIONS — every authored figure passes BR30 gate-1", () => {
  const figures = Object.entries(CONSTELLATIONS);

  it("starts empty (per-emotion geometries are authored downstream)", () => {
    // Sanity pin: the iteration below is vacuous until figures are authored, so the
    // `it.todo` placeholders are what currently track the 12 emotions.
    expect(figures.length).toBe(0);
  });

  // Vacuous today (empty map); becomes the live gate as figures are authored.
  for (const [key, figure] of figures) {
    it(`${key} (${figure.emotion}) is structurally valid`, () => {
      assertFigureValid(figure);
    });
  }

  // One placeholder per emotion: flip its `todo` to a real `assertFigureValid`
  // call once that emotion's silhouette geometry lands (BR30-gated).
  for (const emotion of EMOTION_VALUES) {
    it.todo(`authors + verifies the ${emotion} figure`);
  }
});

// ── AC3 — self-test: one valid 10-anchor figure passes; broken variants fail ─
describe("assertFigureValid — self-test against a known-good 10-anchor figure", () => {
  // A hand-built valid figure: 10 distinct anchors, a closed 10-edge ring whose
  // every endpoint is a declared anchor, threshold 10, host derived from emotion.
  const baseAnchors: FigureAnchor[] = Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`,
    r: 0.3 + i * 0.05,
    angle: (i / 10) * Math.PI * 2,
  }));

  const baseEdges: ReadonlyArray<readonly [string, string]> = Array.from(
    { length: 10 },
    (_, i) => [`a${i}`, `a${(i + 1) % 10}`] as const,
  );

  const validFigure: ConstellationFigure = {
    group: "joyful-figure",
    emotion: "joyful",
    hostGalaxyId: hostGalaxyFor("joyful"), // "home"
    threshold: 10,
    anchors: baseAnchors,
    edges: baseEdges,
  };

  it("a valid 10-anchor figure passes (and the ring endpoints all resolve)", () => {
    expect(() => assertFigureValid(validFigure)).not.toThrow();
    // The polar anchors are real points (smoke check the geometry seam is wired).
    expect(polarToXY(baseAnchors[0].r, baseAnchors[0].angle)).toBeDefined();
  });

  it("fails on 9 anchors (below the >= 10 floor)", () => {
    const nineAnchors = baseAnchors.slice(0, 9);
    const broken: ConstellationFigure = {
      ...validFigure,
      anchors: nineAnchors,
      // Keep edges valid against the surviving anchors so the FAILURE is the count.
      edges: Array.from(
        { length: 9 },
        (_, i) => [`a${i}`, `a${(i + 1) % 9}`] as const,
      ),
    };
    expect(() => assertFigureValid(broken)).toThrow(/>= 10 anchors/);
  });

  it("fails on a dangling edge (endpoint is not a declared anchor)", () => {
    const broken: ConstellationFigure = {
      ...validFigure,
      edges: [...baseEdges, ["a0", "ghost"] as const],
    };
    expect(() => assertFigureValid(broken)).toThrow(
      /endpoint "ghost" is not a declared anchor/,
    );
  });

  it("fails on a wrong host galaxy (does not match hostGalaxyFor(emotion))", () => {
    const broken: ConstellationFigure = {
      ...validFigure,
      hostGalaxyId: "andromeda", // joyful → "home", so this is wrong
    };
    expect(() => assertFigureValid(broken)).toThrow(/hostGalaxyId must equal/);
  });

  it("fails on a duplicate anchor id", () => {
    const dupAnchors: FigureAnchor[] = [
      ...baseAnchors.slice(0, 9),
      { id: "a0", r: 0.9, angle: 1 }, // duplicate of anchors[0].id
    ];
    const broken: ConstellationFigure = {
      ...validFigure,
      anchors: dupAnchors,
    };
    expect(() => assertFigureValid(broken)).toThrow(
      /anchor ids must be unique/,
    );
  });

  it("fails on threshold < 10 (the BR27 finished floor)", () => {
    const broken: ConstellationFigure = { ...validFigure, threshold: 9 };
    expect(() => assertFigureValid(broken)).toThrow(/threshold must be >= 10/);
  });

  it("fails when a threshold-member fixture cannot fill every anchor", () => {
    // threshold (10) < anchors.length (11) → assignAnchors leaves one anchor open.
    const elevenAnchors: FigureAnchor[] = [
      ...baseAnchors,
      { id: "a10", r: 0.9, angle: 2 },
    ];
    const broken: ConstellationFigure = {
      ...validFigure,
      anchors: elevenAnchors,
      edges: [...baseEdges, ["a10", "a0"] as const],
      threshold: 10,
    };
    expect(() => assertFigureValid(broken)).toThrow(/must fill all 11 anchors/);
  });
});
