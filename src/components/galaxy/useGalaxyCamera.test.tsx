// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { gsap } from "#/components/galaxy/gsap-setup";
import { useGalaxyCamera } from "#/components/galaxy/useGalaxyCamera";
import { cameraTransform } from "#/lib/galaxy/camera";
import {
  createFocusController,
  DEFAULT_FRAMING,
  type FocusController,
  resolveFocusTarget,
} from "#/lib/galaxy/focus";
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

const HOME_TRANSFORM = cameraTransform(DEFAULT_FRAMING);

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

const Probe = ({ focus }: { focus: FocusController }) => {
  const cam = useGalaxyCamera({ focus, getSky: () => sky });
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

/** Wait out the intro settle so a test starts from the resting home framing. */
const settled = (el: HTMLElement) =>
  waitFor(() => expect(el.style.transform).toBe(HOME_TRANSFORM), {
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

  it("mounts on the intro settle: paints the 1.06 overzoom, then eases home", async () => {
    const { el } = mount();
    expect(el.style.transform).toBe(
      cameraTransform({ ...DEFAULT_FRAMING, zoom: 1.06 }),
    );
    await settled(el);
  });

  it("a focus request eases the camera onto the star's framing (no snap)", async () => {
    const { focus, el } = mount();
    await settled(el);
    act(() => focus.focusStar("a"));
    // It eases — the camera must NOT be on the target synchronously…
    expect(el.style.transform).toBe(HOME_TRANSFORM);
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
    await waitFor(() => expect(el.style.transform).not.toBe(HOME_TRANSFORM), {
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
    await new Promise((r) => setTimeout(r, 120));
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
    await waitFor(() => expect(el.style.transform).toBe(HOME_TRANSFORM), {
      timeout: TIMEOUT,
    });
  });

  it("prefers-reduced-motion: focus snaps immediately — no tween, no intro", () => {
    stubReducedMotion(true);
    const { focus, el } = mount();
    expect(el.style.transform).toBe(HOME_TRANSFORM); // no 1.06 intro overzoom
    act(() => focus.focusStar("a"));
    expect(el.style.transform).toBe(framingOf("a")); // synchronous snap
  });

  it("prefers-reduced-motion: Escape snaps straight back home", () => {
    stubReducedMotion(true);
    const { focus, el } = mount();
    act(() => focus.focusStar("a"));
    pressEscape();
    expect(el.style.transform).toBe(HOME_TRANSFORM);
  });
});
