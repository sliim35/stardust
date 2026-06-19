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

import { StarSearch } from "#/components/galaxy/StarSearch";
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
    id: "s01",
    name: "kitchen radio",
    text: "dad dancing in the kitchen",
    mood: "joyful",
    color: "#ffd166",
  }),
  make({
    id: "s02",
    name: "steady hands",
    text: "grandfather's steady hands",
    mood: "tender",
    color: "#e76f51",
  }),
  make({
    id: "s03",
    name: "the voicemail",
    text: "the voicemail I can't delete",
    mood: "grieving",
    color: "#5a6ea0",
  }),
];

const openInput = () => screen.getByRole("combobox", { name: en.search.label });

afterEach(() => {
  stub.locale = "en";
});

describe("StarSearch — accessible combobox semantics", () => {
  it("exposes a labelled combobox input and a results listbox", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    expect(openInput()).toBeTruthy();
    expect(
      screen.getByRole("listbox", { name: en.search.results }),
    ).toBeTruthy();
  });

  it("renders one option per matching star with an accessible name", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    fireEvent.change(openInput(), { target: { value: "kitchen" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "Go to kitchen radio" }),
    ).toBeTruthy();
  });

  it("shows the full index at rest (empty query)", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    expect(screen.getAllByRole("option")).toHaveLength(STARS.length);
  });

  it("announces a no-results state for a query that matches nothing", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    fireEvent.change(openInput(), { target: { value: "zzzznope" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(en.search.empty)).toBeTruthy();
  });
});

describe("StarSearch — selecting a result frames the star (focus primitive)", () => {
  it("clicking an option calls onSelect with that star id", () => {
    const onSelect = vi.fn();
    render(<StarSearch stars={STARS} onSelect={onSelect} />);
    fireEvent.change(openInput(), { target: { value: "voicemail" } });
    fireEvent.click(
      screen.getByRole("option", { name: "Go to the voicemail" }),
    );
    expect(onSelect).toHaveBeenCalledWith("s03");
  });

  it("ArrowDown then Enter selects the active option by id", () => {
    const onSelect = vi.fn();
    render(<StarSearch stars={STARS} onSelect={onSelect} />);
    const input = openInput();
    input.focus();
    // First ArrowDown activates the first option; second moves to the second.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("s02");
  });

  it("ArrowUp wraps / moves the active option upward", () => {
    const onSelect = vi.fn();
    render(<StarSearch stars={STARS} onSelect={onSelect} />);
    const input = openInput();
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" }); // → s01 active
    fireEvent.keyDown(input, { key: "ArrowUp" }); // wrap → s03 active (last)
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("s03");
  });

  it("Enter with no active option selects the first result", () => {
    const onSelect = vi.fn();
    render(<StarSearch stars={STARS} onSelect={onSelect} />);
    const input = openInput();
    fireEvent.change(input, { target: { value: "kitchen" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("s01");
  });

  it("marks the active option with aria-activedescendant + aria-selected", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    const input = openInput();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    const option = document.getElementById(active as string);
    expect(option?.getAttribute("aria-selected")).toBe("true");
  });

  it("Enter does nothing when there are no results", () => {
    const onSelect = vi.fn();
    render(<StarSearch stars={STARS} onSelect={onSelect} />);
    const input = openInput();
    fireEvent.change(input, { target: { value: "zzzznope" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("StarSearch — i18n (no hardcoded chrome)", () => {
  it("renders localized ru chrome from the catalog", () => {
    stub.locale = "ru";
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    expect(
      screen.getByRole("combobox", { name: ru.search.label }),
    ).toBeTruthy();
    expect(
      screen.getByRole("listbox", { name: ru.search.results }),
    ).toBeTruthy();
    // The placeholder + option name come from the ru catalog, not en.
    const input = screen.getByRole("combobox", { name: ru.search.label });
    expect(input.getAttribute("placeholder")).toBe(ru.search.placeholder);
  });

  it("announces the live result count via the catalog template", () => {
    render(<StarSearch stars={STARS} onSelect={() => {}} />);
    fireEvent.change(openInput(), { target: { value: "kitchen" } });
    // "1 memories found" — the count region is the live status.
    const status = screen.getByRole("status");
    expect(within(status).getByText(/1/)).toBeTruthy();
  });
});
