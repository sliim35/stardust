import type { CSSProperties } from "react";
import type { Point } from "#/lib/galaxy/place";
import {
  bloomSizing,
  haloGradient,
  hoverLabelFor,
  MOOD_LABELS,
  starColor,
  twinkleParams,
} from "#/lib/galaxy/star-visual";
import type { MemoryStar } from "#/lib/galaxy/types";

/**
 * L3 — one memory star as DOM/CSS (not canvas): a soft halo, lens flares, a
 * white-hot center, and a crisp core pixel, sized and timed by the pure helpers
 * in `star-visual.ts`. The agent's `color` is rendered verbatim (#4 AC2); the
 * egg shows no hover label (#4 AC6); a freshly added star carries
 * `data-igniting` so it plays `memIgnite` (#4 AC3 — the position invariant is
 * proven in `place.test.ts`).
 *
 * Pure and deterministic (every value derives from the star's data), so it is
 * SSR-safe and hydrates without mismatch.
 */

type Props = {
  star: MemoryStar;
  position: Point;
  igniting?: boolean;
  /** When set, the star becomes an accessible click target (slice E, #153). */
  onSelect?: (star: MemoryStar) => void;
  /** i18n fallback aria-label for unnamed stars (the egg). */
  a11yLabel?: string;
};

export const MemoryStarView = ({
  star,
  position,
  igniting = false,
  onSelect,
  a11yLabel,
}: Props) => {
  const color = starColor(star);
  const sz = bloomSizing(star);
  const tw = twinkleParams(star);
  const label = hoverLabelFor(star);

  const style = {
    // Round to whole stage pixels: crisper for pixel art, and avoids a
    // hydration mismatch — the browser's CSSOM rounds sub-pixel left/top, while
    // React keeps the full float (custom properties aren't normalized, so they
    // would silently disagree).
    left: `${Math.round(position.x)}px`,
    top: `${Math.round(position.y)}px`,
    "--star-color": color,
    "--bloom": `${sz.bloom}px`,
    "--flare-w": `${sz.flareW}px`,
    "--vflare-h": `${sz.vFlareH}px`,
    "--hot": `${sz.hot}px`,
    "--core": `${sz.core}px`,
    "--halo": haloGradient(color),
    "--twk-period": `${tw.period}s`,
    "--twk-delay": `${tw.delay}s`,
  } as CSSProperties;

  return (
    <div
      className="mem-star"
      data-kind={tw.kind}
      data-igniting={igniting || undefined}
      data-egg={star.egg || undefined}
      data-mood={star.mood}
      style={style}
    >
      <span className="mem-star__body" aria-hidden="true">
        <span className="mem-star__halo" />
        <span className="mem-star__flare-h" />
        <span className="mem-star__flare-v" />
        <span className="mem-star__hot" />
        <span className="mem-star__core" />
      </span>
      {onSelect && (
        <button
          type="button"
          className="mem-star__hit"
          aria-label={star.name ?? a11yLabel}
          onClick={() => onSelect(star)}
        />
      )}
      {label !== null && (
        <span className="mem-star__label" aria-hidden="true">
          {star.name && <em className="mem-star__name">{star.name}</em>}
          <span className="mem-star__mood">
            {MOOD_LABELS[star.mood]}
            {star.who ? ` · ${star.who}` : ""}
          </span>
        </span>
      )}
    </div>
  );
};
