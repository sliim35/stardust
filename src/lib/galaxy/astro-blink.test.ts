import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLINK_DIP_MS, BLINK_MIN_MS, startBlinkLoop } from "#/lib/galaxy/astro";

/**
 * Timer-driven blink loop, exercised with a mocked clock (AC6 — "blink-timer logic
 * is unit-tested … timer with mocked clock"). `startBlinkLoop` is framework-free
 * (pure `setTimeout`/`clearTimeout` over the vitest fake clock), so it is testable
 * here in node without any DOM/React harness.
 */
describe("startBlinkLoop (jittered idle-blink, mocked clock)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not blink before the first delay elapses", () => {
    const onBlink = vi.fn();
    const onReopen = vi.fn();
    // rand = 0 → minimum delay (BLINK_MIN_MS).
    startBlinkLoop({ rand: () => 0, isResting: () => true, onBlink, onReopen });

    vi.advanceTimersByTime(BLINK_MIN_MS - 1);
    expect(onBlink).not.toHaveBeenCalled();
  });

  it("dips at the scheduled delay, then reopens ~120 ms later", () => {
    const onBlink = vi.fn();
    const onReopen = vi.fn();
    startBlinkLoop({ rand: () => 0, isResting: () => true, onBlink, onReopen });

    vi.advanceTimersByTime(BLINK_MIN_MS);
    expect(onBlink).toHaveBeenCalledTimes(1);
    expect(onReopen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(BLINK_DIP_MS);
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it("repeats on a fresh jittered delay (never a metronome)", () => {
    const onBlink = vi.fn();
    // alternate rand so consecutive gaps differ → not a fixed cadence.
    const seq = [0, 1, 0, 1];
    let i = 0;
    startBlinkLoop({
      rand: () => seq[i++ % seq.length],
      isResting: () => true,
      onBlink,
      onReopen: vi.fn(),
    });

    // first gap = MIN (rand 0)
    vi.advanceTimersByTime(BLINK_MIN_MS);
    expect(onBlink).toHaveBeenCalledTimes(1);
    // reopen, then the next gap is the MAX end (rand 1) — longer than MIN.
    vi.advanceTimersByTime(BLINK_DIP_MS);
    vi.advanceTimersByTime(BLINK_MIN_MS); // not yet enough for the longer gap
    expect(onBlink).toHaveBeenCalledTimes(1);
  });

  it("skips the dip while ASTRO is not resting (mid click-emote)", () => {
    const onBlink = vi.fn();
    let resting = false;
    startBlinkLoop({
      rand: () => 0,
      isResting: () => resting,
      onBlink,
      onReopen: vi.fn(),
    });

    vi.advanceTimersByTime(BLINK_MIN_MS);
    expect(onBlink).not.toHaveBeenCalled(); // suppressed — not at rest

    // once back at rest the next scheduled tick blinks again
    resting = true;
    vi.advanceTimersByTime(BLINK_MIN_MS);
    expect(onBlink).toHaveBeenCalledTimes(1);
  });

  it("stops scheduling once the returned stop() is called (cleanup)", () => {
    const onBlink = vi.fn();
    const stop = startBlinkLoop({
      rand: () => 0,
      isResting: () => true,
      onBlink,
      onReopen: vi.fn(),
    });

    stop();
    vi.advanceTimersByTime(BLINK_MIN_MS * 4);
    expect(onBlink).not.toHaveBeenCalled();
  });
});
