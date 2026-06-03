import { describe, expect, it } from "vitest";
import {
  type Camera,
  focusOn,
  lerp,
  lerpCamera,
  PARALLAX_MAX,
  parallaxOffsets,
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
});
