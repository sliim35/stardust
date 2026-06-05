// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The host resolves the active locale from the router; stub it so the test needs
// no router bootstrap. The host still really calls `getMessages(useLocale())`.
vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { CardHost, useCardContext } from "#/components/galaxy/CardHost";
import type { CardTarget } from "#/components/galaxy/card-model";
import { REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID) as CardTarget;

const memoryStar: MemoryStar = {
  id: "s01",
  text: "dad dancing badly in the kitchen.",
  name: "kitchen radio",
  mood: "joyful",
  who: "marco",
  color: "#f0c987",
  r: 0.5,
  angle: 0.2,
  brightness: 0.7,
  createdAt: 1748000000000,
};

/** A tiny consumer that calls the context `openCard`/`close` API on button click. */
const Trigger = () => {
  const { openCard, close } = useCardContext();
  return (
    <>
      <button type="button" onClick={() => openCard(sol)}>
        open-lore
      </button>
      <button type="button" onClick={() => openCard(memoryStar)}>
        open-memory
      </button>
      <button type="button" onClick={() => close()}>
        close
      </button>
    </>
  );
};

const renderHost = () =>
  render(
    <CardHost>
      <Trigger />
    </CardHost>,
  );

describe("CardHost — the openCard API + one-at-a-time rendering", () => {
  it("renders no card until openCard is called", () => {
    renderHost();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("openCard(realObject) renders the lore card", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(en.card.fieldLog)).toBeTruthy();
    expect(screen.getByText(en.lore.sol.line)).toBeTruthy();
  });

  it("openCard(memoryStar) renders the memory card", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-memory"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(memoryStar.text)).toBeTruthy();
  });

  it("opening a second target replaces the first — one card at a time", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    fireEvent.click(screen.getByText("open-memory"));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(screen.getByText(memoryStar.text)).toBeTruthy();
    expect(screen.queryByText(en.lore.sol.line)).toBeNull();
  });

  it("dismisses via the card close button", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    fireEvent.click(screen.getByRole("button", { name: en.card.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismisses via Escape", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismisses when the backdrop (outside the panel) is clicked", () => {
    const { container } = renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    const backdrop = container.querySelector(
      ".galaxy-card-backdrop",
    ) as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does NOT dismiss when the panel itself is clicked", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("dismisses via the context close() API", () => {
    renderHost();
    fireEvent.click(screen.getByText("open-lore"));
    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
