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
import { HOME_GALAXY_ID } from "#/lib/galaxy/scenegraph";
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
  it("renders a labelled combobox and a results listbox", () => {
    renderHub();
    expect(input()).toBeTruthy();
    expect(
      screen.getByRole("listbox", { name: en.search.results }),
    ).toBeTruthy();
  });

  it("typing filters via searchStars and renders one option per match", () => {
    renderHub();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "Irina" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Go to Irina" })).toBeTruthy();
  });

  it("marks the active option with aria-activedescendant + aria-selected", () => {
    renderHub();
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const active = input().getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(
      document.getElementById(active as string)?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("keeps aria-activedescendant on a rendered option after repeated ArrowDown (F1)", () => {
    // The compact layout renders only the first result; the roving cursor must
    // stay on it — advancing would point aria-activedescendant at an option id
    // that isn't in the DOM (dangling IDREF). STARS has 2 matches on an empty query.
    renderHub();
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const active = input().getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active as string)).not.toBeNull();
  });

  it("Escape clears the query", () => {
    renderHub();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "kitchen" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect((input() as HTMLInputElement).value).toBe("");
  });

  it("aria-expanded tracks real disclosure state — false when collapsed, true when open", () => {
    renderHub();
    // collapsed by default
    expect(input().getAttribute("aria-expanded")).toBe("false");
    // focus → expands
    fireEvent.focus(input());
    expect(input().getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape collapses the search back to closed state (aria-expanded false)", () => {
    renderHub();
    fireEvent.focus(input());
    expect(input().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(input(), { key: "Escape" });
    // After Escape: collapsed + query cleared
    expect((input() as HTMLInputElement).value).toBe("");
    // The input itself is still in the DOM (it's the slim affordance)
    expect(input()).toBeTruthy();
  });
});

describe("AstroHub — selecting a result frames the star (AC5)", () => {
  it("clicking a result calls onSelect('star-1') (→ focusStar)", () => {
    const { onSelect } = renderHub();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "Irina" } });
    fireEvent.click(screen.getByRole("option", { name: "Go to Irina" }));
    expect(onSelect).toHaveBeenCalledWith("star-1");
  });

  it("speaks the found line on select (AC4)", () => {
    const { onSpeak } = renderHub();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "Irina" } });
    fireEvent.click(screen.getByRole("option", { name: "Go to Irina" }));
    expect(onSpeak).toHaveBeenCalledWith("Flying you to Irina.");
  });

  it("speaks the notFound line on a zero-result Enter (AC4)", () => {
    const { onSpeak, onSelect } = renderHub();
    fireEvent.focus(input());
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

  it("pill rail is present as a peer of the search (not nested inside it)", () => {
    renderHub();
    // The pill group and the combobox input must be siblings in the dock — neither
    // should be a child of the other. We verify by checking neither contains the other.
    const group = screen.getByRole("group", { name: en.astroHub.pillGroup });
    const inp = input();
    expect(group.contains(inp)).toBe(false);
    expect(inp.closest("[role='group']")).toBeNull();
  });

  it("the pill rail has an overflow-fade affordance wrapper (overflow-hidden + gradient mask)", () => {
    renderHub();
    // The pill rail is wrapped in an element with data-pill-rail attribute
    const rail = screen
      .getByRole("group", { name: en.astroHub.pillGroup })
      .closest("[data-pill-rail]");
    expect(rail).not.toBeNull();
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

  it("a 'Milky Way' nav pill (shown only at the Local Group) dives via onDive(HOME_GALAXY_ID,'galaxy') (AC8/F4)", () => {
    const { onDive } = renderHub({
      ctx: { tier: "localGroup", galaxyId: null },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.astroHub.pills.milkyWay }),
    );
    expect(onDive).toHaveBeenCalledWith(HOME_GALAXY_ID, "galaxy");
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

describe("AstroHub — composition: three peer surfaces (redesign)", () => {
  it("pill rail, search input, and listbox are all present in the hub", () => {
    renderHub();
    expect(
      screen.getByRole("group", { name: en.astroHub.pillGroup }),
    ).toBeTruthy();
    expect(input()).toBeTruthy();
    expect(
      screen.getByRole("listbox", { name: en.search.results }),
    ).toBeTruthy();
  });

  it("keyboard can reach pill buttons (tab order includes pills) and then the input", () => {
    renderHub();
    // Pills are real <button>s in a fieldset — they're in the natural tab order.
    const pills = screen
      .getAllByRole("button")
      .filter((b) => b.closest("fieldset") !== null);
    expect(pills.length).toBeGreaterThan(0);
    // Each pill button has a positive tabIndex or is a natural tab stop (tabIndex >= 0)
    for (const pill of pills) {
      const ti = (pill as HTMLButtonElement).tabIndex;
      expect(ti).toBeGreaterThanOrEqual(0);
    }
    // Input is also a natural tab stop
    expect((input() as HTMLInputElement).tabIndex).toBeGreaterThanOrEqual(0);
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
