// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTierNav } from "#/components/galaxy/useTierNav";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";

describe("useTierNav", () => {
  it("starts on the landing tier (HOME_TIER — the LG overview)", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    expect(result.current.state).toEqual({
      tier: HOME_TIER,
      focusedId: null,
      galaxyId: null,
    });
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
    expect(result.current.state).toEqual({
      tier: "galaxy",
      focusedId: "home",
      galaxyId: "home",
    });
  });

  // AC1 — at the localGroup overview galaxyId is null; the hook falls back to
  // "home", so the first descend (LG → galaxy) works and a second (galaxy →
  // solarSystem) follows the home ladder, matching the wheel-driven path.
  it("descend from the overview falls back to home (galaxyId null → home) (AC1)", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    expect(result.current.state.galaxyId).toBeNull();

    act(() => result.current.descend());
    expect(result.current.state.tier).toBe("galaxy");

    act(() => result.current.descend());
    expect(result.current.state.tier).toBe("solarSystem");
  });

  // AC2 — inside a neighbour galaxy (no solarSystem tier), descending from the
  // galaxy tier is a clamped no-op: the hook must source `available` from the
  // focused galaxyId, not the global v1 default.
  it("descend inside a neighbour galaxy (Andromeda) stays on the galaxy tier (AC2)", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    act(() => result.current.diveTo("andromeda", "galaxy"));
    expect(result.current.state.tier).toBe("galaxy");
    expect(result.current.state.galaxyId).toBe("andromeda");

    act(() => result.current.descend());
    // No solarSystem for a neighbour → clamped, same tier.
    expect(result.current.state).toEqual({
      tier: "galaxy",
      focusedId: "andromeda",
      galaxyId: "andromeda",
    });
  });

  // AC3 — inside the home Milky Way, descending from the galaxy tier reaches the
  // solarSystem tier, because the MW's available set includes it.
  it("descend inside the home Milky Way reaches the solarSystem tier (AC3)", () => {
    const { result } = renderHook(() => useTierNav(() => 0));
    act(() => result.current.diveTo("home", "galaxy"));
    expect(result.current.state.galaxyId).toBe("home");

    act(() => result.current.descend());
    expect(result.current.state).toEqual({
      tier: "solarSystem",
      focusedId: null,
      galaxyId: "home",
    });
  });
});
