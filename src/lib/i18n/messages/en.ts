import type { Messages } from "#/lib/i18n/types";

/**
 * English catalog — the source-of-truth shape. `as const satisfies Messages`
 * pins both the values and the shape, so `ru.ts` drifting out of parity is a
 * compile error (AC4/AC9). Values are verbatim from the story #103 inventory.
 */
export const en = {
  meta: {
    title: "Memory Galaxy",
    description:
      "A growing galaxy of memories — each star is a memory someone shared.",
  },
  chrome: {
    forMom: "For Mom",
    subtitle: "A QUIET PLACE IN THE MILKY WAY",
    srOnly: "Memory Galaxy — a sky of stars, each one a memory.",
    breadcrumbMilkyWay: "MILKY WAY",
    breadcrumbSolEarth: " › SOL › EARTH",
    countLabel: "{count} memories, still growing",
  },
  // ASTRO narration (#72) — the source-of-truth copy, now localized (#103).
  astro: {
    greeting:
      "Every star here is a memory someone left behind. The pulsing one is hers — but add your own, and I'll find its place.",
    clickLines: [
      "Every light you see used to be someone's warmth.",
      "I've been here a long time. So have they.",
      "Add a star. I'll find it a good place in the sky.",
      "Some stars pulse a little brighter. Those are the ones most loved.",
      "The sky keeps growing. It always does.",
    ],
  },
} as const satisfies Messages;
