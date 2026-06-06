import { formatRingLabel, ringsForTier } from "#/lib/galaxy/scale-net";
import type { Tier } from "#/lib/galaxy/types";

/**
 * The tier-aware scale net (interaction spec §5.3, slice I-4a / #112) — faint
 * concentric real-distance range rings pinned to the **bottom-left** corner, the
 * canonical scale/orientation device (it replaces the mockup's linear scale bar).
 * It **relabels per tier** (the `<ScaleNet>`'s only state is its `tier` prop): the
 * Local-Group tier reads `200k ly · 1 Mly · 2.5 Mly`, the Milky-Way tier reads
 * `10k ly · 50k ly · 100k ly` (the §5.3 table, via `ringsForTier`).
 *
 * **Display-only (v1):** no interactive controls, `pointer-events:none` so it
 * never blocks a star hover. **Labels snap on tier change** — no animation in v1
 * (deferred to v1.1, build plan); a tier swap just re-renders the new labels.
 * Solar-System tier is deferred (#127) → `ringsForTier` returns `[]` and the net
 * renders nothing (no crash).
 *
 * **Presentational + pure** (the Card.tsx pattern): it takes the resolved `tier`
 * + the pre-localized `label` aria-name, so it renders identically given the same
 * props and is unit-testable without a router (`ChromeOverlay` does the `useLocale`).
 *
 * **Styling boundary (#75 / code-style.md):** DOM chrome — including this SVG —
 * is Tailwind utilities reading the `@theme` design tokens (mono `font-mono`,
 * faint `text-accent`/`text-dim`, the `bg-space-deep` backing), not bespoke
 * `styles.css`. The rings are SVG `<circle>`s; labels get a subtle dark backing
 * (`bg-space-deep/70`) for legibility over the cosmos (spec §5.3).
 */

/** The net's drawn diameter, px (spec §5.3: "faint, ~140px, never competes"). */
const NET_PX = 140;

type Props = {
  tier: Tier;
  /** The region's accessible name (i18n `scaleNet.label`), resolved by the caller. */
  label: string;
};

export const ScaleNet = ({ tier, label }: Props) => {
  const rings = ringsForTier(tier);
  // Deferred Solar-System tier (#127): nothing to draw → render nothing.
  if (rings.length === 0) return null;

  // The focal centre sits at the bottom-left origin; rings sweep up-and-right as a
  // quarter arc, so only the in-viewport quadrant is drawn (the rest is off-corner).
  const r = NET_PX;

  return (
    <div
      // Pinned bottom-left of the viewport at fixed px + safe-area (matches the
      // existing chrome offsets); display-only so it never captures the pointer.
      className="pointer-events-none absolute bottom-[max(26px,env(safe-area-inset-bottom))] left-[max(28px,env(safe-area-inset-left))] select-none"
      // SVG-as-image role: one short SR name for the whole decorative device,
      // not a per-ring announcement (spec §5.3 — it's an orientation cue).
      role="img"
      aria-label={label}
    >
      <svg
        width={r}
        height={r}
        viewBox={`0 0 ${r} ${r}`}
        aria-hidden="true"
        // Faint accent thread; the rings never compete with the cosmos.
        className="overflow-visible text-accent/35"
      >
        <title>{label}</title>
        {rings.map((ring) => (
          <circle
            key={ring.radius}
            // Focal point = bottom-left of the box; rings arc up-and-right.
            cx={0}
            cy={r}
            r={ring.radius * r}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
        ))}
      </svg>
      {/* Labels — mono, dim, on a subtle dark backing for legibility (spec §5.3).
          Positioned along the up-left diagonal of each ring, inside the box. */}
      <ul className="absolute inset-0 m-0 list-none p-0">
        {rings.map((ring) => {
          // 45° up-and-right from the bottom-left origin → keeps labels readable
          // and clear of the arc; offset is the ring's relative radius.
          const offset = (ring.radius * r) / Math.SQRT2;
          return (
            <li
              key={ring.radius}
              className="absolute whitespace-nowrap rounded-snug bg-space-deep/70 px-[5px] py-px font-mono text-[9px] tracking-[0.12em] text-dim-2"
              style={{
                left: Math.round(offset + 4),
                bottom: Math.round(offset + 2),
              }}
            >
              {formatRingLabel(ring)}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
