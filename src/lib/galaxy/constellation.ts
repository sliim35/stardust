/**
 * Emotion-constellation building + the hover affordance — the pure, headless half
 * of the figure behaviour (ADR-0014 §2, evolving the #154 interaction spec §3). The
 * SVG overlay component only draws what this module computes.
 *
 * Hovering (or keyboard-focusing) a memory star fades up its short description and,
 * when the star belongs to an **authored constellation figure**, lights the figure's
 * designed edges while everything else dims. The owner-pinned rules (2026-06-06,
 * issue #154) carry over, re-expressed for the designed-anchor model:
 *
 *  - **rule 1 — same emotion only**: a figure connects same-`emotion` stars; a member
 *    whose mood differs from the figure's emotion is EXCLUDED (validated here, never
 *    trusted);
 *  - **rule 2 — no cross-colour connections**: colour maps from emotion, so a figure
 *    strokes ONE colour by construction — `figureColor` is the single source
 *    (`MOODS[figure.emotion].color`);
 *  - **rule 3 — pre-created figures**: segments come from the figure's authored
 *    anchor `edges` only — never an emergent `createdAt`-ordered chain;
 *  - **a `deep` star is NEVER a node** — Mom's star (`irina`) stays a lone,
 *    unconnected point even if a future dataset wrongly authors it into a figure
 *    (ADR-0010 §1, the singular exception). Hover gives it the short description only.
 *
 * The figure model (ADR-0014 §2): membership is the set of stars whose
 * `group === figure.group`; the Nth-created member (stable `createdAt`/id order) binds
 * to the Nth open anchor (`assignAnchors`), so adding a star never moves an earlier
 * one. `forming`/`finished` is derived from the live member count vs `threshold`,
 * never stored. Beyond completion, members densify between anchors along the
 * silhouette (`slotBeyondCompletion`), append-only.
 *
 * Real objects (Layer A) have no constellation — hover resolves to a subtle
 * "clickable" highlight only (`kind: "real"`).
 */

import { isRealObject } from "#/lib/galaxy/click-router";
import { type Point, polarToXY } from "#/lib/galaxy/place";
import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import { CONSTELLATIONS, MOODS } from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  FigureAnchor,
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
 * The single stroke colour of a figure — its emotion's colour (rule 2). Colour maps
 * from emotion and a figure has ONE emotion, so cross-colour lines are impossible by
 * construction.
 */
export const figureColor = (figure: ConstellationFigure): string =>
  MOODS[figure.emotion].color;

/** One thin connect-line of the overlay, in stage pixels. */
export type ConstellationSegment = { from: Point; to: Point };

/**
 * The VALIDATED members of a figure (rule 1 + the deep-star hard rule), in stable
 * append-only order: a star must share the figure's `emotion` and not be `deep`.
 * Anything else is excluded, never bound. Sorted by `createdAt` ascending (ties
 * broken by `id`) so the order is total + stable — the Nth member always binds to
 * the same open anchor regardless of input array order. Pure; never mutates input.
 */
const validMembers = (
  members: readonly MemoryStar[],
  figure: ConstellationFigure,
): MemoryStar[] =>
  members
    .filter((s) => s.mood === figure.emotion && !s.deep)
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));

/**
 * Bind members to anchors by stable `createdAt`-ascending order (ties by `id`),
 * append-only: the Nth valid member fills the Nth anchor. A later call with one
 * more member never changes an earlier binding (each member's slot depends only on
 * its rank among earlier members, not on the array order). Returns a map of
 * `anchorId → MemoryStar` for the filled anchors only (partial fill leaves later
 * anchors absent from the map). Pure; never mutates input.
 */
export const assignAnchors = (
  members: readonly MemoryStar[],
  anchors: readonly FigureAnchor[],
): Map<string, MemoryStar> => {
  const ordered = [...members].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1),
  );
  const bound = new Map<string, MemoryStar>();
  for (let i = 0; i < anchors.length && i < ordered.length; i++) {
    bound.set(anchors[i].id, ordered[i]);
  }
  return bound;
};

/**
 * Derived figure state (never stored): `finished` once the live valid-member count
 * reaches the figure's `threshold`, else `forming`. A pure function of the data —
 * it can never drift from the live count (ADR-0014 §2, the no-drift rule).
 */
export const figureState = (
  members: readonly MemoryStar[],
  figure: ConstellationFigure,
): "forming" | "finished" =>
  validMembers(members, figure).length >= figure.threshold
    ? "finished"
    : "forming";

/**
 * The figure's REAL connect-lines: exactly the authored anchor `edges` whose BOTH
 * endpoint anchors are filled by a bound member, drawn at the AUTHORED anchor
 * `(r, angle)` positions via `polarToXY` (NOT the member's own scattered position).
 * A forming figure therefore shows only the edges it can honestly draw — no phantom
 * stars, no faked completion (BR27). Cross-emotion / deep / unfilled endpoints drop
 * with their edge. Pure; never mutates input.
 */
export const figureSegments = (
  members: readonly MemoryStar[],
  figure: ConstellationFigure,
): ConstellationSegment[] => {
  const filled = assignAnchors(validMembers(members, figure), figure.anchors);
  const byId = new Map(figure.anchors.map((a) => [a.id, a]));
  return figure.edges.flatMap(([a, b]) => {
    const from = byId.get(a);
    const to = byId.get(b);
    // Both endpoint anchors must be DECLARED and FILLED to draw a real segment.
    return from !== undefined &&
      to !== undefined &&
      filled.has(a) &&
      filled.has(b)
      ? [
          {
            from: polarToXY(from.r, from.angle),
            to: polarToXY(to.r, to.angle),
          },
        ]
      : [];
  });
};

/**
 * The figure's GHOST outline: ALL authored anchor `edges` at their authored
 * positions, regardless of which anchors are filled — the full silhouette drawn at
 * low opacity behind the real segments (BR27). It is the figure's geometry, so it
 * is independent of how many members exist. An edge that references an undeclared
 * anchor is dropped (defensive). Pure.
 */
export const ghostSegments = (
  figure: ConstellationFigure,
): ConstellationSegment[] => {
  const byId = new Map(figure.anchors.map((a) => [a.id, a]));
  return figure.edges.flatMap(([a, b]) => {
    const from = byId.get(a);
    const to = byId.get(b);
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

/** Silhouette starts forming at 2 — a lone star stays a lone star (owner 2026-06-22). */
export const GHOST_MIN_MEMBERS = 2;

/**
 * The overlay's three render sets for one figure. Omitted below `GHOST_MIN_MEMBERS`;
 * finished (≥ `threshold`) leaves `openSlots` empty + `realSegments` the whole figure.
 * (The member jewels render on their anchors elsewhere — the star layer, not here.)
 */
export type FigureRender = {
  group: string;
  color: string;
  /** ALL authored edges — the dashed faint silhouette. */
  ghost: ConstellationSegment[];
  /** Edges whose BOTH endpoints are filled — the solid connect-lines. */
  realSegments: ConstellationSegment[];
  /** Still-unfilled anchor positions — the hollow rings. */
  openSlots: Point[];
};

/** Every authored figure RENDERABLE in `stars` → its `FigureRender`. Pure; never mutates. */
export const figuresInSky = (stars: readonly MemoryStar[]): FigureRender[] => {
  const groups = [
    ...new Set(stars.map((s) => s.group).filter((g): g is string => !!g)),
  ];
  return groups.flatMap((group) => {
    const figure = figureForGroup(group);
    if (figure === null) return [];
    const members = validMembers(stars, figure);
    if (members.length < GHOST_MIN_MEMBERS) return [];
    const filled = assignAnchors(members, figure.anchors);
    return [
      {
        group,
        color: figureColor(figure),
        ghost: ghostSegments(figure),
        realSegments: figureSegments(members, figure),
        openSlots: figure.anchors
          .filter((a) => !filled.has(a.id))
          .map((a) => polarToXY(a.r, a.angle)),
      },
    ];
  });
};

/**
 * The append-only WRITE-PATH placement (#222, ADR-0014 §3): the polar slot a NEW
 * `star` takes in its figure, derived from its stable rank among the figure's valid
 * members (existing + itself, same `assignAnchors` order). Rank < anchors.length →
 * the Nth open anchor's `(r, angle)`; beyond completion → `slotBeyondCompletion`
 * in-between (SSR-safe). `null` when the star can never anchor — it is `deep` (Mom's
 * star, ADR-0010 §1) or its mood differs from the figure's emotion (rule 1). Rank is
 * a pure function of `createdAt`/`id`, so it never reshuffles an earlier member
 * (append-only) and SSR + client agree. Pure; never mutates input.
 */
export const placeOnFigure = (
  star: MemoryStar,
  existingMembers: readonly MemoryStar[],
  figure: ConstellationFigure,
): { r: number; angle: number } | null => {
  // A deep or cross-emotion star never binds — it stays at its own scattered slot.
  if (star.deep || star.mood !== figure.emotion) return null;
  // The new star's rank = how many valid members sort before it (stable order).
  const all = validMembers([...existingMembers, star], figure);
  const rank = all.findIndex((m) => m.id === star.id);
  const anchor = figure.anchors[rank];
  if (anchor !== undefined) return { r: anchor.r, angle: anchor.angle };
  // Beyond completion: densify between anchors; prior beyond-members offset the slot.
  return slotBeyondCompletion(
    star.id,
    figure.anchors,
    figure.edges,
    rank - figure.anchors.length,
  );
};

/**
 * Densify a member that arrives BEYOND completion (all anchors filled): slot it at
 * the midpoint of the least-occupied edge (by `priorBeyondCount % edges.length`,
 * ties by edge index), perturbed by ±0.05 in both `r` and `angle` via
 * `mulberry32(hashStr(memberId))` so members never visually stack. SSR-safe (the
 * shared `placeStar`/backdrop RNG pattern — no `Math.random()`/`Date.now()`) and a
 * pure function of `memberId` + `anchors` + `edges` + `priorBeyondCount`: re-running
 * for the same member always returns the same `(r, angle)`, and a later member never
 * changes an earlier one (append-only, ADR-0014 §2 / spike #194 §3).
 */
export const slotBeyondCompletion = (
  memberId: string,
  anchors: readonly FigureAnchor[],
  edges: readonly (readonly [string, string])[],
  priorBeyondCount: number,
): { r: number; angle: number } => {
  const byId = new Map(anchors.map((a) => [a.id, a]));
  const usable = edges.filter(([a, b]) => byId.has(a) && byId.has(b));
  const fallback = anchors[0] ?? { r: 0.5, angle: 0 };
  if (usable.length === 0) return { r: fallback.r, angle: fallback.angle };
  // Round-robin the least-occupied edge: the Nth beyond-member targets edge N.
  const [aId, bId] = usable[priorBeyondCount % usable.length];
  const a = byId.get(aId) as FigureAnchor;
  const b = byId.get(bId) as FigureAnchor;
  const rng = mulberry32(hashStr(memberId));
  const jitterR = (rng() - 0.5) * 0.1; // [-0.05, +0.05]
  const jitterAngle = (rng() - 0.5) * 0.1; // [-0.05, +0.05]
  return {
    r: (a.r + b.r) / 2 + jitterR,
    angle: (a.angle + b.angle) / 2 + jitterAngle,
  };
};
