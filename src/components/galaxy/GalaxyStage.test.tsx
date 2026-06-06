// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { GalaxyStage } from "#/components/galaxy/GalaxyStage";
import { buildSeedSky, CONSTELLATIONS, MOODS } from "#/lib/galaxy/seed";

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
  // Derive expected counts from the live seed fixture + the authored figures so
  // seed/figure edits surface here as a deliberate diff, not a magic number
  // drifting out of date (owner rules, 2026-06-06: figures are authored —
  // segments == edges, lit == members — never an emergent createdAt chain).
  const seedStars = buildSeedSky().stars;
  const quietAche = CONSTELLATIONS.quietAche;

  it("focusing a grouped star draws its AUTHORED edges in the figure's single mood colour, dims everything else, and blur restores", () => {
    render(<GalaxyStage />);
    // s04 "the old number" is a member of the wistful quiet-ache figure.
    const button = screen.getByRole("button", { name: "the old number" });
    fireEvent.focus(button);
    const lines = document.querySelectorAll(".galaxy-constellation line");
    expect(lines).toHaveLength(quietAche.edges.length);
    // Rule 2 — no cross-colour connections: every segment strokes the ONE
    // figure-mood colour, by construction.
    const strokes = new Set(
      [...lines].map((line) => line.getAttribute("stroke")),
    );
    expect(strokes).toEqual(new Set([MOODS[quietAche.mood].color]));
    // The figure members stay lit; every other star dims — Mom's star
    // included (interaction spec §3: hovering a grouped star dims everything
    // else; the treatment only exempts irina from being a constellation NODE,
    // not from being dimmed).
    expect(document.querySelectorAll(".mem-star[data-dimmed]")).toHaveLength(
      seedStars.length - quietAche.members.length,
    );
    expect(
      document.querySelector('.mem-star[data-mood="nostalgic"][data-dimmed]'),
    ).not.toBeNull();
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

  it("a solo-mood star (no figure) lights no constellation and dims nothing — short-desc only, like Mom's", () => {
    render(<GalaxyStage />);
    // s02 "his steady hands" (tender) lost its group in the mood-pure redesign
    // (owner rules, 2026-06-06) — solo moods behave like Mom's star on hover.
    const button = screen.getByRole("button", { name: "his steady hands" });
    fireEvent.focus(button);
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
