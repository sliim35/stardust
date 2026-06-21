import { useEffect, useRef } from "react";
import {
  type BackdropGeometry,
  type BackdropPoint,
  buildBackdropGeometry,
  type DiskPlacement,
  MW_PLACEMENT,
} from "#/lib/galaxy/backdrop";
import {
  BLOOM_TUNING,
  bloomPointsFor,
  buildEnteredGalaxyGeometry,
  buildGalaxyGeometry,
  type PlacedGalaxy,
} from "#/lib/galaxy/galaxy-render";
import { LG_GOLD } from "#/lib/galaxy/lg-composition";
import {
  buildShooters,
  SHOOTER_ALPHA_CAP,
  stepMeteor,
} from "#/lib/galaxy/meteors";
import { paletteFor } from "#/lib/galaxy/palette";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import type {
  GalaxyBackdrop as Backdrop,
  RealObject,
} from "#/lib/galaxy/types";

/**
 * L2 — the spiral disk (no central bar). **Soft-glow direction** (owner-chosen 2026-06-03,
 * `docs/superpowers/specs/2026-06-03-galaxy-soft-glow-direction-design.md`): the
 * seeded points render as soft additive glows (pre-rendered sprites + `lighter`
 * blending), so the arms read as smooth luminous bands rather than crisp
 * pixel-art grit. Geometry + density are unchanged; only the surface is soft.
 *
 * Three stacked canvases at the fixed 1280×800 internal resolution, all
 * transparent-backed: a static `base` (the disk-glow point clouds — bgStars +
 * arms + bulge — drawn once per backdrop), a `live` overlay (RAF twinkle + a few
 * thin shooting stars), and a `hover` layer (#174) that blooms ONLY the hovered
 * LG galaxy's own point cloud. The nebula haze + core washes moved out to the
 * full-bleed `BackdropTint` (Layer A, #76), so this canvas paints only additive
 * glow and the tint shows through with no rectangular seam. Deterministic from
 * `backdrop.seed`. Client-only (draws in effects); reduced motion paints the
 * base and stops.
 *
 * The hover layer lives in its OWN effect (keyed on `highlight`) so a hover never
 * repaints the costly base scene — it just re-blooms the one highlighted geometry
 * (~1.4k points) and fades in via a CSS opacity transition (`.galaxy-l2__hover`,
 * snapping under `prefers-reduced-motion`); the empty highlight fades it back out.
 */

const SPRITE_PX = 16; // offscreen glow-sprite resolution
type Sprites = readonly [
  HTMLCanvasElement,
  HTMLCanvasElement,
  HTMLCanvasElement,
];

/** cool / warm / hot bucket for a point's warmth (matches the palette star tones). */
const bucketOf = (warm: number): 0 | 1 | 2 =>
  warm > 0.7 ? 2 : warm > 0.4 ? 1 : 0;

/** A soft round glow (color centre → transparent), pre-rendered once per palette. */
const makeGlowSprite = (color: string): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = SPRITE_PX;
  c.height = SPRITE_PX;
  const cx = c.getContext("2d");
  if (cx) {
    const r = SPRITE_PX / 2;
    const g = cx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, `${color}80`);
    g.addColorStop(1, `${color}00`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  }
  return c;
};

/** Paint a point cloud as soft additive glows — no hard pixels (#50 → soft direction). */
const paintGlow = (
  ctx: CanvasRenderingContext2D,
  points: readonly BackdropPoint[],
  sprites: Sprites,
): void => {
  ctx.globalCompositeOperation = "lighter";
  for (const s of points) {
    const d = s.size === 2 ? 5.6 : 3.6;
    ctx.globalAlpha = s.alpha;
    ctx.drawImage(sprites[bucketOf(s.warm)], s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

/**
 * The hover bloom (#174): a SECOND additive pass over a galaxy's own `arms`+`bulge`
 * — same `paintGlow` sprites + palette, same `lighter` blend, just widened
 * (`diameterScale`) and a touch brighter (`alphaScale`, clamped at 1 so a fully-lit
 * point can't push past the additive ceiling). Painted on the dedicated hover
 * canvas, it makes the hovered silhouette glow without ever touching the base
 * scene — and, by construction, never the deep field (`bloomPointsFor` returns
 * arms+bulge only).
 */
const paintBloom = (
  ctx: CanvasRenderingContext2D,
  points: readonly BackdropPoint[],
  sprites: Sprites,
): void => {
  ctx.globalCompositeOperation = "lighter";
  for (const s of points) {
    const d = (s.size === 2 ? 5.6 : 3.6) * BLOOM_TUNING.diameterScale;
    ctx.globalAlpha = Math.min(1, s.alpha * BLOOM_TUNING.alphaScale);
    ctx.drawImage(sprites[bucketOf(s.warm)], s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

/**
 * The disk glow only (#76): a transparent canvas of additive point-sprite
 * clouds — `bgStars` → `arms` → `bulge`. The nebula haze + core full-rect washes
 * that used to fill this 1280×800 canvas (their rectangular edge was the seam)
 * now live full-bleed in `BackdropTint` (Layer A); this canvas starts cleared so
 * the tint shows through everywhere — no background fill, no rectangle, no seam.
 * The browser composites this transparent-backed canvas over that tint, so the
 * additive `lighter` light lands over the nebula exactly as before.
 *
 * Neighbours (ADR-0011 §1, I-1/I-2) paint on the SAME static base canvas with the
 * SAME `paintGlow` + palette sprites — so the home Milky Way and every Local-Group
 * neighbour read as one coherent soft-glow scene (one renderer, not two). Each
 * neighbour's geometry carries no `bgStars` (the MW owns the one deep field), so
 * only its `arms` + `bulge` paint. The gold accents (Sol's mark + the globulars,
 * I-2) paint last with the dedicated gold sprite — the reserved gold never
 * re-tints with the theme palette.
 */
const drawBase = (
  ctx: CanvasRenderingContext2D,
  geom: BackdropGeometry,
  neighbourGeoms: readonly BackdropGeometry[],
  goldDust: readonly BackdropPoint[],
  sprites: Sprites,
  goldSprite: HTMLCanvasElement,
): void => {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  paintGlow(ctx, geom.bgStars, sprites);
  paintGlow(ctx, geom.arms, sprites);
  paintGlow(ctx, geom.bulge, sprites);
  for (const ng of neighbourGeoms) {
    paintGlow(ctx, ng.arms, sprites);
    paintGlow(ctx, ng.bulge, sprites);
  }
  // One fixed-gold sprite for every warmth bucket — gold dust never palette-tints.
  paintGlow(ctx, goldDust, [goldSprite, goldSprite, goldSprite]);
};

export const GalaxyBackdrop = ({
  backdrop,
  homePlacement = MW_PLACEMENT,
  enteredObject = null,
  neighbours = [],
  goldDust = [],
  highlight = null,
}: {
  backdrop: Backdrop;
  /**
   * Where the home disk sits (I-2): the MW default keeps the home render
   * byte-identical; the LG tier passes the shrunk `LG_MW_PLACEMENT`.
   */
  homePlacement?: DiskPlacement;
  /**
   * The entered (tier-2) neighbour whose OWN morphology this disk must paint
   * (#226); `null` = the home Milky Way → the untouched `buildBackdropGeometry`
   * path (AC1). Set only when descended into a non-home galaxy.
   */
  enteredObject?: RealObject | null;
  /**
   * Layer-A real galaxies to paint alongside the home disk (ADR-0011 §1), each
   * at the placement its tier composition chose. Renders through the same
   * generator + `paintGlow`, differing only in placement + tuning. Defaults to
   * none → the home-only render is unchanged.
   */
  neighbours?: readonly PlacedGalaxy[];
  /**
   * Gold accents (I-2: Sol's amber mark + globular sprinkles), painted with the
   * reserved-gold sprite so they never re-tint with the theme palette.
   */
  goldDust?: readonly BackdropPoint[];
  /**
   * The hovered LG hit-target id (#174): the MW gateway (`HOME_MILKY_WAY_ID`) or
   * a neighbour's `object.id`. Its own `arms`+`bulge` bloom on the hover canvas;
   * `null` fades the bloom out. The stage clears it when leaving the LG tier, so
   * nothing strands across the descend.
   */
  highlight?: string | null;
}) => {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const base = baseRef.current;
    const live = liveRef.current;
    if (!base || !live) return;
    const bctx = base.getContext("2d");
    const lctx = live.getContext("2d");
    if (!bctx || !lctx) return;

    for (const c of [base, live]) {
      c.width = STAGE_W;
      c.height = STAGE_H;
    }
    bctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingEnabled = true;

    const p = paletteFor(backdrop.palette);
    const sprites: Sprites = [
      makeGlowSprite(p.starCool),
      makeGlowSprite(p.starWarm),
      makeGlowSprite(p.starHot),
    ];
    // #226: an entered neighbour paints ITS own shape-dispatched disk + deep field;
    // the home Milky Way keeps the untouched grand-spiral path (AC1 byte-identical).
    const geom = enteredObject
      ? buildEnteredGalaxyGeometry(enteredObject, homePlacement)
      : buildBackdropGeometry(backdrop, homePlacement);
    const neighbourGeoms = neighbours.map(({ object, place }) =>
      buildGalaxyGeometry(object, place),
    );
    drawBase(
      bctx,
      geom,
      neighbourGeoms,
      goldDust,
      sprites,
      makeGlowSprite(LG_GOLD),
    );

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    // Twinkle the brighter arm/bulge points; speed reuses the seeded phase.
    const twinklers = [...geom.arms, ...geom.bulge]
      .filter((s) => s.alpha > 0.5)
      .map((s) => ({ ...s, speed: 0.6 + s.phase * 1.6 }));

    // Multi-directional, full-field streaks (story #55, spike #54): origin edge,
    // slope sign, and y0 all varied per shooter; geometry lives in the pure,
    // unit-tested `meteors` module so this loop only draws.
    const shooters = buildShooters(backdrop.seed);

    const hot = sprites[2];
    let raf = 0;
    const draw = (ms: number): void => {
      const t = ms * 0.001;
      lctx.clearRect(0, 0, STAGE_W, STAGE_H);
      lctx.globalCompositeOperation = "lighter";

      for (const s of twinklers) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase * 6.283);
        const d = s.size === 2 ? 6.5 : 4.5;
        lctx.globalAlpha = s.alpha * tw * 0.6;
        lctx.drawImage(hot, s.x - d / 2, s.y - d / 2, d, d);
      }

      // The streak stepping (window gate, head, fade, per-pixel taper, slope) is the
      // pure `stepMeteor`; this loop only fills the pixels it returns. STAGE-absolute
      // frame + y0 as-is + the SHOOTER_ALPHA_CAP peak (L1 is HEAD-relative + dimmer) —
      // the asymmetry lives in `StepOpts`, not here (#55).
      lctx.fillStyle = p.starHot;
      for (const sh of shooters) {
        for (const px of stepMeteor(sh, t, {
          width: STAGE_W,
          y0Scale: 1,
          slopeFrame: "absolute",
          alphaCap: SHOOTER_ALPHA_CAP,
        })) {
          lctx.globalAlpha = px.alpha;
          lctx.fillRect(px.x, px.y, 1, 1);
        }
      }

      lctx.globalAlpha = 1;
      lctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [backdrop, homePlacement, enteredObject, neighbours, goldDust]);

  // The hover bloom (#174) in its OWN effect — deliberately NOT keyed on the base
  // deps, so a hover never repaints the base scene (AC6). It rebuilds just the one
  // highlighted geometry (~1.4k points) and paints it brighter on the hover canvas;
  // an empty `highlight` clears the canvas and the CSS fade takes it out. The
  // canvas always paints fully opaque — the `.galaxy-l2__hover` opacity transition
  // (driven by `data-active` below) owns the 200 ms fade / reduced-motion snap.
  useEffect(() => {
    const hover = hoverRef.current;
    if (!hover) return;
    const hctx = hover.getContext("2d");
    if (!hctx) return;
    hover.width = STAGE_W;
    hover.height = STAGE_H;
    hctx.imageSmoothingEnabled = true;
    hctx.clearRect(0, 0, STAGE_W, STAGE_H);

    const points = bloomPointsFor(highlight, {
      backdrop,
      homePlacement,
      neighbours,
    });
    if (points.length === 0) return;

    const p = paletteFor(backdrop.palette);
    const sprites: Sprites = [
      makeGlowSprite(p.starCool),
      makeGlowSprite(p.starWarm),
      makeGlowSprite(p.starHot),
    ];
    paintBloom(hctx, points, sprites);
  }, [highlight, backdrop, homePlacement, neighbours]);

  return (
    <div className="galaxy-l2" aria-hidden="true">
      <canvas ref={baseRef} className="galaxy-l2__canvas" />
      <canvas ref={liveRef} className="galaxy-l2__canvas" />
      {/* The hover bloom layer (#174): visibility is the `.galaxy-l2__hover`
          opacity fade, driven by `data-active` so the fade-OUT works (it stays
          mounted, painted, just transparent). `data-lg-bloom` carries the active
          id as a test/QA signal (empty when nothing is highlighted). */}
      <canvas
        ref={hoverRef}
        className="galaxy-l2__canvas galaxy-l2__hover"
        data-lg-bloom={highlight ?? ""}
        data-active={highlight ? "true" : undefined}
      />
    </div>
  );
};
