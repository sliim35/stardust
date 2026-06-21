// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConstellationOverlay } from "#/components/galaxy/ConstellationOverlay";
import type { ConstellationSegment } from "#/lib/galaxy/constellation";

const seg = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): ConstellationSegment => ({
  from: { x: fromX, y: fromY },
  to: { x: toX, y: toY },
});

const REAL: readonly ConstellationSegment[] = [seg(10, 10, 20, 20)];
const GHOST: readonly ConstellationSegment[] = [
  seg(10, 10, 20, 20),
  seg(20, 20, 30, 30),
  seg(30, 30, 40, 40),
];

describe("ConstellationOverlay — forming-ghost render (BR27, #227)", () => {
  it("draws the ghost silhouette at ~0.12 opacity (the 2026-06-20 proof value) — AC1", () => {
    const { container } = render(
      <ConstellationOverlay
        segments={[]}
        ghostSegments={GHOST}
        color="#b8c4e0"
      />,
    );
    const ghostLines = container.querySelectorAll(".constellation-ghost line");
    expect(ghostLines).toHaveLength(GHOST.length);
    for (const line of ghostLines) {
      expect(line.getAttribute("stroke-opacity")).toBe("0.12");
    }
  });

  it("draws the ghost BEHIND the real-star jewel segments (ghost group first) — AC1", () => {
    const { container } = render(
      <ConstellationOverlay
        segments={REAL}
        ghostSegments={GHOST}
        color="#b8c4e0"
      />,
    );
    const ghost = container.querySelector(".constellation-ghost");
    const real = container.querySelector(".constellation-lines");
    expect(ghost).not.toBeNull();
    expect(real).not.toBeNull();
    // The ghost group precedes the real-lines group in document order, so SVG paints
    // it underneath the jewels' bright connect-lines (BR27 — full silhouette behind).
    expect(
      ghost &&
        real &&
        ghost.compareDocumentPosition(real) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders NO phantom star at an empty anchor — ghost is lines-only, no node markers — AC2", () => {
    const { container } = render(
      <ConstellationOverlay
        segments={[]}
        ghostSegments={GHOST}
        color="#b8c4e0"
      />,
    );
    // No <circle>/<rect>/<image> node drawn for the unfilled anchors — only edges.
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    expect(container.querySelectorAll("image")).toHaveLength(0);
    // Every ghost edge still draws (ghost-only) even with zero filled members.
    expect(
      container.querySelectorAll(".constellation-ghost line"),
    ).toHaveLength(GHOST.length);
  });

  it("renders the SVG when only the ghost is present (no real segments yet) — AC2", () => {
    const { container } = render(
      <ConstellationOverlay
        segments={[]}
        ghostSegments={GHOST}
        color="#b8c4e0"
      />,
    );
    expect(container.querySelector("svg.galaxy-constellation")).not.toBeNull();
    expect(
      container.querySelectorAll(".constellation-lines line"),
    ).toHaveLength(0);
  });

  it("renders nothing when both real and ghost segments are empty (back-compat)", () => {
    const { container } = render(
      <ConstellationOverlay segments={[]} ghostSegments={[]} color="#b8c4e0" />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("ghostSegments is optional — omitting it keeps today's real-only behaviour", () => {
    const { container } = render(
      <ConstellationOverlay segments={REAL} color="#b8c4e0" />,
    );
    expect(
      container.querySelectorAll(".constellation-lines line"),
    ).toHaveLength(REAL.length);
    expect(container.querySelector(".constellation-ghost")).toBeNull();
  });

  it("strokes the ghost in the figure's ONE mood colour, verbatim (rule 2)", () => {
    const { container } = render(
      <ConstellationOverlay
        segments={[]}
        ghostSegments={GHOST}
        color="#abcdef"
      />,
    );
    for (const line of container.querySelectorAll(
      ".constellation-ghost line",
    )) {
      expect(line.getAttribute("stroke")).toBe("#abcdef");
    }
  });
});
