// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

// The wheel cooldown is 500 ms wall-clock (#153); the kill test below steps two
// tiers faster than that, so the real hook gets an injected clock that always
// clears the cooldown — the debounce itself stays pinned in useTierNav.test.tsx.
vi.mock("#/components/galaxy/useTierNav", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("#/components/galaxy/useTierNav")>();
  let t = 0;
  return {
    ...mod,
    useTierNav: () => mod.useTierNav(() => (t += mod.WHEEL_COOLDOWN_MS + 1)),
  };
});

import { GalaxyStage } from "#/components/galaxy/GalaxyStage";
import { gsap } from "#/components/galaxy/gsap-setup";
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

  // Slice I-2 (#112): the Local-Group tier is Layer-A territory — the L3 memory
  // layer (MW-interior content) hides with the threshold swap, its pointer +
  // keyboard affordances go with it, and the neighbours get serif/mono labels
  // from the existing lore catalog. Reduced-motion = the snap path (no GSAP race).
  it("the Local-Group tier hides the memory layer and labels the galaxies (I-2)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    const l3 = document.querySelector(".galaxy-l3-wrap") as HTMLElement;
    expect(l3).not.toBeNull();
    // Home tier: memory layer live, no Layer-A labels.
    expect(l3.className).not.toContain("invisible");
    expect(screen.queryByText(en.lore.andromeda.name)).toBeNull();
    fireEvent.wheel(stage, { deltaY: 12 }); // scroll down → ascend to the LG tier
    // The memory layer fades + loses pointer/keyboard affordances…
    expect(l3.className).toContain("invisible");
    expect(l3.className).toContain("opacity-0");
    expect(l3.className).toContain("pointer-events-none");
    // …and the MW + every neighbour read their serif name + mono distance.
    for (const key of [
      "milkyWay",
      "andromeda",
      "triangulum",
      "lmc",
      "smc",
    ] as const) {
      expect(screen.getByText(en.lore[key].name)).toBeTruthy();
      expect(screen.getByText(en.lore[key].sublabel)).toBeTruthy();
    }
    // Labels are decorative annotations — aria-hidden like the mem-star labels.
    expect(
      screen.getByText(en.lore.andromeda.name).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    // Descending home restores the memory layer and drops the labels.
    fireEvent.wheel(stage, { deltaY: -12 });
    expect(l3.className).not.toContain("invisible");
    expect(l3.className).not.toContain("pointer-events-none");
    expect(screen.queryByText(en.lore.andromeda.name)).toBeNull();
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

  // The eased path (a real gsap.timeline): a kill after the threshold must leave
  // the DISPLAYED tier on the nav tier — the source of truth — not stranded
  // mid-transition (#167 review, code-style "terminal events on kill/cancel").
  describe("focus-kill mid-transition resolves the displayed tier (#167 review)", () => {
    // Deterministic choreography: under load the auto ticker can complete the
    // timeline before the reverse lands (vitest runs files in parallel), so
    // GSAP's root clock is driven by hand (the documented manual mode) — every
    // step parks the playhead exactly where the test says, no wall-clock races.
    beforeAll(() => {
      gsap.ticker.remove(gsap.updateRoot);
    });
    afterAll(() => {
      gsap.ticker.add(gsap.updateRoot);
    });

    it("Escape mid-reverse (after the threshold) settles the scale net on the nav tier", () => {
      stubReducedMotion(false);
      render(<GalaxyStage />);
      const stage = document.querySelector(".galaxy-stage") as HTMLElement;
      let t = gsap.ticker.time;
      const advance = (s: number) => {
        t += s;
        act(() => {
          gsap.updateRoot(t);
        });
      };
      advance(0); // sync the frozen root clock to "now"
      // Ascend: the eased timeline crosses the 0.9 s threshold → relabel to LG…
      fireEvent.wheel(stage, { deltaY: 12 });
      advance(1.0); // mid-arrive: past the threshold, well before the 2.3 s settle
      expect(screen.getByText("2.5 Mly")).toBeTruthy();
      expect(screen.queryByText("100k ly")).toBeNull();
      // …reverse (the nav steps back to the galaxy): the timeline is live by
      // construction, so it reverses in place — then Escape kills it before
      // any tick can re-cross the threshold. Only the kill's terminal arrive
      // can resolve the displayed tier back to the nav tier (galaxy).
      fireEvent.wheel(stage, { deltaY: -12 });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(screen.getByText("100k ly")).toBeTruthy();
      expect(screen.queryByText("2.5 Mly")).toBeNull();
      // ASTRO settles on the arrival line, not a stale mid-flight depart line.
      expect(screen.getByText(en.astroNarration.onArrival.galaxy)).toBeTruthy();
    });
  });
});
