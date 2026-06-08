// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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

describe("GalaxyChrome — live tier-driven breadcrumb (#112 §5.3)", () => {
  it("makes LOCAL GROUP the active segment at the local-group tier; MILKY WAY + SOL dim", () => {
    render(<GalaxyChrome count={3} tier="localGroup" />);
    expect(
      screen.getByText(en.chrome.breadcrumb.localGroup).className,
    ).not.toContain("is-dim");
    expect(screen.getByText(en.chrome.breadcrumb.galaxy).className).toContain(
      "is-dim",
    );
    expect(
      screen.getByText(en.chrome.breadcrumb.solarSystem).className,
    ).toContain("is-dim");
  });

  it("makes MILKY WAY the active segment at the galaxy tier; LOCAL GROUP + SOL dim", () => {
    render(<GalaxyChrome count={3} tier="galaxy" />);
    expect(
      screen.getByText(en.chrome.breadcrumb.galaxy).className,
    ).not.toContain("is-dim");
    expect(
      screen.getByText(en.chrome.breadcrumb.localGroup).className,
    ).toContain("is-dim");
    expect(
      screen.getByText(en.chrome.breadcrumb.solarSystem).className,
    ).toContain("is-dim");
  });

  it("renders the localized ru segments and no hardcoded English copy (parity)", () => {
    stub.locale = "ru";
    render(<GalaxyChrome count={3} tier="galaxy" />);
    expect(
      screen.getByText(ru.chrome.breadcrumb.galaxy).className,
    ).not.toContain("is-dim");
    expect(
      screen.getByText(ru.chrome.breadcrumb.localGroup).className,
    ).toContain("is-dim");
    expect(
      screen.getByText(ru.chrome.breadcrumb.solarSystem).className,
    ).toContain("is-dim");
    // If any segment were hardcoded English it would still render here.
    expect(screen.queryByText("MILKY WAY")).toBeNull();
    expect(screen.queryByText("LOCAL GROUP")).toBeNull();
  });

  it("keeps the breadcrumb decorative (aria-hidden) — the sr-only h1 carries meaning", () => {
    const { container } = render(<GalaxyChrome count={3} tier="localGroup" />);
    expect(
      container
        .querySelector(".galaxy-chrome__breadcrumb")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
