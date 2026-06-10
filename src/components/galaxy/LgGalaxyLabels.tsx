import { useState } from "react";
import type { LgHitTarget, LgLabel } from "#/lib/galaxy/lg-composition";
import type { Messages } from "#/lib/i18n/types";

/**
 * The Local-Group tier's galaxy titles + **clickable galaxies** (slice I, #112 →
 * #169). Two layers of behaviour over the same composition-derived hit-targets:
 *
 *  - **hover-only titles** (#167): at rest the LG scene shows NO names; hovering
 *    or keyboard-focusing a galaxy's hit-target fades its serif name + mono
 *    distance up — the memory-star label pattern (state-driven opacity,
 *    `motion-reduce:` snaps). Copy comes from the existing `lore.*` catalog
 *    (en+ru, resolved by the caller).
 *  - **click** (#169): each hit-target is now a real `<button type="button">`
 *    that reports its composition `id` up through `onSelect`; the stage routes it
 *    through the shared `useObjectClick` seam (the MW gateway dives, a neighbour
 *    opens its lore card). A button is correct now — it DOES something — so it
 *    keeps the keyboard parity (Tab to focus, Enter/Space to activate) for free,
 *    no faked `role="img"`/`tabIndex`. Hover/focus also paints the subtle #154
 *    "clickable" highlight (a soft accent glow) alongside the title, so the
 *    galaxy reads as "you can click this" (snaps under `prefers-reduced-motion`).
 *
 * **Hit-targets** are sized/positioned by the pure composition (`lgHitTargets`
 * — centre + `placedExtent` silhouette reach, no geometry invented here) and
 * carry the accessible name (`aria-label` = name + distance). The title stays
 * decorative (`aria-hidden`), mirroring the mem-star hover labels.
 *
 * Lives INSIDE the camera tree (a sibling of the disk canvas in the L2 wrap) so
 * targets + titles track the tier framing + parallax exactly like the point
 * clouds they annotate. Unmounts with the LG view, so a hover/click live at
 * descend-start can't strand a title, and the MW tier's memory-star interaction
 * is untouched (the state dies with the component).
 *
 * Positions are whole-pixel world coords (rounding guards the CSSOM sub-pixel
 * mismatch — standing rule), though this layer only mounts client-side.
 */
export const LgGalaxyLabels = ({
  labels,
  targets,
  lore,
  onSelect,
}: {
  labels: readonly LgLabel[];
  targets: readonly LgHitTarget[];
  lore: Messages["lore"];
  /** Click sink: the composition `id` of the clicked galaxy (the stage resolves it). */
  onSelect: (id: string) => void;
}) => {
  // One active galaxy at a time — pointer enter/leave and focus/blur both feed
  // it, last event wins (the MemoryStarView onHoverChange semantics). Drives both
  // the title reveal and the clickable highlight.
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="pointer-events-none absolute inset-0">
      {targets.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={`${lore[t.loreKey].name} · ${lore[t.loreKey].sublabel}`}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent/40"
          style={{
            left: `${Math.round(t.x)}px`,
            top: `${Math.round(t.y)}px`,
            width: `${Math.round(t.halfW * 2)}px`,
            height: `${Math.round(t.halfH * 2)}px`,
          }}
          onPointerEnter={() => setActive(t.id)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(t.id)}
          onBlur={() => setActive(null)}
          onClick={() => onSelect(t.id)}
        >
          {/* The #154 "real" clickable highlight: a soft, restrained accent glow
              that fades in on hover/focus — the cue that the silhouette is
              interactive (matching the mem-star restraint, not a loud new visual). */}
          <span
            data-lg-glow={t.id}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_70%)] transition-opacity duration-200 motion-reduce:transition-none ${
              active === t.id ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
      ))}
      <div aria-hidden="true">
        {labels.map((l) => (
          <div
            key={l.id}
            data-lg-label={l.id}
            className={`absolute -translate-x-1/2 text-center transition-opacity duration-200 motion-reduce:transition-none ${
              l.side === "above" ? "-translate-y-full" : ""
            } ${active === l.id ? "opacity-100" : "opacity-0"}`}
            style={{
              left: `${Math.round(l.x)}px`,
              top: `${Math.round(l.y)}px`,
            }}
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
    </div>
  );
};
