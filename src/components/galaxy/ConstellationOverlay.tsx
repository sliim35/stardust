import type { ConstellationSegment } from "#/lib/galaxy/constellation";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";

/**
 * #154 — the mood-constellation overlay (interaction spec §3): thin SVG
 * `<line>`s over L3 connecting the hovered star's same-`group` siblings, in the
 * segments the pure `constellation.ts` builder computed. It renders inside the
 * camera plane (`.galaxy-l3-wrap`), so the lines track the stars under the
 * parallax/zoom transform exactly.
 *
 * Decorative: `aria-hidden`, pointer-transparent. The lines fade up via the
 * `constellation-in` keyframe (styles.css — stage-side animation, the card/loader
 * precedent); `prefers-reduced-motion` snaps them instant. Stroke = the hovered
 * star's agent-owned mood colour, rendered verbatim (never recoloured).
 */

type Props = {
  segments: readonly ConstellationSegment[];
  /** The hovered star's `color` — the agent's mood colour, verbatim. */
  color: string;
};

export const ConstellationOverlay = ({ segments, color }: Props) => {
  if (segments.length === 0) return null;
  return (
    <svg
      className="galaxy-constellation pointer-events-none absolute inset-0"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
    >
      <g className="constellation-lines">
        {segments.map((s) => (
          <line
            key={`${s.from.x},${s.from.y}-${s.to.x},${s.to.y}`}
            x1={s.from.x}
            y1={s.from.y}
            x2={s.to.x}
            y2={s.to.y}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.55}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
};
