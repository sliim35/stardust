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
} as const satisfies Messages;
