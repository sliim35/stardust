import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { CHANNELS } from "#/brand/composer/channels";
import { composeScene } from "#/brand/composer/composeScene";

// Decode a PNG buffer back to {width,height} via the canvas lib.
const pngSize = async (png: Buffer): Promise<{ w: number; h: number }> => {
  const { loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(png);
  return { w: img.width, h: img.height };
};

describe("composeScene", () => {
  it("returns a PNG buffer and a reproducible sidecar (AC1/AC9)", async () => {
    const { png, sidecar } = await composeScene({
      channel: "og",
      seed: 424242,
    });
    expect(Buffer.isBuffer(png)).toBe(true);
    // PNG magic number
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(sidecar).toMatchObject({
      channel: "og",
      seed: 424242,
      NW: 200,
      NH: 105,
      SCALE: 6,
      pose: "point", // owner-approved default
      heroStar: true, // owner-approved default
    });
  });

  it("is pixel-identical for the same {channel, seed, copy} (AC3)", async () => {
    const a = await composeScene({ channel: "og", seed: 7, headline: "hi" });
    const b = await composeScene({ channel: "og", seed: 7, headline: "hi" });
    expect(a.png.equals(b.png)).toBe(true);
  });

  it("diverges for a different seed (AC3 negative)", async () => {
    const a = await composeScene({ channel: "og", seed: 1 });
    const b = await composeScene({ channel: "og", seed: 2 });
    expect(a.png.equals(b.png)).toBe(false);
  });

  it("exports the exact per-channel size (AC7)", async () => {
    const og = await composeScene({ channel: "og", seed: 5 });
    const li = await composeScene({ channel: "linkedin", seed: 5 });
    const av = await composeScene({ channel: "avatar", seed: 5 });
    expect(await pngSize(og.png)).toEqual({ w: 1200, h: 630 });
    expect(await pngSize(li.png)).toEqual({ w: 1200, h: 627 });
    expect(await pngSize(av.png)).toEqual({ w: 512, h: 512 });
  });

  it("uses an integer scale only — ASTRO height equals 16×SCALE (AC4)", async () => {
    const { sidecar } = await composeScene({ channel: "og", seed: 9 });
    expect(Number.isInteger(sidecar.SCALE)).toBe(true);
    expect(sidecar.astroHeightPx).toBe(16 * CHANNELS.og.SCALE);
  });

  it("supports pose, faceLeft, heroStar and expression params (AC5)", async () => {
    const { sidecar } = await composeScene({
      channel: "og",
      seed: 11,
      pose: "wave",
      faceLeft: false,
      heroStar: false,
      expression: "A_curious",
    });
    expect(sidecar).toMatchObject({
      pose: "wave",
      faceLeft: false,
      heroStar: false,
      expression: "A_curious",
    });
  });

  it("changing the pose changes the pixels (ASTRO is actually composited)", async () => {
    const a = await composeScene({ channel: "og", seed: 3, pose: "idle" });
    const b = await composeScene({ channel: "og", seed: 3, pose: "wave" });
    expect(a.png.equals(b.png)).toBe(false);
  });

  it("renders the avatar from the favicon tile, not a scene crop (R3)", async () => {
    // Avatar is independent of scene seed (it's the fixed ASTRO tile).
    const a = await composeScene({ channel: "avatar", seed: 1 });
    const b = await composeScene({ channel: "avatar", seed: 99999 });
    expect(a.png.equals(b.png)).toBe(true);
  });
});

// Guard the canvas lib actually disables smoothing (defensive — AC4 grep-gate
// covers source, this covers behaviour).
describe("canvas smoothing default", () => {
  it("can disable image smoothing on a 2d context", () => {
    const ctx = createCanvas(4, 4).getContext("2d");
    ctx.imageSmoothingEnabled = false;
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
