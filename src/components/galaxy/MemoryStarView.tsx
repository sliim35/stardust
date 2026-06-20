import type { CSSProperties } from "react";
import type { Point } from "#/lib/galaxy/place";
import {
  bloomSizing,
  haloGradient,
  hoverLabelFor,
  starColor,
  twinkleParams,
} from "#/lib/galaxy/star-visual";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";
import type { Messages } from "#/lib/i18n/types";

/**
 * L3 — one memory star as DOM/CSS (not canvas): a soft halo, lens flares, a
 * white-hot center, and a crisp core pixel, sized and timed by the pure helpers
 * in `star-visual.ts`. The agent's `color` is rendered verbatim (#4 AC2); the
 * egg shows no hover label (#4 AC6); a freshly added star carries
 * `data-igniting` so it plays `memIgnite` (#4 AC3 — the position invariant is
 * proven in `place.test.ts`).
 *
 * Hover/keyboard-focus (#154, spec §3) reports the star through `onHoverChange`
 * so the stage can light its mood constellation; while another group is lit the
 * star dims (`dimmed`) with a soft cross-fade (instant under reduced motion via
 * `motion-reduce:transition-none`). The label's MOOD eyebrow reads the i18n
 * `moods` catalog (en+ru) passed down by the locale-aware stage.
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
  /** Hover/focus enter (the star) and leave (`null`) — the #154 affordance. */
  onHoverChange?: (star: MemoryStar | null) => void;
  /** True while another star's constellation is lit — this star fades back. */
  dimmed?: boolean;
  /**
   * The localized MOOD eyebrow catalog (`Messages["moods"]`), passed by the
   * locale-aware parent. Defaults to the `en` source-of-truth corpus so the
   * component stays pure/router-free (the `buildSeedSky` precedent).
   */
  moodLabels?: Messages["moods"];
};

export const MemoryStarView = ({
  star,
  position,
  igniting = false,
  onSelect,
  a11yLabel,
  onHoverChange,
  dimmed = false,
  moodLabels,
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
      className={`mem-star transition-opacity duration-300 motion-reduce:transition-none ${
        dimmed ? "opacity-25" : "opacity-100"
      }`}
      data-kind={tw.kind}
      data-igniting={igniting || undefined}
      data-egg={star.egg || undefined}
      data-mood={star.mood}
      data-dimmed={dimmed || undefined}
      style={style}
      onPointerEnter={onHoverChange && (() => onHoverChange(star))}
      onPointerLeave={onHoverChange && (() => onHoverChange(null))}
    >
      <span className="mem-star__body" aria-hidden="true">
        <span className="mem-star__halo" />
        <span className="mem-star__flare-h" />
        <span className="mem-star__flare-v" />
        {/* Mom's 8-point soft lodestar: the deep star adds two soft diagonal
            flares to the 4 cardinal ones (treatment §3 — soft-glow, not pixel). */}
        {star.deep && (
          <>
            <span className="mem-star__flare-d1" />
            <span className="mem-star__flare-d2" />
          </>
        )}
        <span className="mem-star__hot" />
        <span className="mem-star__core" />
      </span>
      {onSelect && (
        <button
          type="button"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 [block-size:max(var(--bloom),24px)] [inline-size:max(var(--bloom),24px)] focus-visible:[outline:2px_solid_var(--star-color)] focus-visible:[outline-offset:2px]"
          aria-label={star.name ?? a11yLabel}
          onClick={() => onSelect(star)}
          onFocus={onHoverChange && (() => onHoverChange(star))}
          onBlur={onHoverChange && (() => onHoverChange(null))}
        />
      )}
      {label !== null && (
        <span className="mem-star__label" aria-hidden="true">
          {star.name && <em className="mem-star__name">{star.name}</em>}
          <span className="mem-star__mood">
            {/* The `moods` catalog is now 12-wide (#193-B), so `star.mood` (typed
                `Mood = Emotion`) indexes it directly — the bridging cast is gone. */}
            {(moodLabels ?? en.moods)[star.mood]}
            {star.who ? ` · ${star.who}` : ""}
          </span>
        </span>
      )}
    </div>
  );
};
