// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Drive the active locale from a hoisted stub (the component still resolves its
// copy through getMessages(useLocale())).
const stub = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => stub.locale,
}));

import { AstroHub } from "#/components/galaxy/AstroHub";
import type { PillContext } from "#/lib/galaxy/astro-pills";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

const make = (
  over: Partial<MemoryStar> & Pick<MemoryStar, "id">,
): MemoryStar => ({
  text: "a quiet memory.",
  mood: "peaceful",
  color: "#abcdef",
  r: 0.3,
  angle: 1,
  brightness: 0.8,
  createdAt: 1,
  ...over,
});

const STARS: readonly MemoryStar[] = [
  make({
    id: "star-1",
    name: "Irina",
    text: "her steady light",
    mood: "tender",
  }),
  make({
    id: "s02",
    name: "kitchen radio",
    text: "dad dancing",
    mood: "joyful",
  }),
];

const HOME_GALAXY: PillContext = { tier: "galaxy", galaxyId: "home" };

type Handlers = Parameters<typeof AstroHub>[0];

const renderHub = (over: Partial<Handlers> = {}) => {
  const props: Handlers = {
    stars: STARS,
    ctx: HOME_GALAXY,
    variant: "a",
    onSelect: vi.fn(),
    onTierSelect: vi.fn(),
    onDive: vi.fn(),
    onSpeak: vi.fn(),
    narrate: vi.fn().mockResolvedValue(null),
    ...over,
  };
  render(<AstroHub {...props} />);
  return props;
};

const input = () => screen.getByRole("combobox", { name: en.search.label });

afterEach(() => {
  stub.locale = "en";
});

describe("AstroHub — search combobox a11y (AC10)", () => {
  it("renders an always-visible labelled combobox and a results listbox", () => {
    renderHub();
    expect(input()).toBeTruthy();
    expect(
      screen.getByRole("listbox", { name: en.search.results }),
    ).toBeTruthy();
  });

  it("typing filters via searchStars and renders one option per match", () => {
    renderHub();
    fireEvent.change(input(), { target: { value: "Irina" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Go to Irina" })).toBeTruthy();
  });

  it("marks the active option with aria-activedescendant + aria-selected", () => {
    renderHub();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const active = input().getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(
      document.getElementById(active as string)?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("Escape clears the query", () => {
    renderHub();
    fireEvent.change(input(), { target: { value: "kitchen" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect((input() as HTMLInputElement).value).toBe("");
  });
});

describe("AstroHub — selecting a result frames the star (AC5)", () => {
  it("clicking a result calls onSelect('star-1') (→ focusStar)", () => {
    const { onSelect } = renderHub();
    fireEvent.change(input(), { target: { value: "Irina" } });
    fireEvent.click(screen.getByRole("option", { name: "Go to Irina" }));
    expect(onSelect).toHaveBeenCalledWith("star-1");
  });

  it("speaks the found line on select (AC4)", () => {
    const { onSpeak } = renderHub();
    fireEvent.change(input(), { target: { value: "Irina" } });
    fireEvent.click(screen.getByRole("option", { name: "Go to Irina" }));
    expect(onSpeak).toHaveBeenCalledWith("Flying you to Irina.");
  });

  it("speaks the notFound line on a zero-result Enter (AC4)", () => {
    const { onSpeak, onSelect } = renderHub();
    fireEvent.change(input(), { target: { value: "zzzznope" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onSpeak).toHaveBeenCalledWith(en.astroHub.notFound);
  });
});

describe("AstroHub — fast-action pills (AC8)", () => {
  it("renders the pills in a labelled group of real buttons", () => {
    renderHub();
    const group = screen.getByRole("group", { name: en.astroHub.pillGroup });
    expect(
      within(group).getByRole("button", { name: en.astroHub.pills.sol }),
    ).toBeTruthy();
    expect(
      within(group).getByRole("button", { name: en.astroHub.pills.earth }),
    ).toBeTruthy();
  });

  it("a 'Sol' nav pill dives via onDive('sol-system','solarSystem')", () => {
    const { onDive } = renderHub();
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.sol }),
    );
    expect(onDive).toHaveBeenCalledWith("sol-system", "solarSystem");
  });

  it("a 'Back out' nav pill ascends via onTierSelect(localGroup)", () => {
    const { onTierSelect } = renderHub();
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.back }),
    );
    expect(onTierSelect).toHaveBeenCalledWith("localGroup");
  });

  it("a 'sayLine' prompt pill speaks the canned catalog line", () => {
    const { onSpeak } = renderHub();
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.whoAreYou }),
    );
    expect(onSpeak).toHaveBeenCalledWith(en.astroHub.lines.whoAreYou);
  });

  it("a 'speakLore' prompt pill speaks the narrateFn result when present", async () => {
    const narrate = vi
      .fn()
      .mockResolvedValue("Earth is the third world from the Sun.");
    const { onSpeak } = renderHub({ narrate });
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.earth }),
    );
    expect(narrate).toHaveBeenCalledWith({
      key: "earth",
      subject: en.lore.earth.name,
    });
    await vi.waitFor(() =>
      expect(onSpeak).toHaveBeenCalledWith(
        "Earth is the third world from the Sun.",
      ),
    );
  });

  it("a 'speakLore' prompt pill falls back to lore.line when narrateFn returns null (AC8)", async () => {
    const narrate = vi.fn().mockResolvedValue(null);
    const { onSpeak } = renderHub({ narrate });
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.earth }),
    );
    await vi.waitFor(() =>
      expect(onSpeak).toHaveBeenCalledWith(en.lore.earth.line),
    );
  });

  it("hides the 'Sol' pill outside the home Milky Way (tier-aware, AC8)", () => {
    renderHub({ ctx: { tier: "galaxy", galaxyId: "andromeda" } });
    expect(
      screen.queryByRole("button", { name: en.astroHub.pills.sol }),
    ).toBeNull();
  });
});

describe("AstroHub — i18n (no hardcoded chrome)", () => {
  it("renders localized ru pill labels from the catalog", () => {
    stub.locale = "ru";
    renderHub();
    expect(
      screen.getByRole("group", { name: ru.astroHub.pillGroup }),
    ).toBeTruthy();
  });
});
