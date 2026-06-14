// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimedNarration } from "#/components/galaxy/useTimedNarration";

describe("useTimedNarration — minimum dwell between phrases (#183)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the first phrase immediately", () => {
    const { result } = renderHook(() => useTimedNarration(3000));
    act(() => result.current.show("depart"));
    expect(result.current.narration).toBe("depart");
  });

  it("defers a second phrase until the min dwell (3s) elapses", () => {
    const { result } = renderHook(() => useTimedNarration(3000));
    act(() => result.current.show("depart"));
    act(() => result.current.show("arrive")); // fires right after — must wait
    expect(result.current.narration).toBe("depart"); // first still up
    act(() => vi.advanceTimersByTime(2999));
    expect(result.current.narration).toBe("depart");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.narration).toBe("arrive"); // swapped at 3s
  });

  it("clear is immediate and cancels a pending phrase", () => {
    const { result } = renderHook(() => useTimedNarration(3000));
    act(() => result.current.show("depart"));
    act(() => result.current.show("arrive")); // pending
    act(() => result.current.clear());
    expect(result.current.narration).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.narration).toBeNull(); // the pending phrase was cancelled
  });
});
