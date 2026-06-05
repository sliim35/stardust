// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryStarLayer } from "#/components/galaxy/MemoryStarLayer";
import type { MemoryStar } from "#/lib/galaxy/types";

const star: MemoryStar = {
  id: "s01",
  text: "the kitchen radio.",
  name: "kitchen radio",
  mood: "joyful",
  color: "#ffd166",
  r: 0.3,
  angle: 1,
  brightness: 0.8,
  createdAt: 1,
};

describe("MemoryStarLayer onSelect", () => {
  it("clicking a star's hit-button calls onSelect with that star", () => {
    const onSelect = vi.fn();
    render(
      <MemoryStarLayer
        stars={[star]}
        onSelect={onSelect}
        a11yLabel="Open memory"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "kitchen radio" }));
    expect(onSelect).toHaveBeenCalledWith(star);
  });

  it("renders no hit-button when onSelect is absent (decorative, today's behaviour)", () => {
    render(<MemoryStarLayer stars={[star]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
