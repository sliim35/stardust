// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { GalaxyStage } from "#/components/galaxy/GalaxyStage";

describe("GalaxyStage — click → card wiring (#153)", () => {
  it("clicking a memory star opens its memory card", () => {
    render(<GalaxyStage />);
    // The seeded sky renders memory stars as accessible hit-buttons inside `.mem-star`.
    const star = document.querySelector<HTMLButtonElement>(".mem-star button");
    expect(star).not.toBeNull();
    fireEvent.click(star as HTMLElement);
    // The card overlay mounts its dismiss scrim (CardHost, #152).
    expect(document.querySelector(".galaxy-card-backdrop")).not.toBeNull();
  });
});

describe("GalaxyStage — hover lights the mood constellation + dims the rest (#154)", () => {
  it("focusing a grouped star draws its connect-lines, dims everything else, and blur restores", () => {
    render(<GalaxyStage />);
    // s04 "the old number" belongs to quiet-ache (s02 · s03 · s04 → 2 segments).
    const button = screen.getByRole("button", { name: "the old number" });
    fireEvent.focus(button);
    expect(
      document.querySelectorAll(".galaxy-constellation line"),
    ).toHaveLength(2);
    // The 3 quiet-ache members stay lit; the other 5 seed stars dim…
    expect(document.querySelectorAll(".mem-star[data-dimmed]")).toHaveLength(5);
    // …and the disk + deep field fade back so the group reads alone.
    expect(document.querySelector(".galaxy-l2-wrap")?.className).toContain(
      "opacity-40",
    );
    // Un-hover/blur restores all layers.
    fireEvent.blur(button);
    expect(
      document.querySelectorAll(".galaxy-constellation line"),
    ).toHaveLength(0);
    expect(document.querySelectorAll(".mem-star[data-dimmed]")).toHaveLength(0);
    expect(document.querySelector(".galaxy-l2-wrap")?.className).not.toContain(
      "opacity-40",
    );
  });

  it("Mom's star (deep, ungrouped) lights no constellation and dims nothing — short-desc only", () => {
    render(<GalaxyStage />);
    // irina is the only nostalgic star in the seed sky.
    const button = document.querySelector<HTMLButtonElement>(
      '.mem-star[data-mood="nostalgic"] button',
    );
    expect(button).not.toBeNull();
    fireEvent.focus(button as HTMLElement);
    expect(
      document.querySelectorAll(".galaxy-constellation line"),
    ).toHaveLength(0);
    expect(document.querySelectorAll(".mem-star[data-dimmed]")).toHaveLength(0);
  });
});
