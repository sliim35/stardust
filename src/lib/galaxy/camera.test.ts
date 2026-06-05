import { describe, expect, it } from "vitest";
import {
  type Camera,
  cameraTransform,
  focusOn,
  lerp,
  lerpCamera,
  PARALLAX_MAX,
  parallaxOffsets,
  type StageRect,
  screenToStage,
  wheelZoomFactor,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomToCursor,
} from "#/lib/galaxy/camera";

describe("lerp (eased interpolation — never snaps)", () => {
  it("returns the endpoints at t=0 and t=1", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it("returns an intermediate value strictly between for 0 < t < 1", () => {
    const v = lerp(0, 10, 0.5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(10);
    expect(v).toBeCloseTo(5, 6);
  });
});

describe("lerpCamera", () => {
  it("eases every axis toward the target", () => {
    const cur: Camera = { cx: 0, cy: 0, zoom: 1 };
    const target: Camera = { cx: 100, cy: 200, zoom: 2 };
    expect(lerpCamera(cur, target, 0.5)).toEqual({
      cx: 50,
      cy: 100,
      zoom: 1.5,
    });
  });
});

describe("focusOn", () => {
  it("centers the camera on a stage position", () => {
    expect(focusOn({ x: 760, y: 440 }, 1.8)).toEqual({
      cx: 760,
      cy: 440,
      zoom: 1.8,
    });
  });
});

describe("parallaxOffsets", () => {
  const vp = { w: 1280, h: 800 };

  it("is zero when the pointer is centered", () => {
    expect(parallaxOffsets({ x: 640, y: 400 }, vp)).toEqual({
      l1: { x: 0, y: 0 },
      l2: { x: 0, y: 0 },
      l3: { x: 0, y: 0 },
    });
  });

  it("shifts layers opposite the pointer, nearest layer moving most", () => {
    const o = parallaxOffsets({ x: 1280, y: 400 }, vp); // far right edge
    expect(o.l3.x).toBe(-PARALLAX_MAX.l3); // opposite + max at the edge
    expect(o.l2.x).toBe(-PARALLAX_MAX.l2);
    expect(o.l1.x).toBe(-PARALLAX_MAX.l1);
    expect(Math.abs(o.l3.x)).toBeGreaterThan(Math.abs(o.l2.x));
    expect(Math.abs(o.l2.x)).toBeGreaterThan(Math.abs(o.l1.x));
  });

  it("is disabled (all zero) under reduced motion", () => {
    expect(parallaxOffsets({ x: 1280, y: 800 }, vp, true)).toEqual({
      l1: { x: 0, y: 0 },
      l2: { x: 0, y: 0 },
      l3: { x: 0, y: 0 },
    });
  });
});

describe("cameraTransform (Camera → stage CSS transform)", () => {
  it("is the identity transform at the resting home framing", () => {
    // origin is stage center (640,400): centering the center at zoom 1 is a no-op
    expect(cameraTransform({ cx: 640, cy: 400, zoom: 1 })).toBe(
      "scale(1) translate(0px, 0px)",
    );
  });

  it("translates so the focused point lands at stage center, then scales", () => {
    // origin center (640,400): translate by (640-cx, 400-cy) under scale(zoom)
    expect(cameraTransform({ cx: 760, cy: 440, zoom: 1.8 })).toBe(
      "scale(1.8) translate(-120px, -40px)",
    );
  });

  it("rounds the translate to whole pixels (SSR/CSSOM sub-pixel safety)", () => {
    expect(cameraTransform({ cx: 700.4, cy: 399.6, zoom: 1.5 })).toBe(
      "scale(1.5) translate(-60px, 0px)",
    );
  });
});

describe("zoomToCursor", () => {
  const cam: Camera = { cx: 640, cy: 400, zoom: 1 };

  it("clamps zoom to [ZOOM_MIN, ZOOM_MAX]", () => {
    expect(zoomToCursor(cam, { x: 640, y: 400 }, 100).zoom).toBe(ZOOM_MAX);
    expect(zoomToCursor(cam, { x: 640, y: 400 }, 0.001).zoom).toBe(ZOOM_MIN);
  });

  it("eases the center toward the cursor when zooming in", () => {
    const next = zoomToCursor(cam, { x: 800, y: 400 }, 2);
    expect(next.zoom).toBe(2);
    expect(next.cx).toBeGreaterThan(cam.cx); // moved toward the cursor
    expect(next.cx).toBeLessThan(800);
  });

  // --- #110 zoom-to-cursor: the anchored-point-stays-put invariant ----------
  // The whole gesture is correct iff the stage point under the cursor maps to
  // the SAME screen pixel before and after the zoom. `screenToStage` is the
  // inverse used to find that anchor, so we assert the round trip here.
  it("keeps the point under the cursor fixed on screen across a zoom (round trip)", () => {
    const rect: StageRect = { left: 0, top: 0, scale: 1 };
    const client = { x: 900, y: 520 }; // an off-center cursor
    const before = screenToStage(client, rect, cam);
    const next = zoomToCursor(cam, before, 2.5);
    const after = screenToStage(client, rect, next);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("no jitter at the clamp edge: a further zoom-in at ZOOM_MAX is a no-op", () => {
    const maxed: Camera = { cx: 700, cy: 420, zoom: ZOOM_MAX };
    const next = zoomToCursor(maxed, { x: 900, y: 500 }, 1.4);
    expect(next).toEqual(maxed); // zoom clamped → k=0 → center unchanged
  });

  it("no jitter at the clamp edge: a further zoom-out at ZOOM_MIN is a no-op", () => {
    const minned: Camera = { cx: 700, cy: 420, zoom: ZOOM_MIN };
    const next = zoomToCursor(minned, { x: 200, y: 100 }, 0.6);
    expect(next).toEqual(minned);
  });
});

describe("screenToStage (client px → camera world point under the cursor)", () => {
  const cam: Camera = { cx: 640, cy: 400, zoom: 1 };

  it("maps the stage center at the home framing to GALAXY_CENTER", () => {
    // fit at scale 1, origin (0,0): client (640,400) is the logical center.
    const rect: StageRect = { left: 0, top: 0, scale: 1 };
    expect(screenToStage({ x: 640, y: 400 }, rect, cam)).toEqual({
      x: 640,
      y: 400,
    });
  });

  it("inverts the fit scale (a contained, letterboxed stage)", () => {
    // scale 0.5, fit's top-left at client (100,50): a client point 200px right
    // and 100px down of the top-left is 400/200 logical px into the stage.
    const rect: StageRect = { left: 100, top: 50, scale: 0.5 };
    const p = screenToStage({ x: 100 + 200, y: 50 + 100 }, rect, cam);
    expect(p.x).toBeCloseTo(640 - 640 + 400, 6); // fitLocal 400 → world 400 (cam home)
    expect(p.y).toBeCloseTo(200, 6);
  });

  it("inverts the camera zoom + center (anchor is in camera world space)", () => {
    const zoomed: Camera = { cx: 700, cy: 450, zoom: 2 };
    const rect: StageRect = { left: 0, top: 0, scale: 1 };
    // The logical stage center (640,400) always shows the camera center.
    expect(screenToStage({ x: 640, y: 400 }, rect, zoomed)).toEqual({
      x: 700,
      y: 450,
    });
    // 100 logical px right of center → 100/zoom world px right of cx.
    const off = screenToStage({ x: 740, y: 400 }, rect, zoomed);
    expect(off.x).toBeCloseTo(700 + 100 / 2, 6);
    expect(off.y).toBeCloseTo(450, 6);
  });
});

describe("wheelZoomFactor (wheel delta → multiplicative zoom factor)", () => {
  it("returns a factor > 1 when scrolling up (deltaY < 0, zoom in)", () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
  });

  it("returns a factor < 1 when scrolling down (deltaY > 0, zoom out)", () => {
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  it("is multiplicatively symmetric (up then down by the same delta is identity)", () => {
    expect(wheelZoomFactor(-120) * wheelZoomFactor(120)).toBeCloseTo(1, 6);
  });

  it("returns 1 for a zero delta", () => {
    expect(wheelZoomFactor(0)).toBe(1);
  });
});
