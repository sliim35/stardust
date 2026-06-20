import { describe, expect, it } from "vitest";
import {
  ADVERSARIAL_FIXTURES,
  BASE_FIXTURES,
  MOOD_FIXTURES,
  type MoodFixture,
  scoreClassifications,
} from "#/lib/galaxy/mood-fixtures";
import { EMOTION_VALUES, isMood } from "#/lib/galaxy/seed";

describe("MOOD_FIXTURES (the labeled accuracy set — AC3)", () => {
  it("holds exactly 54 fixtures (36 base + 18 adversarial)", () => {
    expect(MOOD_FIXTURES).toHaveLength(54);
    expect(BASE_FIXTURES).toHaveLength(36);
    expect(ADVERSARIAL_FIXTURES).toHaveLength(18);
  });

  it("labels every fixture with a valid Emotion", () => {
    for (const fx of MOOD_FIXTURES) {
      expect(isMood(fx.expected)).toBe(true);
    }
  });

  it("has exactly 3 base fixtures per emotion (full coverage)", () => {
    for (const emotion of EMOTION_VALUES) {
      const count = BASE_FIXTURES.filter(
        (fx) => fx.expected === emotion,
      ).length;
      expect(count, `base fixtures for ${emotion}`).toBe(3);
    }
  });

  it("covers all 12 emotions across the base set", () => {
    const covered = new Set(BASE_FIXTURES.map((fx) => fx.expected));
    expect(covered.size).toBe(12);
  });

  it("tags every adversarial fixture with the distinct emotion it straddles", () => {
    for (const fx of ADVERSARIAL_FIXTURES) {
      expect(fx.confusedWith, fx.text).toBeDefined();
      expect(isMood(fx.confusedWith as string)).toBe(true);
      // The boundary is between two DIFFERENT emotions.
      expect(fx.confusedWith).not.toBe(fx.expected);
    }
  });

  it("gives every fixture a non-empty memory text", () => {
    for (const fx of MOOD_FIXTURES) {
      expect(fx.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("scoreClassifications (the smoke harness scoring core)", () => {
  const base: MoodFixture = { text: "b", expected: "joyful" };
  const adv: MoodFixture = {
    text: "a",
    expected: "hope",
    confusedWith: "wonder",
  };

  it("scores a perfect run at 1.0 overall, base, and adversarial", () => {
    const report = scoreClassifications([base, adv], ["joyful", "hope"]);
    expect(report).toMatchObject({
      total: 2,
      correct: 2,
      accuracy: 1,
      baseAccuracy: 1,
      adversarialAccuracy: 1,
    });
    expect(report.misses).toHaveLength(0);
  });

  it("splits accuracy across base vs adversarial subsets", () => {
    // base correct, adversarial wrong (mistaken for its confusedWith)
    const report = scoreClassifications([base, adv], ["joyful", "wonder"]);
    expect(report.accuracy).toBe(0.5);
    expect(report.baseAccuracy).toBe(1);
    expect(report.adversarialAccuracy).toBe(0);
    expect(report.misses).toHaveLength(1);
    expect(report.misses[0]?.predicted).toBe("wonder");
  });

  it("counts a null prediction (parse failure) as a miss", () => {
    const report = scoreClassifications([base], [null]);
    expect(report.correct).toBe(0);
    expect(report.misses[0]?.predicted).toBeNull();
  });

  it("returns 0 (not NaN) for an empty adversarial subset", () => {
    const report = scoreClassifications([base], ["joyful"]);
    expect(report.adversarialAccuracy).toBe(0);
  });

  it("throws when predictions don't line up with fixtures", () => {
    expect(() => scoreClassifications([base, adv], ["joyful"])).toThrow();
  });
});
