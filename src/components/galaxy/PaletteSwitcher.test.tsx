// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Drive the active locale from a hoisted stub (the component still really
// resolves its copy through getMessages(useLocale())).
const stub = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => stub.locale,
}));

import { PaletteSwitcher } from "#/components/galaxy/PaletteSwitcher";
import { PALETTE_ORDER } from "#/lib/galaxy/palette";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

afterEach(() => {
  stub.locale = "en";
});

describe("PaletteSwitcher — quiet dots + reveal (owner redesign 2026-06-10)", () => {
  it("is a labelled group of NATIVE radios, one per palette, the value checked", () => {
    render(<PaletteSwitcher value="ember" onChange={() => {}} />);
    // fieldset + sr-only legend = the accessible group; native inputs = radios
    // (exclusive selection, browser-native group-tab + Arrow move-and-select).
    screen.getByRole("group", { name: en.chrome.backdrop.label });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(PALETTE_ORDER.length);
    expect(
      screen.getByRole("radio", { name: en.chrome.backdrop.ember }),
    ).toHaveProperty("checked", true);
  });

  it("selects on pick", () => {
    const onChange = vi.fn();
    render(<PaletteSwitcher value="ember" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("radio", { name: en.chrome.backdrop.ice }),
    );
    expect(onChange).toHaveBeenCalledWith("ice");
  });

  it("shares one radio name so the browser owns the exclusive-group semantics", () => {
    render(<PaletteSwitcher value="ember" onChange={() => {}} />);
    const names = new Set(
      screen.getAllByRole("radio").map((r) => r.getAttribute("name")),
    );
    expect(names.size).toBe(1);
  });

  it("renders the localized ru labels from the catalog (reveal copy + group name)", () => {
    stub.locale = "ru";
    render(<PaletteSwitcher value="ember" onChange={() => {}} />);
    screen.getByRole("group", { name: ru.chrome.backdrop.label });
    expect(screen.getByText(ru.chrome.backdrop.auroral)).toBeTruthy();
    expect(screen.queryByText(en.chrome.backdrop.auroral)).toBeNull();
  });
});
