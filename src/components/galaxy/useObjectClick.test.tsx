// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import { availableTiersFor, V1_AVAILABLE_TIERS } from "#/lib/galaxy/tier-nav";
import type { RealObject } from "#/lib/galaxy/types";
import { useObjectClick } from "./useObjectClick";

// The hook reads `openCard` from the CardHost context; stub it so the test drives
// the resolve→dive/card decision in isolation (no card UI mount needed).
const openCard = vi.hoisted(() => vi.fn());
vi.mock("./CardHost", () => ({
  useCardContext: () => ({ openCard, close: vi.fn() }),
}));

const byId = (id: string) =>
  REAL_OBJECTS.find((o) => o.id === id) as RealObject;

describe("useObjectClick — routes a click to dive or card (#248 AC2)", () => {
  it("dives Sol into the Solar System when the home tier set is passed in", () => {
    // AC2: at the Milky-Way tier the caller threads availableTiersFor('home')
    // (which includes solarSystem), so a Sol click resolves to a DIVE, not a card.
    const diveTo = vi.fn();
    openCard.mockClear();
    const { result } = renderHook(() =>
      useObjectClick(diveTo, availableTiersFor("home")),
    );
    result.current(byId(SOL_ID));
    expect(diveTo).toHaveBeenCalledWith("sol", "solarSystem");
    expect(openCard).not.toHaveBeenCalled();
  });

  it("opens Sol's lore card when the available set omits solarSystem (today's MW default)", () => {
    // Without solarSystem in `available`, Sol's child tier is unbuilt → lore card.
    const diveTo = vi.fn();
    openCard.mockClear();
    const { result } = renderHook(() =>
      useObjectClick(diveTo, V1_AVAILABLE_TIERS),
    );
    result.current(byId(SOL_ID));
    expect(diveTo).not.toHaveBeenCalled();
    expect(openCard).toHaveBeenCalledWith(byId(SOL_ID));
  });

  it("still dives the Milky-Way gateway into the galaxy tier (regression)", () => {
    const diveTo = vi.fn();
    openCard.mockClear();
    const { result } = renderHook(() =>
      useObjectClick(diveTo, availableTiersFor("home")),
    );
    result.current(byId(HOME_MILKY_WAY_ID));
    expect(diveTo).toHaveBeenCalledWith(HOME_MILKY_WAY_ID, "galaxy");
  });

  it("defaults to the v1 tier set when no `available` is passed (back-compat)", () => {
    // The memory-star layers still call useObjectClick(diveTo) with no second arg;
    // the default keeps Sol a card there (no accidental dive from a star layer).
    const diveTo = vi.fn();
    openCard.mockClear();
    const { result } = renderHook(() => useObjectClick(diveTo));
    result.current(byId(SOL_ID));
    expect(diveTo).not.toHaveBeenCalled();
    expect(openCard).toHaveBeenCalledWith(byId(SOL_ID));
  });
});
