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
  // Accessibility labels for interactive galaxy elements (not visible copy).
  a11y: {
    memoryStar: "Open memory",
  },
  // ASTRO loading screen (#79) — the source-of-truth copy, now localized (#103).
  loader: {
    thinking: "thinking",
    label: "gathering her stars",
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
  // Layer-A real-object lore (ADR-0010 §4, #146). Facts verbatim from the design
  // spec table (docs/design/2026-06-05-real-galaxy-main-view.md). Curated, real,
  // hardcoded (the ASTRO-AI swap-seam) — never lorem.
  lore: {
    milkyWay: {
      name: "The Milky Way",
      sublabel: "home galaxy · 100,000 ly across",
      line: "our whole sky — a barred spiral of some 200 billion suns, and she lived under one of them.",
    },
    sol: {
      name: "Sol",
      sublabel: "her home · one of ~200 billion",
      line: "our star — the one she lived under; a single light among two hundred billion.",
    },
    sgrA: {
      name: "Sgr A*",
      sublabel: "galactic center · 26,000 ly",
      line: "a supermassive black hole, four million suns heavy, anchoring everything that turns.",
    },
    orionArm: {
      name: "Orion Arm",
      sublabel: "one of many feathered arms",
      line: "the minor spiral arm we drift along — our small lane in the turning of the galaxy.",
    },
    pillars: {
      name: "Pillars of Creation",
      sublabel: "eagle nebula · 7,000 ly",
      line: "columns of cold dust where new stars are still being born; the light reaching you tonight left them 7,000 years ago.",
    },
    crab: {
      name: "Crab Nebula",
      sublabel: "M1 · 6,500 ly",
      line: "the shockwave of a star that died in a flash in 1054 AD — bright enough that they wrote it down.",
    },
    orion: {
      name: "Orion Nebula",
      sublabel: "M42 · 1,344 ly",
      line: "a nursery for young stars — close enough to see with the naked eye on a winter night.",
    },
    lmc: {
      name: "Large Magellanic Cloud",
      sublabel: "163,000 ly · satellite",
      line: "a ragged dwarf galaxy, slowly being shredded by ours — a bright smudge in the southern sky.",
    },
    smc: {
      name: "Small Magellanic Cloud",
      sublabel: "200,000 ly · satellite",
      line: "the LMC's wispy companion — both of them visible from the southern sky on a dark night.",
    },
    andromeda: {
      name: "Andromeda",
      sublabel: "M31 · 2.5 Mly",
      line: "a trillion stars drifting toward us — on a collision course with the Milky Way in about 4.5 billion years.",
    },
    triangulum: {
      name: "Triangulum",
      sublabel: "M33 · 2.7 Mly",
      line: "a small spiral and our third-largest neighbour — a faint smudge to the naked eye on the clearest nights.",
    },
    m32: {
      name: "M32",
      sublabel: "Andromeda satellite · 2.5 Mly",
      line: "a compact dwarf elliptical pressed close against Andromeda's bright disk.",
    },
    m110: {
      name: "M110",
      sublabel: "Andromeda satellite · 2.7 Mly",
      line: "a soft dwarf elliptical drifting beside Andromeda — a smudge beside a giant.",
    },
  },
  // ASTRO's guided-journey narration (ADR-0010 §4) — HARDCODED, hand-curated (the
  // post-v1 ASTRO-AI swap-seam). Tour-guide voice, wistful, first-person.
  astroNarration: {
    onArrival: {
      localGroup:
        "Here is our whole neighbourhood — the Milky Way and the handful of galaxies that drift alongside it.",
      galaxy:
        "And here we are, inside our own galaxy. Somewhere along this arm is the star she called home.",
      solarSystem:
        "Her sun, and the worlds that turn around it. The third one was hers.",
    },
    descend: {
      toGalaxy: "Come closer — let me take you inside the Milky Way.",
      toSolarSystem: "Down we go, toward her star.",
    },
    ascend: {
      toGalaxy: "Back out, into the galaxy.",
      toLocalGroup:
        "And further still, until the whole galaxy is just one light among many.",
    },
  },
  // Layer-B seeded memory-star copy (#146). The fake/seed corpus + Mom's standalone
  // gold star (`irina`) + the egg. Resolved by `buildSeedSky` — no inline strings.
  memoryStars: {
    s01: {
      name: "kitchen radio",
      text: "dad dancing badly in the kitchen while the radio played something from before i was born.",
    },
    s02: {
      name: "his steady hands",
      text: "the way grandfather's hands shook pouring tea, and never once spilled a drop.",
    },
    s03: {
      name: "the voicemail",
      text: "i cannot delete the voicemail. i never play it. i just keep it there.",
    },
    s04: {
      name: "the old number",
      text: "i still know the phone number of a house we left behind twenty years ago.",
    },
    s05: {
      name: "rain on tin",
      text: "rain on the tin roof of the cabin, and nothing in the world that needed doing.",
    },
    s06: {
      name: "saturn, actually",
      text: "the night dad aimed the telescope and i actually saw the rings of saturn, real.",
    },
    irina: {
      name: "for mom",
      text: "a whole life, lived right here on the third stone from this star. follow her home.",
    },
    egg: {
      name: "for mom",
      text: "for the one who taught me to look up. the gold was always hers; the rest is the universe she lived in.",
    },
  },
  // Mood-constellation captions (Layer B) — the one-word MOOD label beside a group.
  moods: {
    joyful: "JOY",
    tender: "LOVE",
    grieving: "GRIEF",
    wistful: "LONGING",
    peaceful: "PEACE",
    nostalgic: "MEMORY",
    wonder: "WONDER",
    memory: "MEMORY",
  },
  // Card chrome (#146/#5) — the soft-glass panel's own labels; object copy is elsewhere.
  card: {
    fieldLog: "FIELD LOG",
    close: "Close",
  },
  // Scale net (#112, spec §5.3) — the bottom-left range rings' accessible name;
  // the visible ring distances are formatted from values, not from the catalog.
  scaleNet: {
    label: "Distance scale",
  },
} as const satisfies Messages;
