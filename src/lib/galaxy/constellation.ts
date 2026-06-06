/**
 * Mood-constellation building + the hover affordance — the pure, headless half of
 * the #154 hover behaviour (interaction spec §3). The SVG overlay component only
 * draws what this module computes.
 *
 * Hovering (or keyboard-focusing) a memory star fades up its short description
 * and, when the star belongs to a mood constellation, lights the thin connect-
 * lines to its same-`group` siblings (in `createdAt` order) while everything
 * else dims. Two hard rules live here, owner-pinned (2026-06-06):
 *
 *  - **ungrouped stars are never constellation nodes** — a star without `group`
 *    is always a lone point;
 *  - **a `deep` star is NEVER connected** — Mom's star (`irina`) stays a lone,
 *    unconnected point even if a future dataset wrongly hands it a `group`
 *    (ADR-0010 §1, the singular exception). Hover gives it the short
 *    description only.
 *
 * Real objects (Layer A) have no constellation — hover resolves to a subtle
 * "clickable" highlight only (`kind: "real"`); the real-object layer adopts it
 * when its interactive DOM lands (slice I, #112).
 */

import { isRealObject } from "#/lib/galaxy/click-router";
import { type Point, polarToXY } from "#/lib/galaxy/place";
import type { MemoryStar, RealObject } from "#/lib/galaxy/types";

/** Anything the pointer can rest on — a real object or a memory star. */
export type HoverTarget = RealObject | MemoryStar;

/**
 * What hover lights for a target (spec §3): a memory star fades up its short
 * description, plus its constellation when `group` is non-null; a real object
 * gets only the subtle clickable highlight.
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

/**
 * The ordered nodes of one mood constellation: every star of `group`, in
 * `createdAt` order — skipping ungrouped stars (no `group`) and ALWAYS skipping
 * `deep` stars (the owner hard constraint). Pure; never mutates the input.
 */
export const constellationNodes = (
  stars: readonly MemoryStar[],
  group: string,
): MemoryStar[] =>
  stars
    .filter((s) => s.group === group && !s.deep)
    .sort((a, b) => a.createdAt - b.createdAt);

/** One thin connect-line of the overlay, in stage pixels. */
export type ConstellationSegment = { from: Point; to: Point };

/**
 * Consecutive connect-lines between ordered nodes — N nodes → N-1 segments at
 * their `polarToXY` stage positions. Fewer than two nodes draw nothing.
 */
export const constellationSegments = (
  nodes: readonly MemoryStar[],
): ConstellationSegment[] =>
  nodes.slice(1).map((node, i) => ({
    from: polarToXY(nodes[i].r, nodes[i].angle),
    to: polarToXY(node.r, node.angle),
  }));
