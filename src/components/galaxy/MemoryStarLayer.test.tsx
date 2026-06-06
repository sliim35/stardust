// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryStarLayer } from "#/components/galaxy/MemoryStarLayer";
import type { MemoryStar } from "#/lib/galaxy/types";
import { ru } from "#/lib/i18n/messages/ru";

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

describe("MemoryStarLayer hover/focus affordance (#154)", () => {
  const second: MemoryStar = {
    ...star,
    id: "s02",
    name: "his steady hands",
    createdAt: 2,
  };

  it("pointer enter/leave on a star reports it to onHoverChange", () => {
    const onHoverChange = vi.fn();
    render(<MemoryStarLayer stars={[star]} onHoverChange={onHoverChange} />);
    const root = document.querySelector(".mem-star") as HTMLElement;
    fireEvent.pointerEnter(root);
    expect(onHoverChange).toHaveBeenLastCalledWith(star);
    fireEvent.pointerLeave(root);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it("keyboard focus/blur on the hit-button drives the same affordance", () => {
    const onHoverChange = vi.fn();
    render(
      <MemoryStarLayer
        stars={[star]}
        onSelect={vi.fn()}
        onHoverChange={onHoverChange}
      />,
    );
    const button = screen.getByRole("button", { name: "kitchen radio" });
    fireEvent.focus(button);
    expect(onHoverChange).toHaveBeenLastCalledWith(star);
    fireEvent.blur(button);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it("dims exactly the stars outside litIds when a constellation is active", () => {
    render(
      <MemoryStarLayer stars={[star, second]} litIds={new Set([star.id])} />,
    );
    const dimmed = document.querySelectorAll(".mem-star[data-dimmed]");
    expect(dimmed).toHaveLength(1);
    expect(
      document.querySelector(`.mem-star[data-mood="${star.mood}"]`),
    ).not.toBeNull();
    // The lit star (s01) keeps full presence; only s02 carries the dim.
    const all = [...document.querySelectorAll(".mem-star")];
    expect(all.filter((el) => el.hasAttribute("data-dimmed"))).toHaveLength(1);
  });

  it("dims nothing when no constellation is lit (litIds null — un-hover restores)", () => {
    render(<MemoryStarLayer stars={[star, second]} litIds={null} />);
    expect(document.querySelectorAll(".mem-star[data-dimmed]")).toHaveLength(0);
  });

  it("renders the MOOD eyebrow from the i18n moods catalog (ru parity)", () => {
    render(<MemoryStarLayer stars={[star]} moodLabels={ru.moods} />);
    expect(screen.getByText(/РАДОСТЬ/)).not.toBeNull();
  });
});
