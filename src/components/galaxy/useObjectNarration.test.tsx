// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RealObject } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

// The narration server fn is the AI/KV edge — stub it so the wiring is tested
// without bindings (real Workers-AI + KV is QA's job on the preview URL).
const narrateFn = vi.fn();
vi.mock("#/server/narrate", () => ({
  narrateFn: (...args: unknown[]) => narrateFn(...args),
}));

import { useObjectNarration } from "#/components/galaxy/useObjectNarration";

const milkyWay = {
  id: "home",
  loreKey: "milkyWay",
  name: "Milky Way",
} as unknown as RealObject;

describe("useObjectNarration (the object-focus → cached narration seam)", () => {
  it("requests narration keyed by loreKey + the catalog subject, then routes a hit into setNarration", async () => {
    narrateFn.mockResolvedValueOnce("Our whole sky — 200 billion suns.");
    const setNarration = vi.fn();
    const { result } = renderHook(() =>
      useObjectNarration(setNarration, en.lore),
    );

    act(() => result.current(milkyWay));

    await waitFor(() =>
      expect(setNarration).toHaveBeenCalledWith(
        "Our whole sky — 200 billion suns.",
      ),
    );
    expect(narrateFn).toHaveBeenCalledWith({
      data: { key: "milkyWay", subject: en.lore.milkyWay.name },
    });
  });

  it("GRACEFUL: a null narration (AI/KV absent or failing) does NOT touch setNarration", async () => {
    narrateFn.mockResolvedValueOnce(null);
    const setNarration = vi.fn();
    const { result } = renderHook(() =>
      useObjectNarration(setNarration, en.lore),
    );

    act(() => result.current(milkyWay));

    // Give the microtask a chance to resolve; the sky still renders, no line.
    await Promise.resolve();
    await Promise.resolve();
    expect(setNarration).not.toHaveBeenCalled();
  });

  it("GRACEFUL: a thrown server fn never crashes and never sets a narration", async () => {
    narrateFn.mockRejectedValueOnce(new Error("edge down"));
    const setNarration = vi.fn();
    const { result } = renderHook(() =>
      useObjectNarration(setNarration, en.lore),
    );

    act(() => result.current(milkyWay));

    await Promise.resolve();
    await Promise.resolve();
    expect(setNarration).not.toHaveBeenCalled();
  });
});
