import type { ConstellationSegment } from "#/lib/galaxy/constellation";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";

/**
 * #154 — the mood-constellation overlay (interaction spec §3 + owner rules
 * 2026-06-06): thin SVG `<line>`s over L3 drawing an AUTHORED figure's designed
 * edges, in the segments the pure `constellation.ts` builder computed. It
 * renders inside the camera plane (`.galaxy-l3-wrap`), so the lines track the
 * stars under the parallax/zoom transform exactly.
 *
 * BR27 (#227) — the **forming-ghost**: the optional `ghostSegments` draw the
 * figure's FULL authored silhouette (every edge, regardless of fill) faint and
 * BEHIND the real-star jewel lines, so a forming figure reads as an outline
 * filling in. No phantom star is drawn at an empty anchor — the ghost is
 * edges-only, so an unfilled-endpoint edge shows ghost-only (never a faked node).
 *
 * Decorative: `aria-hidden`, pointer-transparent. The lines fade up via the
 * `constellation-in` keyframe (styles.css — stage-side animation, the card/loader
 * precedent); `prefers-reduced-motion` snaps them instant. Stroke = the figure's
 * ONE mood colour (`figureColor` — rule 2: single-colour by construction),
 * rendered verbatim (never recoloured). Reuses the ADR-0011 overlay seam — one SVG
 * layer, no new canvas/dep, SSR-safe.
 */

/** ~0.12 (the 2026-06-20 proof value) — the forming-ghost silhouette opacity. */
const GHOST_OPACITY = 0.12;

type Props = {
  segments: readonly ConstellationSegment[];
  /** The figure's mood colour (`figureColor(figure)`) — one colour, verbatim. */
  color: string;
  /**
   * The full authored silhouette (BR27 — `ghostSegments(figure)`), drawn faint
   * behind the real lines. Optional → omitting it keeps today's real-only render.
   */
  ghostSegments?: readonly ConstellationSegment[];
};

/** One thin connect-line in stage pixels — shared by the ghost + the real pass. */
const Line = ({
  s,
  color,
  opacity,
}: {
  s: ConstellationSegment;
  color: string;
  opacity: number;
}) => (
  <line
    x1={s.from.x}
    y1={s.from.y}
    x2={s.to.x}
    y2={s.to.y}
    stroke={color}
    strokeWidth={1}
    strokeOpacity={opacity}
    strokeLinecap="round"
  />
);

export const ConstellationOverlay = ({
  segments,
  color,
  ghostSegments = [],
}: Props) => {
  // Nothing authored to draw (neither real lines nor a ghost) → render no DOM.
  if (segments.length === 0 && ghostSegments.length === 0) return null;
  return (
    <svg
      className="galaxy-constellation pointer-events-none absolute inset-0"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
    >
      {/* Ghost FIRST so SVG paint-order puts the faint silhouette behind the jewels. */}
      {ghostSegments.length > 0 && (
        <g className="constellation-ghost">
          {ghostSegments.map((s) => (
            <Line
              key={`g:${s.from.x},${s.from.y}-${s.to.x},${s.to.y}`}
              s={s}
              color={color}
              opacity={GHOST_OPACITY}
            />
          ))}
        </g>
      )}
      <g className="constellation-lines">
        {segments.map((s) => (
          <Line
            key={`${s.from.x},${s.from.y}-${s.to.x},${s.to.y}`}
            s={s}
            color={color}
            opacity={0.55}
          />
        ))}
      </g>
    </svg>
  );
};
