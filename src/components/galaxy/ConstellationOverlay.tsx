import type { CSSProperties } from "react";
import type { ConstellationSegment } from "#/lib/galaxy/constellation";
import { type Point, STAGE_H, STAGE_W } from "#/lib/galaxy/place";

/**
 * #231 — the emotion-figure overlay (owner's Claude Design render): ONE figure per
 * instance, drawn as an SVG layer over the camera plane (`.galaxy-l3-wrap`), so the
 * geometry tracks the stars under the parallax/zoom transform exactly.
 *
 * The render shows a FORMING figure honestly (BR27): a dashed, faint GHOST silhouette
 * of the full authored figure (`ghost` — all authored edges), hollow OPEN-SLOT rings at
 * the unfilled anchor positions (`openSlots`), and SOLID connect-lines for the
 * filled-pair edges (`realSegments`). The figure's filled member jewels are NOT drawn
 * here — those are real stars on a separate DOM layer. Decorative: `aria-hidden`,
 * pointer-transparent. The groups fade up via the `constellation-in` keyframe
 * (styles.css); `prefers-reduced-motion` snaps them instant.
 *
 * Stroke = the figure's ONE mood colour (`color` — rule 2: single-colour by
 * construction), rendered verbatim (never recoloured). SSR-safe, pure.
 */

type Props = {
  /** The figure's emotion colour (one colour) — rendered verbatim (rule 2). */
  color: string;
  /** ALL authored edges — the dashed, faint figure silhouette. */
  ghost?: readonly ConstellationSegment[];
  /** Filled-pair edges — the solid connect-lines. */
  realSegments?: readonly ConstellationSegment[];
  /** Unfilled anchor positions — hollow open-slot rings. */
  openSlots?: readonly Point[];
};

export const ConstellationOverlay = ({
  color,
  ghost = [],
  realSegments = [],
  openSlots = [],
}: Props) => {
  if (ghost.length === 0 && realSegments.length === 0 && openSlots.length === 0)
    return null;
  return (
    <svg
      className="galaxy-constellation pointer-events-none absolute inset-0"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
      style={{ "--cg": color } as CSSProperties}
    >
      <g className="constellation-ghost">
        {ghost.map((s) => (
          <line
            key={`g:${s.from.x},${s.from.y}-${s.to.x},${s.to.y}`}
            x1={s.from.x}
            y1={s.from.y}
            x2={s.to.x}
            y2={s.to.y}
            stroke={color}
            strokeOpacity={0.13}
            strokeWidth={1.4}
            strokeDasharray="3 7"
            strokeLinecap="round"
          />
        ))}
      </g>
      <g className="constellation-slots">
        {openSlots.map((p) => (
          <circle
            key={`s:${p.x},${p.y}`}
            cx={p.x}
            cy={p.y}
            r={3.6}
            fill="none"
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        ))}
      </g>
      <g className="constellation-lines">
        {realSegments.map((s) => {
          const key = `${s.from.x},${s.from.y}-${s.to.x},${s.to.y}`;
          return (
            <g key={key}>
              <line
                x1={s.from.x}
                y1={s.from.y}
                x2={s.to.x}
                y2={s.to.y}
                stroke={color}
                strokeOpacity={0.16}
                strokeWidth={4.5}
                strokeLinecap="round"
              />
              <line
                x1={s.from.x}
                y1={s.from.y}
                x2={s.to.x}
                y2={s.to.y}
                stroke={color}
                strokeOpacity={0.62}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};
