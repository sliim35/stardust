// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Resolve the active locale from a stub so the overlay needs no router bootstrap;
// the overlay (via ScaleNet) still really calls getMessages(useLocale()).
vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { ChromeOverlay } from "#/components/galaxy/ChromeOverlay";
import { en } from "#/lib/i18n/messages/en";

const noop = () => {};

describe("ChromeOverlay — wires the tier-aware scale net (#112)", () => {
  it("mounts the scale net with the Local-Group labels at the LG tier", () => {
    render(
      <ChromeOverlay
        count={3}
        palette="auroral"
        onPaletteChange={noop}
        tier="localGroup"
      />,
    );
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    expect(screen.getByRole("img", { name: en.scaleNet.label })).toBeTruthy();
  });

  it("relabels the scale net to the Milky-Way disk scale at the galaxy tier", () => {
    render(
      <ChromeOverlay
        count={3}
        palette="auroral"
        onPaletteChange={noop}
        tier="galaxy"
      />,
    );
    expect(screen.getByText("100k ly")).toBeTruthy();
    expect(screen.queryByText("2.5 Mly")).toBeNull();
  });

  it("drives the top-right breadcrumb from the displayed tier (LG active, MW dim)", () => {
    render(
      <ChromeOverlay
        count={3}
        palette="auroral"
        onPaletteChange={noop}
        tier="localGroup"
      />,
    );
    expect(
      screen.getByText(en.chrome.breadcrumb.localGroup).className,
    ).not.toContain("is-dim");
    expect(screen.getByText(en.chrome.breadcrumb.galaxy).className).toContain(
      "is-dim",
    );
  });

  it("passes the tier-transition narration through to ASTRO's bubble (#125)", () => {
    render(
      <ChromeOverlay
        count={3}
        palette="auroral"
        onPaletteChange={noop}
        tier="galaxy"
        narration="narration line"
        onNarrationDismiss={noop}
      />,
    );
    expect(screen.getByText("narration line")).toBeTruthy();
  });
});
