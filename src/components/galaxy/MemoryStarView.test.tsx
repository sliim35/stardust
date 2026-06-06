// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryStarView } from "#/components/galaxy/MemoryStarView";
import type { MemoryStar } from "#/lib/galaxy/types";

const star = (over: Partial<MemoryStar> = {}): MemoryStar => ({
  id: "s01",
  text: "a memory",
  name: "kitchen radio",
  mood: "joyful",
  color: "#f3c24e",
  r: 0.5,
  angle: 0.3,
  brightness: 0.5,
  createdAt: 0,
  ...over,
});

const pos = { x: 100, y: 100 };

describe("MemoryStarView — Mom's 8-point soft lodestar (deep)", () => {
  it("renders the two soft diagonal flares for the DEEP star", () => {
    const { container } = render(
      <MemoryStarView star={star({ deep: true })} position={pos} />,
    );
    expect(container.querySelector(".mem-star__flare-d1")).not.toBeNull();
    expect(container.querySelector(".mem-star__flare-d2")).not.toBeNull();
  });

  it("does NOT render the diagonal flares for a regular star", () => {
    const { container } = render(
      <MemoryStarView star={star()} position={pos} />,
    );
    expect(container.querySelector(".mem-star__flare-d1")).toBeNull();
    expect(container.querySelector(".mem-star__flare-d2")).toBeNull();
  });
});
