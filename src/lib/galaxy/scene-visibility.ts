/**
 * Single source of truth for MW-interior layer visibility per displayed tier
 * (ADR-0018 §2 — kill the flash). Drives the L3/L4/L5 wrapper visibility in
 * `GalaxyStage.tsx` off the threshold-committed `displayedTier`, NOT off an
 * independent CSS clock — so old and new content never both paint.
 *
 * Pure + SSR-safe: no DOM, no clock, no random.
 */

import type { Tier } from "#/lib/galaxy/types";

/**
 * Whether the MW-interior layers (L3 free stars, L4 figures, L5 Mom's deep
 * star) should paint at the given displayed tier.
 *
 * Returns `true` only for `"galaxy"` (the tier whose world is the Milky Way
 * interior). `"localGroup"` and `"solarSystem"` both hide the interior — no
 * tier causes both the LG-composition backdrop and the MW interior to paint
 * simultaneously.
 *
 * Binding the L3/L4/L5 wrappers to this function eliminates the 500ms CSS fade
 * lag that produced the MW-star flash on zoom-out: the moment `displayedTier`
 * commits to `"localGroup"` (at the GSAP threshold label), `interiorLayersVisible`
 * returns `false` and the layers instantly hide (instant hide on ascend,
 * optional fade-in on descend — ADR-0018 §2 option (a)).
 */
export const interiorLayersVisible = (tier: Tier): boolean => tier === "galaxy";
