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
