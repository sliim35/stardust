// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

// The server fn is the network edge — stub it so the composer's success/error
// wiring is tested without bindings (real D1/Workers-AI is QA's job).
const addStarFn = vi.fn();
vi.mock("#/server/add-star", () => ({
  addStarFn: (...args: unknown[]) => addStarFn(...args),
}));

import { MemoryComposer } from "#/components/galaxy/MemoryComposer";

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

const renderComposer = () => {
  const onStarAdded = vi.fn();
  const onConfirm = vi.fn();
  render(<MemoryComposer onStarAdded={onStarAdded} onConfirm={onConfirm} />);
  return { onStarAdded, onConfirm };
};

describe("MemoryComposer", () => {
  it("renders only the open trigger at rest (no panel until opened)", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: en.chat.open })).toBeTruthy();
    expect(screen.queryByLabelText(en.chat.label)).toBeNull();
  });

  it("opening reveals the labelled textarea + submit, all from the en catalog", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    const field = screen.getByLabelText(en.chat.label) as HTMLTextAreaElement;
    expect(field.placeholder).toBe(en.chat.placeholder);
    expect(screen.getByRole("button", { name: en.chat.submit })).toBeTruthy();
  });

  it("on a successful submit: ignites the star, confirms via narration, and closes", async () => {
    addStarFn.mockResolvedValueOnce({ ok: true, star: savedStar });
    const { onStarAdded, onConfirm } = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "the blue door" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() => expect(onStarAdded).toHaveBeenCalledWith(savedStar));
    expect(onConfirm).toHaveBeenCalledWith(en.chat.success);
    expect(addStarFn).toHaveBeenCalledWith({ data: "the blue door" });
    // panel closes back to the trigger
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en.chat.open })).toBeTruthy(),
    );
  });

  it("on a rejection: shows the authored chat.error message and does NOT ignite or confirm", async () => {
    addStarFn.mockResolvedValueOnce({ ok: false, errorKey: "flagged" });
    const { onStarAdded, onConfirm } = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "spam" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.flagged)).toBeTruthy(),
    );
    expect(onStarAdded).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    // panel stays open so the visitor can edit + retry
    expect(screen.getByLabelText(en.chat.label)).toBeTruthy();
  });

  it("a thrown server fn maps to the authored failed message", async () => {
    addStarFn.mockRejectedValueOnce(new Error("network"));
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: en.chat.open }));
    fireEvent.change(screen.getByLabelText(en.chat.label), {
      target: { value: "a memory" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.failed)).toBeTruthy(),
    );
  });
});
