// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTierNav } from "#/components/galaxy/useTierNav";

describe("useTierNav", () => {
  it("starts on the home (galaxy) tier", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    expect(result.current.state).toEqual({ tier: "galaxy", focusedId: null });
  });

  it("a wheel-down step ascends; a wheel-up step descends; one step per gesture", () => {
    const clock = { t: 0 };
    const { result } = renderHook(() => useTierNav(() => clock.t));

    act(() => result.current.onWheel({ deltaY: 12 })); // scroll down → ascend
    expect(result.current.state.tier).toBe("localGroup");

    clock.t = 100; // within the cooldown window
    act(() => result.current.onWheel({ deltaY: 12 }));
    expect(result.current.state.tier).toBe("localGroup"); // blocked — one step per gesture

    clock.t = 800; // past the cooldown
    act(() => result.current.onWheel({ deltaY: -12 })); // scroll up → descend
    expect(result.current.state.tier).toBe("galaxy");
  });

  it("diveTo centres on a gateway in its tier", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    act(() => result.current.diveTo("home", "galaxy"));
    expect(result.current.state).toEqual({ tier: "galaxy", focusedId: "home" });
  });
});
