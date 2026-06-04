import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RENDER_SET, writeRender } from "#/brand/composer/render-set";

let out: string;
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), "brand-renders-"));
});
afterEach(() => {
  rmSync(out, { recursive: true, force: true });
});

describe("writeRender", () => {
  it("writes a PNG and a JSON sidecar under <out>/<channel>/ (AC9)", async () => {
    await writeRender(out, "proof", {
      channel: "og",
      seed: 424242,
      pose: "idle",
      faceLeft: true,
    });
    const png = join(out, "og", "proof.png");
    const json = join(out, "og", "proof.json");
    expect(existsSync(png)).toBe(true);
    expect(existsSync(json)).toBe(true);
    const sidecar = JSON.parse(readFileSync(json, "utf8"));
    expect(sidecar).toMatchObject({
      channel: "og",
      seed: 424242,
      NW: 200,
      NH: 105,
      SCALE: 6,
      pose: "idle",
      faceLeft: true,
      astroHeightPx: 96,
    });
    // PNG magic number
    expect(readFileSync(png).subarray(0, 4).toString("hex")).toBe("89504e47");
  });
});

describe("DEFAULT_RENDER_SET", () => {
  it("covers all three channels and includes the AC8 proof render", () => {
    const channels = new Set(DEFAULT_RENDER_SET.map((r) => r.input.channel));
    expect(channels).toEqual(new Set(["linkedin", "og", "avatar"]));
    const proof = DEFAULT_RENDER_SET.find(
      (r) => r.name === "proof-pixel-galaxy",
    );
    expect(proof?.input).toMatchObject({
      channel: "og",
      seed: 424242,
      pose: "idle",
      faceLeft: true,
    });
  });
});
