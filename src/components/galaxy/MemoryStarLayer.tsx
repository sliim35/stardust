import { memberAnchorPoints } from "#/lib/galaxy/constellation";
import { DISK_TILT, layoutStars } from "#/lib/galaxy/place";
import type { MemoryStar } from "#/lib/galaxy/types";
import type { Messages } from "#/lib/i18n/types";
import { MemoryStarView } from "./MemoryStarView";

/**
 * L3 — the nearest plane: every memory star positioned by `layoutStars` (a pure
 * function of each star's own `(r, angle)`, so appending one never moves the
 * others — #4 AC3). Stars in `ignitingIds` mount with the `memIgnite` fade-in.
 *
 * The layer itself ignores the pointer; each star opts back in (selection/panel
 * is #5). Rendered ordered by `createdAt` so the future tab order (#5) is stable.
 *
 * Hover (#154): `onHoverChange` reports the star under the pointer/focus; while
 * a constellation is lit, `litIds` names the stars that stay bright — every
 * other star dims (`litIds: null` = nothing lit, nobody dims).
 */

type Props = {
  stars: readonly MemoryStar[];
  ignitingIds?: ReadonlySet<string>;
  /**
   * The id of the deep-link arrival highlighted star (ADR-0018 §3). The matching
   * `MemoryStarView` receives `data-highlighted` so the CSS ring cue fires. Only
   * one star is highlighted at a time; `null` = no highlight.
   */
  highlightedId?: string | null;
  /** Slice E (#153): when set, each star is an accessible click target. */
  onSelect?: (star: MemoryStar) => void;
  /** i18n fallback aria-label for unnamed stars. */
  a11yLabel?: string;
  /** #154: hover/focus enter (the star) / leave (`null`). */
  onHoverChange?: (star: MemoryStar | null) => void;
  /** #154: the lit constellation's star ids — others dim. `null` = no dim. */
  litIds?: ReadonlySet<string> | null;
  /** #154: localized MOOD eyebrow catalog for the hover labels. */
  moodLabels?: Messages["moods"];
  /** #234: the displayed galaxy's interior disk tilt — stars project onto its own
   * foreshortened disk, not the global home 0.74. Defaults to `DISK_TILT` (home / LMC). */
  tilt?: number;
};

export const MemoryStarLayer = ({
  stars,
  ignitingIds,
  highlightedId = null,
  onSelect,
  a11yLabel,
  onHoverChange,
  litIds = null,
  moodLabels,
  tilt = DISK_TILT,
}: Props) => {
  // A figure member renders ON its bound anchor (the figure is the source of truth for
  // where it sits), not its stored (r,angle) — so a star written before the silhouette
  // was re-placed still lands on its figure (#234 follow-up). Non-members + beyond-
  // completion members fall back to their own `layoutStars` position.
  const positions = layoutStars(stars, tilt);
  const memberAnchors = memberAnchorPoints(stars, tilt);
  const ordered = [...stars].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="galaxy-l3">
      {ordered.map((star) => (
        <MemoryStarView
          key={star.id}
          star={star}
          position={memberAnchors[star.id] ?? positions[star.id]}
          igniting={ignitingIds?.has(star.id)}
          highlighted={highlightedId !== null && highlightedId === star.id}
          onSelect={onSelect}
          a11yLabel={a11yLabel}
          onHoverChange={onHoverChange}
          dimmed={litIds !== null && !litIds.has(star.id)}
          moodLabels={moodLabels}
        />
      ))}
    </div>
  );
};
