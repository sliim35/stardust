/**
 * The 54-fixture labeled accuracy set for the emotion classifier (#211 AC3, ADR-0014 §1):
 * 36 clear base memories (3/emotion) + 18 adversarial near-pair memories (2/pair) that sit
 * on a confusable boundary to stress `buildMoodMessages`'s disambiguation. i18n-exempt —
 * these are test inputs, never user-facing; scored live by `mood-detect.smoke.ts`.
 */

import type { Emotion } from "#/lib/galaxy/types";

/** One labeled memory: the input `text` and the emotion it should classify to. */
export type MoodFixture = {
  text: string;
  expected: Emotion;
  /**
   * For an adversarial fixture, the OTHER emotion it is designed to be mistaken for —
   * i.e. it deliberately straddles the `expected` <-> `confusedWith` boundary. Absent on
   * a clear base fixture.
   */
  confusedWith?: Emotion;
};

/**
 * 3 clear, unambiguous memories per emotion (36 total). Each leans squarely into the
 * emotion's core sense with no boundary tension — the classifier's baseline accuracy.
 */
export const BASE_FIXTURES = [
  // joyful
  {
    text: "We danced in the kitchen until midnight, laughing so hard it hurt.",
    expected: "joyful",
  },
  {
    text: "The whole street threw confetti when our team finally won the cup.",
    expected: "joyful",
  },
  {
    text: "Her first birthday party — cake everywhere, every single one of us grinning.",
    expected: "joyful",
  },
  // tender
  {
    text: "I held her hand while she fell asleep and just listened to her breathe.",
    expected: "tender",
  },
  {
    text: "He tucked the blanket around my shoulders without a word and kissed my hair.",
    expected: "tender",
  },
  {
    text: "We lay tangled together watching the rain, saying nothing, completely close.",
    expected: "tender",
  },
  // grieving
  {
    text: "The house is so quiet now that Dad is gone; I keep setting his place at the table.",
    expected: "grieving",
  },
  {
    text: "I found her glasses in the drawer and the loss hit me all over again.",
    expected: "grieving",
  },
  {
    text: "We buried the old dog under the apple tree and I couldn't stop crying.",
    expected: "grieving",
  },
  // wonder
  {
    text: "Standing under the Milky Way for the first time, I felt impossibly small and amazed.",
    expected: "wonder",
  },
  {
    text: "The whale surfaced right beside the boat and my breath just caught at the size of it.",
    expected: "wonder",
  },
  {
    text: "Inside the cathedral the light poured down and I forgot how to speak.",
    expected: "wonder",
  },
  // nostalgic
  {
    text: "The smell of cut grass took me straight back to summers at grandma's house.",
    expected: "nostalgic",
  },
  {
    text: "We found our old mixtapes and spent the night remembering every dumb lyric, smiling.",
    expected: "nostalgic",
  },
  {
    text: "That song came on and suddenly I was sixteen again, warm with the whole memory.",
    expected: "nostalgic",
  },
  // hope
  {
    text: "The scan was clear, and for the first time in months I let myself plan for next year.",
    expected: "hope",
  },
  {
    text: "She mailed the application today, certain that this is the start of something good.",
    expected: "hope",
  },
  {
    text: "First green shoots in the garden — proof that the long winter is finally ending.",
    expected: "hope",
  },
  // peaceful
  {
    text: "Coffee on the porch at dawn, mist on the field, nowhere I needed to be.",
    expected: "peaceful",
  },
  {
    text: "After the kids slept, the house went still and I just breathed, completely at ease.",
    expected: "peaceful",
  },
  {
    text: "Floating on my back in the warm lake, the whole world soft and quiet.",
    expected: "peaceful",
  },
  // wistful
  {
    text: "Our old apartment is a parking lot now; I drove past and smiled at the ghost of it.",
    expected: "wistful",
  },
  {
    text: "The kids are grown and gone, and the empty swing in the yard still sways a little.",
    expected: "wistful",
  },
  {
    text: "We were so young in that photo — those days are gone, and I'm glad they happened.",
    expected: "wistful",
  },
  // gratitude
  {
    text: "A stranger paid for my groceries when my card failed, and I still think of her kindness.",
    expected: "gratitude",
  },
  {
    text: "My sister drove four hours in the storm just to sit with me; I'll never forget it.",
    expected: "gratitude",
  },
  {
    text: "The nurses stayed past their shift for us — I am so thankful they were there.",
    expected: "gratitude",
  },
  // courage
  {
    text: "Hands shaking, I finally told them the truth I'd been hiding for years.",
    expected: "courage",
  },
  {
    text: "She walked back into the burning house to carry the cat out, terrified the whole time.",
    expected: "courage",
  },
  {
    text: "I stepped up to the mic with my knees buckling and said it anyway.",
    expected: "courage",
  },
  // pride
  {
    text: "My daughter crossed the stage in her cap and gown and my chest could have burst.",
    expected: "pride",
  },
  {
    text: "After two years of night classes I finally passed the exam — I did that.",
    expected: "pride",
  },
  {
    text: "He ran the whole marathon on a rebuilt knee; we all stood and roared for him.",
    expected: "pride",
  },
  // longing
  {
    text: "It's been a year since you moved overseas and I ache to just sit across from you again.",
    expected: "longing",
  },
  {
    text: "I keep reaching for the phone to call him before I remember I can't anymore.",
    expected: "longing",
  },
  {
    text: "I want to go home so badly it hurts — back to a place that doesn't exist now.",
    expected: "longing",
  },
] as const satisfies readonly MoodFixture[];

/**
 * 2 adversarial memories per near-pair (18 total). Each entry sits on the boundary of a
 * confusable pair: its surface words pull toward `confusedWith`, but its true dominant
 * meaning is `expected`. Covers the 5 hard pairs from `MOOD_DISAMBIGUATION_PAIRS` plus 4
 * further confusables, exercising the prompt's disambiguation from both directions.
 */
export const ADVERSARIAL_FIXTURES = [
  // hope <-> wonder
  {
    text: "Watching the rocket climb, I wasn't just amazed — I believed we'd really reach Mars in my lifetime.",
    expected: "hope",
    confusedWith: "wonder",
  },
  {
    text: "The aurora rippled overhead and I just stood there, undone by how vast and strange it was.",
    expected: "wonder",
    confusedWith: "hope",
  },
  // gratitude <-> tender
  {
    text: "Holding my newborn, all I could feel was thank-you — to the doctors, to luck, to everything.",
    expected: "gratitude",
    confusedWith: "tender",
  },
  {
    text: "He brushed the hair from her face and held her close, no thanks needed, just love.",
    expected: "tender",
    confusedWith: "gratitude",
  },
  // longing <-> wistful
  {
    text: "I'd give anything to walk back into that summer right now — I want it back, not just to remember it.",
    expected: "longing",
    confusedWith: "wistful",
  },
  {
    text: "Our wedding song played and I smiled at how far that day feels now, fond and a little sad.",
    expected: "wistful",
    confusedWith: "longing",
  },
  // pride <-> joyful
  {
    text: "I laughed and cried at graduation — but underneath it was the deep knowing that I'd earned this.",
    expected: "pride",
    confusedWith: "joyful",
  },
  {
    text: "We won the trivia night on a lucky guess and the whole table erupted in delight.",
    expected: "joyful",
    confusedWith: "pride",
  },
  // courage <-> hope
  {
    text: "Terrified, I signed the divorce papers anyway, because staying afraid was no longer living.",
    expected: "courage",
    confusedWith: "hope",
  },
  {
    text: "After the diagnosis she chose to believe the treatment would work and started counting the good days ahead.",
    expected: "hope",
    confusedWith: "courage",
  },
  // nostalgic <-> wistful
  {
    text: "Flipping through the old album, every photo warmed me — pure happy remembering, no ache at all.",
    expected: "nostalgic",
    confusedWith: "wistful",
  },
  {
    text: "The carousel still turns where the arcade used to be; I watched it, smiling at what's gone.",
    expected: "wistful",
    confusedWith: "nostalgic",
  },
  // grieving <-> longing
  {
    text: "It's the missing that gets me now — I just want one more ordinary Tuesday with him.",
    expected: "longing",
    confusedWith: "grieving",
  },
  {
    text: "At the funeral I couldn't breathe for the weight of never seeing her again.",
    expected: "grieving",
    confusedWith: "longing",
  },
  // peaceful <-> tender
  {
    text: "We sat quietly on the dock as the sun set, no need to talk, completely settled.",
    expected: "peaceful",
    confusedWith: "tender",
  },
  {
    text: "I wrapped my arms around him in the hammock and felt closer to him than ever.",
    expected: "tender",
    confusedWith: "peaceful",
  },
  // joyful <-> gratitude
  {
    text: "Surprise party, everyone I love in one room — I was simply, helplessly happy.",
    expected: "joyful",
    confusedWith: "gratitude",
  },
  {
    text: "My friends rebuilt my flooded kitchen over a weekend and I'm overwhelmed with thanks.",
    expected: "gratitude",
    confusedWith: "joyful",
  },
] as const satisfies readonly MoodFixture[];

/** The full 54-fixture labeled set (36 base + 18 adversarial). */
export const MOOD_FIXTURES: readonly MoodFixture[] = [
  ...BASE_FIXTURES,
  ...ADVERSARIAL_FIXTURES,
];

/** One scored fixture: the fixture, the classifier's prediction, and whether it matched. */
export type FixtureResult = {
  fixture: MoodFixture;
  predicted: Emotion | null;
  correct: boolean;
};

/** The aggregate accuracy report `scoreClassifications` produces over a fixture run. */
export type AccuracyReport = {
  total: number;
  correct: number;
  /** Overall accuracy in 0..1. */
  accuracy: number;
  /** Accuracy over the clear base fixtures only (no boundary tension). */
  baseAccuracy: number;
  /** Accuracy over the adversarial near-pair fixtures only (the hard ones). */
  adversarialAccuracy: number;
  /** Every miss, for eyeballing where the classifier drifts. */
  misses: readonly FixtureResult[];
  results: readonly FixtureResult[];
};

/** Accuracy over a subset, or 0 when the subset is empty (avoids 0/0 = NaN). */
const accuracyOf = (results: readonly FixtureResult[]): number =>
  results.length === 0
    ? 0
    : results.filter((r) => r.correct).length / results.length;

/**
 * Pure scoring core for the smoke harness: zip a list of predictions against the labeled
 * fixtures (same order, same length) and report overall / base / adversarial accuracy +
 * the misses. Kept pure (no `env.AI`, no clock) so the default gate can unit-test the
 * scoring math; the live `*.smoke.ts` harness feeds it real classifier output.
 */
export const scoreClassifications = (
  fixtures: readonly MoodFixture[],
  predictions: readonly (Emotion | null)[],
): AccuracyReport => {
  if (fixtures.length !== predictions.length) {
    throw new Error(
      `scoreClassifications: ${fixtures.length} fixtures vs ${predictions.length} predictions`,
    );
  }
  const results: FixtureResult[] = fixtures.map((fixture, i) => {
    const predicted = predictions[i];
    return { fixture, predicted, correct: predicted === fixture.expected };
  });
  const base = results.filter((r) => r.fixture.confusedWith === undefined);
  const adversarial = results.filter(
    (r) => r.fixture.confusedWith !== undefined,
  );
  return {
    total: results.length,
    correct: results.filter((r) => r.correct).length,
    accuracy: accuracyOf(results),
    baseAccuracy: accuracyOf(base),
    adversarialAccuracy: accuracyOf(adversarial),
    misses: results.filter((r) => !r.correct),
    results,
  };
};
