// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTierNav } from "#/components/galaxy/useTierNav";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";

describe("useTierNav", () => {
  it("starts on the landing tier (HOME_TIER — the LG overview)", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    expect(result.current.state).toEqual({ tier: HOME_TIER, focusedId: null });
  });

  it("a wheel-up step descends; a wheel-down step ascends; one step per gesture", () => {
    const clock = { t: 0 };
    const { result } = renderHook(() => useTierNav(() => clock.t));

    // The primary first gesture from the LG landing: scroll up → dive into the MW.
    act(() => result.current.onWheel({ deltaY: -12 }));
    expect(result.current.state.tier).toBe("galaxy");

    clock.t = 100; // within the cooldown window
    act(() => result.current.onWheel({ deltaY: 12 }));
    expect(result.current.state.tier).toBe("galaxy"); // blocked — one step per gesture

    clock.t = 800; // past the cooldown
    act(() => result.current.onWheel({ deltaY: 12 })); // scroll down → ascend
    expect(result.current.state.tier).toBe("localGroup");
  });

  it("diveTo centres on a gateway in its tier", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    act(() => result.current.diveTo("home", "galaxy"));
    expect(result.current.state).toEqual({ tier: "galaxy", focusedId: "home" });
  });
});
