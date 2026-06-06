// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { GalaxyStage } from "#/components/galaxy/GalaxyStage";
import { en } from "#/lib/i18n/messages/en";

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

describe("GalaxyStage — tier transitions swap the scene + narrate (#125)", () => {
  const stubReducedMotion = (matches: boolean) => {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  };

  // Reduced motion = the snap path: the whole transition (threshold scene swap +
  // arrival narration) lands synchronously, so the wiring asserts without racing
  // GSAP's ticker — the eased path itself is pinned in useGalaxyCamera.test.tsx.
  it("a wheel ascend relabels the scale net at the threshold and ASTRO narrates the arrival", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage");
    expect(stage).not.toBeNull();
    // The home tier reads the Milky-Way disk scale…
    expect(screen.getByText("100k ly")).toBeTruthy();
    fireEvent.wheel(stage as HTMLElement, { deltaY: 12 }); // scroll down → ascend
    // …the swap relabels it to the Local-Group range…
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.queryByText("100k ly")).toBeNull();
    // …and ASTRO speaks the on-arrival line (the snap skips the depart line).
    expect(
      screen.getByText(en.astroNarration.onArrival.localGroup),
    ).toBeTruthy();
  });

  it("the wheel clamp at the ceiling stays a quiet no-op — no swap, no narration", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.wheel(stage, { deltaY: 12 }); // → localGroup
    fireEvent.wheel(stage, { deltaY: 12 }); // already at the ceiling (cooldown aside)
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(
      screen.queryByText(en.astroNarration.ascend.toLocalGroup),
    ).toBeNull();
  });
});
