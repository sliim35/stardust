// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LgGalaxyLabels } from "#/components/galaxy/LgGalaxyLabels";
import {
  type LgHitTarget,
  lgHitTargets,
  lgLabels,
} from "#/lib/galaxy/lg-composition";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";
import type { Messages } from "#/lib/i18n/types";

/**
 * The Local-Group titles, now CLICKABLE (#169). The hover-only title reveal
 * (#167) is preserved verbatim — at rest the scene shows NO titles; hovering or
 * keyboard-focusing a galaxy's hit-target fades its serif name + mono distance up
 * — but the hit-target is now a real `<button>` that DOES something: a click
 * routes through the shared `useObjectClick` seam (MW dive · neighbour lore card),
 * and hover/focus also paints the subtle #154 "clickable" highlight.
 *
 * Everything below derives from the composition module (`lgHitTargets` /
 * `lgLabels`) and the lore catalog — no magic positions or strings.
 */

const renderLabels = (
  lore: Messages["lore"] = en.lore,
  onSelect: (id: string) => void = () => {},
) =>
  render(
    <LgGalaxyLabels
      labels={lgLabels()}
      targets={lgHitTargets()}
      lore={lore}
      onSelect={onSelect}
    />,
  );

/** The target's accessible name — composed from the catalog, like the DOM label. */
const ariaName = (
  lore: Messages["lore"],
  t: { loreKey: LgHitTarget["loreKey"] },
) => `${lore[t.loreKey].name} · ${lore[t.loreKey].sublabel}`;

const targetByKey = (key: LgHitTarget["loreKey"]): LgHitTarget => {
  const t = lgHitTargets().find((x) => x.loreKey === key);
  if (!t) throw new Error(`no hit target for ${key}`);
  return t;
};

const labelEl = (key: LgHitTarget["loreKey"]): HTMLElement => {
  const el = screen.getByText(en.lore[key].name).closest("[data-lg-label]");
  if (!(el instanceof HTMLElement)) throw new Error(`no label node for ${key}`);
  return el;
};

/** The per-target clickable-highlight glow (#154 "real" affordance, #169). */
const glowEl = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-lg-glow="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no glow node for ${id}`);
  return el;
};

describe("LgGalaxyLabels — hover-only titles preserved (#167)", () => {
  it("shows zero visible titles at rest — every label starts faded out", () => {
    renderLabels();
    for (const l of lgLabels()) {
      expect(labelEl(l.loreKey).className).toContain("opacity-0");
      expect(labelEl(l.loreKey).className).not.toContain("opacity-100");
    }
  });

  it("hovering a target fades ONLY its title up; un-hover restores", () => {
    renderLabels();
    const andromeda = screen.getByRole("button", {
      name: ariaName(en.lore, targetByKey("andromeda")),
    });
    fireEvent.pointerEnter(andromeda);
    expect(labelEl("andromeda").className).toContain("opacity-100");
    for (const other of ["milkyWay", "triangulum", "lmc", "smc"] as const) {
      expect(labelEl(other).className).toContain("opacity-0");
    }
    fireEvent.pointerLeave(andromeda);
    expect(labelEl("andromeda").className).toContain("opacity-0");
  });

  it("keyboard focus drives the same reveal; blur restores", () => {
    renderLabels();
    const mw = screen.getByRole("button", {
      name: ariaName(en.lore, targetByKey("milkyWay")),
    });
    fireEvent.focus(mw);
    expect(labelEl("milkyWay").className).toContain("opacity-100");
    fireEvent.blur(mw);
    expect(labelEl("milkyWay").className).toContain("opacity-0");
  });

  it("aria-labels resolve from the ru catalog too — no new strings", () => {
    renderLabels(ru.lore);
    for (const t of lgHitTargets()) {
      expect(
        screen.getByRole("button", { name: ariaName(ru.lore, t) }),
      ).toBeTruthy();
    }
  });

  it("positions + sizes each target from the composition's silhouette reach", () => {
    renderLabels();
    for (const t of lgHitTargets()) {
      const target = screen.getByRole("button", { name: ariaName(en.lore, t) });
      expect(target.style.left).toBe(`${Math.round(t.x)}px`);
      expect(target.style.top).toBe(`${Math.round(t.y)}px`);
      expect(target.style.width).toBe(`${Math.round(t.halfW * 2)}px`);
      expect(target.style.height).toBe(`${Math.round(t.halfH * 2)}px`);
    }
  });

  it("fades via transition-opacity and snaps under prefers-reduced-motion (the mem-star pattern)", () => {
    renderLabels();
    for (const l of lgLabels()) {
      const el = labelEl(l.loreKey);
      expect(el.className).toContain("transition-opacity");
      expect(el.className).toContain("motion-reduce:transition-none");
    }
  });

  it("keeps the labels decorative (aria-hidden) — the accessible name lives on the target", () => {
    renderLabels();
    expect(
      screen.getByText(en.lore.andromeda.name).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});

describe("LgGalaxyLabels — clickable controls (#169)", () => {
  it("every target is a focusable <button type=button> with a catalog-resolved aria-label (en)", () => {
    renderLabels();
    for (const t of lgHitTargets()) {
      const target = screen.getByRole("button", { name: ariaName(en.lore, t) });
      // A native <button> is in the tab order AND Enter/Space-activatable for
      // free — that is the keyboard parity the #167 role="img" div faked.
      expect(target.tagName).toBe("BUTTON");
      expect(target.getAttribute("type")).toBe("button");
    }
  });

  it("clicking a target reports its composition id up through onSelect", () => {
    const onSelect = vi.fn();
    renderLabels(en.lore, onSelect);
    fireEvent.click(
      screen.getByRole("button", {
        name: ariaName(en.lore, targetByKey("andromeda")),
      }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    // The neighbour's id == its loreKey; the MW's id is "home" (≠ loreKey).
    expect(onSelect).toHaveBeenCalledWith("andromeda");
  });

  it("the Milky Way target reports the gateway id 'home' (not the loreKey)", () => {
    const onSelect = vi.fn();
    renderLabels(en.lore, onSelect);
    fireEvent.click(
      screen.getByRole("button", {
        name: ariaName(en.lore, targetByKey("milkyWay")),
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("home");
  });

  it("hover paints ONLY the active target's clickable highlight; un-hover restores", () => {
    renderLabels();
    const andromeda = screen.getByRole("button", {
      name: ariaName(en.lore, targetByKey("andromeda")),
    });
    fireEvent.pointerEnter(andromeda);
    expect(glowEl("andromeda").className).toContain("opacity-100");
    for (const id of ["home", "triangulum", "lmc", "smc"]) {
      expect(glowEl(id).className).toContain("opacity-0");
    }
    fireEvent.pointerLeave(andromeda);
    expect(glowEl("andromeda").className).toContain("opacity-0");
  });

  it("keyboard focus paints the same clickable highlight; blur restores", () => {
    renderLabels();
    const triangulum = screen.getByRole("button", {
      name: ariaName(en.lore, targetByKey("triangulum")),
    });
    fireEvent.focus(triangulum);
    expect(glowEl("triangulum").className).toContain("opacity-100");
    fireEvent.blur(triangulum);
    expect(glowEl("triangulum").className).toContain("opacity-0");
  });

  it("the clickable highlight cross-fades but snaps under prefers-reduced-motion", () => {
    renderLabels();
    for (const t of lgHitTargets()) {
      const glow = glowEl(t.id);
      expect(glow.className).toContain("transition-opacity");
      expect(glow.className).toContain("motion-reduce:transition-none");
    }
  });
});
