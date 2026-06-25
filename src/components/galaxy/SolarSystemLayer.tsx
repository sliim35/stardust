/**
 * SolarSystemLayer — the S2+S3 DOM overlay for the Solar-System tier.
 *
 * Renders the **sleek stylized planet spheres + pulsing Sol** as CSS DOM
 * elements over the canvas void (the canvas still draws the faint ring
 * ladder + background stars). Each planet is a gradient-lit sphere div with
 * its one recognizable cue (Saturn's ring, Jupiter's bands + spot, etc.).
 * Sol is a pulsing white-hot bloom: a photosphere disc + wide warm-gold
 * corona halo, breathing on a ~7 s cycle.
 *
 * S3 orbital motion: GSAP RAF drives `t` (elapsed s); `orbitAngle(planet, t)`
 * is the pure math; the component positions each planet via inline `left/top`
 * (Math.round-quantized per the SSR sub-pixel rule). Hover/focus pauses all
 * orbits so the targeted planet holds still — sets up S4 click→card.
 *
 * ADR constraints:
 * - GSAP lives here (components/galaxy/*), never in lib/ (ADR-0009 boundary).
 * - SSR: Math.round inline positions (memory:ssr-subpixel-hydration-gotcha).
 * - Reduced motion: no orbit drift, no pulse — static at authored angles.
 * - `prefers-reduced-motion` drives the pause; hover/focus also pauses.
 * - Per-planet cues from `solar-orbit.ts` (pure, no DOM). No pixel-art.
 * - DOM chrome (labels, hit areas) uses Tailwind utilities per the #75 boundary.
 *   Visual sphere + cue elements use inline styles (no @theme tokens on canvas
 *   geometry — design-token boundary from docs/design/2026-06-03-design-tokens.md).
 * - i18n: aria-labels read from the i18n catalog (en+ru) via caller prop, never
 *   hardcoded here.
 */

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GALAXY_CENTER } from "#/lib/galaxy/place";
import {
  orbitAngle,
  PLANET_CUES,
  ringXY,
  SOLAR_ORBIT_TILT,
  SUN_CORONA_OPACITY_MAX,
  SUN_CORONA_OPACITY_MIN,
  SUN_CORONA_SCALE_MAX,
  SUN_CORONA_SCALE_MIN,
  SUN_PULSE_PERIOD,
  SUN_PULSE_SCALE_AMPLITUDE,
} from "#/lib/galaxy/solar-orbit";
import type { RealObject } from "#/lib/galaxy/types";
import { useCardContext } from "./CardHost";
import { gsap, useGalaxyGsap } from "./gsap-setup";

// ── Constants (tunable knobs — expose in PR body) ────────────────────────────

/** Base sphere radius (px) per unit `size` — planets are compact soft-glow spheres. */
export const SOLAR_BODY_PX = 18;

/** Sol's photosphere disc radius (px) — the white-hot hero. */
export const SOLAR_SUN_DISC_PX = 34;

/** Sol's wide warm-gold halo diameter (px). */
export const SOLAR_SUN_HALO_PX = 300;

// ── Pure sphere-shading helpers ───────────────────────────────────────────────

const hexToRgb = (h: string): [number, number, number] => {
  const c = h.replace("#", "");
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
};

const mixRgb = (
  c1: readonly [number, number, number],
  c2: readonly [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(c1[0] + (c2[0] - c1[0]) * t),
  Math.round(c1[1] + (c2[1] - c1[1]) * t),
  Math.round(c1[2] + (c2[2] - c1[2]) * t),
];

const rgbStr = (c: readonly [number, number, number]): string =>
  `rgb(${c[0]},${c[1]},${c[2]})`;

const WHITE: [number, number, number] = [255, 255, 255];
const DEEP: [number, number, number] = [8, 12, 26];

/**
 * CSS radial-gradient background for a gradient-lit planet sphere.
 * The highlight is biased toward the Sun (centre of the stage) — a small
 * specular near the lit limb + a full hemisphere gradient dark→light→dark.
 * Mirrors the design's `sphereBg()` JS function.
 */
const sphereBg = (
  color: string,
  px: number, // planet x (stage px)
  py: number, // planet y (stage px)
): string => {
  const cx = GALAXY_CENTER.x;
  const cy = GALAXY_CENTER.y;
  let ux = cx - px;
  let uy = cy - py;
  const d = Math.hypot(ux, uy) || 1;
  ux /= d;
  uy /= d;
  // Lit-side centre (% of the sphere div) — shifted toward the Sun.
  const hx = 50 + ux * 30;
  const hy = 50 + uy * 30;
  // Specular highlight near the lit limb.
  const sx = 50 + ux * 44;
  const sy = 50 + uy * 44;
  const rgb = hexToRgb(color);
  const light = rgbStr(mixRgb(rgb, WHITE, 0.5));
  const base = rgbStr(rgb);
  const dark = rgbStr(mixRgb(rgb, DEEP, 0.8));
  return (
    `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 24%),` +
    `radial-gradient(circle at ${hx}% ${hy}%, ${light} 0%, ${base} 46%, ${dark} 100%)`
  );
};

// ── Sub-components for planet cues ───────────────────────────────────────────

/** Saturn's tilted ring ellipse. Drawn as a CSS border + rotateX foreshortening. */
const SaturnRing = ({ size, color }: { size: number; color: string }) => {
  const ringW = Math.round(size * 2.6);
  const ringH = Math.round(size * 0.55 * SOLAR_ORBIT_TILT);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: ringW,
        height: ringH,
        transform: "translate(-50%, -50%)",
        border: `1.5px solid ${color}`,
        borderRadius: "50%",
        opacity: 0.7,
        pointerEvents: "none",
      }}
    />
  );
};

/** Jupiter's horizontal cloud bands + Great Red Spot. */
const JupiterBands = (_: { size: number; color: string }) => {
  const bandColors = [
    "rgba(180,158,138,0.3)",
    "rgba(210,188,165,0.25)",
    "rgba(175,153,132,0.3)",
  ];
  return (
    <>
      {/* three faint horizontal band stripes */}
      {[28, 50, 72].map((topPct, i) => (
        <div
          key={topPct}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "4%",
            width: "92%",
            top: `${topPct}%`,
            height: "8%",
            background: bandColors[i],
            borderRadius: 1,
            pointerEvents: "none",
          }}
        />
      ))}
      {/* Great Red Spot */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "58%",
          top: "60%",
          width: "22%",
          height: "13%",
          background: `radial-gradient(circle, rgba(180,80,70,0.55) 0%, rgba(180,80,70,0) 100%)`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
    </>
  );
};

/** Earth's cloud swirl + thin bright atmosphere rim. */
const EarthFeatures = () => (
  <>
    {/* faint cloud swirl — an irregular white patch */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "30%",
        top: "18%",
        width: "45%",
        height: "30%",
        background:
          "radial-gradient(ellipse 80% 60% at 55% 45%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    />
    {/* thin atmosphere rim glow */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        boxShadow: "inset 0 0 4px 2px rgba(140,200,240,0.35)",
        pointerEvents: "none",
      }}
    />
  </>
);

/** Mars's tiny polar cap at the top of the sphere. */
const MarsPolarCap = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      left: "50%",
      top: "4%",
      width: "30%",
      height: "18%",
      transform: "translateX(-50%)",
      background:
        "radial-gradient(ellipse 100% 70% at 50% 30%, rgba(240,235,228,0.7) 0%, rgba(240,235,228,0) 100%)",
      borderRadius: "50%",
      pointerEvents: "none",
    }}
  />
);

/** Neptune's dark storm mottling. */
const NeptuneStorm = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      left: "22%",
      top: "38%",
      width: "36%",
      height: "22%",
      background: `radial-gradient(ellipse, rgba(40,55,120,0.45) 0%, rgba(40,55,120,0) 100%)`,
      borderRadius: "50%",
      pointerEvents: "none",
    }}
  />
);

// ── Single planet element ─────────────────────────────────────────────────────

type PlanetNodeProps = {
  planet: RealObject;
  /** Initial (SSR / first-paint) stage position; the RAF then drives left/top imperatively. */
  initialX: number;
  initialY: number;
  ariaLabel: string;
  /** Display name (i18n) for the hover/focus brief-info label. */
  name: string;
  /** Ref callback so the parent's GSAP ticker can move this node without a React re-render. */
  nodeRef: (el: HTMLButtonElement | null) => void;
  onHoverChange: (id: string | null) => void;
  /** Click / Enter → open the lore card + ASTRO narration. */
  onSelect: () => void;
};

const PlanetNode = ({
  planet,
  initialX,
  initialY,
  ariaLabel,
  name,
  nodeRef,
  onHoverChange,
  onSelect,
}: PlanetNodeProps) => {
  const color = planet.color;
  const size = Math.round(planet.size * SOLAR_BODY_PX * 2); // diameter in px
  const cue = PLANET_CUES[planet.id as keyof typeof PLANET_CUES];

  const bg = sphereBg(color, initialX, initialY);

  // atmosphere glow drop-shadow (all planets have a soft edge glow)
  const atmosphereFilter = `drop-shadow(0 0 3px ${color}80) drop-shadow(0 0 8px ${color}40)`;
  // Mercury has no atmosphere — minimal glow
  const filter =
    planet.id === "mercury"
      ? `drop-shadow(0 0 2px ${color}50)`
      : atmosphereFilter;

  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: size,
    height: size,
    borderRadius: "50%",
    // Position rides `transform` (GPU-composited) — the ticker updates this. The
    // translate3d places the centre at (x,y); the trailing translate(-50%,-50%) re-
    // centres on the sphere. `willChange` hints the compositor for smooth motion.
    transform: `translate3d(${Math.round(initialX)}px, ${Math.round(initialY)}px, 0) translate(-50%, -50%)`,
    willChange: "transform",
    background: bg,
    filter,
    cursor: "pointer",
    outline: "none",
    overflow: "visible",
  };

  return (
    <button
      ref={nodeRef}
      type="button"
      className="group focus-visible:outline-none"
      aria-label={ariaLabel}
      style={style}
      onPointerEnter={() => onHoverChange(planet.id)}
      onPointerLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(planet.id)}
      onBlur={() => onHoverChange(null)}
      onClick={onSelect}
    >
      {/* Per-planet cue overlay */}
      {cue?.kind === "marble" && <EarthFeatures />}
      {cue?.kind === "polarCap" && <MarsPolarCap />}
      {cue?.kind === "bands" && <JupiterBands size={size} color={color} />}
      {cue?.kind === "ring" && <SaturnRing size={size} color={color} />}
      {cue?.kind === "storm" && <NeptuneStorm />}
      {/* Brief info on hover/focus — the planet NAME, like the galaxy labels (the
          full facts — real distance + lore — live in the click card). CSS-only reveal
          (group-hover/focus) so it never re-renders the orbiting node; the orbit pause
          (pausedRef) holds the planet still while you read it + aim a click. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[#d6dae6] opacity-0 transition-opacity duration-150 [text-shadow:0_1px_3px_rgba(2,4,12,0.9)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {name}
      </span>
      {/* Generous invisible hit pad per Fitts's law (min 44×44 touch target) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: Math.max(46, size + 22),
          height: Math.max(46, size + 22),
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
        }}
      />
    </button>
  );
};

// ── Sol — the pulsing hero ────────────────────────────────────────────────────

type SolProps = {
  x: number;
  y: number;
  ariaLabel: string;
  name: string;
  tRef: React.RefObject<number>;
  reducedMotion: boolean;
  onHoverChange: (id: string | null) => void;
  onSelect: () => void;
};

const SolElement = ({
  x,
  y,
  ariaLabel,
  name,
  tRef,
  reducedMotion,
  onHoverChange,
  onSelect,
}: SolProps) => {
  const photoRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  // RAF-driven pulse (reduced motion → CSS animation only, static values)
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const TAU = Math.PI * 2;
    const tick = () => {
      const t = tRef.current;
      const phase = (TAU * t) / SUN_PULSE_PERIOD;
      const norm = (1 + Math.sin(phase)) / 2;

      const photoScale = 1 + SUN_PULSE_SCALE_AMPLITUDE * Math.sin(phase);
      const coronaOpacity =
        SUN_CORONA_OPACITY_MIN +
        norm * (SUN_CORONA_OPACITY_MAX - SUN_CORONA_OPACITY_MIN);
      const coronaScale =
        SUN_CORONA_SCALE_MIN +
        norm * (SUN_CORONA_SCALE_MAX - SUN_CORONA_SCALE_MIN);

      if (photoRef.current) {
        photoRef.current.style.transform = `translate(-50%,-50%) scale(${photoScale})`;
      }
      if (haloRef.current) {
        haloRef.current.style.opacity = String(coronaOpacity);
        haloRef.current.style.transform = `translate(-50%,-50%) scale(${coronaScale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, tRef]);

  const discStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: SOLAR_SUN_DISC_PX * 2,
    height: SOLAR_SUN_DISC_PX * 2,
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 50% 50%, #fffefa 0%, #fff1d4 40%, #f7d9a0 72%, #eec488 90%, rgba(225,170,100,0) 100%)",
    pointerEvents: "none",
  };

  const haloStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: SOLAR_SUN_HALO_PX,
    height: SOLAR_SUN_HALO_PX,
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    // Warm-gold corona halo using screen blend for additive glow feel
    background:
      "radial-gradient(circle, rgba(245,214,160,0.15) 0%, rgba(248,224,172,0.07) 38%, transparent 70%)",
    mixBlendMode: "screen",
    opacity: reducedMotion ? 0.8 : SUN_CORONA_OPACITY_MIN,
    pointerEvents: "none",
  };

  // Extended outer glow ring (the "wide warm-gold halo" from the design)
  const outerGlowStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: SOLAR_SUN_HALO_PX * 1.5,
    height: SOLAR_SUN_HALO_PX * 1.5,
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(245,214,160,0.06) 0%, rgba(245,214,160,0.02) 50%, transparent 72%)",
    mixBlendMode: "screen",
    pointerEvents: "none",
  };

  return (
    <button
      type="button"
      className="group focus-visible:outline-none"
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        left: Math.round(x),
        top: Math.round(y),
        width: 0,
        height: 0,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        outline: "none",
      }}
      onPointerEnter={() => onHoverChange("sol-star")}
      onPointerLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange("sol-star")}
      onBlur={() => onHoverChange(null)}
      onClick={onSelect}
    >
      {/* Brief info on hover/focus — Sol's name, gold (reserved). Click opens its
          lore card ("her home" + the AI fact). CSS-only reveal (no re-render). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        style={{ top: SOLAR_SUN_DISC_PX + 18 }}
      >
        <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-[#f5d6a0] [text-shadow:0_1px_3px_rgba(2,4,12,0.9)]">
          {name}
        </span>
      </span>
      {/* Outer warm glow (farthest layer) */}
      <div aria-hidden="true" style={outerGlowStyle} />
      {/* Corona halo — pulses in opacity + scale */}
      <div aria-hidden="true" ref={haloRef} style={haloStyle} />
      {/* Photosphere disc — pulses in scale */}
      <div aria-hidden="true" ref={photoRef} style={discStyle} />
      {/* Hit area */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 84,
          height: 84,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
        }}
      />
    </button>
  );
};

// ── Main layer component ──────────────────────────────────────────────────────

export type SolarSystemLayerProps = {
  /** Sol + the 8 real planets from solarSystemObjects(). */
  bodies: readonly RealObject[];
  /**
   * Per-body aria-label supplier (i18n — caller reads from the en/ru catalog
   * so this component never hardcodes user-facing strings, per all-user-text-via-i18n).
   * Called with `body.id` → the translated accessible label.
   */
  ariaLabelFor: (id: string) => string;
  /** Per-body display name (i18n, from the lore catalog) for the hover label. */
  nameFor: (id: string) => string;
  /**
   * ASTRO narration on select (#184, ADR-0013) — opening a body's lore card also
   * asks the cached-fact server fn for an interesting line, routed through ASTRO's
   * narration seam (same wiring galaxies use). Optional; omitted in tests.
   */
  onNarrate?: (object: { loreKey: string }) => void;
};

/**
 * The HD-2D Solar-System DOM layer (S2 + S3):
 * - S2: sleek CSS gradient-lit planet spheres with per-planet cues + pulsing Sol.
 * - S3: GSAP-driven orbital motion (outer planets slower); pause on hover/focus.
 *
 * Positioned absolutely inside `.galaxy-stage__fit` (1280×800 stage space),
 * layered OVER the canvas (which draws the faint ring ladder + void starfield).
 * Pointer-events are enabled on the planet buttons, disabled on the container
 * (`pointer-events: none` on the wrapper, planets opt back in — the L4 plane
 * pattern from the figure overlay).
 */
export const SolarSystemLayer = ({
  bodies,
  ariaLabelFor,
  nameFor,
  onNarrate,
}: SolarSystemLayerProps) => {
  const useGSAP = useGalaxyGsap();
  // Card seam (interaction spec §4): SolarSystemLayer is a child of <CardHost>, so
  // a body click opens its LORE card (RealObject → lore skin) just like a galaxy.
  const { openCard } = useCardContext();

  // `t` accumulates elapsed seconds for the pure orbit/pulse math — a ref, so the
  // animation never costs a React re-render (ADR-0009: GSAP drives, refs hold the
  // live values; the rest of the stage animates the same way — useGalaxyCamera).
  const tRef = useRef(0);
  // Hover/focus pause lives in a REF, not state, so pausing never tears down +
  // recreates the ticker (which churned the timing) — the ticker reads it live.
  const pausedRef = useRef(false);

  const planets = useMemo(
    () => bodies.filter((b) => b.kind === "planet"),
    [bodies],
  );
  const sol = useMemo(() => bodies.find((b) => b.kind === "star"), [bodies]);

  // Reduced motion detection (client-side; SSR returns false for safe static render).
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // The live planet button elements, keyed by id — the ticker moves these directly.
  const planetEls = useRef<Record<string, HTMLButtonElement | null>>({});

  // Static SSR / first-paint positions (authored rest angle); the ticker takes over.
  const initialPos = useMemo(
    () =>
      Object.fromEntries(
        planets.map((p) => [
          p.id,
          ringXY(
            p.placement.r,
            p.placement.angle,
            GALAXY_CENTER.x,
            GALAXY_CENTER.y,
          ),
        ]),
      ),
    [planets],
  );

  // Hover/focus pauses ALL orbits (owner decision) so the targeted planet holds
  // still — sets up S4 (click → lore card + ASTRO narration). Imperative: flips a
  // ref, so the ticker keeps running (just doesn't advance `t`) and isn't recreated.
  const handleHoverChange = useCallback((id: string | null) => {
    pausedRef.current = id !== null;
  }, []);

  // Select (click / Enter) → open the body's LORE card + fire ASTRO's narration,
  // exactly like a galaxy/star selection (#169/#184). The body is a RealObject.
  const onSelect = useCallback(
    (body: RealObject) => {
      openCard(body);
      onNarrate?.(body);
    },
    [openCard, onNarrate],
  );

  // One stable GSAP ticker — drives `t` and writes each planet's left/top + lit-side
  // gradient IMPERATIVELY (no per-frame setState → no render churn, no ticker stacking,
  // no 0–5 s ramp). Deps exclude the pause (it's a ref), so hover never recreates it.
  useGSAP(() => {
    if (reducedMotion) return;
    let lastTime: number | null = null;
    let frame = 0;
    const ticker = (time: number) => {
      if (lastTime === null) lastTime = time;
      const dt = Math.min(0.05, time - lastTime); // seconds; cap survives tab-switch
      lastTime = time;
      if (!pausedRef.current) tRef.current += dt;
      const t = tRef.current;
      frame++;
      // Re-light the gradient only ~5×/s, not every frame: rebuilding a radial
      // gradient + repainting 8 spheres each frame is what made motion feel laggy.
      // Position rides `transform: translate3d` (GPU-composited, no layout/repaint).
      const relight = frame % 12 === 0;
      for (const p of planets) {
        const el = planetEls.current[p.id];
        if (!el) continue;
        const theta = orbitAngle(p, t, false);
        const pos = ringXY(
          p.placement.r,
          theta,
          GALAXY_CENTER.x,
          GALAXY_CENTER.y,
        );
        el.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0) translate(-50%, -50%)`;
        if (relight) el.style.background = sphereBg(p.color, pos.x, pos.y);
      }
    };
    gsap.ticker.add(ticker);
    return () => gsap.ticker.remove(ticker);
  }, [planets, reducedMotion]);

  // Sol's position is always the stage centre.
  const solX = GALAXY_CENTER.x;
  const solY = GALAXY_CENTER.y;

  return (
    // pointer-events:none on container; planet buttons opt back in individually.
    // This mirrors the L4 figure-plane pattern so the underlying canvas remains
    // interactive for any future L2-level hit targets. NOT aria-hidden: the bodies
    // are interactive (S4 — keyboard-focusable, labelled), so they must stay in the
    // a11y tree; only the decorative glow/ring children are individually aria-hidden.
    <div className="pointer-events-none absolute inset-0">
      {/* Sol — the pulsing hero at the stage centre */}
      {sol && (
        <div className="pointer-events-auto">
          <SolElement
            x={solX}
            y={solY}
            ariaLabel={ariaLabelFor(sol.id)}
            name={nameFor(sol.id)}
            tRef={tRef}
            reducedMotion={reducedMotion}
            onHoverChange={handleHoverChange}
            onSelect={() => onSelect(sol)}
          />
        </div>
      )}

      {/* The 8 planets — gradient-lit spheres with per-planet cues. Rendered once at
          their static angle; the ticker moves them imperatively (no re-render). */}
      {planets.map((p) => (
        <div key={p.id} className="pointer-events-auto">
          <PlanetNode
            planet={p}
            initialX={initialPos[p.id].x}
            initialY={initialPos[p.id].y}
            ariaLabel={ariaLabelFor(p.id)}
            name={nameFor(p.id)}
            nodeRef={(el) => {
              planetEls.current[p.id] = el;
            }}
            onHoverChange={handleHoverChange}
            onSelect={() => onSelect(p)}
          />
        </div>
      ))}
    </div>
  );
};
