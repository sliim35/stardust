import { type CSSProperties, useEffect, useRef } from "react";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import {
  homeFeatureObjects,
  type RealDrawSpec,
  realDrawSpec,
  realScreenPos,
  visibleFeatureLabels,
} from "#/lib/galaxy/real-visual";
import type { RealObject } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";

/**
 * Layer A·features — the real Layer-A objects of the **home Milky-Way tier** drawn
 * by their `shape`/`kind` (ADR-0010 §4, #146): Sgr A* (core marker), the Orion Arm
 * (arm label), Sol (the "her home" gateway star), and the 3 named nebulae (Pillars,
 * Crab, Orion). It sits over the disk-glow `GalaxyBackdrop` and under the memory
 * stars, inside the contain-fit camera so it pans/parallaxes with the cosmos.
 *
 * **HD-2D soft-glow** (owner-binding — memory `pixel-art-always`, the design spec):
 * the cosmos is sleek soft glow, NOT hard pixels — so every silhouette here is a
 * smooth radial bloom painted with `lighter` compositing (the same surface as the
 * disk), keyed to each object's morphology by the pure `realDrawSpec`. Only ASTRO
 * stays crisp pixel art (a different layer). The shape→draw mapping + the view
 * selector are the unit-tested pure half (`real-visual.ts`); this component is the
 * thin canvas+DOM shell, mirroring `GalaxyBackdrop`/`MemoryStarLayer`.
 *
 * **i18n (ADR-0010 §2):** the on-stage feature labels (name + mono sublabel) come
 * from the `lore` catalog via `getMessages(useLocale())` — no inline strings; the
 * full ASTRO lore line is the lore card's (a later slice).
 *
 * **DOM-chrome styling (owner critique — the styling boundary, #75):** the feature
 * labels are DOM chrome, so they're styled with **Tailwind utilities + design tokens**
 * (`font-serif`, `font-mono`, `text-*`/`text-dim-2` colour tokens) inline here — NOT
 * bespoke `galaxy-feature-label__*` CSS classes. `src/styles.css` stays canvas-stage
 * only (the `.galaxy-features` / `__canvas` wrapper rules remain — those position the
 * canvas, which is the stage, not chrome).
 *
 * **Label deconfliction (owner critique #1):** the on-stage labels run through
 * `visibleFeatureLabels`, which suppresses the soft `Orion Arm` arm caption whenever a
 * real POI label (Sol, a nebula, Sgr A*) sits within `ARM_LABEL_SUPPRESS_PX` — so the
 * "Sol · her home" lockup, the emotional anchor, always reads cleanly.
 *
 * **SSR-safe:** the canvas paints client-side in an effect (never during SSR);
 * positions/colours derive purely from the data + locale, so labels hydrate
 * without mismatch (locale is a pure function of the URL). Honors
 * `prefers-reduced-motion` implicitly — the layer is static (no RAF).
 */

/** A hex `#rrggbb` + a 0..1 alpha → an 8-digit `#rrggbbaa` the canvas accepts. */
const withAlpha = (color: string, alpha: number): string => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${a}`;
};

/** A soft round bloom at (x,y), squashed to `aspect` and rotated by `angle`. */
const paintBloom = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spec: RealDrawSpec,
  angle: number,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, spec.aspect);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, spec.radiusPx);
  g.addColorStop(0, withAlpha(spec.color, spec.alpha));
  g.addColorStop(0.4, withAlpha(spec.color, spec.alpha * 0.45));
  g.addColorStop(1, withAlpha(spec.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, spec.radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Sol-style bright point: a tight hot core over a soft halo + a thin cross-flare. */
const paintPoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spec: RealDrawSpec,
): void => {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, spec.radiusPx);
  halo.addColorStop(0, withAlpha(spec.color, spec.alpha));
  halo.addColorStop(0.5, withAlpha(spec.color, spec.alpha * 0.3));
  halo.addColorStop(1, withAlpha(spec.color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, spec.radiusPx, 0, Math.PI * 2);
  ctx.fill();
  // White-hot center.
  ctx.fillStyle = withAlpha("#fffdf6", Math.min(1, spec.alpha + 0.3));
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** A faint open ring — the Sgr A* core marker. */
const paintRing = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spec: RealDrawSpec,
): void => {
  const r = spec.radiusPx * 0.4;
  ctx.strokeStyle = withAlpha(spec.color, spec.alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // A small soft core inside the ring.
  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, withAlpha(spec.color, spec.alpha * 0.7));
  core.addColorStop(1, withAlpha(spec.color, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** Paint one real object by its primitive (soft-glow, additive). */
const paintObject = (ctx: CanvasRenderingContext2D, obj: RealObject): void => {
  const spec = realDrawSpec(obj);
  if (spec.primitive === "none") return;
  const { x, y } = realScreenPos(obj);
  if (spec.primitive === "disk")
    paintBloom(ctx, x, y, spec, spec.barAngle + spec.tilt);
  else if (spec.primitive === "cloud") paintBloom(ctx, x, y, spec, 0);
  else if (spec.primitive === "point") paintPoint(ctx, x, y, spec);
  else paintRing(ctx, x, y, spec);
};

export const GalaxyFeatureLayer = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const m = getMessages(useLocale());

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.globalCompositeOperation = "lighter";
    for (const obj of homeFeatureObjects()) paintObject(ctx, obj);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  return (
    <div className="galaxy-features" aria-hidden="true">
      <canvas ref={ref} className="galaxy-features__canvas" />
      {visibleFeatureLabels(homeFeatureObjects()).map((obj) => {
        const { x, y } = realScreenPos(obj);
        const lore = m.lore[obj.loreKey];
        const isArm = obj.kind === "armLabel";
        // Sgr A* (marker) sits dead-centre in the brightest core bloom, so its label
        // floats higher to clear the bulge falloff + gets a denser dark backing — the
        // "GALACTIC CENTER · 26,000 LY" line was washed out by the core (critique #5).
        const isCore = obj.kind === "marker";
        return (
          <span
            key={obj.id}
            // DOM chrome → Tailwind utilities + tokens (#75). The dark radial backing
            // (per-label craft, like the per-instance --star-color the spec blesses —
            // NOT a static token) + the data-driven position are inline `style`, so
            // they render reliably without a bespoke CSS class.
            className={`absolute flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-center pointer-events-none ${
              isCore
                ? "-translate-y-[calc(50%+64px)]"
                : "-translate-y-[calc(50%+28px)]"
            }`}
            style={
              {
                left: `${Math.round(x)}px`,
                top: `${Math.round(y)}px`,
                background: isCore
                  ? "radial-gradient(ellipse at center, rgb(4 5 13 / 0.88) 0%, rgb(4 5 13 / 0) 72%)"
                  : "radial-gradient(ellipse at center, rgb(4 5 13 / 0.72) 0%, rgb(4 5 13 / 0) 75%)",
              } as CSSProperties
            }
          >
            {/* The arm caption reads as a soft annotation, not a point object → dimmer. */}
            <em
              className={`font-serif text-[14px] italic ${isArm ? "text-dim" : "text-text"}`}
            >
              {lore.name}
            </em>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim-2">
              {lore.sublabel}
            </span>
          </span>
        );
      })}
    </div>
  );
};
