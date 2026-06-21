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
  // the SOL crumb; SOL is the deferred tier (#127) — present but inert.
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

  it("keeps the active segment and the deferred SOL tail inert (no buttons) at the LG tier", () => {
    render(<GalaxyChrome count={3} tier="localGroup" galaxyId={null} />);
    // Only one button: the galaxy crumb (the other reachable tier). LOCAL GROUP
    // is the active inert segment; SOL = #127, inert.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe(en.lore.milkyWay.name);
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
