// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConstellationOverlay } from "#/components/galaxy/ConstellationOverlay";
import type { ConstellationSegment } from "#/lib/galaxy/constellation";
import type { Point } from "#/lib/galaxy/place";

const COLOR = "#ffd166";

const ghost: ConstellationSegment[] = [
  { from: { x: 10, y: 20 }, to: { x: 30, y: 40 } },
  { from: { x: 30, y: 40 }, to: { x: 50, y: 60 } },
];

const real: ConstellationSegment[] = [
  { from: { x: 10, y: 20 }, to: { x: 30, y: 40 } },
];

const slots: Point[] = [
  { x: 50, y: 60 },
  { x: 70, y: 80 },
];

describe("ConstellationOverlay", () => {
  it("renders nothing when ghost, realSegments, and openSlots are all empty", () => {
    const { container } = render(<ConstellationOverlay color={COLOR} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws ghost edges as dashed lines at stroke-opacity 0.13", () => {
    const { container } = render(
      <ConstellationOverlay color={COLOR} ghost={ghost} />,
    );
    const lines = container.querySelectorAll(".constellation-ghost line");
    expect(lines).toHaveLength(ghost.length);
    for (const line of lines) {
      expect(line.getAttribute("stroke-dasharray")).toBe("3 7");
      expect(line.getAttribute("stroke-opacity")).toBe("0.13");
    }
  });

  it("draws one hollow circle per open slot (fill none)", () => {
    const { container } = render(
      <ConstellationOverlay color={COLOR} openSlots={slots} />,
    );
    const circles = container.querySelectorAll(".constellation-slots circle");
    expect(circles).toHaveLength(slots.length);
    for (const circle of circles) {
      expect(circle.getAttribute("fill")).toBe("none");
    }
  });

  it("draws two stacked lines (underlay + crisp) per real segment", () => {
    const { container } = render(
      <ConstellationOverlay color={COLOR} realSegments={real} />,
    );
    const lines = container.querySelectorAll(".constellation-lines line");
    expect(lines).toHaveLength(real.length * 2);
    const opacities = [...lines].map((l) => l.getAttribute("stroke-opacity"));
    expect(opacities).toContain("0.16");
    expect(opacities).toContain("0.62");
  });

  it("paints the ghost group before the lines group in document order", () => {
    const { container } = render(
      <ConstellationOverlay
        color={COLOR}
        ghost={ghost}
        realSegments={real}
        openSlots={slots}
      />,
    );
    const groups = [...container.querySelectorAll("svg > g")].map((g) =>
      g.getAttribute("class"),
    );
    const ghostIdx = groups.indexOf("constellation-ghost");
    const linesIdx = groups.indexOf("constellation-lines");
    expect(ghostIdx).toBeGreaterThanOrEqual(0);
    expect(linesIdx).toBeGreaterThanOrEqual(0);
    expect(ghostIdx).toBeLessThan(linesIdx);
  });

  it("renders the color verbatim on a ghost line's stroke", () => {
    const { container } = render(
      <ConstellationOverlay color={COLOR} ghost={ghost} />,
    );
    const line = container.querySelector(".constellation-ghost line");
    expect(line?.getAttribute("stroke")).toBe(COLOR);
  });
});
