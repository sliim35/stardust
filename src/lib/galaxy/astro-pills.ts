/**
 * The ASTRO interaction-hub pill model (#250, ADR-0017 §2/§3/§4) — pure, SSR-safe,
 * unit-testable in node with no React/DOM (like `tier-nav.ts` / `star-search.ts`).
 *
 * A pill is a typed descriptor; `pillsFor(ctx)` is the pure selector returning the
 * **tier-aware, available** pill set for the current nav node. The component
 * (`AstroHub.tsx`) maps `pillsFor(ctx)` → real `<button>`s and dispatches each
 * pill's `action` to the right handler — it owns NO pill logic.
 *
 * **Two pill kinds (ADR-0017 §3/§4):**
 * - `nav` → drives the camera through the EXISTING tier-nav spine
 *   (`onTierSelect(tier)` for `ascendTo`, `nav.diveTo(id, tier)` for `dive`). Each
 *   nav pill carries an `available(ctx)` predicate consulting `availableTiersFor` /
 *   `descendTier` / `ascendTier`, so `pillsFor` filters out any pill that would
 *   clamp to a no-op (no "Sol" outside the home MW, no "Back out" at the ceiling) —
 *   the SAME asymmetric-tier logic the wheel/breadcrumb already obey.
 * - `prompt` → makes ASTRO speak ONE bubble response through the narration seam.
 *   `speakLore` → `narrateFn({key, subject})` with the authored `lore[key].line`
 *   fallback; `sayLine` → `showNarration(m.astroHub.lines[key])`. NOT a chat
 *   backend, NOT a thread, NOT multi-turn state.
 *
 * The pill catalog is a static `as const` table (no module-scope clock/random),
 * so the set + availability are byte-stable across SSR↔client (ADR-0003).
 */

import { SOL_SYSTEM_ID } from "#/lib/galaxy/realdata";
import { HOME_GALAXY_ID } from "#/lib/galaxy/scenegraph";
import {
  ascendTier,
  availableTiersFor,
  descendTier,
} from "#/lib/galaxy/tier-nav";
import type { LoreKey, Tier } from "#/lib/galaxy/types";
import type { LoreEntry, Messages } from "#/lib/i18n/types";

/** A pill's catalog label key — compile-locked to `astroHub.pills.*` copy (§5). */
export type PillLabelKey = keyof Messages["astroHub"]["pills"];

/** A canned `sayLine` response key — compile-locked to `astroHub.lines.*` copy. */
export type SayLineKey = keyof Messages["astroHub"]["lines"];

/** The live nav slice the selector reads (a subset of `TierNavState`). */
export type PillContext = { tier: Tier; galaxyId: string | null };

/** A nav pill's effect — a thin dispatch into the existing tier-nav spine (§3). */
export type NavPillAction =
  /** → `onTierSelect(tier)`: "Back out" (ascend) / "Milky Way" (dive home). */
  | { kind: "ascendTo"; tier: Tier }
  /** → `onTierSelect(tier)` for the galaxy crumb / `nav.diveTo(id, tier)` for Sol. */
  | { kind: "dive"; id: string; tier: Tier };

/** A prompt pill's effect — ONE spoken bubble via the narration seam (§4). */
export type PromptPillAction =
  /** → `narrateFn({key, subject})`, fallback `lore[key].line` ("Tell me about X"). */
  | { kind: "speakLore"; loreKey: LoreKey }
  /** → `showNarration(m.astroHub.lines[key])` (subject-less canned prompt). */
  | { kind: "sayLine"; lineKey: SayLineKey };

/** A fast-action pill — a typed descriptor the component renders + dispatches. */
export type AstroPill = {
  /** Stable React key + test handle. */
  id: string;
  kind: "nav" | "prompt";
  /** Catalog copy key, never an inline string (BR-i18n). */
  labelKey: PillLabelKey;
  action: NavPillAction | PromptPillAction;
  /**
   * Tier-availability predicate (§3). Absent → always available (prompt pills,
   * which carry no nav clamp). `pillsFor` filters by this so the row never shows a
   * pill that would no-op.
   */
  available?: (ctx: PillContext) => boolean;
};

/** Resolve a context's available tier set (home gets the Sol tier; neighbours don't). */
const tiersFor = (ctx: PillContext): readonly Tier[] =>
  availableTiersFor(ctx.galaxyId ?? "home");

/**
 * The authored v1 pill catalog (Miller's Law — small: 3 nav + 3 prompt). A static
 * `as const` table; `pillsFor` filters it per context. The `available` predicates
 * reuse the EXACT `descendTier`/`ascendTier`/`availableTiersFor` asymmetry the
 * wheel + breadcrumb obey, so there is one source of truth for "is this jump real".
 */
const PILLS: readonly AstroPill[] = [
  // ── nav pills ──────────────────────────────────────────────────────────────
  {
    id: "nav-milkyWay",
    kind: "nav",
    labelKey: "milkyWay",
    action: { kind: "dive", id: HOME_GALAXY_ID, tier: "galaxy" },
    // Only meaningful when we're NOT already inside a galaxy (i.e. at the LG
    // overview): diving to `galaxy` from `galaxy`/`solarSystem` would re-enter the
    // tier we're at or below. Shown only at the local-group ceiling.
    available: (ctx) => ctx.tier === "localGroup",
  },
  {
    id: "nav-sol",
    kind: "nav",
    labelKey: "sol",
    action: { kind: "dive", id: SOL_SYSTEM_ID, tier: "solarSystem" },
    // The Sol dive is real only when the Solar-System tier is reachable from the
    // CURRENT tier in the home MW — i.e. `descendTier(tier)` lands on solarSystem.
    // Filters out: neighbours (no Sol tier), the LG overview (galaxy is the next
    // step, not solarSystem), and already being AT solarSystem.
    available: (ctx) => descendTier(ctx.tier, tiersFor(ctx)) === "solarSystem",
  },
  {
    id: "nav-back",
    kind: "nav",
    labelKey: "back",
    // "Back out" ascends one tier wider; the concrete target is resolved at
    // dispatch from `ascendTier(tier)` (so the pill stays tier-agnostic). The
    // placeholder tier here is overwritten by the live target in `pillsFor`.
    action: { kind: "ascendTo", tier: "localGroup" },
    // Available only when there IS a wider tier to ascend to (not at the ceiling).
    available: (ctx) => ascendTier(ctx.tier, tiersFor(ctx)) !== null,
  },
  // ── prompt pills ─────────────────────────────────────────────────────────────
  {
    id: "prompt-earth",
    kind: "prompt",
    labelKey: "earth",
    action: { kind: "speakLore", loreKey: "earth" },
  },
  {
    id: "prompt-whoAreYou",
    kind: "prompt",
    labelKey: "whoAreYou",
    action: { kind: "sayLine", lineKey: "whoAreYou" },
  },
  {
    id: "prompt-whatIsThis",
    kind: "prompt",
    labelKey: "whatIsThis",
    action: { kind: "sayLine", lineKey: "whatIsThis" },
  },
];

/**
 * The tier-aware, available pill set for the current nav node (§2). Pure: filters
 * the static catalog by each pill's `available` predicate and resolves the "Back
 * out" pill's concrete ascend target from `ascendTier(tier)` (so the dispatch is a
 * single `onTierSelect(target)` with no further clamp). A pill with no predicate
 * (every prompt pill) is always kept.
 */
export const pillsFor = (ctx: PillContext): AstroPill[] =>
  PILLS.filter((p) => p.available?.(ctx) ?? true).map((p) => {
    // Resolve "Back out" to its live wider tier so the component dispatches a
    // concrete `onTierSelect(target)` — the catalog placeholder tier is ignored.
    if (p.id === "nav-back") {
      const target = ascendTier(ctx.tier, tiersFor(ctx));
      // `available` guaranteed `target != null`; fall back to the placeholder defensively.
      return target == null
        ? p
        : { ...p, action: { kind: "ascendTo", tier: target } };
    }
    return p;
  });

/**
 * Build the narration request for a `speakLore` prompt pill (ADR-0017 §4) — mirrors
 * `narrationRequestFor`'s shape so the request build stays headless-testable: key by
 * the `loreKey`, subject from the catalog's English `name` (falling back to the key
 * so the subject is never empty). The handler routes this to `narrateFn` and falls
 * back to `lore[loreKey].line` on a null result (the pill must never speak nothing).
 */
export const promptNarrationRequest = (
  loreKey: LoreKey,
  lore: Record<string, Pick<LoreEntry, "name">>,
): { key: string; subject: string } => ({
  key: loreKey,
  subject: lore[loreKey]?.name ?? loreKey,
});
