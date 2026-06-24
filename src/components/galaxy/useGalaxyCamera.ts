import { type RefObject, useRef } from "react";
import {
  type Camera,
  cameraTransform,
  parallaxOffsets,
} from "#/lib/galaxy/camera";
import {
  back,
  createFocus,
  DEFAULT_FRAMING,
  type FocusController,
  type FocusState,
  focusCamera,
  resolveFocusTarget,
} from "#/lib/galaxy/focus";
import { DISK_TILT } from "#/lib/galaxy/place";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";
import {
  directionOf,
  framingForTier,
  planTierTransition,
  type TierTransitionController,
  type TierTransitionEvent,
  type TierTransitionPlan,
} from "#/lib/galaxy/tier-transition";
import type { GalaxySky, Tier } from "#/lib/galaxy/types";
import { gsap, useGalaxyGsap } from "./gsap-setup";

/**
 * Drives the camera + 3-layer parallax (#4 AC5) and the focus-on-star move
 * (#111) imperatively via refs, so no camera move ever re-renders React.
 *
 * **GSAP owns the time domain (ADR-0009, step 2).** Every eased camera move —
 * the intro settle and the focus/back click-dive — is a `gsap.to` tween of a
 * plain `Camera { cx, cy, zoom }` object; `onUpdate` paints it through the pure
 * `cameraTransform` (whose `Math.round` keeps fractional tween values off the
 * DOM — the SSR sub-pixel hydration fix). The pure spatial seam is untouched:
 * `focusOn` / `resolveFocusTarget` compute *where* the camera goes, GSAP only
 * decides *when* it gets there. The retired hand-rolled stepping
 * (`stepFocus` / `lerpCamera` / `lerp`) is gone with its RAF wiring.
 *
 * Focus bookkeeping (target · prior framing · in-flight flag) stays the pure
 * `FocusState` machine from `lib/galaxy/focus`: the hook syncs the machine's
 * `current` from the live tweened camera at each request boundary, so the
 * prior-framing rules (first focus records it, an interrupting focus preserves
 * it, back consumes it) remain headless-tested. A new focus while a tween is in
 * flight retargets smoothly: `overwrite: "auto"` kills the conflicting tween at
 * start and the new one eases from wherever the camera actually is — no jump,
 * no stale tween. `Escape` returns to the prior framing (or the zoomed-out
 * default).
 *
 * The galaxy is **guided, not free** (interaction spec, 2026-06-05): there is NO
 * drag-to-pan (#109, retired) and NO free wheel/pinch zoom-to-cursor (#110,
 * retired). Within a tier the framing is fixed — only the gentle idle drift /
 * parallax and the eased focus moves animate it; scroll is discrete tier-zoom
 * (#153), whose eased transition timelines land with #125.
 *
 * `prefers-reduced-motion` is read live per move: a focus/back *snaps* (direct
 * set, any in-flight tween killed) instead of easing (design spec §A11y). The
 * parallax/idle drift loop and the intro settle still honor only the mount-time
 * value — the known #4 limitation, now narrowed to the decorative layer.
 */

/**
 * The focus / back click-dive tween (#111 → spec §1 gateway dive): duration (s)
 * + ease for one `gsap.to` toward the pure focus target. Tuned to read like the
 * 5%-per-frame exponential step it replaces — fast start, long soft landing
 * (`power3.out`). The *feel* gate stays the owner's preview spot-check.
 */
export const FOCUS_TWEEN = { duration: 1.6, ease: "power3.out" } as const;

/** The mount settle (zoom ×1.06 → the landing rest) — the visible "no snap" intro. */
export const INTRO_TWEEN = { duration: 1.2, ease: "power2.out" } as const;
export const INTRO_OVERZOOM = 1.06;

/**
 * The landing rest the intro settles onto — the HOME_TIER framing (the LG
 * overview; owner decision 2026-06-06, PR #167, overriding spec §1's MW-home).
 * Derived, never authored here, so the camera and the nav spine can't disagree
 * about where the page opens. The `??` arm is unreachable while HOME_TIER has a
 * built framing — it guards the #127 (Solar-System) extension, not a real path.
 */
const HOME_FRAMING: Camera = framingForTier(HOME_TIER) ?? DEFAULT_FRAMING;

/**
 * The two phases of a tier transition (#125, ADR-0009 step 4): an ease-in toward
 * the threshold framing (the scene swaps there), then a long soft landing onto
 * the destination tier's rest. Continuous in zoom-space — there is no camera
 * jump at the swap, so reversing the timeline retraces the same path. The *feel*
 * gate stays the owner's preview spot-check.
 */
export const TIER_TWEEN = {
  depart: { duration: 0.9, ease: "power2.in" },
  arrive: { duration: 1.4, ease: "power3.out" },
} as const;

type CameraRefs = {
  l1: RefObject<HTMLDivElement | null>;
  l2: RefObject<HTMLDivElement | null>;
  l3: RefObject<HTMLDivElement | null>;
  /** The foreground figure plane (#243) — the emotion figures + their member stars
   * ride it at `PARALLAX_MAX.l4` (the nearest, most-moving rate). */
  l4: RefObject<HTMLDivElement | null>;
  cam: RefObject<HTMLDivElement | null>;
  /** The scene root. */
  stage: RefObject<HTMLDivElement | null>;
  /** The contain-fit box (carries `--stage-scale`); later tier transitions map
   * client px → stage space off its client rect. */
  fit: RefObject<HTMLDivElement | null>;
  onPointerMove: (e: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
};

type Options = {
  /** The focus-by-id seam other features call (#5/#113). */
  focus?: FocusController;
  /** Reads the current sky so a focus request resolves its star's position live. */
  getSky?: () => GalaxySky;
  /** Reads the displayed galaxy's interior tilt so a focus target projects with the
   * SAME foreshortening the star is rendered at (neighbour galaxies, #234). */
  getDisplayTilt?: () => number;
  /** The tier-transition request channel the nav state drives (#125). */
  transitions?: TierTransitionController;
  /**
   * Transition lifecycle cues (#125): `threshold` is the scene-swap moment
   * (display the new tier NOW); `depart`/`arrive` are the ASTRO narration cues.
   */
  onTransitionEvent?: (e: TierTransitionEvent) => void;
};

export const useGalaxyCamera = (options: Options = {}): CameraRefs => {
  const l1 = useRef<HTMLDivElement>(null);
  const l2 = useRef<HTMLDivElement>(null);
  const l3 = useRef<HTMLDivElement>(null);
  const l4 = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });

  // Keep the latest controller/getSky without re-subscribing the GSAP effect.
  const optsRef = useRef(options);
  optsRef.current = options;

  // The focus machine lives in a ref: GSAP tweens toward its targets, never via
  // React state, so a focus move costs zero re-renders.
  const focusState = useRef<FocusState>(createFocus(HOME_FRAMING));

  // ADR-0009: registration at hook scope, client-only — never at module scope
  // (Workers SSR safety). Returns the context-scoped `useGSAP` effect hook.
  const useGSAP = useGalaxyGsap();

  useGSAP(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    // The GSAP tween target: a plain Camera object — no DOM needed. `onUpdate`
    // paints it through the pure `cameraTransform`; its `Math.round` is what
    // keeps the tween's fractional values from ever hitting the DOM raw.
    const camera: Camera = { ...HOME_FRAMING };
    const applyCamera = () => {
      if (cam.current) cam.current.style.transform = cameraTransform(camera);
    };

    // --- tier transitions (#125, ADR-0009 step 4) ---------------------------
    // One interruptible gsap.timeline() per tier change, easing the camera
    // between the pure per-tier framings (lib/galaxy/tier-transition). The
    // in-flight timeline is tracked so a focus move can kill it (never a silent
    // overwrite that would leave its labels/callbacks firing on a dead camera).
    let transition: {
      plan: TierTransitionPlan;
      tl: gsap.core.Timeline;
      /** The focused galaxy of this dive (BR22-frame #198) — the disk + lore the
       * scene-swap renders. `null` for a non-entry move (e.g. ascend to the LG). */
      galaxyId: string | null;
      /** A threshold event committed the displayed tier (scene swap, scale-net
       * relabel) — the kill path must then resolve the lifecycle terminally
       * (code-style: terminal events on kill/cancel, #167 review). */
      thresholdFired: boolean;
    } | null = null;
    const emit = (e: TierTransitionEvent) =>
      optsRef.current.onTransitionEvent?.(e);
    // The displayed galaxy at a side of the threshold (BR22-frame #198): the dive's
    // galaxy when that side is the `galaxy` tier, else `null` (the LG overview has none).
    const galaxyAt = (tier: Tier, galaxyId: string | null): string | null =>
      tier === "galaxy" ? galaxyId : null;
    const killTransition = () => {
      if (!transition) return;
      const { plan, tl, thresholdFired, galaxyId } = transition;
      // The tier the timeline was heading toward — exactly where the nav state
      // (the logical source of truth) already stepped: a request steps the nav
      // first, a mid-flight reverse steps it back.
      const heading = tl.reversed() ? plan.from : plan.to;
      transition = null;
      tl.kill();
      // Killed AFTER the threshold committed the displayed tier → emit the
      // terminal arrive so consumers settle on the nav tier. Killed BEFORE →
      // stay silent: nothing was committed, and an arrive here would force a
      // scene swap the camera never crossed (spec §1: the swap belongs to the
      // threshold).
      if (thresholdFired)
        emit({
          kind: "arrive",
          tier: heading,
          galaxyId: galaxyAt(heading, galaxyId),
        });
    };

    // One eased move toward `target`. `overwrite: "auto"` kills an in-flight
    // tween's conflicting axes the moment the new one starts, so a retarget
    // redirects from wherever the camera actually is — no jump, no stale tween.
    // Reduced motion is read live per move: snap, never tween.
    const tweenTo = (target: Camera) => {
      // A focus move takes the camera over: an in-flight tier timeline dies
      // here, not silently under `overwrite` (its callbacks must never fire on).
      killTransition();
      if (mq.matches) {
        gsap.killTweensOf(camera);
        Object.assign(camera, target);
        focusState.current = { ...focusState.current, focusing: false };
        applyCamera();
        return;
      }
      gsap.to(camera, {
        ...target,
        ...FOCUS_TWEEN,
        overwrite: "auto",
        onUpdate: applyCamera,
        onComplete: () => {
          focusState.current = { ...focusState.current, focusing: false };
        },
      });
    };

    // Intro settle on load — a visible "no snap" demonstration easing onto the
    // landing (HOME_TIER) rest from a slight overzoom; reduced motion mounts
    // parked on the rest instead. A focus request mid-settle simply overwrites
    // this tween's zoom axis.
    if (!mq.matches) {
      camera.zoom = HOME_FRAMING.zoom * INTRO_OVERZOOM;
      gsap.to(camera, {
        zoom: HOME_FRAMING.zoom,
        ...INTRO_TWEEN,
        overwrite: "auto",
        onUpdate: applyCamera,
      });
    }
    applyCamera();

    // --- focus-by-id seam (#5/#113) ----------------------------------------
    // The machine's `current` is synced from the live tweened camera at each
    // request boundary, so the pure prior-framing rules in `lib/galaxy/focus`
    // keep deciding *where* back() returns to.
    const requestFocus = (id: string, zoom?: number) => {
      const sky = optsRef.current.getSky?.();
      const tilt = optsRef.current.getDisplayTilt?.() ?? DISK_TILT;
      const target = sky ? resolveFocusTarget(sky, id, zoom, tilt) : null;
      if (!target) return; // unknown id degrades gracefully (no throw, no move)
      focusState.current = focusCamera(
        { ...focusState.current, current: { ...camera } },
        target,
      );
      tweenTo(focusState.current.target);
    };
    const requestBack = () => {
      // ESC with nothing to back out of is inert (no prior focus, no focus in
      // flight, no tier timeline): `back()`'s DEFAULT_FRAMING fallback would
      // silently dive the camera to the MW framing while the scene/nav stay
      // put — a first-touch desync now that the page lands on the LG tier.
      const { prior, focusing } = focusState.current;
      if (!prior && !focusing && !transition) return;
      focusState.current = back({
        ...focusState.current,
        current: { ...camera },
      });
      tweenTo(focusState.current.target);
    };
    const unsubscribe = optsRef.current.focus?.subscribe((req) => {
      if (req.kind === "focus") requestFocus(req.id, req.zoom);
      else requestBack();
    });

    // --- tier-transition requests (#125) ------------------------------------
    // The timeline eases depart → [threshold: scene swap] → arrive, tweening
    // the SAME camera object through the pure plan's framings. Mid-flight, an
    // opposite request *reverses* the live timeline (the breadcrumb case,
    // ADR-0009) — the threshold swap re-fires on the way back, so the scene
    // swaps back exactly where it swapped forward. Reduced motion is read
    // live: snap to rest, swap, announce arrival — no ease, no timeline.
    const requestTransition = (
      from: Tier,
      to: Tier,
      galaxyId: string | null,
    ) => {
      // `transition` is non-null exactly while a timeline is in flight (nulled
      // on complete / reverse-complete / kill) — deterministic, unlike
      // `isActive()`, which is still false on the tick the timeline is born.
      if (transition) {
        const { plan, tl } = transition;
        const heading = tl.reversed() ? plan.from : plan.to;
        if (to === heading) return; // already on its way there
        if (to === (tl.reversed() ? plan.to : plan.from)) {
          // The opposite end → reverse in place: no jump, no second timeline.
          tl.reversed(!tl.reversed());
          // The reverse re-keys the dive's galaxy (BR22-frame #198): ascending back
          // to the LG leaves every galaxy → null; re-entering carries the new id.
          transition.galaxyId = galaxyId;
          const direction = directionOf(heading, to);
          if (direction) emit({ kind: "depart", direction, from: heading, to });
          return;
        }
      }
      killTransition(); // a third-tier retarget (#127) never leaves a live timeline
      const plan = planTierTransition(from, to);
      if (!plan) return; // same tier / unbuilt tier (#127) degrades to a no-op
      gsap.killTweensOf(camera); // the intro/focus tween never fights the timeline
      if (mq.matches) {
        Object.assign(camera, plan.rest);
        applyCamera();
        const gid = galaxyAt(plan.to, galaxyId);
        emit({ kind: "threshold", tier: plan.to, galaxyId: gid });
        emit({ kind: "arrive", tier: plan.to, galaxyId: gid });
        return;
      }
      emit({
        kind: "depart",
        direction: plan.direction,
        from: plan.from,
        to: plan.to,
      });
      const tl = gsap.timeline();
      tl.to(camera, {
        ...plan.threshold,
        ...TIER_TWEEN.depart,
        onUpdate: applyCamera,
      })
        .addLabel("threshold")
        .to(camera, {
          ...plan.rest,
          ...TIER_TWEEN.arrive,
          onUpdate: applyCamera,
        });
      // The scene swaps when the playhead crosses the threshold label — in
      // EITHER direction (a reverse must swap back exactly where it swapped
      // forward). Detected by which SIDE of the label the rendered time is on,
      // not a zero-duration `.call`: GSAP skips a callback the playhead is
      // parked on when flipped to reverse, which would strand the swap. `sync`
      // also runs in the terminal callbacks: one large tick (event-loop stall)
      // can jump the playhead clear across the label to an end with no
      // intermediate onUpdate, which a per-update window check alone misses.
      const swapAt = tl.labels.threshold;
      const live = { plan, tl, galaxyId, thresholdFired: false };
      let committed: Tier = plan.from; // the threshold side the scene shows
      const sync = () => {
        const side = tl.time() >= swapAt ? plan.to : plan.from;
        if (side === committed) return;
        committed = side;
        live.thresholdFired = true;
        // The dive's galaxy may have been re-keyed by a mid-flight reverse — read it
        // off the live transition so the swap-back announces the right side's galaxy.
        emit({
          kind: "threshold",
          tier: side,
          galaxyId: galaxyAt(side, live.galaxyId),
        });
      };
      tl.eventCallback("onUpdate", sync);
      tl.eventCallback("onComplete", () => {
        sync();
        transition = null;
        emit({
          kind: "arrive",
          tier: plan.to,
          galaxyId: galaxyAt(plan.to, live.galaxyId),
        });
      });
      tl.eventCallback("onReverseComplete", () => {
        sync();
        transition = null;
        emit({
          kind: "arrive",
          tier: plan.from,
          galaxyId: galaxyAt(plan.from, live.galaxyId),
        });
      });
      transition = live;
    };
    const unsubscribeTransitions = optsRef.current.transitions?.subscribe(
      (req) => requestTransition(req.from, req.to, req.galaxyId),
    );

    // ESC / "back" — return to the prior framing (or zoomed-out default).
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestBack();
    };
    window.addEventListener("keydown", onKeyDown);

    // --- 3-layer parallax (decorative) --------------------------------------
    // The one remaining RAF concern: a continuous follow toward a moving
    // pointer/idle-sine target — not a tween toward a fixed end, so it stays a
    // hand-stepped loop. The camera no longer steps here; GSAP's own ticker
    // drives its tweens. Mount-time reduced motion pins parallax static (no RAF).
    let raf = 0;
    if (!mq.matches) {
      const cur = {
        l1: { x: 0, y: 0 },
        l2: { x: 0, y: 0 },
        l3: { x: 0, y: 0 },
        l4: { x: 0, y: 0 },
      };
      const els = { l1, l2, l3, l4 } as const;

      const frame = (ms: number) => {
        const t = ms * 0.001;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Idle sine drift only when the pointer is away; the pointer drives the
        // parallax while it is over the stage.
        const idle = !pointer.current.active;
        const px = idle
          ? vw * (0.5 + Math.sin(t * 0.16) * 0.12)
          : pointer.current.x;
        const py = idle
          ? vh * (0.5 + Math.cos(t * 0.12) * 0.1)
          : pointer.current.y;
        const tgt = parallaxOffsets({ x: px, y: py }, { w: vw, h: vh });

        for (const key of ["l1", "l2", "l3", "l4"] as const) {
          cur[key].x += (tgt[key].x - cur[key].x) * 0.06;
          cur[key].y += (tgt[key].y - cur[key].y) * 0.06;
          const el = els[key].current;
          if (el)
            el.style.transform = `translate3d(${cur[key].x}px, ${cur[key].y}px, 0)`;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      killTransition();
      gsap.killTweensOf(camera);
      unsubscribe?.();
      unsubscribeTransitions?.();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return {
    l1,
    l2,
    l3,
    l4,
    cam,
    stage,
    fit,
    onPointerMove: (e) => {
      pointer.current = { x: e.clientX, y: e.clientY, active: true };
    },
    onPointerLeave: () => {
      pointer.current.active = false;
    },
  };
};
