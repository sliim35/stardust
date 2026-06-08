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
import { buildSeedSky, CONSTELLATIONS, MOODS } from "#/lib/galaxy/seed";
import { en } from "#/lib/i18n/messages/en";

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

/**
 * Land (LG overview, owner decision 2026-06-06) and dive into the MW tier with
 * one scroll-up step — the reduced-motion snap path, so the swap lands
 * synchronously (the eased path is pinned in useGalaxyCamera.test.tsx).
 */
const renderDivedIntoMilkyWay = () => {
  stubReducedMotion(true);
  render(<GalaxyStage />);
  const stage = document.querySelector(".galaxy-stage") as HTMLElement;
  expect(stage).not.toBeNull();
  fireEvent.wheel(stage, { deltaY: -12 }); // scroll up → descend INTO the MW
  return stage;
};

describe("GalaxyStage — click → card wiring (#153)", () => {
  it("clicking a memory star (after the first dive) opens its memory card", () => {
    renderDivedIntoMilkyWay();
    // The seeded sky renders memory stars as accessible hit-buttons inside `.mem-star`.
    const star = document.querySelector<HTMLButtonElement>(".mem-star button");
    expect(star).not.toBeNull();
    fireEvent.click(star as HTMLElement);
    // The card overlay mounts its dismiss scrim (CardHost, #152).
    expect(document.querySelector(".galaxy-card-backdrop")).not.toBeNull();
  });
});

describe("GalaxyStage — tier transitions swap the scene + narrate (#125)", () => {
  // The landing state (owner decision 2026-06-06, overriding spec §1's MW-home):
  // the page opens on the Local-Group overview — LG scale net, memory layer
  // hidden — and stays QUIET: transition narration belongs to moves the user
  // causes, never to the initial state (ASTRO's greeting flow is separate).
  it("lands on the Local-Group overview with no transition narration", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.queryByText("100k ly")).toBeNull();
    for (const line of [
      en.astroNarration.onArrival.localGroup,
      en.astroNarration.onArrival.galaxy,
      en.astroNarration.ascend.toLocalGroup,
      en.astroNarration.descend.toGalaxy,
    ]) {
      expect(screen.queryByText(line)).toBeNull();
    }
  });

  // Reduced motion = the snap path: the whole transition (threshold scene swap +
  // arrival narration) lands synchronously, so the wiring asserts without racing
  // GSAP's ticker — the eased path itself is pinned in useGalaxyCamera.test.tsx.
  it("a wheel descend relabels the scale net at the threshold and ASTRO narrates the arrival", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage");
    expect(stage).not.toBeNull();
    // The landing tier reads the Local-Group range…
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    fireEvent.wheel(stage as HTMLElement, { deltaY: -12 }); // scroll up → descend
    // …the swap relabels it to the Milky-Way disk scale…
    expect(screen.getByText("100k ly")).toBeTruthy();
    expect(screen.queryByText("2.5 Mly")).toBeNull();
    // …and ASTRO speaks the on-arrival line (the snap skips the depart line).
    expect(screen.getByText(en.astroNarration.onArrival.galaxy)).toBeTruthy();
  });

  // Slice I-2 (#112): the Local-Group tier is Layer-A territory — the L3 memory
  // layer (MW-interior content) hides there with its pointer + keyboard
  // affordances, and the galaxies carry serif/mono titles from the existing
  // lore catalog. Hover-only since the #167 owner amend: the landing reads
  // CLEAN (zero visible titles); the names live behind the silhouettes'
  // hover/focus hit-targets. The first dive restores L3.
  const LG_LORE_KEYS = [
    "milkyWay",
    "andromeda",
    "triangulum",
    "lmc",
    "smc",
  ] as const;
  const lgLabelEl = (key: (typeof LG_LORE_KEYS)[number]) =>
    screen
      .getByText(en.lore[key].name)
      .closest("[data-lg-label]") as HTMLElement;
  const lgTarget = (key: (typeof LG_LORE_KEYS)[number]) =>
    screen.getByRole("button", {
      name: `${en.lore[key].name} · ${en.lore[key].sublabel}`,
    });

  it("the Local-Group landing hides the memory layer and shows zero visible titles (I-2 + #167 amend)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    const l3 = document.querySelector(".galaxy-l3-wrap") as HTMLElement;
    expect(l3).not.toBeNull();
    // Landing tier: memory layer hidden, no pointer/keyboard affordances…
    expect(l3.className).toContain("invisible");
    expect(l3.className).toContain("opacity-0");
    expect(l3.className).toContain("pointer-events-none");
    // …the MW + every neighbour mount their title FADED OUT (clean composition)
    // with a focusable <button> hit-target carrying the catalog-resolved name
    // (a native button is tab-reachable + Enter/Space-activatable, #169)…
    for (const key of LG_LORE_KEYS) {
      expect(lgLabelEl(key).className).toContain("opacity-0");
      expect(lgTarget(key).tagName).toBe("BUTTON");
      expect(lgTarget(key).getAttribute("type")).toBe("button");
    }
    // …and the titles stay decorative annotations (aria-hidden), the
    // accessible name living on the target like the mem-star hit-button.
    expect(
      screen.getByText(en.lore.andromeda.name).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    // The first dive (scroll up) restores the memory layer and unmounts the
    // LG titles AND their hover targets (MW hover stays the mem-star affair)…
    fireEvent.wheel(stage, { deltaY: -12 });
    expect(l3.className).not.toContain("invisible");
    expect(l3.className).not.toContain("pointer-events-none");
    expect(screen.queryByText(en.lore.andromeda.name)).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `${en.lore.andromeda.name} · ${en.lore.andromeda.sublabel}`,
      }),
    ).toBeNull();
    // …and scrolling back down returns to the (quiet) LG overview.
    fireEvent.wheel(stage, { deltaY: 12 });
    expect(l3.className).toContain("invisible");
    expect(lgLabelEl("andromeda").className).toContain("opacity-0");
  });

  it("hovering a galaxy's hit-target fades ONLY its title up; un-hover restores (#167 amend)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.pointerEnter(lgTarget("andromeda"));
    expect(lgLabelEl("andromeda").className).toContain("opacity-100");
    for (const other of ["milkyWay", "triangulum", "lmc", "smc"] as const) {
      expect(lgLabelEl(other).className).toContain("opacity-0");
    }
    fireEvent.pointerLeave(lgTarget("andromeda"));
    expect(lgLabelEl("andromeda").className).toContain("opacity-0");
  });

  it("keyboard focus on a hit-target drives the same title reveal; blur restores (#167 amend)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.focus(lgTarget("triangulum"));
    expect(lgLabelEl("triangulum").className).toContain("opacity-100");
    fireEvent.blur(lgTarget("triangulum"));
    expect(lgLabelEl("triangulum").className).toContain("opacity-0");
  });

  // Slice I / #169: the LG hit-targets are now clickable controls routing through
  // the SAME seam memory stars use (`useObjectClick` → `resolveClick`): the MW
  // gateway dives (reusing the #167 descend timeline — no new camera math), a
  // neighbour opens its lore card in place (one at a time). Hover/focus also
  // paints the subtle #154 clickable highlight alongside the title.
  it("clicking the Milky Way target dives into the galaxy tier — no card opens (#169)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    expect(screen.getByText("2.5 Mly")).toBeTruthy(); // the LG landing
    fireEvent.click(lgTarget("milkyWay"));
    // The dive reuses the #167 timeline (snap under reduced motion) → the MW
    // tier: scale net relabels and the LG layer unmounts (its buttons gone)…
    expect(screen.getByText("100k ly")).toBeTruthy();
    expect(screen.queryByText("2.5 Mly")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `${en.lore.andromeda.name} · ${en.lore.andromeda.sublabel}`,
      }),
    ).toBeNull();
    // …and a gateway dive is NOT a card.
    expect(document.querySelector(".galaxy-card-backdrop")).toBeNull();
  });

  it("clicking a neighbour opens its lore card in place — no dive; one at a time; ESC + × dismiss (#169)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.click(lgTarget("andromeda"));
    // The lore card opens (its unique catalog lore line) over the dismiss scrim…
    expect(screen.getByText(en.lore.andromeda.line)).toBeTruthy();
    expect(document.querySelectorAll(".galaxy-card-backdrop")).toHaveLength(1);
    // …with NO dive: still the LG tier (scale net + the neighbour targets stay).
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(lgTarget("triangulum")).toBeTruthy();
    // A second neighbour REPLACES the first (one card at a time, the reducer).
    fireEvent.click(lgTarget("triangulum"));
    expect(screen.getByText(en.lore.triangulum.line)).toBeTruthy();
    expect(screen.queryByText(en.lore.andromeda.line)).toBeNull();
    expect(document.querySelectorAll(".galaxy-card-backdrop")).toHaveLength(1);
    // Escape (on the focused dialog) dismisses it.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.querySelector(".galaxy-card-backdrop")).toBeNull();
    // Re-open and dismiss via the × close button.
    fireEvent.click(lgTarget("lmc"));
    expect(screen.getByText(en.lore.lmc.line)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.card.close }));
    expect(document.querySelector(".galaxy-card-backdrop")).toBeNull();
  });

  it("real-object hover/focus paints the #154 clickable highlight alongside the title (#169)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const glow = (id: string) =>
      document.querySelector(`[data-lg-glow="${id}"]`) as HTMLElement;
    fireEvent.pointerEnter(lgTarget("andromeda"));
    // Both the title AND the clickable highlight light up for the active target.
    expect(lgLabelEl("andromeda").className).toContain("opacity-100");
    expect(glow("andromeda").className).toContain("opacity-100");
    // The MW (id "home") stays dark.
    expect(glow("home").className).toContain("opacity-0");
    fireEvent.pointerLeave(lgTarget("andromeda"));
    expect(glow("andromeda").className).toContain("opacity-0");
  });

  it("the wheel clamp at the LG ceiling stays a quiet no-op — no swap, no narration", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.wheel(stage, { deltaY: 12 }); // scroll down at the landing ceiling
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(
      screen.queryByText(en.astroNarration.onArrival.localGroup),
    ).toBeNull();
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
      // Descend: the eased timeline crosses the 0.9 s threshold → relabel to MW…
      fireEvent.wheel(stage, { deltaY: -12 });
      advance(1.0); // mid-arrive: past the threshold, well before the 2.3 s settle
      expect(screen.getByText("100k ly")).toBeTruthy();
      expect(screen.queryByText("2.5 Mly")).toBeNull();
      // …reverse (the nav steps back to the Local Group): the timeline is live
      // by construction, so it reverses in place — then Escape kills it before
      // any tick can re-cross the threshold. Only the kill's terminal arrive
      // can resolve the displayed tier back to the nav tier (localGroup).
      fireEvent.wheel(stage, { deltaY: 12 });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(screen.getByText("2.5 Mly")).toBeTruthy();
      expect(screen.queryByText("100k ly")).toBeNull();
      // ASTRO settles on the arrival line, not a stale mid-flight depart line.
      expect(
        screen.getByText(en.astroNarration.onArrival.localGroup),
      ).toBeTruthy();
    });
  });
});

describe("GalaxyStage — hover lights the mood constellation + dims the rest (#154)", () => {
  // Derive expected counts from the live seed fixture + the authored figures so
  // seed/figure edits surface here as a deliberate diff, not a magic number
  // drifting out of date (owner rules, 2026-06-06: figures are authored —
  // segments == edges, lit == members — never an emergent createdAt chain).
  // Every case dives into the MW first: the LG landing hides the memory layer,
  // so hover is a post-first-dive affordance now.
  const seedStars = buildSeedSky().stars;
  const quietAche = CONSTELLATIONS.quietAche;

  it("focusing a grouped star (after the first dive) draws its AUTHORED edges in the figure's single mood colour, dims everything else, and blur restores", () => {
    renderDivedIntoMilkyWay();
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
    renderDivedIntoMilkyWay();
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
    renderDivedIntoMilkyWay();
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
