// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Card } from "#/components/galaxy/Card";
import {
  type CardTarget,
  resolveCardTarget,
} from "#/components/galaxy/card-model";
import { useCard } from "#/components/galaxy/useCard";
import { REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import type { MemoryStar } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID) as CardTarget;
const andromeda = REAL_OBJECTS.find((o) => o.id === "andromeda") as CardTarget;

const memoryStar: MemoryStar = {
  id: "s01",
  text: "dad dancing badly in the kitchen while the radio played.",
  name: "kitchen radio",
  mood: "joyful",
  who: "marco",
  color: "#f0c987",
  r: 0.5,
  angle: 0.2,
  brightness: 0.7,
  createdAt: 1748000000000,
  group: "bright-days",
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Force `prefers-reduced-motion` for the reduced-motion test. */
const mockReducedMotion = (reduced: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

describe("Card — lore skin (RealObject → ASTRO FIELD LOG)", () => {
  it("shows the FIELD LOG eyebrow, the object name, real distance, and the lore line", () => {
    render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={() => {}} />,
    );
    expect(screen.getByText(en.card.fieldLog)).toBeTruthy();
    expect(screen.getByText(en.lore.sol.name)).toBeTruthy();
    expect(screen.getByText(en.lore.sol.sublabel)).toBeTruthy();
    expect(screen.getByText(en.lore.sol.line)).toBeTruthy();
  });

  it("localizes the lore copy from the Russian catalog", () => {
    render(
      <Card
        model={resolveCardTarget(andromeda)}
        messages={ru}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(ru.card.fieldLog)).toBeTruthy();
    expect(screen.getByText(ru.lore.andromeda.name)).toBeTruthy();
    expect(screen.getByText(ru.lore.andromeda.line)).toBeTruthy();
  });
});

describe("Card — memory skin (MemoryStar → memory text + mood eyebrow)", () => {
  it("shows the mood eyebrow (in the mood label), the name, and the full memory text", () => {
    render(
      <Card
        model={resolveCardTarget(memoryStar)}
        messages={en}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(en.moods.joyful)).toBeTruthy();
    expect(screen.getByText(String(memoryStar.name))).toBeTruthy();
    expect(screen.getByText(memoryStar.text)).toBeTruthy();
  });

  it("tints the mood eyebrow with the agent-owned mood colour (never recoloured)", () => {
    const { container } = render(
      <Card
        model={resolveCardTarget(memoryStar)}
        messages={en}
        onClose={() => {}}
      />,
    );
    const panel = container.querySelector(".galaxy-card") as HTMLElement;
    expect(panel.style.getPropertyValue("--card-accent")).toBe("#f0c987");
  });

  it("does NOT render a lore FIELD LOG eyebrow on a memory card", () => {
    render(
      <Card
        model={resolveCardTarget(memoryStar)}
        messages={en}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(en.card.fieldLog)).toBeNull();
  });
});

describe("Card — trigger chip (#219 AC5, BR28)", () => {
  it("renders the `person` chip from card.trigger.person when trigger is person", () => {
    const star: MemoryStar = { ...memoryStar, trigger: "person" };
    render(
      <Card model={resolveCardTarget(star)} messages={en} onClose={() => {}} />,
    );
    expect(screen.getByText(en.card.trigger.person)).toBeTruthy();
  });

  it("renders the `action` chip (moment) when trigger is action", () => {
    const star: MemoryStar = { ...memoryStar, trigger: "action" };
    render(
      <Card model={resolveCardTarget(star)} messages={en} onClose={() => {}} />,
    );
    expect(screen.getByText(en.card.trigger.action)).toBeTruthy();
  });

  it("localizes the trigger chip from the ru catalog", () => {
    const star: MemoryStar = { ...memoryStar, trigger: "person" };
    render(
      <Card model={resolveCardTarget(star)} messages={ru} onClose={() => {}} />,
    );
    expect(screen.getByText(ru.card.trigger.person)).toBeTruthy();
  });

  it("renders NO trigger chip when the star has no trigger (back-compat)", () => {
    render(
      <Card
        model={resolveCardTarget(memoryStar)}
        messages={en}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(en.card.trigger.person)).toBeNull();
    expect(screen.queryByText(en.card.trigger.action)).toBeNull();
  });
});

describe("Card — dismiss, keyboard, focus, reduced-motion", () => {
  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: en.card.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={onClose} />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a keyboard-focusable dialog and takes focus on open", () => {
    render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);
  });

  it("marks reduced-motion so the open is instant (no entrance animation)", () => {
    mockReducedMotion(true);
    const { container } = render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={() => {}} />,
    );
    const panel = container.querySelector(".galaxy-card") as HTMLElement;
    expect(panel.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("animates the open when motion is allowed", () => {
    mockReducedMotion(false);
    const { container } = render(
      <Card model={resolveCardTarget(sol)} messages={en} onClose={() => {}} />,
    );
    const panel = container.querySelector(".galaxy-card") as HTMLElement;
    expect(panel.getAttribute("data-reduced-motion")).toBeNull();
  });
});

describe("useCard — open / dismiss / one-at-a-time", () => {
  it("starts closed (no model)", () => {
    const { result } = renderHook(() => useCard());
    expect(result.current.model).toBeNull();
  });

  it("openCard(realObject) yields a lore model", () => {
    const { result } = renderHook(() => useCard());
    act(() => result.current.openCard(sol));
    expect(result.current.model?.skin).toBe("lore");
    expect(result.current.model?.id).toBe(SOL_ID);
  });

  it("openCard(memoryStar) yields a memory model", () => {
    const { result } = renderHook(() => useCard());
    act(() => result.current.openCard(memoryStar));
    expect(result.current.model?.skin).toBe("memory");
    expect(result.current.model?.id).toBe("s01");
  });

  it("opening a second target replaces the first — one at a time", () => {
    const { result } = renderHook(() => useCard());
    act(() => result.current.openCard(sol));
    act(() => result.current.openCard(memoryStar));
    expect(result.current.model?.id).toBe("s01");
  });

  it("close clears the model", () => {
    const { result } = renderHook(() => useCard());
    act(() => result.current.openCard(sol));
    act(() => result.current.close());
    expect(result.current.model).toBeNull();
  });

  it("exposes the raw open target too (for deep-link / focus reuse)", () => {
    const { result } = renderHook(() => useCard());
    act(() => result.current.openCard(sol));
    expect(result.current.target).toBe(sol);
  });
});
