import { type CSSProperties, useEffect, useRef } from "react";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import {
  homeViewObjects,
  type RealDrawSpec,
  realDrawSpec,
  realScreenPos,
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
    for (const obj of homeViewObjects()) paintObject(ctx, obj);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  return (
    <div className="galaxy-features" aria-hidden="true">
      <canvas ref={ref} className="galaxy-features__canvas" />
      {homeViewObjects().map((obj) => {
        const { x, y } = realScreenPos(obj);
        const lore = m.lore[obj.loreKey];
        return (
          <span
            key={obj.id}
            className="galaxy-feature-label"
            data-kind={obj.kind}
            style={
              {
                left: `${Math.round(x)}px`,
                top: `${Math.round(y)}px`,
              } as CSSProperties
            }
          >
            <em className="galaxy-feature-label__name">{lore.name}</em>
            <span className="galaxy-feature-label__sub">{lore.sublabel}</span>
          </span>
        );
      })}
    </div>
  );
};
