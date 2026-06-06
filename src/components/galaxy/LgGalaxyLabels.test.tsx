// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
 * The hover-only LG titles (#167 owner amend): at rest the scene shows NO
 * titles; hovering or keyboard-focusing a galaxy's invisible hit-target fades
 * its serif name + mono distance up — exactly the memory-star label pattern
 * (state-driven opacity, `motion-reduce:transition-none` snaps).
 *
 * Everything below derives from the composition module (`lgHitTargets` /
 * `lgLabels`) and the lore catalog — no magic positions or strings.
 */

const renderLabels = (lore: Messages["lore"] = en.lore) =>
  render(
    <LgGalaxyLabels labels={lgLabels()} targets={lgHitTargets()} lore={lore} />,
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

describe("LgGalaxyLabels — hover-only titles (#167)", () => {
  it("shows zero visible titles at rest — every label starts faded out", () => {
    renderLabels();
    for (const l of lgLabels()) {
      expect(labelEl(l.loreKey).className).toContain("opacity-0");
      expect(labelEl(l.loreKey).className).not.toContain("opacity-100");
    }
  });

  it("hovering a target fades ONLY its title up; un-hover restores", () => {
    renderLabels();
    const andromeda = screen.getByRole("img", {
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
    const mw = screen.getByRole("img", {
      name: ariaName(en.lore, targetByKey("milkyWay")),
    });
    fireEvent.focus(mw);
    expect(labelEl("milkyWay").className).toContain("opacity-100");
    fireEvent.blur(mw);
    expect(labelEl("milkyWay").className).toContain("opacity-0");
  });

  it("every target is in the tab order with a catalog-resolved aria-label (en)", () => {
    renderLabels();
    for (const t of lgHitTargets()) {
      const target = screen.getByRole("img", { name: ariaName(en.lore, t) });
      expect(target.getAttribute("tabindex")).toBe("0");
    }
  });

  it("aria-labels resolve from the ru catalog too — no new strings", () => {
    renderLabels(ru.lore);
    for (const t of lgHitTargets()) {
      expect(
        screen.getByRole("img", { name: ariaName(ru.lore, t) }),
      ).toBeTruthy();
    }
  });

  it("positions + sizes each target from the composition's silhouette reach", () => {
    renderLabels();
    for (const t of lgHitTargets()) {
      const target = screen.getByRole("img", { name: ariaName(en.lore, t) });
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
