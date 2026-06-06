import { useState } from "react";
import type { LgHitTarget, LgLabel } from "#/lib/galaxy/lg-composition";
import type { Messages } from "#/lib/i18n/types";

/**
 * The Local-Group tier's galaxy titles (slice I-2, #112) — **hover-only** since
 * the #167 owner amend: at rest the LG scene shows NO titles (the always-on
 * names broke the composition); hovering or keyboard-focusing a galaxy's
 * invisible hit-target fades its serif-italic name + mono distance up — exactly
 * the memory-star label pattern (state-driven opacity, `motion-reduce:` snaps).
 * Copy comes from the existing `lore.*` catalog entries (en+ru, resolved by the
 * caller); the proof's lowercase/uppercase reads are CSS transforms, not string
 * changes.
 *
 * **Hit-targets** are sized/positioned by the pure composition (`lgHitTargets`
 * — centre + `placedExtent` silhouette reach, no geometry invented here) and
 * carry the accessible name (`aria-label` = name + distance). Element choice:
 * a focusable `role="img"` div, NOT a `<button>` — there is no click behavior
 * in this slice, and a button that does nothing would promise an action to AT
 * users. The target is an *annotated graphic you can land on* (the tooltip-
 * trigger pattern); story #169 upgrades these same targets to real clickable
 * controls (MW dive + lore cards). The label stays decorative (`aria-hidden`),
 * mirroring the mem-star hover labels.
 *
 * Lives INSIDE the camera tree (a sibling of the disk canvas in the L2 wrap) so
 * targets + labels track the tier framing + parallax exactly like the point
 * clouds they annotate. Unmounts with the LG view, so a hover live at
 * descend-start can't strand a title (the state dies with the component).
 *
 * Positions are whole-pixel world coords (rounding guards the CSSOM sub-pixel
 * mismatch — standing rule), though this layer only mounts client-side.
 */
export const LgGalaxyLabels = ({
  labels,
  targets,
  lore,
}: {
  labels: readonly LgLabel[];
  targets: readonly LgHitTarget[];
  lore: Messages["lore"];
}) => {
  // One active galaxy at a time — pointer enter/leave and focus/blur both feed
  // it, last event wins (the MemoryStarView onHoverChange semantics).
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="pointer-events-none absolute inset-0">
      {targets.map((t) => (
        <div
          key={t.id}
          role="img"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: deliberate tooltip-trigger — the tab-stop reveals the title for keyboard users (hover parity); #169 turns this into a real button when clicks land.
          tabIndex={0}
          aria-label={`${lore[t.loreKey].name} · ${lore[t.loreKey].sublabel}`}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent/40"
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
        />
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
