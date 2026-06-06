import { layoutStars } from "#/lib/galaxy/place";
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
};

export const MemoryStarLayer = ({
  stars,
  ignitingIds,
  onSelect,
  a11yLabel,
  onHoverChange,
  litIds = null,
  moodLabels,
}: Props) => {
  const positions = layoutStars(stars);
  const ordered = [...stars].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="galaxy-l3">
      {ordered.map((star) => (
        <MemoryStarView
          key={star.id}
          star={star}
          position={positions[star.id]}
          igniting={ignitingIds?.has(star.id)}
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
