// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Drive the active locale from a hoisted stub so each test can render either
// catalog without a router bootstrap; the component still really resolves its
// copy through getMessages(useLocale()).
const stub = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => stub.locale,
}));

import { GalaxyChrome } from "#/components/galaxy/GalaxyChrome";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

afterEach(() => {
  stub.locale = "en";
});

describe("GalaxyChrome — brand title block (owner relayout 2026-06-10)", () => {
  it("renders the Stardust wordmark with the live count as its tagline", () => {
    render(<GalaxyChrome count={11} tier="localGroup" />);
    expect(screen.getByText(en.chrome.brand)).toBeTruthy();
    expect(screen.getByText("11 memories, still growing")).toBeTruthy();
  });

  it("retired the dedication — no 'For Mom', no subtitle, no second count", () => {
    render(<GalaxyChrome count={11} tier="localGroup" />);
    expect(screen.queryByText("For Mom")).toBeNull();
    expect(screen.queryByText("A QUIET PLACE IN THE MILKY WAY")).toBeNull();
    expect(screen.getAllByText(/memories, still growing/)).toHaveLength(1);
  });
});

describe("GalaxyChrome — node-aware breadcrumb trail (BR21, #199)", () => {
  // AC3 — inside the home Milky Way at tier-2 the galaxy segment reads the
  // catalog's lore name (uppercased by CSS), NOT the retired constant "MILKY WAY".
  it("derives the home galaxy segment from lore.milkyWay.name (AC3)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const galaxy = screen.getByText(en.lore.milkyWay.name);
    expect(galaxy.getAttribute("aria-current")).toBe("location");
    // The retired `chrome.breadcrumb.galaxy` constant is gone from the trail.
    expect(screen.queryByText(en.chrome.breadcrumb.galaxy)).toBeNull();
  });

  // AC3 — the home MW carries the third (Solar-System) tier, so its trail keeps
  // the SOL crumb (now a built, navigable tier — ADR-0016 §4, #248).
  it("shows the SOL crumb only under the home Milky Way (AC3)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    expect(screen.getByText(en.chrome.breadcrumb.solarSystem)).toBeTruthy();
  });

  // AC1 — inside Andromeda the trail is two segments and the galaxy name is
  // Andromeda's lore name; there is no SOL crumb (neighbours stop at galaxy).
  it("inside Andromeda reads LOCAL GROUP › <ANDROMEDA> with no SOL crumb (AC1)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="andromeda" />);
    expect(screen.getByText(en.lore.andromeda.name)).toBeTruthy();
    expect(screen.getByText(en.chrome.breadcrumb.localGroup)).toBeTruthy();
    expect(screen.queryByText(en.chrome.breadcrumb.solarSystem)).toBeNull();
    // The home MW name never leaks into a neighbour's trail.
    expect(screen.queryByText(en.lore.milkyWay.name)).toBeNull();
  });

  // AC2 — LMC + Triangulum resolve their own lore names; still no SOL crumb.
  it("inside the LMC + Triangulum reads each neighbour's lore name (AC2)", () => {
    const { unmount } = render(
      <GalaxyChrome count={3} tier="galaxy" galaxyId="lmc" />,
    );
    expect(screen.getByText(en.lore.lmc.name)).toBeTruthy();
    expect(screen.queryByText(en.chrome.breadcrumb.solarSystem)).toBeNull();
    unmount();
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="triangulum" />);
    expect(screen.getByText(en.lore.triangulum.name)).toBeTruthy();
    expect(screen.queryByText(en.chrome.breadcrumb.solarSystem)).toBeNull();
  });

  // The active segment is marked at every tier; only the active one is inert.
  it("marks LOCAL GROUP active (aria-current, not a button) at the local-group tier (AC8)", () => {
    render(<GalaxyChrome count={3} tier="localGroup" galaxyId={null} />);
    const active = screen.getByText(en.chrome.breadcrumb.localGroup);
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(active.tagName).not.toBe("BUTTON");
  });

  // AC3 — at tier-3 (Solar System, MW only) the SOL crumb is the active segment.
  it("marks SOL active at the Solar-System tier inside the home MW (AC3)", () => {
    render(<GalaxyChrome count={3} tier="solarSystem" galaxyId="home" />);
    const sol = screen.getByText(en.chrome.breadcrumb.solarSystem);
    expect(sol.getAttribute("aria-current")).toBe("location");
  });

  // AC9 — the ru locale renders the Russian lore name, never hardcoded English.
  it("renders the localized ru galaxy name with no hardcoded English copy (AC9)", () => {
    stub.locale = "ru";
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="andromeda" />);
    const galaxy = screen.getByText(ru.lore.andromeda.name);
    expect(galaxy.getAttribute("aria-current")).toBe("location");
    expect(screen.queryByText(en.lore.andromeda.name)).toBeNull();
    expect(screen.queryByText("LOCAL GROUP")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: ru.chrome.breadcrumbNav }),
    ).toBeTruthy();
  });
});

describe("GalaxyChrome — clickable breadcrumb nav (owner 2026-06-10)", () => {
  it("is a real labelled <nav>, not aria-hidden decoration (AC8)", () => {
    render(<GalaxyChrome count={3} tier="localGroup" galaxyId={null} />);
    const nav = screen.getByRole("navigation", {
      name: en.chrome.breadcrumbNav,
    });
    expect(nav.getAttribute("aria-hidden")).toBeNull();
  });

  // AC5 — the galaxy crumb (non-active) fires onTierSelect('galaxy').
  it("navigates: clicking the galaxy crumb at the LG tier fires onTierSelect('galaxy') (AC5)", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome
        count={3}
        tier="localGroup"
        galaxyId={null}
        onTierSelect={onTierSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.lore.milkyWay.name }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("galaxy");
  });

  // AC4 — LOCAL GROUP is a button at any deeper tier and ascends.
  it("navigates: clicking LOCAL GROUP at the galaxy tier fires onTierSelect('localGroup') (AC4)", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome
        count={3}
        tier="galaxy"
        galaxyId="andromeda"
        onTierSelect={onTierSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.chrome.breadcrumb.localGroup }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("localGroup");
  });

  // AC5 — at the Solar-System tier the galaxy crumb is the (non-active) button.
  it("makes the galaxy crumb the only navigable ascent button at the SOL tier (AC5)", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome
        count={3}
        tier="solarSystem"
        galaxyId="home"
        onTierSelect={onTierSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.lore.milkyWay.name }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("galaxy");
  });

  // #248 (AC3) — the SOL crumb is no longer the inert #127 tail: with the
  // Solar-System tier built it is navigable when above tier 3. At the LG tier the
  // home trail (LOCAL GROUP active › MILKY WAY › SOL) now has TWO buttons — the
  // galaxy crumb AND SOL — and only the active LOCAL GROUP segment stays inert.
  it("makes both MILKY WAY and SOL navigable buttons at the LG tier (#248 AC3)", () => {
    render(<GalaxyChrome count={3} tier="localGroup" galaxyId={null} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      en.lore.milkyWay.name,
      en.chrome.breadcrumb.solarSystem,
    ]);
    // LOCAL GROUP is the active, inert segment — never a button.
    const active = screen.getByText(en.chrome.breadcrumb.localGroup);
    expect(active.tagName).not.toBe("BUTTON");
  });

  // #248 (AC3) — clicking the now-navigable SOL crumb (while above tier 3) fires
  // onTierSelect('solarSystem'); the stage maps that to the Sol dive.
  it("navigates: clicking SOL above tier 3 fires onTierSelect('solarSystem') (#248 AC3)", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome
        count={3}
        tier="galaxy"
        galaxyId="home"
        onTierSelect={onTierSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.chrome.breadcrumb.solarSystem }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("solarSystem");
  });

  // #248 (AC3) — at the Solar-System tier the SOL crumb is the ACTIVE segment
  // (aria-current), not a button, so it can't re-dive into itself.
  it("keeps SOL inert (active, not a button) at the Solar-System tier (#248 AC3)", () => {
    render(<GalaxyChrome count={3} tier="solarSystem" galaxyId="home" />);
    const sol = screen.getByText(en.chrome.breadcrumb.solarSystem);
    expect(sol.getAttribute("aria-current")).toBe("location");
    expect(sol.tagName).not.toBe("BUTTON");
  });

  // AC1 — a neighbour's trail has exactly one navigable ascent button (LOCAL
  // GROUP); the galaxy name is the active inert segment, and there is no SOL.
  it("inside a neighbour the only button is LOCAL GROUP (the single ascent)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="andromeda" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe(en.chrome.breadcrumb.localGroup);
  });
});

// ── #249 redesign — top-left, uppercase, left-anchored, colour-only active ──────
// These assert structure/classes (not pixel positions): jsdom has no layout, so
// the contract is the Tailwind class surface that drives placement + transform.
describe("GalaxyChrome — breadcrumb redesign (#249, BR35/BR36)", () => {
  const navOf = (locale = en) =>
    screen.getByRole("navigation", { name: locale.chrome.breadcrumbNav });

  // AC2 — every segment carries the `uppercase` transform, so the title-case
  // `lore.name` ("The Milky Way") RENDERS as THE MILKY WAY without mutating the
  // catalog string (the DOM text content stays title-case; CSS does the casing).
  it("AC2 — the galaxy segment is uppercased by CSS, catalog string untouched", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const galaxy = screen.getByText(en.lore.milkyWay.name);
    // The DOM text is the unmodified title-case catalog string …
    expect(galaxy.textContent).toBe("The Milky Way");
    // … and the visual uppercase comes from the Tailwind transform, not a
    // pre-uppercased string.
    expect(galaxy.className).toContain("uppercase");
  });

  // AC2 — the transform is uniform across the whole trail (active span, the
  // navigable ascent button, and the deferred SOL tail all carry `uppercase`).
  it("AC2 — uppercase applies to every segment (active, button, deferred)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const nav = navOf();
    const segments = nav.querySelectorAll("[data-breadcrumb-segment]");
    expect(segments.length).toBe(3);
    for (const seg of segments) {
      expect(seg.className).toContain("uppercase");
    }
  });

  // AC3 — the active segment differs from its siblings by COLOUR ONLY: same
  // font-size token (`text-eyebrow`), same family (`font-mono`), same case
  // (`uppercase`); only the colour class flips (`text-accent` vs `text-dim-3`),
  // and no segment carries an `underline` the others lack.
  it("AC3 — active differs by colour only (same size/family/case, no underline)", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const active = screen.getByText(en.lore.milkyWay.name); // tier === galaxy
    const lg = screen.getByText(en.chrome.breadcrumb.localGroup); // navigable
    const sol = screen.getByText(en.chrome.breadcrumb.solarSystem); // deferred
    const classesOf = (el: Element) => el.className.split(/\s+/);
    for (const el of [active, lg, sol]) {
      const cls = classesOf(el);
      expect(cls).toContain("font-mono"); // same family
      expect(cls).toContain("text-eyebrow"); // same size token
      expect(cls).toContain("uppercase"); // same case
      // No segment carries an underline the others lack (AC3).
      expect(cls.some((c) => c.includes("underline"))).toBe(false);
    }
    // Colour is the one salient difference (Von Restorff): the REST-state colour
    // token (a bare `text-*`, not a `hover:`/`focus-visible:` variant) — active is
    // accent, the siblings are dim.
    const restColour = (el: Element) =>
      classesOf(el).find((c) => /^text-(accent|dim-\d)$/.test(c));
    expect(restColour(active)).toBe("text-accent");
    expect(restColour(lg)).toBe("text-dim-3");
    expect(restColour(sol)).toBe("text-dim-3");
  });

  // AC1 — the breadcrumb nav is no longer top-right: it is left-anchored (no
  // `right-*`) and lives inside the same top-left wayfinding block as the brand.
  it("AC1 — breadcrumb is left-anchored, stacked under the brand/count block", () => {
    const { container } = render(
      <GalaxyChrome count={3} tier="galaxy" galaxyId="home" />,
    );
    const nav = navOf();
    // No top-right anchoring survives.
    expect(nav.className).not.toMatch(/(^|\s)right-/);
    // The nav shares the single top-left container with the brand wordmark.
    const block = container.querySelector("[data-wayfinding-block]");
    expect(block).not.toBeNull();
    expect(block?.contains(nav)).toBe(true);
    expect(block?.contains(screen.getByText(en.chrome.brand))).toBe(true);
  });

  // AC4 — the trail is a left-anchored row: segments flow left→right so the SOL
  // crumb is the rightmost (last) child and the leftmost crumbs never reorder.
  // 3-tier home: LOCAL GROUP › MILKY WAY › SOL, SOL last.
  it("AC4 — SOL is the rightmost (last) segment; leftmost stays LOCAL GROUP", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const nav = navOf();
    const segments = [...nav.querySelectorAll("[data-breadcrumb-segment]")];
    expect(segments[0]?.textContent).toBe(en.chrome.breadcrumb.localGroup);
    expect(segments.at(-1)?.textContent).toBe(en.chrome.breadcrumb.solarSystem);
  });

  // AC4 — dropping to 2 tiers (a neighbour) removes SOL from the right; the
  // leftmost segment is STILL LOCAL GROUP (no horizontal shift of existing crumbs).
  it("AC4 — 2-tier trail keeps LOCAL GROUP leftmost, no SOL on the right", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="andromeda" />);
    const nav = navOf();
    const segments = [...nav.querySelectorAll("[data-breadcrumb-segment]")];
    expect(segments).toHaveLength(2);
    expect(segments[0]?.textContent).toBe(en.chrome.breadcrumb.localGroup);
    expect(screen.queryByText(en.chrome.breadcrumb.solarSystem)).toBeNull();
  });

  // AC5 — the trail is capped at 3 segments; even a hypothetical 4-tier source
  // can never render a 4th crumb. `toBe(3)` (not `<= 3`) so a regression that
  // DROPS the SOL crumb (rendering only 2) also fails the cap gate.
  it("AC5 — renders exactly 3 segments at the deepest (home) trail", () => {
    // home is the deepest real trail (3 tiers); assert the hard cap holds.
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    const nav = navOf();
    const segments = nav.querySelectorAll("[data-breadcrumb-segment]");
    expect(segments.length).toBe(3);
  });

  // AC6 — the <620px hide is preserved (Tailwind `max-[620px]:hidden` on the nav).
  it("AC6 — preserves the <620px hide", () => {
    render(<GalaxyChrome count={3} tier="galaxy" galaxyId="home" />);
    expect(navOf().className).toContain("max-[620px]:hidden");
  });
});
