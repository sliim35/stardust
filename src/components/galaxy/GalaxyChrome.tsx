import { Fragment } from "react";
import type { Tier } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";

/**
 * The ordered wayfinding trail, outermost → innermost (interaction spec §5.3).
 * The component maps over this single list so the breadcrumb stays DRY — each
 * span is generated, never hand-written. `satisfies readonly Tier[]` compile-
 * locks the order to the `Tier` union: dropping/renaming a tier fails to build.
 * `solarSystem` is the deferred tier (#127) — present as the dim reserved tail,
 * never the active tier in v1 (the camera never settles there).
 */
const BREADCRUMB_TRAIL = [
  "localGroup",
  "galaxy",
  "solarSystem",
] as const satisfies readonly Tier[];

/**
 * Minimal stage chrome (#4): the dedication title, the **live** tier-driven
 * breadcrumb (#112 §5.3), and the live memory count. The astronaut, stat
 * captions, and the `+ ADD YOUR STAR` ritual button are reserved chrome owned
 * by later stories (#15 / cinematic) and are not built here.
 *
 * The breadcrumb is the 3-tier trail `LOCAL GROUP › MILKY WAY › SOL`, driven by
 * the displayed `tier`: the segment whose tier === `tier` is the active (bright,
 * `--color-accent`) link, the rest are dim (`--color-dim-3`). Because `tier` is
 * the threshold-following `displayedTier` from `GalaxyStage`, the trail swaps
 * exactly when the scene does — the easing/hysteresis is handled upstream (#125).
 * It is `aria-hidden` (decorative wayfinding; the `sr-only` `<h1>` carries
 * meaning) and hidden below ~620px (`styles.css`, #76 AC7).
 *
 * All user-facing copy comes from the message catalog (#103): the active locale
 * is resolved from the URL via `useLocale()` (en at `/`, ru at `/ru/`), so the
 * same component SSR-renders English or Russian chrome with no hardcoded strings.
 */
export const GalaxyChrome = ({
  count,
  tier,
}: {
  count: number;
  tier: Tier;
}) => {
  const m = getMessages(useLocale());
  return (
    <div className="galaxy-chrome">
      <h1 className="galaxy-chrome__title">
        <span className="galaxy-chrome__for">{m.chrome.forMom}</span>
        <span className="galaxy-chrome__sub">{m.chrome.subtitle}</span>
        <span className="sr-only">{m.chrome.srOnly}</span>
      </h1>
      <div className="galaxy-chrome__breadcrumb" aria-hidden="true">
        {BREADCRUMB_TRAIL.map((segment, i) => (
          <Fragment key={segment}>
            {/* The ` › ` separators are always dim — never part of the active link. */}
            {i > 0 && <span className="is-dim"> › </span>}
            <span className={segment === tier ? undefined : "is-dim"}>
              {m.chrome.breadcrumb[segment]}
            </span>
          </Fragment>
        ))}
      </div>
      <div className="galaxy-chrome__count">
        {interpolate(m.chrome.countLabel, { count })}
      </div>
    </div>
  );
};
