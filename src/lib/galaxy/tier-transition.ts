/**
 * Pure tier-transition math + narration routing for the guided tier-zoom (#125,
 * interaction spec §1, ADR-0009 step 4). This module owns the *spatial decisions*
 * of a tier change — the per-tier resting framings, the threshold framing where
 * the scene swaps, and WHICH ASTRO narration line fires for which move — all
 * headless-tested. The `gsap.timeline()` that eases between these targets lives
 * in `components/galaxy/useGalaxyCamera` (the ADR-0009 import boundary: GSAP only
 * ever tweens *toward* what this module computes, never under `src/lib/**`).
 *
 * **Framings:** the galaxy/home tier rests on the identity framing
 * (`DEFAULT_FRAMING`); the Local-Group tier rests on `LG_FRAMING`, owned by the
 * I-2 composition (`lg-composition.ts`) so the camera and the composed scene
 * can never drift apart. Because the MW's world centre is tier-invariant
 * (GALAXY_CENTER), the LG→MW descend path — rest → threshold → identity —
 * reads as a dive INTO the MW disk.
 *
 * Narration is HARDCODED i18n (en+ru) — the catalog's `astroNarration.*` keys are
 * exactly the seam the post-v1 ASTRO-AI (#128) swaps behind. The resolvers take
 * the catalog *slice*, never import a locale, so they stay pure and the tests
 * cover both languages.
 *
 * SSR/Workers-safe: no module-scope clock/random/DOM; the controller mirrors the
 * `FocusController` request-channel pattern (`focus.ts`).
 */

import type { Camera } from "#/lib/galaxy/camera";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import { LG_FRAMING } from "#/lib/galaxy/lg-composition";
import { GALAXY_CENTER } from "#/lib/galaxy/place";
import { HOME_MILKY_WAY_ID, loreKeyForGalaxy } from "#/lib/galaxy/realdata";
import { TIER_ORDER } from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";
import type { Messages } from "#/lib/i18n/types";

/**
 * The Solar-System resting framing (ADR-0016 §4, #248). Sol is authored at the
 * tier centre (`SOL_SYSTEM_ID`'s scene composes around `GALAXY_CENTER`, the
 * world-invariant centre the MW also uses), so the dive INTO Sol lands on the
 * same world centre — mirroring the LG→MW descend. The zoom is one step DEEPER
 * than the galaxy rest (`DEFAULT_FRAMING.zoom` = 1) so the descent reads as a
 * zoom-in (the planet ring fills the stage) rather than a pure scene-swap with no
 * camera move; the ratio mirrors the LG→MW step (1/`LG_ZOOM` ≈ 1.18) for a
 * consistent dive scale across tiers.
 */
const SOLAR_FRAMING = {
  cx: GALAXY_CENTER.x,
  cy: GALAXY_CENTER.y,
  zoom: 1.18,
} as const satisfies Camera;

/**
 * The per-tier resting camera framings (spec §1: within a tier the framing is
 * fixed). The galaxy/home tier IS the identity framing the camera already rests
 * on (`DEFAULT_FRAMING`); the Local-Group tier rests on the I-2 composition's
 * `LG_FRAMING` (zoomed out, the MW slightly low — the FINAL proof); the
 * Solar-System tier rests on `SOLAR_FRAMING` (centred on Sol at the tier centre,
 * zoomed in — ADR-0016 §4, #248). Every tier is now built, so a tier transition
 * always has a framing target and never no-ops.
 */
const TIER_FRAMINGS = {
  localGroup: LG_FRAMING,
  galaxy: DEFAULT_FRAMING,
  solarSystem: SOLAR_FRAMING,
} as const satisfies Partial<Record<Tier, Camera>>;

/**
 * The resting framing for a tier — a fresh copy each call so callers (and GSAP's
 * tween bookkeeping) can never mutate the authored constant. Non-`null` for every
 * tier now that the Solar-System floor is built (ADR-0016 §4, #248); the `| null`
 * return is kept so the type tolerates a future unbuilt tier without a churn.
 */
export const framingForTier = (tier: Tier): Camera | null => {
  const framing = TIER_FRAMINGS[tier as keyof typeof TIER_FRAMINGS];
  return framing ? { ...framing } : null;
};

export type TransitionDirection = "descend" | "ascend";

/**
 * Which way a tier change moves on the canonical ladder (`TIER_ORDER`, widest →
 * deepest): deeper = `descend` (scroll up / gateway dive), wider = `ascend`.
 * `null` for a same-tier "move".
 */
export const directionOf = (
  from: Tier,
  to: Tier,
): TransitionDirection | null => {
  const d = TIER_ORDER.indexOf(to) - TIER_ORDER.indexOf(from);
  return d === 0 ? null : d > 0 ? "descend" : "ascend";
};

/**
 * One planned tier transition — the pure targets the `gsap.timeline()` eases
 * between. `threshold` is the framing at the scene-swap label (the camera passes
 * through it mid-flight); `rest` is the destination tier's resting framing.
 */
export type TierTransitionPlan = {
  from: Tier;
  to: Tier;
  direction: TransitionDirection;
  /** The mid-flight framing where the scene swaps + the scale net relabels. */
  threshold: Camera;
  /** The destination tier's resting framing the timeline settles on. */
  rest: Camera;
};

/**
 * Plan a tier transition: direction + the threshold/rest target framings.
 * The threshold sits midway — centre is the arithmetic midpoint, zoom the
 * *geometric* mean (zoom is multiplicative, so this is the perceptual halfway
 * point) — and is symmetric by construction: both directions cross the SAME
 * framing, which is what lets a mid-flight reverse retrace without a jump.
 * Returns `null` for a same-tier move (no framing target to ease toward); every
 * tier is built now (ADR-0016 §4, #248), so a real tier change always plans.
 */
export const planTierTransition = (
  from: Tier,
  to: Tier,
): TierTransitionPlan | null => {
  const direction = directionOf(from, to);
  const a = framingForTier(from);
  const b = framingForTier(to);
  if (!direction || !a || !b) return null;
  return {
    from,
    to,
    direction,
    threshold: {
      cx: (a.cx + b.cx) / 2,
      cy: (a.cy + b.cy) / 2,
      zoom: Math.sqrt(a.zoom * b.zoom),
    },
    rest: b,
  };
};

type AstroNarration = Messages["astroNarration"];

/**
 * The ASTRO line that fires as a transition *starts* — the descend/ascend
 * narration (spec §1: "ASTRO narrates each descent/ascent"). Pure function of
 * the catalog slice, so the same rule serves en and ru. `null` for impossible
 * moves (descending to the ceiling / ascending to the floor).
 */
export const departNarration = (
  n: AstroNarration,
  direction: TransitionDirection,
  to: Tier,
): string | null => {
  if (direction === "descend") {
    return to === "galaxy"
      ? n.descend.toGalaxy
      : to === "solarSystem"
        ? n.descend.toSolarSystem
        : null;
  }
  return to === "galaxy"
    ? n.ascend.toGalaxy
    : to === "localGroup"
      ? n.ascend.toLocalGroup
      : null;
};

/** The ASTRO line that fires when a tier *settles* (catalog `onArrival.*`). */
export const arrivalNarration = (n: AstroNarration, tier: Tier): string =>
  n.onArrival[tier];

/**
 * The ASTRO entry line keyed by the FOCUSED galaxy (BR22-frame #198): entering a
 * neighbour speaks that galaxy's own `lore.<id>.line` (en+ru, already authored — no new
 * keys), while the home Milky Way keeps its curated `onArrival.galaxy` line unchanged.
 * `null`/unknown → the MW line (the home fallback). Pure over the catalog slices.
 */
export const entryNarration = (
  n: AstroNarration,
  lore: Messages["lore"],
  galaxyId: string | null,
): string =>
  galaxyId === null || galaxyId === HOME_MILKY_WAY_ID
    ? n.onArrival.galaxy
    : lore[loreKeyForGalaxy(galaxyId)].line;

/**
 * A tier-transition request crossing from the nav state to the camera hook. `galaxyId`
 * (BR22-frame #198) is the focused galaxy whose disk + lore the scene-swap renders at the
 * threshold — `null` for a tier move that isn't a node entry (e.g. ascending to the LG).
 */
export type TierTransitionRequest = {
  from: Tier;
  to: Tier;
  galaxyId: string | null;
};

/**
 * What the camera hook reports back as a transition plays — the seam React state
 * (displayed tier + ASTRO narration) listens on, so the *scene swap* happens at
 * the timeline's threshold, not at request time:
 * - `depart` — a transition (or a mid-flight reverse) started easing;
 * - `threshold` — the camera crossed the swap point: display `tier` now;
 * - `arrive` — the transition resolved on `tier`: the timeline settled, the
 *   reduced-motion snap landed, or a kill (focus move) after the threshold
 *   terminally resolved to the tier the timeline was heading toward — which
 *   is the nav tier, the logical source of truth (code-style: terminal
 *   events on kill/cancel).
 */
export type TierTransitionEvent =
  | { kind: "depart"; direction: TransitionDirection; from: Tier; to: Tier }
  // `threshold`/`arrive` carry the focused galaxy (BR22-frame #198) so the scene-swap
  // renders the right disk + lore at the swap moment; `null` for a non-entry tier move.
  | { kind: "threshold"; tier: Tier; galaxyId: string | null }
  | { kind: "arrive"; tier: Tier; galaxyId: string | null };

/**
 * The tier-transition request channel (the `FocusController` pattern): the nav
 * owner requests by tier pair; the camera hook subscribes and drives the
 * timeline. SSR-safe — no module-scope state.
 */
export type TierTransitionController = {
  /**
   * Request an eased transition between two tiers. `galaxyId` (BR22-frame #198) is the
   * focused galaxy the scene-swap renders; omit it (defaults `null`) for a non-entry move.
   */
  request(from: Tier, to: Tier, galaxyId?: string | null): void;
  /** Listen for requests; returns an unsubscribe. */
  subscribe(fn: (req: TierTransitionRequest) => void): () => void;
};

export const createTierTransitionController = (): TierTransitionController => {
  const subscribers = new Set<(req: TierTransitionRequest) => void>();
  return {
    request: (from, to, galaxyId = null) => {
      for (const fn of subscribers) fn({ from, to, galaxyId });
    },
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
};
