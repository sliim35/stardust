// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

// The server fn is the network edge — stub it so the form's success/error wiring
// is tested without bindings (real D1/Workers-AI is QA's job).
const addStarFn = vi.fn();
vi.mock("#/server/add-star", () => ({
  addStarFn: (...args: unknown[]) => addStarFn(...args),
}));

import { AstroComposer } from "#/components/galaxy/AstroComposer";

const savedStar: MemoryStar = {
  id: "u-1",
  text: "the blue door",
  mood: "wistful",
  color: "#c8d4e8",
  r: 0.5,
  angle: 1.9,
  brightness: 0.7,
  createdAt: 1748100000000,
};

describe("AstroComposer", () => {
  it("renders the prompt, textarea, and submit from the en catalog", () => {
    render(<AstroComposer onSuccess={vi.fn()} />);
    const field = screen.getByLabelText(en.chat.label) as HTMLTextAreaElement;
    expect(field.placeholder).toBe(en.chat.placeholder);
    expect(screen.getByRole("button", { name: en.chat.submit })).toBeTruthy();
  });

  it("on a successful submit: calls onSuccess with the star + the confirmation line", async () => {
    addStarFn.mockResolvedValueOnce({ ok: true, star: savedStar });
    const onSuccess = vi.fn();
    render(<AstroComposer onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "the blue door" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(savedStar, en.chat.success),
    );
    expect(addStarFn).toHaveBeenCalledWith({ data: "the blue door" });
  });

  it("on a rejection: shows the authored chat.error message and does NOT call onSuccess", async () => {
    addStarFn.mockResolvedValueOnce({ ok: false, errorKey: "flagged" });
    const onSuccess = vi.fn();
    render(<AstroComposer onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "spam" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.flagged)).toBeTruthy(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("a thrown server fn maps to the authored failed message", async () => {
    addStarFn.mockRejectedValueOnce(new Error("network"));
    render(<AstroComposer onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "a memory" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.failed)).toBeTruthy(),
    );
  });
});
