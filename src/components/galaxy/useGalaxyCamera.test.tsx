// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { gsap } from "#/components/galaxy/gsap-setup";
import {
  INTRO_OVERZOOM,
  useGalaxyCamera,
} from "#/components/galaxy/useGalaxyCamera";
import { cameraTransform } from "#/lib/galaxy/camera";
import {
  createFocusController,
  DEFAULT_FRAMING,
  type FocusController,
  resolveFocusTarget,
} from "#/lib/galaxy/focus";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";
import {
  createTierTransitionController,
  framingForTier,
  type TierTransitionController,
  type TierTransitionEvent,
} from "#/lib/galaxy/tier-transition";
import type { GalaxySky, MemoryStar } from "#/lib/galaxy/types";

/**
 * Component-level coverage for the GSAP-driven camera (#143, ADR-0009 step 2).
 *
 * The deleted temporal stepping (`stepFocus`/`lerpCamera`/`lerp`) was headless-
 * tested in `lib/`; GSAP's tween timing is the library's job, not ours — so what
 * is pinned here is OUR wiring: a focus request reaches the star's exact framing
 * through the pure `cameraTransform`, a retarget redirects without a jump or a
 * stale tween, ESC restores the prior framing, and `prefers-reduced-motion`
 * snaps with no tween at all.
 *
 * Determinism: tweens run on GSAP's own ticker (jsdom rAF), compressed via
 * `globalTimeline.timeScale` so arrival lands well inside the waitFor timeout.
 * The *feel* of the eases is not assertable here — that part of AC9 stays an
 * owner spot-check on the preview URL.
 */

/** Real tween seconds ÷ 10 — fast, but still several observable frames. */
const TIME_COMPRESSION = 10;
const TIMEOUT = 1000;

/**
 * The landing rest — the HOME_TIER framing (the LG overview; owner decision
 * 2026-06-06 overriding spec §1's MW-home), derived so a HOME_TIER change never
 * silently stales this suite.
 */
const HOME_FRAMING = framingForTier(HOME_TIER) ?? DEFAULT_FRAMING;
const REST_TRANSFORM = cameraTransform(HOME_FRAMING);

const star = (over: Partial<MemoryStar>): MemoryStar => ({
  id: "s1",
  text: "a memory",
  mood: "wonder",
  color: "#abcdef",
  r: 0.5,
  angle: 1,
  brightness: 0.7,
  createdAt: 1,
  ...over,
});

const sky: GalaxySky = {
  backdrop: {
    seed: 1,
    branches: 4,
    spin: 0,
    randomnessPower: 2.2,
    palette: "auroral",
  },
  stars: [
    star({ id: "a", r: 0.5, angle: 1 }),
    star({ id: "b", r: 0.25, angle: 3.5 }),
  ],
};

/** The exact transform the camera must land on for a star id (pure math). */
const framingOf = (id: string): string => {
  const target = resolveFocusTarget(sky, id);
  if (!target) throw new Error(`fixture star missing: ${id}`);
  return cameraTransform(target);
};

const Probe = ({
  focus,
  transitions,
  onTransitionEvent,
}: {
  focus: FocusController;
  transitions?: TierTransitionController;
  onTransitionEvent?: (e: TierTransitionEvent) => void;
}) => {
  const cam = useGalaxyCamera({
    focus,
    getSky: () => sky,
    transitions,
    onTransitionEvent,
  });
  return (
    <div ref={cam.stage}>
      <div ref={cam.l1} />
      <div ref={cam.fit}>
        <div data-testid="camera" ref={cam.cam}>
          <div ref={cam.l2} />
          <div ref={cam.l3} />
        </div>
      </div>
    </div>
  );
};

const stubReducedMotion = (matches: boolean) => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
};

const mount = () => {
  const focus = createFocusController();
  const view = render(<Probe focus={focus} />);
  return { focus, el: view.getByTestId("camera") };
};

/** Mount with the tier-transition channel wired and its events recorded (#125). */
const mountWithTransitions = () => {
  const focus = createFocusController();
  const transitions = createTierTransitionController();
  const events: TierTransitionEvent[] = [];
  const transforms: string[] = []; // the camera transform at each event
  let el: HTMLElement | null = null;
  const view = render(
    <Probe
      focus={focus}
      transitions={transitions}
      onTransitionEvent={(e) => {
        events.push(e);
        if (el) transforms.push(el.style.transform);
      }}
    />,
  );
  el = view.getByTestId("camera");
  return { focus, transitions, events, transforms, el };
};

/** Wait out the intro settle so a test starts from the landing rest. */
const settled = (el: HTMLElement) =>
  waitFor(() => expect(el.style.transform).toBe(REST_TRANSFORM), {
    timeout: TIMEOUT,
  });

const pressEscape = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
};

describe("useGalaxyCamera — GSAP drives the focus/zoom eases (#143)", () => {
  beforeAll(() => {
    gsap.globalTimeline.timeScale(TIME_COMPRESSION);
  });
  afterAll(() => {
    gsap.globalTimeline.timeScale(1);
  });
  beforeEach(() => {
    stubReducedMotion(false);
  });

  it("mounts on the intro settle: paints the overzoom, then eases onto the landing (LG) rest", async () => {
    const { el } = mount();
    expect(el.style.transform).toBe(
      cameraTransform({
        ...HOME_FRAMING,
        zoom: HOME_FRAMING.zoom * INTRO_OVERZOOM,
      }),
    );
    await settled(el);
  });

  it("a focus request eases the camera onto the star's framing (no snap)", async () => {
    const { focus, el } = mount();
    await settled(el);
    act(() => focus.focusStar("a"));
    // It eases — the camera must NOT be on the target synchronously…
    expect(el.style.transform).toBe(REST_TRANSFORM);
    // …and lands on the exact pure-math framing once the tween completes.
    await waitFor(() => expect(el.style.transform).toBe(framingOf("a")), {
      timeout: TIMEOUT,
    });
  });

  it("retargets in flight: a second focus redirects — no jump, no stale tween", async () => {
    const { focus, el } = mount();
    await settled(el);
    act(() => focus.focusStar("a"));
    // Catch the move genuinely in flight (left home, not yet on a)…
    await waitFor(() => expect(el.style.transform).not.toBe(REST_TRANSFORM), {
      timeout: TIMEOUT,
    });
    act(() => focus.focusStar("b"));
    // …the retarget does not snap…
    expect(el.style.transform).not.toBe(framingOf("b"));
    // …it lands on b…
    await waitFor(() => expect(el.style.transform).toBe(framingOf("b")), {
      timeout: TIMEOUT,
    });
    // …and STICKS there: the killed a-tween never fights the camera back.
    // Deterministic (review #166 nit): pump the gsap ticker instead of a
    // wall-clock sleep — a surviving a-tween would move the camera on tick.
    act(() => {
      for (let i = 0; i < 10; i++) gsap.ticker.tick();
    });
    expect(el.style.transform).toBe(framingOf("b"));
  });

  it("Escape eases back to the prior framing", async () => {
    const { focus, el } = mount();
    await settled(el);
    act(() => focus.focusStar("a"));
    await waitFor(() => expect(el.style.transform).toBe(framingOf("a")), {
      timeout: TIMEOUT,
    });
    pressEscape();
    await waitFor(() => expect(el.style.transform).toBe(REST_TRANSFORM), {
      timeout: TIMEOUT,
    });
  });

  it("Escape at rest is inert — nothing to back out of, the camera stays on the landing rest", async () => {
    // Without the guard, back()'s DEFAULT_FRAMING fallback would silently dive
    // the camera to the MW framing while the scene/nav still show the Local
    // Group — a first-touch desync now that the page lands on the LG tier.
    const { el } = mount();
    await settled(el);
    pressEscape();
    act(() => {
      for (let i = 0; i < 10; i++) gsap.ticker.tick();
    });
    expect(el.style.transform).toBe(REST_TRANSFORM);
  });

  it("prefers-reduced-motion: focus snaps immediately — no tween, no intro", () => {
    stubReducedMotion(true);
    const { focus, el } = mount();
    expect(el.style.transform).toBe(REST_TRANSFORM); // no intro overzoom
    act(() => focus.focusStar("a"));
    expect(el.style.transform).toBe(framingOf("a")); // synchronous snap
  });

  it("prefers-reduced-motion: Escape snaps straight back to the landing rest", () => {
    stubReducedMotion(true);
    const { focus, el } = mount();
    act(() => focus.focusStar("a"));
    pressEscape();
    expect(el.style.transform).toBe(REST_TRANSFORM);
  });
});

/** The exact transform of a tier's resting framing (pure math). */
const tierTransformOf = (tier: "localGroup" | "galaxy"): string => {
  const framing = framingForTier(tier);
  if (!framing) throw new Error(`tier framing missing: ${tier}`);
  return cameraTransform(framing);
};

describe("useGalaxyCamera — tier transitions on gsap.timeline() (#125)", () => {
  beforeAll(() => {
    gsap.globalTimeline.timeScale(TIME_COMPRESSION);
  });
  afterAll(() => {
    gsap.globalTimeline.timeScale(1);
  });
  beforeEach(() => {
    stubReducedMotion(false);
  });

  it("a tier request eases to the destination framing — depart → threshold → arrive", async () => {
    const { transitions, events, transforms, el } = mountWithTransitions();
    await settled(el);
    // The primary first gesture: dive from the LG landing INTO the Milky Way.
    act(() => transitions.request("localGroup", "galaxy"));
    // It eases — the camera must NOT be on the MW framing synchronously…
    expect(el.style.transform).toBe(REST_TRANSFORM);
    // …the depart cue fires up front…
    expect(events).toEqual([
      {
        kind: "depart",
        direction: "descend",
        from: "localGroup",
        to: "galaxy",
      },
    ]);
    // …and the timeline settles on the exact pure MW framing.
    await waitFor(
      () => expect(el.style.transform).toBe(tierTransformOf("galaxy")),
      { timeout: TIMEOUT },
    );
    await waitFor(() =>
      expect(events.map((e) => e.kind)).toEqual([
        "depart",
        "threshold",
        "arrive",
      ]),
    );
    // The scene swap happened MID-flight: at the threshold event the camera was
    // between the two rests, not parked on either.
    expect(transforms[1]).not.toBe(REST_TRANSFORM);
    expect(transforms[1]).not.toBe(tierTransformOf("galaxy"));
    expect(events[1]).toEqual({ kind: "threshold", tier: "galaxy" });
    expect(events[2]).toEqual({ kind: "arrive", tier: "galaxy" });
  });

  it("reverses mid-flight (the breadcrumb case): swaps back, lands on the LG rest, no stale timeline", async () => {
    const { transitions, events, el } = mountWithTransitions();
    await settled(el);
    act(() => transitions.request("localGroup", "galaxy"));
    // Let it cross the threshold (the scene swapped to the Milky Way)…
    await waitFor(
      () => expect(events.some((e) => e.kind === "threshold")).toBe(true),
      { timeout: TIMEOUT },
    );
    // …then reverse (opposite scroll / breadcrumb): no snap at the flip…
    act(() => transitions.request("galaxy", "localGroup"));
    expect(el.style.transform).not.toBe(REST_TRANSFORM);
    // …the reverse re-narrates as an ascend and swaps the scene back…
    await waitFor(() => expect(el.style.transform).toBe(REST_TRANSFORM), {
      timeout: TIMEOUT,
    });
    expect(events).toContainEqual({
      kind: "depart",
      direction: "ascend",
      from: "galaxy",
      to: "localGroup",
    });
    expect(events.filter((e) => e.kind === "threshold")).toEqual([
      { kind: "threshold", tier: "galaxy" },
      { kind: "threshold", tier: "localGroup" },
    ]);
    await waitFor(
      () =>
        expect(events.at(-1)).toEqual({ kind: "arrive", tier: "localGroup" }),
      { timeout: TIMEOUT },
    );
    // …and STICKS: the reversed timeline never re-asserts itself.
    // Deterministic (review #167 nit): pump the gsap ticker instead of a
    // wall-clock sleep — a surviving timeline would move the camera on tick.
    act(() => {
      for (let i = 0; i < 10; i++) gsap.ticker.tick();
    });
    expect(el.style.transform).toBe(REST_TRANSFORM);
  });

  it("ignores a request for the tier it is already heading to", async () => {
    const { transitions, events, el } = mountWithTransitions();
    await settled(el);
    act(() => transitions.request("localGroup", "galaxy"));
    act(() => transitions.request("localGroup", "galaxy"));
    await waitFor(
      () => expect(el.style.transform).toBe(tierTransformOf("galaxy")),
      { timeout: TIMEOUT },
    );
    // One transition's worth of cues — no doubled depart/arrive.
    await waitFor(
      () => expect(events.filter((e) => e.kind === "arrive")).toHaveLength(1),
      { timeout: TIMEOUT },
    );
    expect(events.filter((e) => e.kind === "depart")).toHaveLength(1);
  });

  it("a focus request mid-transition kills the timeline — the star framing sticks", async () => {
    const { focus, transitions, el } = mountWithTransitions();
    await settled(el);
    act(() => transitions.request("localGroup", "galaxy"));
    await waitFor(() => expect(el.style.transform).not.toBe(REST_TRANSFORM), {
      timeout: TIMEOUT,
    });
    act(() => focus.focusStar("a"));
    await waitFor(() => expect(el.style.transform).toBe(framingOf("a")), {
      timeout: TIMEOUT,
    });
    // The killed timeline never fights the camera back toward the MW framing.
    // Deterministic (review #167 nit): pump the gsap ticker instead of a
    // wall-clock sleep — a surviving timeline would move the camera on tick.
    act(() => {
      for (let i = 0; i < 10; i++) gsap.ticker.tick();
    });
    expect(el.style.transform).toBe(framingOf("a"));
  });

  it("a focus kill after the threshold emits the terminal arrive for the nav tier (#167 review)", async () => {
    const { focus, transitions, events, el } = mountWithTransitions();
    await settled(el);
    act(() => transitions.request("localGroup", "galaxy"));
    // The threshold committed the displayed tier (scene swap, scale-net relabel)…
    await waitFor(
      () => expect(events.some((e) => e.kind === "threshold")).toBe(true),
      { timeout: TIMEOUT },
    );
    // …so the focus-kill must terminally resolve it — to the tier the timeline
    // was heading toward, which is exactly where the nav already stepped
    // (code-style: terminal events on kill/cancel).
    act(() => focus.focusStar("a"));
    expect(events.at(-1)).toEqual({ kind: "arrive", tier: "galaxy" });
    await waitFor(() => expect(el.style.transform).toBe(framingOf("a")), {
      timeout: TIMEOUT,
    });
    // Exactly one terminal event — the killed timeline never re-arrives.
    act(() => {
      for (let i = 0; i < 10; i++) gsap.ticker.tick();
    });
    expect(events.filter((e) => e.kind === "arrive")).toHaveLength(1);
  });

  it("a focus kill after a mid-flight reverse resolves to the reversed heading (#167 review)", () => {
    // Deterministic choreography: the auto ticker can complete the timeline
    // before the reverse lands under load, so GSAP's root clock is driven by
    // hand (the documented manual mode) — the playhead parks exactly where
    // the scenario needs it, no wall-clock races.
    gsap.ticker.remove(gsap.updateRoot);
    try {
      const { focus, transitions, events, el } = mountWithTransitions();
      let t = gsap.ticker.time;
      const advance = (s: number) => {
        t += s;
        act(() => {
          gsap.updateRoot(t);
        });
      };
      advance(0); // sync the frozen root clock to "now"
      act(() => transitions.request("localGroup", "galaxy"));
      advance(0.1); // ×10 timeScale → 1 s of timeline: past the 0.9 s threshold
      expect(events.some((e) => e.kind === "threshold")).toBe(true);
      // Reverse (the nav stepped back to the Local Group) and kill in ONE act:
      // no tick can re-cross the threshold in between, so the swap-back never
      // fired — the kill alone must resolve the displayed tier to the heading.
      act(() => {
        transitions.request("galaxy", "localGroup");
        focus.focusStar("a");
      });
      expect(events.at(-1)).toEqual({ kind: "arrive", tier: "localGroup" });
      expect(events.filter((e) => e.kind === "threshold")).toEqual([
        { kind: "threshold", tier: "galaxy" },
      ]);
      advance(0.2); // the focus tween (1.6 s ÷ 10) lands on the star
      expect(el.style.transform).toBe(framingOf("a"));
    } finally {
      gsap.ticker.add(gsap.updateRoot);
    }
  });

  it("a focus kill before the threshold stays silent — nothing was committed", async () => {
    const { focus, transitions, events, el } = mountWithTransitions();
    await settled(el);
    // Request + kill back-to-back: no tick crossed the threshold, the scene
    // never swapped — a terminal arrive here would force a swap the camera
    // never reached (spec §1: the swap belongs to the threshold).
    act(() => {
      transitions.request("localGroup", "galaxy");
      focus.focusStar("a");
    });
    expect(events).toEqual([
      {
        kind: "depart",
        direction: "descend",
        from: "localGroup",
        to: "galaxy",
      },
    ]);
    await waitFor(() => expect(el.style.transform).toBe(framingOf("a")), {
      timeout: TIMEOUT,
    });
  });

  it("prefers-reduced-motion: a tier change snaps — threshold + arrive, no ease, no depart", () => {
    stubReducedMotion(true);
    const { transitions, events, el } = mountWithTransitions();
    act(() => transitions.request("localGroup", "galaxy"));
    expect(el.style.transform).toBe(tierTransformOf("galaxy")); // synchronous snap
    expect(events).toEqual([
      { kind: "threshold", tier: "galaxy" },
      { kind: "arrive", tier: "galaxy" },
    ]);
  });
});
