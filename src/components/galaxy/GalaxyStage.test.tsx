// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import { cameraTransform } from "#/lib/galaxy/camera";
import { DEEPLINK_FRAMING_ZOOM, resolveFocusTarget } from "#/lib/galaxy/focus";
import { buildSeedSky } from "#/lib/galaxy/seed";
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
  const LG_LORE_KEYS = ["milkyWay", "andromeda", "triangulum", "lmc"] as const;
  // The breadcrumb now surfaces the galaxy's lore name too (BR21, #199), so the home
  // MW name appears twice at the overview — scope to the `[data-lg-label]` title, not
  // the breadcrumb crumb in the <nav>.
  const lgLabelEl = (key: (typeof LG_LORE_KEYS)[number]) => {
    const el = screen
      .getAllByText(en.lore[key].name)
      .map((node) => node.closest("[data-lg-label]"))
      .find((node): node is HTMLElement => node !== null);
    if (!el) throw new Error(`no LG label for ${key}`);
    return el;
  };
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
    for (const other of ["milkyWay", "triangulum", "lmc"] as const) {
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

  // BR22 (#196, data slice): every Local-Group galaxy is now a `gateway`, so a
  // neighbour click DIVES into its galaxy tier through the SAME `resolveClick` seam
  // as the MW — it no longer opens a lore card. The per-galaxy scene-swap (rendering
  // Andromeda's own disk + breadcrumb + ASTRO lore at the dive) is wired in slice 3
  // (#198 — GalaxyStage de-hardcode); this slice only flips the routing to a dive.
  it("clicking a neighbour now dives into its galaxy tier — no card opens (BR22 #196)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    expect(screen.getByText("2.5 Mly")).toBeTruthy(); // the LG landing
    fireEvent.click(lgTarget("andromeda"));
    // The dive reuses the descend timeline (snap under reduced motion) → the galaxy
    // tier: the scale net relabels and the LG layer (its neighbour targets) unmounts…
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

  // BR22-frame (#198): the node-aware scene swap. Entering a NEIGHBOUR renders THAT
  // galaxy's disk + per-galaxy ASTRO lore — not the hardcoded home Milky Way — and an
  // empty galaxy (zero memory figures, true for every neighbour at launch) enters cleanly.
  const memStars = () => document.querySelectorAll(".mem-star");

  it("entering Andromeda swaps to its disk + speaks Andromeda's lore — empty figure layer (AC1/AC3/AC5)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    // The home MW disk carries the seeded memory corpus; Andromeda carries none.
    fireEvent.click(lgTarget("andromeda"));
    // The galaxy tier is reached (scale net relabels)…
    expect(screen.getByText("100k ly")).toBeTruthy();
    // …Andromeda has ZERO memory figures (the empty-galaxy first-class state)…
    expect(memStars()).toHaveLength(0);
    // …ASTRO speaks Andromeda's OWN lore line, not the MW-worded arrival string…
    expect(screen.getByText(en.lore.andromeda.line)).toBeTruthy();
    expect(screen.queryByText(en.astroNarration.onArrival.galaxy)).toBeNull();
    // …and no crash / no card.
    expect(document.querySelector(".galaxy-card-backdrop")).toBeNull();
  });

  it("entering LMC and Triangulum each speak their own lore + render an empty disk (AC2)", () => {
    for (const key of ["lmc", "triangulum"] as const) {
      stubReducedMotion(true);
      const view = render(<GalaxyStage />);
      fireEvent.click(
        screen.getByRole("button", {
          name: `${en.lore[key].name} · ${en.lore[key].sublabel}`,
        }),
      );
      expect(screen.getByText("100k ly")).toBeTruthy();
      expect(document.querySelectorAll(".mem-star")).toHaveLength(0);
      expect(screen.getByText(en.lore[key].line)).toBeTruthy();
      view.unmount();
    }
  });

  it("entering the home Milky Way keeps its seeded stars + the unchanged MW arrival line (AC5)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.click(lgTarget("milkyWay"));
    expect(screen.getByText("100k ly")).toBeTruthy();
    // The MW keeps its seeded memory corpus (the empty-galaxy swap never strands it)…
    expect(memStars().length).toBeGreaterThan(0);
    // …and the entry narration is the existing MW-worded arrival line, not a lore line.
    expect(screen.getByText(en.astroNarration.onArrival.galaxy)).toBeTruthy();
  });

  it("ascending back out of a neighbour returns to the quiet LG overview (no stranded disk)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.click(lgTarget("andromeda"));
    expect(screen.getByText("100k ly")).toBeTruthy();
    // Scroll back out to the Local-Group overview…
    fireEvent.wheel(stage, { deltaY: 12 });
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.queryByText("100k ly")).toBeNull();
    // …the LG composition is back (neighbour titles re-mount).
    expect(screen.getByText(en.lore.andromeda.name)).toBeTruthy();
  });

  // #174: the in-DOM `data-lg-glow` wash (a boxy clipped "oreol") is gone. The
  // hover highlight is now the hovered galaxy's own point cloud blooming on a
  // dedicated backdrop canvas; the stage feeds the active id down as `highlight`
  // via the canvas's `data-lg-bloom` signal (the bloom render is canvas-only).
  const bloomCanvas = () =>
    document.querySelector("[data-lg-bloom]") as HTMLElement | null;

  it("real-object hover/focus blooms the hovered galaxy's point cloud — no in-DOM oreol (#174)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    // The #169 DOM wash is gone — not a single glow span in the tree.
    expect(document.querySelector("[data-lg-glow]")).toBeNull();
    fireEvent.pointerEnter(lgTarget("andromeda"));
    // The title still fades up, and the active id flows to the backdrop canvas.
    expect(lgLabelEl("andromeda").className).toContain("opacity-100");
    expect(bloomCanvas()?.getAttribute("data-lg-bloom")).toBe("andromeda");
    fireEvent.pointerLeave(lgTarget("andromeda"));
    // Un-hover clears the bloom (empty signal) but the canvas stays mounted.
    expect(bloomCanvas()?.getAttribute("data-lg-bloom")).toBe("");
  });

  it("highlight flows only while on the LG tier — diving in clears it (#174)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.pointerEnter(lgTarget("andromeda"));
    expect(bloomCanvas()?.getAttribute("data-lg-bloom")).toBe("andromeda");
    expect(bloomCanvas()?.getAttribute("data-active")).toBe("true");
    // Dive into the MW tier: the LG layer unmounts and the highlight prop is gated
    // off — the bloom canvas (always mounted) reverts to an empty/inactive signal,
    // so nothing strands the highlight across the descend.
    fireEvent.wheel(stage, { deltaY: -12 });
    expect(bloomCanvas()?.getAttribute("data-lg-bloom")).toBe("");
    expect(bloomCanvas()?.getAttribute("data-active")).toBeNull();
    // Ascend back to the LG overview: still an empty (un-highlighted) bloom.
    fireEvent.wheel(stage, { deltaY: 12 });
    expect(bloomCanvas()?.getAttribute("data-lg-bloom")).toBe("");
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

    it("Escape mid-reverse (after the threshold) settles the scale net on the nav tier", async () => {
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
      // ASTRO settles on the arrival line, not a stale mid-flight depart line —
      // after the ≥3s narration dwell (#183), the line is deferred but lands.
      await waitFor(
        () =>
          expect(
            screen.getByText(en.astroNarration.onArrival.localGroup),
          ).toBeTruthy(),
        { timeout: 3500 },
      );
    });
  });
});

describe("GalaxyStage — node-aware breadcrumb derived from the live galaxyId (BR21, #199)", () => {
  // The breadcrumb is a real <nav>; scope queries to it so the galaxy crumb's lore
  // name never collides with the same name on an LG hit-target at the overview.
  const crumbs = () => within(screen.getByRole("navigation"));

  // AC6 — diving into a neighbour threads its live galaxyId to the chrome: the
  // breadcrumb galaxy segment reads THAT galaxy's lore name (Andromeda), never the
  // hardcoded home Milky Way. The LG hit-targets unmount on the dive, so the only
  // "Andromeda" left in the tree is the breadcrumb's active crumb.
  it("a neighbour dive shows that galaxy's lore name as the active breadcrumb segment (AC1/AC6)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.lore.andromeda.name} · ${en.lore.andromeda.sublabel}`,
      }),
    );
    const active = crumbs().getByText(en.lore.andromeda.name);
    expect(active.getAttribute("aria-current")).toBe("location");
    // A neighbour has no SOL tier → the trail is two segments, no SOL crumb.
    expect(crumbs().queryByText(en.chrome.breadcrumb.solarSystem)).toBeNull();
    // …and the home MW name never leaks into a neighbour's trail.
    expect(crumbs().queryByText(en.lore.milkyWay.name)).toBeNull();
  });

  // AC4/AC6 — the LOCAL GROUP crumb ascends and clears the galaxyId: back at the
  // overview the trail falls back to the home ladder (MW name + SOL tail restored).
  it("clicking LOCAL GROUP from a neighbour ascends to the overview and clears the galaxy (AC4)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.lore.andromeda.name} · ${en.lore.andromeda.sublabel}`,
      }),
    );
    expect(screen.getByText("100k ly")).toBeTruthy(); // dived into the galaxy tier
    fireEvent.click(
      crumbs().getByRole("button", { name: en.chrome.breadcrumb.localGroup }),
    );
    // Back on the LG overview: scale net relabels, LOCAL GROUP is the active crumb,
    // and the home ladder is restored (the SOL tail returns at the overview).
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(
      crumbs()
        .getByText(en.chrome.breadcrumb.localGroup)
        .getAttribute("aria-current"),
    ).toBe("location");
    expect(crumbs().getByText(en.chrome.breadcrumb.solarSystem)).toBeTruthy();
  });

  // AC3 — inside the home Milky Way the trail keeps the SOL crumb (the only galaxy
  // with a third tier), and the galaxy segment reads the home MW lore name.
  it("the home Milky Way dive keeps the SOL crumb and shows the MW lore name (AC3)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${en.lore.milkyWay.name} · ${en.lore.milkyWay.sublabel}`,
      }),
    );
    expect(
      crumbs().getByText(en.lore.milkyWay.name).getAttribute("aria-current"),
    ).toBe("location");
    expect(crumbs().getByText(en.chrome.breadcrumb.solarSystem)).toBeTruthy();
  });
});

describe("GalaxyStage — emotion figures render ambiently (owner Claude Design #232)", () => {
  // Figures are AMBIENT (no hover reveal): an authored figure with ≥2 members of an
  // emotion shows a dashed ghost + hollow open-slot rings + solid lines between filled
  // pairs, members rendering as jewels on their anchors. That forming/finished render is
  // unit-tested (constellation.test + ConstellationOverlay.test). The seed is now
  // Mom-only, so the seed sky shows NO figure — Mom's deep star is never a member. Each
  // case dives into the MW first (the LG landing hides the memory layer).
  it("the Mom-only seed shows no figure (figures need ≥2 members of an emotion)", () => {
    renderDivedIntoMilkyWay();
    expect(document.querySelectorAll(".constellation-ghost line")).toHaveLength(
      0,
    );
    expect(
      document.querySelectorAll(".constellation-slots circle"),
    ).toHaveLength(0);
    expect(document.querySelector(".galaxy-constellation")).toBeNull();
  });

  it("Mom's deep star renders as a lone jewel, never part of a figure", () => {
    renderDivedIntoMilkyWay();
    expect(
      document.querySelectorAll('.mem-star[data-mood="nostalgic"]'),
    ).toHaveLength(1);
  });
});

describe("GalaxyStage — figures ride the L4 foreground parallax plane (#243)", () => {
  // A renderable joyful figure (3 same-emotion members) injected as user stars so
  // the MW disk has real figure members; Mom's deep star rides the L5 dedication plane.
  // The split puts figure members + the ConstellationOverlay on L4, loose stars on L3,
  // and Mom's singular deep star alone on L5 (the nearest plane).
  const joyMembers = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `j${i}`,
      text: `joy ${i}`,
      mood: "joyful" as const,
      color: "#f6d36b",
      r: 0.5,
      angle: i,
      brightness: 0.7,
      createdAt: 100 + i,
      group: "joyful",
    }));

  const renderWithFigure = (n = 3) => {
    stubReducedMotion(true);
    render(<GalaxyStage userStars={joyMembers(n)} />);
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.wheel(stage, { deltaY: -12 }); // dive into the MW
    return stage;
  };

  it("renders an L4 wrapper inside the camera, stacked above L3", () => {
    renderWithFigure();
    const camera = document.querySelector(
      ".galaxy-stage__camera",
    ) as HTMLElement;
    const l3 = camera.querySelector(".galaxy-l3-wrap") as HTMLElement;
    const l4 = camera.querySelector(".galaxy-l4-wrap") as HTMLElement;
    expect(l3).not.toBeNull();
    expect(l4).not.toBeNull();
    // L4 is a sibling of L3 inside the camera, ordered AFTER it (stacked above).
    expect(l4.parentElement).toBe(camera);
    expect(
      l3.compareDocumentPosition(l4) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders three memory-star layers — free on L3, figure members on L4, Mom on L5", () => {
    renderWithFigure();
    const l3 = document.querySelector(".galaxy-l3-wrap") as HTMLElement;
    const l4 = document.querySelector(".galaxy-l4-wrap") as HTMLElement;
    const l5 = document.querySelector(".galaxy-l5-wrap") as HTMLElement;
    // Three distinct MemoryStarLayer instances (one per plane: L3 free, L4 members, L5 Mom).
    expect(document.querySelectorAll(".galaxy-l3")).toHaveLength(3);
    expect(l3.querySelector(".galaxy-l3")).not.toBeNull();
    expect(l4.querySelector(".galaxy-l3")).not.toBeNull();
    expect(l5.querySelector(".galaxy-l3")).not.toBeNull();
    // The 3 joyful figure members ride L4 (none leak onto L3 or L5)…
    expect(l4.querySelectorAll('.mem-star[data-mood="joyful"]')).toHaveLength(
      3,
    );
    expect(l3.querySelectorAll('.mem-star[data-mood="joyful"]')).toHaveLength(
      0,
    );
    expect(l5.querySelectorAll('.mem-star[data-mood="joyful"]')).toHaveLength(
      0,
    );
    // …and Mom's deep star (never a member) rides the L5 dedication plane, off L3/L4.
    expect(
      l5.querySelectorAll('.mem-star[data-mood="nostalgic"]'),
    ).toHaveLength(1);
    expect(
      l3.querySelectorAll('.mem-star[data-mood="nostalgic"]'),
    ).toHaveLength(0);
    expect(
      l4.querySelectorAll('.mem-star[data-mood="nostalgic"]'),
    ).toHaveLength(0);
  });

  it("rides Mom's deep star on an L5 plane stacked above L4 (owner #243 follow-up)", () => {
    renderWithFigure();
    const camera = document.querySelector(
      ".galaxy-stage__camera",
    ) as HTMLElement;
    const l4 = camera.querySelector(".galaxy-l4-wrap") as HTMLElement;
    const l5 = camera.querySelector(".galaxy-l5-wrap") as HTMLElement;
    expect(l5).not.toBeNull();
    // L5 is a sibling of L4 inside the camera, ordered AFTER it (the nearest plane).
    expect(l5.parentElement).toBe(camera);
    expect(
      l4.compareDocumentPosition(l5) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("moves the ConstellationOverlay onto L4 with its members", () => {
    renderWithFigure();
    const l3 = document.querySelector(".galaxy-l3-wrap") as HTMLElement;
    const l4 = document.querySelector(".galaxy-l4-wrap") as HTMLElement;
    expect(l4.querySelector(".galaxy-constellation")).not.toBeNull();
    expect(l3.querySelector(".galaxy-constellation")).toBeNull();
  });

  it("keeps the L4/L5 foreground wrappers pointer-transparent so they never swallow lower-plane stars (Mom-unclickable regression #243)", () => {
    // The figure (L4) + Mom (L5) planes are full-bleed `inset-0` ABOVE L3. If their
    // wrapper captured the pointer it would eat every click over the loose stars
    // beneath — which is exactly how Mom's star became unclickable. The wrappers must
    // stay `pointer-events-none` (the member/Mom stars opt back in via `.mem-star`).
    renderWithFigure();
    const l4 = document.querySelector(".galaxy-l4-wrap") as HTMLElement;
    const l5 = document.querySelector(".galaxy-l5-wrap") as HTMLElement;
    expect(l4.className).toContain("pointer-events-none");
    expect(l5.className).toContain("pointer-events-none");
  });

  it("carries the same Local-Group hide gate as L3 (L4 + L5 hide on the LG overview)", () => {
    stubReducedMotion(true);
    render(<GalaxyStage userStars={joyMembers(3)} />);
    // At the LG landing the memory interior (all planes) hides.
    const l4 = document.querySelector(".galaxy-l4-wrap") as HTMLElement;
    const l5 = document.querySelector(".galaxy-l5-wrap") as HTMLElement;
    expect(l4.className).toContain("invisible");
    expect(l4.className).toContain("opacity-0");
    expect(l5.className).toContain("invisible");
    expect(l5.className).toContain("opacity-0");
    // Diving into the MW lifts the visibility gate, but the wrappers stay
    // pointer-transparent (that is always-on now, not part of the LG gate).
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.wheel(stage, { deltaY: -12 });
    expect(l4.className).not.toContain("invisible");
    expect(l5.className).not.toContain("invisible");
    expect(l4.className).toContain("pointer-events-none");
    expect(l5.className).toContain("pointer-events-none");
  });

  it("keeps both layers interactive — clicking a figure member on L4 opens its card", () => {
    renderWithFigure();
    const l4 = document.querySelector(".galaxy-l4-wrap") as HTMLElement;
    const member = l4.querySelector<HTMLButtonElement>(
      '.mem-star[data-mood="joyful"] button',
    );
    expect(member).not.toBeNull();
    fireEvent.click(member as HTMLElement);
    expect(document.querySelector(".galaxy-card-backdrop")).not.toBeNull();
  });

  it("clicking Mom's star on L5 opens her card (the unclickable-regression guard #243)", () => {
    // The whole point of the pointer-events fix: the full-bleed L4/L5 wrappers must NOT
    // swallow the click. Mom rides L5 as the topmost plane, so this is the strongest guard
    // that a foreground plane stays click-through to its own star.
    renderWithFigure();
    const l5 = document.querySelector(".galaxy-l5-wrap") as HTMLElement;
    const mom = l5.querySelector<HTMLButtonElement>(
      '.mem-star[data-mood="nostalgic"] button',
    );
    expect(mom).not.toBeNull();
    fireEvent.click(mom as HTMLElement);
    expect(document.querySelector(".galaxy-card-backdrop")).not.toBeNull();
  });
});

describe("GalaxyStage — wayfinding deep-links (#129)", () => {
  // All snap-path (reduced motion): the dive + the focus land without racing
  // GSAP's ticker — the eased flights themselves are pinned in
  // useGalaxyCamera.test.tsx; these specs pin the URL → nav/focus WIRING.
  // The seeded sky is deterministic, so the expected star framing is derived
  // from the same pure math the camera paints with (the #166 house pattern).
  const seeded = buildSeedSky();
  // ADR-0018 §3: deep-link arrivals focus at DEEPLINK_FRAMING_ZOOM (1.15), not
  // the default close-up zoom (1.8). Pass it explicitly so the expectation matches
  // the actual camera move the stage drives.
  const framingOf = (id: string): string => {
    const target = resolveFocusTarget(seeded, id, DEEPLINK_FRAMING_ZOOM);
    if (!target) throw new Error(`seed star missing: ${id}`);
    return cameraTransform(target);
  };
  /** The seed sky is Mom-only now — focus her star (the deep exclusions are
   * hover-affordance rules, not focus rules, so Mom is a valid focus target). */
  const starId = seeded.stars[0].id;

  // AC1 — `?at=galaxy:home` focuses + ENTERS the node on load.
  it("?at=galaxy:home enters the Milky Way on load and ASTRO narrates the arrival", () => {
    stubReducedMotion(true);
    render(<GalaxyStage deepLink={{ at: "galaxy:home" }} />);
    expect(screen.getByText("100k ly")).toBeTruthy(); // MW scale net
    expect(screen.queryByText("2.5 Mly")).toBeNull(); // LG landing left
    expect(screen.getByText(en.astroNarration.onArrival.galaxy)).toBeTruthy();
  });

  // AC2 — `?star=<id>` resolves the star across tiers: dives to its containing
  // tier, then the camera lands exactly on the star's eased-focus framing
  // (at DEEPLINK_FRAMING_ZOOM — ADR-0018 §3). The focus is FLUSHED ON ARRIVE
  // (focusing mid-flight would kill the #167 timeline and strand the scene swap),
  // so the framing assertion waits.
  it("?star=<id> dives to the star's tier and lands the camera on its framing", async () => {
    stubReducedMotion(true);
    render(<GalaxyStage deepLink={{ star: starId }} />);
    expect(screen.getByText("100k ly")).toBeTruthy();
    const camEl = document.querySelector(
      ".galaxy-stage__camera",
    ) as HTMLElement;
    expect(camEl).not.toBeNull();
    await waitFor(() => expect(camEl.style.transform).toBe(framingOf(starId)));
  });

  // `at` + `star` compose: the place owns the dive, the star rides the arrival.
  it("?at=galaxy:home&star=<id> dives and the star focus rides the arrival", async () => {
    stubReducedMotion(true);
    render(<GalaxyStage deepLink={{ at: "galaxy:home", star: starId }} />);
    expect(screen.getByText("100k ly")).toBeTruthy();
    const camEl = document.querySelector(
      ".galaxy-stage__camera",
    ) as HTMLElement;
    await waitFor(() => expect(camEl.style.transform).toBe(framingOf(starId)));
  });

  // AC3 — invalid ids fall back gracefully: the default LG landing, no
  // transition, no stray narration, no crash.
  it("unknown ids fall back to the default Local-Group landing", () => {
    stubReducedMotion(true);
    render(<GalaxyStage deepLink={{ at: "galaxy:nope", star: "ghost" }} />);
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.queryByText("100k ly")).toBeNull();
    expect(screen.queryByText(en.astroNarration.onArrival.galaxy)).toBeNull();
  });

  // No deep-link at all → byte-identical landing (the prop is optional).
  it("renders the plain landing when no deep-link params are present", () => {
    stubReducedMotion(true);
    render(<GalaxyStage deepLink={{}} />);
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.queryByText("100k ly")).toBeNull();
  });
});

describe("GalaxyStage — discovery search → focus-on-star (#113)", () => {
  // Reuse the deep-link suite's pure framing helpers: selecting a search result
  // must land the camera on exactly the focus-on-star (#111) framing — the same
  // math the deep-link path lands on, proving the search reuses the primitive.
  const seeded = buildSeedSky();
  const framingOf = (id: string): string => {
    const target = resolveFocusTarget(seeded, id);
    if (!target) throw new Error(`seed star missing: ${id}`);
    return cameraTransform(target);
  };

  // The search lives at the Milky-Way tier (the memory stars' home); it is absent
  // on the Local-Group landing where the memory layer hides.
  it("the search combobox is hidden on the Local-Group landing, present after diving into the Milky Way", () => {
    stubReducedMotion(true);
    render(<GalaxyStage />);
    expect(
      screen.queryByRole("combobox", { name: en.search.label }),
    ).toBeNull();
    const stage = document.querySelector(".galaxy-stage") as HTMLElement;
    fireEvent.wheel(stage, { deltaY: -12 }); // dive into the MW
    expect(
      screen.getByRole("combobox", { name: en.search.label }),
    ).toBeTruthy();
  });

  it("selecting a result frames that star — the camera lands on its focus-on-star framing", async () => {
    renderDivedIntoMilkyWay();
    const input = screen.getByRole("combobox", { name: en.search.label });
    // Mom's "for mom" star is the only seeded memory star now.
    fireEvent.change(input, { target: { value: "for mom" } });
    fireEvent.click(screen.getByRole("option", { name: "Go to for mom" }));
    const camEl = document.querySelector(
      ".galaxy-stage__camera",
    ) as HTMLElement;
    expect(camEl).not.toBeNull();
    await waitFor(() => expect(camEl.style.transform).toBe(framingOf("irina")));
  });
});
