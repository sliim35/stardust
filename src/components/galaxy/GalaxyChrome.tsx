import { Fragment } from "react";
import type { Tier } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";

/**
 * The ordered wayfinding trail, outermost → innermost (interaction spec §5.3).
 * The component maps over this single list so the breadcrumb stays DRY — each
 * segment is generated, never hand-written. `satisfies readonly Tier[]` compile-
 * locks the order to the `Tier` union: dropping/renaming a tier fails to build.
 * `solarSystem` is the deferred tier (#127) — present as the dim reserved tail,
 * never the active tier in v1 (the camera never settles there).
 */
const BREADCRUMB_TRAIL = [
  "localGroup",
  "galaxy",
  "solarSystem",
] as const satisfies readonly Tier[];

/** The tiers a breadcrumb click can navigate to in v1 (`solarSystem` = #127). */
const NAVIGABLE = new Set<Tier>(["localGroup", "galaxy"]);

/** `text-eyebrow` = the 10px/0.2em mono chrome-label token (@theme). */
const BREADCRUMB_SEGMENT_BASE = "font-mono text-eyebrow";

/**
 * Minimal stage chrome: the brand wordmark + the live count line (top-left) and
 * the **live, clickable** tier breadcrumb (top-right). Owner layout pass
 * 2026-06-10: the "For Mom" dedication + subtitle are retired (the dedication
 * must not pull attention), the brand "Stardust" + "{count} memories, still
 * growing" are the title block, and the bottom-center count is gone.
 *
 * The breadcrumb is the 3-tier trail `LOCAL GROUP › MILKY WAY › SOL`, driven by
 * the displayed `tier` (the threshold-following `displayedTier` from
 * `GalaxyStage`, so the trail swaps exactly when the scene does — easing/
 * hysteresis upstream, #125). It is a real `<nav>` now: the active segment is
 * marked `aria-current="location"` and inert; the other *reachable* tier is a
 * button that navigates (`onTierSelect` → ascend / dive-home in the stage);
 * SOL stays the dim deferred tail (#127) — never interactive in v1. The overlay
 * is `pointer-events:none`, so only the buttons opt back in. Hidden below
 * ~620px (#76 AC7), where it would collide with the title.
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
  onTierSelect,
}: {
  count: number;
  tier: Tier;
  /** Breadcrumb navigation sink — the stage maps it to ascend / dive-home. */
  onTierSelect?: (tier: Tier) => void;
}) => {
  const m = getMessages(useLocale());
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* The h1 is the wordmark ALONE — the live count and the sr-only line are
          siblings, so the page heading stays a stable "Stardust" instead of a
          mutating brand+count+brand concatenation (review nit, 2026-06-10). */}
      <div className="absolute top-[max(22px,env(safe-area-inset-top))] left-[max(28px,env(safe-area-inset-left))] flex flex-col gap-[5px]">
        <h1 className="m-0 font-serif text-title font-semibold text-accent [font-variation-settings:'opsz'_56,'SOFT'_100,'WONK'_0] [text-shadow:0_0_18px_var(--color-accent-soft)]">
          {m.chrome.brand}
        </h1>
        <p className="m-0 font-mono text-count tracking-[1px] text-dim-2">
          {interpolate(m.chrome.countLabel, { count })}
        </p>
        <p className="sr-only">{m.chrome.srOnly}</p>
      </div>
      <nav
        aria-label={m.chrome.breadcrumbNav}
        className="absolute top-[max(24px,env(safe-area-inset-top))] right-[max(28px,env(safe-area-inset-right))] max-[620px]:hidden"
      >
        {BREADCRUMB_TRAIL.map((segment, i) => (
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
                aria-current="location"
                className={`${BREADCRUMB_SEGMENT_BASE} text-accent`}
              >
                {m.chrome.breadcrumb[segment]}
              </span>
            ) : NAVIGABLE.has(segment) ? (
              <button
                type="button"
                onClick={() => onTierSelect?.(segment)}
                className={`${BREADCRUMB_SEGMENT_BASE} pointer-events-auto m-0 cursor-pointer border-0 bg-transparent p-0 text-dim-3 transition-colors duration-200 hover:text-accent focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none`}
              >
                {m.chrome.breadcrumb[segment]}
              </button>
            ) : (
              <span className={`${BREADCRUMB_SEGMENT_BASE} text-dim-3`}>
                {m.chrome.breadcrumb[segment]}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
};
