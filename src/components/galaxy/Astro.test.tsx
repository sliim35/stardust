// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

import { Astro } from "#/components/galaxy/Astro";
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

  it("shows the narration even after the bubble was dismissed", () => {
    const { rerender } = render(<Astro />);
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.queryByText(en.astro.greeting)).toBeNull();
    rerender(<Astro narration="narration line" />);
    expect(screen.getByText("narration line")).toBeTruthy();
  });

  it("dismissing a narration clears it via the owner's callback and closes the bubble", () => {
    const onNarrationDismiss = vi.fn();
    const { rerender } = render(
      <Astro
        narration="narration line"
        onNarrationDismiss={onNarrationDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(onNarrationDismiss).toHaveBeenCalledTimes(1);
    // The owner clears its state; the bubble is gone (not fallen back to the greeting).
    rerender(
      <Astro narration={null} onNarrationDismiss={onNarrationDismiss} />,
    );
    expect(screen.queryByText(en.astro.greeting)).toBeNull();
    expect(screen.queryByText("narration line")).toBeNull();
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
