import { Fragment } from "react";
import { loreKeyForGalaxy } from "#/lib/galaxy/realdata";
import { availableTiersFor } from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";
import type { Messages } from "#/lib/i18n/types";

/** The tiers a breadcrumb click can navigate to in v1 (`solarSystem` = #127). */
const NAVIGABLE = new Set<Tier>(["localGroup", "galaxy"]);

/** `text-eyebrow` = the 10px/0.2em mono chrome-label token (@theme). The
 *  `uppercase` transform is the CSS-only root-cause fix for the title-case bug
 *  (#249 AC2): `lore.name` is stored title-case and `text-eyebrow` carries no
 *  `text-transform`, so the galaxy crumb rendered "The Milky Way". Every segment
 *  shares this base, so the trail is one font family + one case (Aesthetic-
 *  Usability Effect) and the active segment pops by colour alone (Von Restorff)
 *  — never by a different size or case. */
const BREADCRUMB_SEGMENT_BASE = "font-mono text-eyebrow uppercase";

/** The trail caps at 3 chunks (Miller's Law): Local Group › galaxy › Sol. No 4th
 *  tier exists, but slicing makes the cap a hard invariant — no 4th crumb can ever
 *  appear regardless of the tier source (#249 AC5). */
const MAX_BREADCRUMB_SEGMENTS = 3;

/** The label for one trail segment: the `galaxy` crumb is the live galaxy's lore
 *  name (BR21), the others keep their static catalog labels — no new i18n key. */
const segmentLabel = (
  segment: Tier,
  galaxyName: string,
  breadcrumb: Messages["chrome"]["breadcrumb"],
): string => (segment === "galaxy" ? galaxyName : breadcrumb[segment]);

/**
 * Minimal stage chrome: one **top-left wayfinding block** stacking the brand
 * wordmark, the live count line, and the **live, node-aware** tier breadcrumb
 * (#249, BR35/BR36). Jakob's Law + reading gravity put wayfinding where the eye
 * starts (top-left); Law of Proximity / Common Region groups brand + count +
 * breadcrumb as one unit. Owner layout pass 2026-06-10 retired the "For Mom"
 * dedication + subtitle (the dedication must not pull attention); the brand
 * "Stardust" + "{count} memories, still growing" are the title block, and the
 * bottom-center count is gone.
 *
 * The trail is DERIVED from `availableTiersFor(galaxyId)` (BR21, #199): it reads
 * `LOCAL GROUP › ANDROMEDA` inside Andromeda, `LOCAL GROUP › THE MILKY WAY › SOL`
 * inside the home Solar System — the SOL crumb appears only under the home Milky
 * Way (the one galaxy with a third tier). The galaxy segment label is the live
 * galaxy's lore name (`lore.<loreKey>.name`), uppercased by the `uppercase`
 * Tailwind transform on every segment (#249) — the catalog string stays title-
 * case, the CSS does the casing, so no new i18n key is needed (en+ru already
 * authored). The trail follows the displayed `tier` (the threshold-following
 * `displayedTier` from `GalaxyStage`, so the trail swaps exactly when the scene
 * does — easing/hysteresis upstream, #125), and is capped at 3 segments
 * (Miller's Law, `MAX_BREADCRUMB_SEGMENTS`). It is a real `<nav>`: the active
 * segment is `aria-current="location"` and inert; the other *reachable* tiers are
 * buttons that navigate (`onTierSelect` → ascend / dive in the stage); SOL stays
 * the dim deferred tail (#127) — never interactive in v1. Every segment shares
 * one font family + one case, so the active segment differs by COLOUR ONLY
 * (`text-accent` vs `text-dim-3`, Von Restorff) — not by size, case, or underline.
 *
 * The trail is a LEFT-ANCHORED flex row that grows rightward (#249 AC4): the
 * leftmost crumbs (LOCAL GROUP, the galaxy) hold position and the SOL crumb
 * appears/disappears on the right as tier 3 is entered/left — no horizontal jump
 * of the existing crumbs. The overlay is `pointer-events:none`, so only the
 * buttons opt back in. Hidden below ~620px (#76 AC7), where it would collide with
 * the title.
 *
 * All user-facing copy comes from the message catalog (#103): the active locale
 * is resolved from the URL via `useLocale()` (en at `/`, ru at `/ru/`), so the
 * same component SSR-renders English or Russian chrome with no hardcoded strings.
 * Styling is Tailwind utilities reading the @theme tokens (#75 boundary — the
 * legacy `.galaxy-chrome__*` CSS block is retired with the dedication).
 */
export const GalaxyChrome = ({
  count,
  tier,
  galaxyId = null,
  onTierSelect,
}: {
  count: number;
  tier: Tier;
  /** The live nav galaxy id (BR22) — drives the trail shape + the galaxy name. */
  galaxyId?: string | null;
  /** Breadcrumb navigation sink — the stage maps it to ascend / dive. */
  onTierSelect?: (tier: Tier) => void;
}) => {
  const m = getMessages(useLocale());
  // Null galaxyId (the LG overview) falls back to the home ladder, mirroring the
  // nav adapter — so the overview keeps the home MW name + SOL tail in its trail.
  // Slice to the 3-chunk cap (Miller's Law) so no source can ever render a 4th.
  const trail = availableTiersFor(galaxyId ?? "home").slice(
    0,
    MAX_BREADCRUMB_SEGMENTS,
  );
  const galaxyName = m.lore[loreKeyForGalaxy(galaxyId)].name;
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* One top-left wayfinding block: brand wordmark + live count + breadcrumb,
          stacked + left-aligned (Jakob's Law, Law of Proximity). The h1 is the
          wordmark ALONE — the live count and the sr-only line are siblings, so the
          page heading stays a stable "Stardust" instead of a mutating
          brand+count+brand concatenation (review nit, 2026-06-10). */}
      <div
        data-wayfinding-block
        className="absolute top-[max(22px,env(safe-area-inset-top))] left-[max(28px,env(safe-area-inset-left))] flex flex-col items-start gap-[5px]"
      >
        <h1 className="m-0 font-serif text-title font-semibold text-accent [font-variation-settings:'opsz'_56,'SOFT'_100,'WONK'_0] [text-shadow:0_0_18px_var(--color-accent-soft)]">
          {m.chrome.brand}
        </h1>
        <p className="m-0 font-mono text-count tracking-[1px] text-dim-2">
          {interpolate(m.chrome.countLabel, { count })}
        </p>
        <p className="sr-only">{m.chrome.srOnly}</p>
        {/* Left-anchored flex row: segments flow left→right so the SOL crumb is
            the rightmost child and grows/shrinks on the right (#249 AC4) — the
            leftmost crumbs never shift. The mt separates it from the count line. */}
        <nav
          aria-label={m.chrome.breadcrumbNav}
          className="mt-[3px] flex items-baseline max-[620px]:hidden"
        >
          {trail.map((segment, i) => (
            <Fragment key={segment}>
              {/* Separators are visual-only: dim, never part of a link, and
                  aria-hidden — the nav is real now, so AT must not read them. */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`${BREADCRUMB_SEGMENT_BASE} text-dim-3`}
                >
                  {" › "}
                </span>
              )}
              {segment === tier ? (
                <span
                  data-breadcrumb-segment
                  aria-current="location"
                  className={`${BREADCRUMB_SEGMENT_BASE} text-accent`}
                >
                  {segmentLabel(segment, galaxyName, m.chrome.breadcrumb)}
                </span>
              ) : NAVIGABLE.has(segment) ? (
                <button
                  data-breadcrumb-segment
                  type="button"
                  onClick={() => onTierSelect?.(segment)}
                  className={`${BREADCRUMB_SEGMENT_BASE} pointer-events-auto m-0 cursor-pointer border-0 bg-transparent p-0 text-dim-3 transition-colors duration-200 hover:text-accent focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none`}
                >
                  {segmentLabel(segment, galaxyName, m.chrome.breadcrumb)}
                </button>
              ) : (
                <span
                  data-breadcrumb-segment
                  className={`${BREADCRUMB_SEGMENT_BASE} text-dim-3`}
                >
                  {segmentLabel(segment, galaxyName, m.chrome.breadcrumb)}
                </span>
              )}
            </Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
};
