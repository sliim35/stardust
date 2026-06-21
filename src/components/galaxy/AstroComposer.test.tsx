// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryStar } from "#/lib/galaxy/types";
import { interpolate } from "#/lib/i18n";
import { en } from "#/lib/i18n/messages/en";

vi.mock("#/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/i18n")>()),
  useLocale: () => "en" as const,
}));

// The server fns are the network edge — stub them so the form's two-step
// (propose → confirm → commit) wiring is tested without bindings (real
// D1/Workers-AI is QA's job).
const proposeStarFn = vi.fn();
const commitStarFn = vi.fn();
vi.mock("#/server/add-star", () => ({
  proposeStarFn: (...args: unknown[]) => proposeStarFn(...args),
  commitStarFn: (...args: unknown[]) => commitStarFn(...args),
}));

import { AstroComposer } from "#/components/galaxy/AstroComposer";

// Reset call history between tests so a prior commit's calls don't leak forward.
beforeEach(() => {
  vi.clearAllMocks();
});

const proposed: MemoryStar = {
  id: "u-1",
  text: "the rings of saturn",
  mood: "wonder",
  color: "#cbb8ef",
  r: 0.5,
  angle: 1.9,
  brightness: 0.7,
  createdAt: 1748100000000,
  group: "wonder",
  placement: { tier: "galaxy", parentId: "andromeda", r: 0.5, angle: 1.9 },
};

/** Type a memory and submit to reach the confirm step. */
const submitMemory = (value: string) => {
  fireEvent.change(screen.getByLabelText(en.chat.label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: en.chat.submit }));
};

describe("AstroComposer — write step", () => {
  it("renders the prompt, textarea, and submit from the en catalog", () => {
    render(<AstroComposer onSuccess={vi.fn()} />);
    const field = screen.getByLabelText(en.chat.label) as HTMLTextAreaElement;
    expect(field.placeholder).toBe(en.chat.placeholder);
    expect(screen.getByRole("button", { name: en.chat.submit })).toBeTruthy();
  });

  it("a rejected proposal shows the authored chat.error message and stays on the form", async () => {
    proposeStarFn.mockResolvedValueOnce({ ok: false, errorKey: "flagged" });
    const onSuccess = vi.fn();
    render(<AstroComposer onSuccess={onSuccess} />);
    submitMemory("spam");

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.flagged)).toBeTruthy(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(commitStarFn).not.toHaveBeenCalled();
  });

  it("a thrown propose fn maps to the authored failed message", async () => {
    proposeStarFn.mockRejectedValueOnce(new Error("network"));
    render(<AstroComposer onSuccess={vi.fn()} />);
    submitMemory("a memory");

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.failed)).toBeTruthy(),
    );
  });
});

describe("AstroComposer — confirm-first routing step (#219 AC2)", () => {
  it("surfaces the classified emotion + target galaxy before persisting", async () => {
    proposeStarFn.mockResolvedValueOnce({
      ok: true,
      star: proposed,
      hostGalaxyId: "andromeda",
    });
    render(<AstroComposer onSuccess={vi.fn()} />);
    submitMemory("the rings of saturn");

    const expected = interpolate(en.chat.confirm.prompt, {
      emotion: en.moods.wonder,
      galaxy: en.lore.andromeda.name,
    });
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
    // Nothing persisted yet — the user has not confirmed.
    expect(commitStarFn).not.toHaveBeenCalled();
  });

  it("on confirm: commits the proposed star and fires onSuccess with the saved star", async () => {
    proposeStarFn.mockResolvedValueOnce({
      ok: true,
      star: proposed,
      hostGalaxyId: "andromeda",
    });
    commitStarFn.mockResolvedValueOnce({ ok: true, star: proposed });
    const onSuccess = vi.fn();
    render(<AstroComposer onSuccess={onSuccess} />);
    submitMemory("the rings of saturn");

    await screen.findByRole("button", { name: en.chat.confirm.confirm });
    fireEvent.click(
      screen.getByRole("button", { name: en.chat.confirm.confirm }),
    );

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(proposed, en.chat.success),
    );
    expect(commitStarFn).toHaveBeenCalledWith({ data: proposed });
  });

  it("on back: returns to the textarea without persisting (catch a misroute)", async () => {
    proposeStarFn.mockResolvedValueOnce({
      ok: true,
      star: proposed,
      hostGalaxyId: "andromeda",
    });
    render(<AstroComposer onSuccess={vi.fn()} />);
    submitMemory("the rings of saturn");

    await screen.findByRole("button", { name: en.chat.confirm.back });
    fireEvent.click(screen.getByRole("button", { name: en.chat.confirm.back }));

    // Back on the write form; the typed text is preserved so it isn't lost.
    const field = (await screen.findByLabelText(
      en.chat.label,
    )) as HTMLTextAreaElement;
    expect(field.value).toBe("the rings of saturn");
    expect(commitStarFn).not.toHaveBeenCalled();
  });

  it("a failed commit shows the authored error and does NOT fire onSuccess", async () => {
    proposeStarFn.mockResolvedValueOnce({
      ok: true,
      star: proposed,
      hostGalaxyId: "andromeda",
    });
    commitStarFn.mockResolvedValueOnce({ ok: false, errorKey: "failed" });
    const onSuccess = vi.fn();
    render(<AstroComposer onSuccess={onSuccess} />);
    submitMemory("the rings of saturn");

    await screen.findByRole("button", { name: en.chat.confirm.confirm });
    fireEvent.click(
      screen.getByRole("button", { name: en.chat.confirm.confirm }),
    );

    await waitFor(() =>
      expect(screen.getByText(en.chat.error.failed)).toBeTruthy(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
