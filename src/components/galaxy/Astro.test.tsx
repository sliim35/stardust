// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

// Astro now hosts the add-star form (AstroComposer) in its bubble (#183 dir. A),
// which imports the confirm-first server fns (#219) at module scope — stub them so
// the bubble renders in jsdom without a binding.
const proposeStarFn = vi.fn();
const commitStarFn = vi.fn();
vi.mock("#/server/add-star", () => ({
  proposeStarFn: (...args: unknown[]) => proposeStarFn(...args),
  commitStarFn: (...args: unknown[]) => commitStarFn(...args),
}));

import { Astro } from "#/components/galaxy/Astro";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

describe("Astro — tier-transition narration takes the bubble (#125)", () => {
  it("greets on mount when no narration is active", () => {
    render(<Astro />);
    expect(screen.getByText(en.astro.greeting)).toBeTruthy();
  });

  it("an active narration line overrides the spoken line", () => {
    render(<Astro narration="narration line" />);
    expect(screen.getByText("narration line")).toBeTruthy();
    expect(screen.queryByText(en.astro.greeting)).toBeNull();
  });

  it("has no manual dismiss control on the bubble (owner 2026-06-25 — the line is ambient)", () => {
    // The ▾ collapse/dismiss button was removed: ASTRO's line just stays until a new
    // line replaces it (a timed tier narration auto-clears, or a sprite click clears
    // it — covered below). No "dismiss" button exists in either bubble state.
    const { rerender } = render(<Astro />);
    expect(screen.getByText(en.astro.greeting)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "dismiss" })).toBeNull();
    rerender(<Astro narration="narration line" />);
    expect(screen.getByText("narration line")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "dismiss" })).toBeNull();
  });

  it("clicking ASTRO during a narration clears it and speaks the next click line", () => {
    const onNarrationDismiss = vi.fn();
    const { rerender } = render(
      <Astro
        narration="narration line"
        onNarrationDismiss={onNarrationDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "hear from ASTRO" }));
    expect(onNarrationDismiss).toHaveBeenCalledTimes(1);
    rerender(
      <Astro narration={null} onNarrationDismiss={onNarrationDismiss} />,
    );
    expect(screen.getByText(en.astro.clickLines[0])).toBeTruthy();
  });
});

describe("Astro — add-star is a pill in the hub rail (#250 owner; #183 dir. A)", () => {
  const savedStar: MemoryStar = {
    id: "u-9",
    text: "a memory",
    mood: "tender",
    color: "#f0c0c0",
    r: 0.4,
    angle: 1.1,
    brightness: 0.6,
    createdAt: 1748100000000,
  };
  // The "Add your star" CTA moved OUT of the bubble into the hub's pill rail, so these
  // tests render Astro WITH a hub (galaxy tier); the pill shows only when add is wired.
  const HUB = {
    stars: [],
    ctx: { tier: "galaxy" as const, galaxyId: null },
    onSelect: vi.fn(),
    onTierSelect: vi.fn(),
    onDive: vi.fn(),
    onSpeak: vi.fn(),
    narrate: vi.fn().mockResolvedValue(null),
  };

  it("shows the 'Add your star' pill only when canAddStar + onStarAdded are set", () => {
    const { rerender } = render(<Astro hub={HUB} />);
    expect(screen.queryByRole("button", { name: en.chat.open })).toBeNull();
    rerender(<Astro hub={HUB} onStarAdded={vi.fn()} canAddStar />);
    expect(screen.getByRole("button", { name: en.chat.open })).toBeTruthy();
  });

  it("CTA opens the composer; propose → confirm → commit ignites + ASTRO speaks the confirmation", async () => {
    // Confirm-first (#219): submit proposes (no persist), the user confirms, commit ignites.
    proposeStarFn.mockResolvedValueOnce({
      ok: true,
      star: savedStar,
      hostGalaxyId: "home",
    });
    commitStarFn.mockResolvedValueOnce({ ok: true, star: savedStar });
    const onStarAdded = vi.fn();
    render(<Astro hub={HUB} onStarAdded={onStarAdded} canAddStar />);
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    // the composer is now in the bubble
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "a memory" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));
    // the routing confirmation appears; the user confirms
    await screen.findByRole("button", { name: en.chat.confirm.confirm });
    fireEvent.click(
      screen.getByRole("button", { name: en.chat.confirm.confirm }),
    );
    await waitFor(() => expect(onStarAdded).toHaveBeenCalledWith(savedStar));
    // ASTRO speaks the confirmation; the form is gone; the CTA is back
    expect(screen.getByText(en.chat.success)).toBeTruthy();
    expect(screen.queryByLabelText(en.chat.label)).toBeNull();
    expect(screen.getByRole("button", { name: en.chat.open })).toBeTruthy();
  });

  it("the composer's Cancel exits back to ASTRO's line (without closing ASTRO)", () => {
    render(<Astro hub={HUB} onStarAdded={vi.fn()} canAddStar />);
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    expect(screen.getByLabelText(en.chat.label)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.chat.cancel }));
    expect(screen.queryByLabelText(en.chat.label)).toBeNull();
    expect(screen.getByText(en.astro.greeting)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.chat.open })).toBeTruthy();
  });
});

describe("Astro — wide-panel HUD composition (Companion HUD design)", () => {
  it("renders the speech text inside the one wide glass panel", () => {
    const { container } = render(<Astro />);
    const panel = container.querySelector(".galaxy-astro__panel");
    expect(panel).not.toBeNull();
    // The greeting text lives inside the panel (one HUD, not separate boxes).
    expect(panel?.textContent).toContain(en.astro.greeting);
  });

  it("renders an ASTRO speaker tag on the panel (top-right marker)", () => {
    const { container } = render(<Astro />);
    const tag = container.querySelector(".galaxy-astro__panel-tag");
    expect(tag).not.toBeNull();
    expect(tag?.textContent).toBe("ASTRO");
    // aria-hidden — the spoken text is the live region, not the tag.
    expect(tag?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the pixel sprite as a sibling of the panel (sprite at the panel's edge)", () => {
    const { container } = render(<Astro />);
    const frame = container.querySelector(".galaxy-astro");
    const panel = container.querySelector(".galaxy-astro__panel");
    const sprite = container.querySelector(".galaxy-astro__hit");
    expect(frame).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(sprite).not.toBeNull();
    // Sprite is a direct child of the frame, NOT nested inside the panel.
    expect(panel?.contains(sprite ?? null)).toBe(false);
    expect(sprite?.parentElement).toBe(frame);
  });
});
