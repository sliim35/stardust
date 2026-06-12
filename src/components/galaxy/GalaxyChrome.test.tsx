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

describe("GalaxyChrome — live tier-driven breadcrumb (#112 §5.3)", () => {
  it("marks LOCAL GROUP active (aria-current, not a button) at the local-group tier", () => {
    render(<GalaxyChrome count={3} tier="localGroup" />);
    const active = screen.getByText(en.chrome.breadcrumb.localGroup);
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(active.tagName).not.toBe("BUTTON");
  });

  it("makes MILKY WAY the active segment at the galaxy tier", () => {
    render(<GalaxyChrome count={3} tier="galaxy" />);
    expect(
      screen
        .getByText(en.chrome.breadcrumb.galaxy)
        .getAttribute("aria-current"),
    ).toBe("location");
    expect(
      screen
        .getByText(en.chrome.breadcrumb.localGroup)
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("renders the localized ru segments and no hardcoded English copy (parity)", () => {
    stub.locale = "ru";
    render(<GalaxyChrome count={3} tier="galaxy" />);
    expect(
      screen
        .getByText(ru.chrome.breadcrumb.galaxy)
        .getAttribute("aria-current"),
    ).toBe("location");
    expect(screen.queryByText("MILKY WAY")).toBeNull();
    expect(screen.queryByText("LOCAL GROUP")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: ru.chrome.breadcrumbNav }),
    ).toBeTruthy();
  });
});

describe("GalaxyChrome — clickable breadcrumb nav (owner 2026-06-10)", () => {
  it("is a real labelled <nav>, not aria-hidden decoration", () => {
    render(<GalaxyChrome count={3} tier="localGroup" />);
    const nav = screen.getByRole("navigation", {
      name: en.chrome.breadcrumbNav,
    });
    expect(nav.getAttribute("aria-hidden")).toBeNull();
  });

  it("navigates: clicking MILKY WAY at the LG tier fires onTierSelect('galaxy')", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome count={3} tier="localGroup" onTierSelect={onTierSelect} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.chrome.breadcrumb.galaxy }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("galaxy");
  });

  it("navigates: clicking LOCAL GROUP at the galaxy tier fires onTierSelect('localGroup')", () => {
    const onTierSelect = vi.fn();
    render(
      <GalaxyChrome count={3} tier="galaxy" onTierSelect={onTierSelect} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.chrome.breadcrumb.localGroup }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("localGroup");
  });

  it("keeps the active segment and the deferred SOL tail inert (no buttons)", () => {
    render(<GalaxyChrome count={3} tier="localGroup" />);
    // Only one button: MILKY WAY (the other reachable tier). SOL = #127, inert.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe(en.chrome.breadcrumb.galaxy);
  });
});
