/**
 * Mood-constellation building + the hover affordance — the pure, headless half of
 * the #154 hover behaviour (interaction spec §3). The SVG overlay component only
 * draws what this module computes.
 *
 * Hovering (or keyboard-focusing) a memory star fades up its short description
 * and, when the star belongs to an **authored constellation figure**, lights the
 * figure's designed edges while everything else dims. The owner-pinned rules
 * (2026-06-06, issue #154):
 *
 *  - **rule 1 — same mood only**: a figure connects same-`mood` stars; a member
 *    whose mood differs from the figure's mood is EXCLUDED (validated here,
 *    never trusted);
 *  - **rule 2 — no cross-colour connections**: colour maps from mood, so a
 *    figure strokes ONE colour by construction — `figureColor` is the single
 *    source (`MOODS[figure.mood].color`);
 *  - **rule 3 — pre-created figures**: segments come from the figure's authored
 *    `edges` only — never an emergent `createdAt`-ordered chain;
 *  - **a `deep` star is NEVER a node** — Mom's star (`irina`) stays a lone,
 *    unconnected point even if a future dataset wrongly authors it into a
 *    figure (ADR-0010 §1, the singular exception). Hover gives it the short
 *    description only — exactly like any solo-mood star without a figure.
 *
 * Real objects (Layer A) have no constellation — hover resolves to a subtle
 * "clickable" highlight only (`kind: "real"`); the real-object layer adopts it
 * when its interactive DOM lands (slice I, #112).
 */

import { isRealObject } from "#/lib/galaxy/click-router";
import { type Point, polarToXY } from "#/lib/galaxy/place";
import { CONSTELLATIONS, MOODS } from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  MemoryStar,
  RealObject,
} from "#/lib/galaxy/types";

/** Anything the pointer can rest on — a real object or a memory star. */
export type HoverTarget = RealObject | MemoryStar;

/**
 * What hover lights for a target (spec §3): a memory star fades up its short
 * description, plus its figure when `group` is non-null; a real object gets
 * only the subtle clickable highlight.
 */
export type HoverAffordance =
  | { kind: "memory"; group: string | null }
  | { kind: "real" };

/**
 * Resolve a hover target to its affordance. A `deep` star's group is always
 * `null` — Mom's star never joins a constellation, whatever its data says.
 */
export const hoverAffordanceFor = (target: HoverTarget): HoverAffordance => {
  if (isRealObject(target)) return { kind: "real" };
  const group = !target.deep && target.group ? target.group : null;
  return { kind: "memory", group };
};

/** Resolve a star's `group` key to its authored figure, or `null` for none. */
export const figureForGroup = (group: string): ConstellationFigure | null =>
  Object.values(CONSTELLATIONS).find((f) => f.group === group) ?? null;

/**
 * The single stroke colour of a figure — its mood's colour (rule 2). Colour maps
 * from mood and a figure has ONE mood, so cross-colour lines are impossible by
 * construction.
 */
export const figureColor = (figure: ConstellationFigure): string =>
  MOODS[figure.mood].color;

/**
 * The VALIDATED nodes of an authored figure, in authored member order: a member
 * id must resolve to a star that shares the figure's `mood` (rule 1) and is not
 * `deep` (the owner hard constraint) — anything else is excluded, never drawn.
 * Pure; never mutates the input.
 */
export const constellationNodes = (
  stars: readonly MemoryStar[],
  figure: ConstellationFigure,
): MemoryStar[] => {
  const byId = new Map(stars.map((s) => [s.id, s]));
  return figure.members.flatMap((id) => {
    const star = byId.get(id);
    return star !== undefined && star.mood === figure.mood && !star.deep
      ? [star]
      : [];
  });
};

/** One thin connect-line of the overlay, in stage pixels. */
export type ConstellationSegment = { from: Point; to: Point };

/**
 * The figure's connect-lines: exactly its authored `edges` (rule 3) at the
 * nodes' `polarToXY` stage positions. An edge touching an excluded node
 * (cross-mood / deep / missing) is dropped with it.
 */
export const constellationSegments = (
  stars: readonly MemoryStar[],
  figure: ConstellationFigure,
): ConstellationSegment[] => {
  const nodes = new Map(
    constellationNodes(stars, figure).map((s) => [s.id, s]),
  );
  return figure.edges.flatMap(([a, b]) => {
    const from = nodes.get(a);
    const to = nodes.get(b);
    return from !== undefined && to !== undefined
      ? [
          {
            from: polarToXY(from.r, from.angle),
            to: polarToXY(to.r, to.angle),
          },
        ]
      : [];
  });
};
