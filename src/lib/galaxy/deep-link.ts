/**
 * Wayfinding deep-links (#129) — the pure URL → camera-target mapping that lets a
 * shared link land the visitor on a place (`?at=galaxy:<id>` / `?at=system:<id>`)
 * and/or a memory star (`?star=<id>`). It owns the *decision* — which tier to
 * dive into and which star to focus — and stays headless: the route's
 * `validateSearch` calls `validateDeepLinkSearch`, and `GalaxyStage` feeds the
 * resolved `dive`/`star` into the existing nav (`diveTo`, #157/#166) + focus
 * (`focusStar`, #111) seams. GSAP / camera live in the component; this module
 * never imports either.
 *
 * **SSR-safe (ADR-0003):** a pure function of its inputs — no module-scope clock,
 * random, or storage — so the same URL resolves to the same target on the server
 * and the client (no hydration mismatch). Dependencies (the dataset + sky lookups
 * + the available tier set) are injected, so the mapping is unit-tested in
 * isolation without the scene graph or the store.
 *
 * **Graceful by construction (AC3):** every malformed / unknown input resolves to
 * `null` (the default view) or drops the offending param — a broken link never
 * throws, 404s, or strands the page.
 */

import { HOME_MILKY_WAY_ID } from "#/lib/galaxy/realdata";
import { TIER_ORDER, V1_AVAILABLE_TIERS } from "#/lib/galaxy/tier-nav";
import type { MemoryStar, RealObject, Tier } from "#/lib/galaxy/types";

/** The two place kinds a `?at=` link can name (spec §1: the only descend gateways). */
export type AtKind = "galaxy" | "system";

/** A parsed `?at=<kind>:<id>` value. */
export type AtTarget = { kind: AtKind; id: string };

/** The route's deep-link search params (a permissive subset of the URL query). */
export type DeepLinkSearch = { at?: string; star?: string };

/** A resolved dive: enter `id` at `tier` (drives `nav.diveTo`). */
export type DiveTarget = { id: string; tier: Tier };

/**
 * The resolved camera target: where to dive and which star to focus. `dive: null`
 * means "stay on the home tier but focus the star" is NOT representable — a focus
 * always rides a dive to the star's containing tier — so a non-null result always
 * carries a `dive`. `star: null` is a place-only link.
 */
export type DeepLinkTarget = {
  dive: DiveTarget;
  star: string | null;
};

/** The lookups + tier set the resolver needs, injected for headless testing. */
export type DeepLinkDeps = {
  /** Resolve a real object (galaxy / Sol / nebula …) by id (Layer A). */
  findReal: (id: string) => RealObject | undefined;
  /** Resolve a memory star by id (the live sky). */
  findStar: (id: string) => MemoryStar | undefined;
  /** Which tiers are built (defaults to the v1 set — Solar System deferred, #127). */
  available?: readonly Tier[];
};

/** The valid `?at=` kinds, for the parse guard. */
const AT_KINDS = ["galaxy", "system"] as const satisfies readonly AtKind[];

const isAtKind = (s: string): s is AtKind =>
  (AT_KINDS as readonly string[]).includes(s);

/**
 * Parse a raw `?at=` value into `{ kind, id }`, or `null` for anything malformed
 * (no throw). Only the FIRST colon splits, so an id may itself contain colons.
 */
export const parseAt = (raw: unknown): AtTarget | null => {
  if (typeof raw !== "string") return null;
  const colon = raw.indexOf(":");
  if (colon <= 0) return null; // no kind, or no separator
  const kind = raw.slice(0, colon);
  const id = raw.slice(colon + 1);
  if (id.length === 0 || !isAtKind(kind)) return null;
  return { kind, id };
};

/**
 * The route's permissive search validator: keep only the string `at` / `star`
 * params, drop everything else. Never throws on a bad shape, so a malformed link
 * renders the default view instead of a router error (AC3).
 */
export const validateDeepLinkSearch = (
  search: Record<string, unknown>,
): DeepLinkSearch => {
  const out: DeepLinkSearch = {};
  if (typeof search.at === "string") out.at = search.at;
  if (typeof search.star === "string") out.star = search.star;
  return out;
};

/**
 * The tier a gateway object's INTERIOR lives in — one step deeper than the object's
 * own tier in the canonical ladder (the home MW sits at `localGroup`, its interior
 * is `galaxy`; Sol sits at `galaxy`, its interior is `solarSystem`). `null` if the
 * object already sits at the floor.
 */
const interiorTier = (tier: Tier): Tier | null =>
  TIER_ORDER[TIER_ORDER.indexOf(tier) + 1] ?? null;

/**
 * The tier a Memory Star is placed in. A star without an explicit `placement`
 * defaults to the home galaxy (`tier:'galaxy'`) — the back-compat rule the scene
 * graph already uses for today's flat seeded stars (`scenegraph.starsForView`).
 */
const tierOfStar = (star: MemoryStar): Tier => star.placement?.tier ?? "galaxy";

/** Resolve a `?at=` target to a dive, or `null` if it can't be entered/focused. */
const resolveAt = (at: AtTarget, deps: DeepLinkDeps): DiveTarget | null => {
  const available = deps.available ?? V1_AVAILABLE_TIERS;
  const object = deps.findReal(at.id);
  if (!object) return null; // unknown id → default view (AC3)

  // A gateway (the home MW, Sol) can be ENTERED: dive into its interior tier,
  // but only if that tier is built (Sol's `solarSystem` is deferred in v1 → AC3).
  if (object.gateway) {
    const interior = interiorTier(object.tier);
    if (interior && available.includes(interior)) {
      return { id: object.id, tier: interior };
    }
    return null;
  }

  // A non-gateway place (a neighbour galaxy, a nebula) has no interior: focus it
  // at its OWN tier — provided that tier is built.
  return available.includes(object.tier)
    ? { id: object.id, tier: object.tier }
    : null;
};

/** Resolve a `?star=` id to its containing-tier dive + the focus, or `null`. */
const resolveStar = (id: string, deps: DeepLinkDeps): DeepLinkTarget | null => {
  const star = deps.findStar(id);
  if (!star) return null; // unknown star → default view (AC3)
  // Stars live in a container node (the home galaxy at the galaxy tier, or the
  // Local Group). The dive id is the home galaxy for both — a localGroup-placed
  // star is still "the home galaxy's neighbourhood", just viewed one tier wider.
  // The canonical container id is HOME_MILKY_WAY_ID (the dataset's home gateway),
  // so this module stays free of a re-declared `"home"` literal.
  return { dive: { id: HOME_MILKY_WAY_ID, tier: tierOfStar(star) }, star: id };
};

/**
 * Resolve the deep-link search to a single camera target (or `null` for the
 * default view). `at` owns the dive; `star` adds (or, alone, drives) the focus —
 * so `?at=galaxy:home&star=s01` dives into the MW and focuses the star, while a
 * malformed `at` next to a good `star` degrades to the star's own dive (AC3).
 */
export const resolveDeepLink = (
  search: DeepLinkSearch,
  deps: DeepLinkDeps,
): DeepLinkTarget | null => {
  const at = parseAt(search.at);
  const dive = at ? resolveAt(at, deps) : null;

  if (dive) {
    // A place dive; a valid `?star=` (resolvable) rides along as the focus.
    const star = search.star && deps.findStar(search.star) ? search.star : null;
    return { dive, star };
  }

  // No (valid) place → fall back to the star's own resolution, if present.
  if (search.star) return resolveStar(search.star, deps);

  return null;
};
