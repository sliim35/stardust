import type { LgLabel } from "#/lib/galaxy/lg-composition";
import type { Messages } from "#/lib/i18n/types";

/**
 * The Local-Group tier's galaxy labels (slice I-2, #112) — a serif-italic name
 * over a mono distance sublabel per galaxy (the FINAL proof's on-brand chrome:
 * no boxed panel). Copy comes from the existing `lore.*` catalog entries (en+ru,
 * resolved by the caller — this component stays pure/presentational like
 * `ScaleNet`); the proof's lowercase/uppercase reads are CSS transforms, not
 * string changes.
 *
 * Lives INSIDE the camera tree (a sibling of the disk canvas in the L2 wrap) so
 * the labels track the tier framing + parallax exactly like the point clouds
 * they annotate. Decorative annotations → `aria-hidden`, mirroring how the
 * mem-star hover labels are handled; the accessible story for real objects is
 * the lore card (spec §4).
 *
 * Positions are whole-pixel world coords from the pure composition
 * (`lgLabels()`); rounding guards the CSSOM sub-pixel mismatch (standing rule),
 * though this layer only ever mounts client-side (the SSR tier is the MW).
 */
export const LgGalaxyLabels = ({
  labels,
  lore,
}: {
  labels: readonly LgLabel[];
  lore: Messages["lore"];
}) => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    {labels.map((l) => (
      <div
        key={l.id}
        className={`absolute -translate-x-1/2 text-center ${
          l.side === "above" ? "-translate-y-full" : ""
        }`}
        style={{ left: `${Math.round(l.x)}px`, top: `${Math.round(l.y)}px` }}
      >
        <em className="block font-serif text-[20px] lowercase italic leading-tight text-text/85">
          {lore[l.loreKey].name}
        </em>
        <span className="mt-[3px] block whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-dim-2">
          {lore[l.loreKey].sublabel}
        </span>
      </div>
    ))}
  </div>
);
