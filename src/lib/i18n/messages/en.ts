import type { Messages } from "#/lib/i18n/types";

/**
 * English catalog — the source-of-truth shape. `as const satisfies Messages`
 * pins both the values and the shape, so `ru.ts` drifting out of parity is a
 * compile error (AC4/AC9). Values are verbatim from the story #103 inventory.
 */
export const en = {
  meta: {
    title: "Stardust",
    description:
      "A growing galaxy of memories — each star is a memory someone shared.",
  },
  chrome: {
    // Owner rebrand + layout pass 2026-06-10: the "For Mom" dedication +
    // subtitle are retired (the dedication must not pull attention); the brand
    // wordmark + the live count line are the title block now.
    brand: "Stardust",
    srOnly: "Stardust — a sky of stars, each one a memory.",
    // Live tier-driven wayfinding trail (§5.3) — one segment per Tier; the
    // active segment is the displayed tier. The old static placeholder's "EARTH"
    // is intentionally dropped (no 4th tier; the solarSystem label is "SOL").
    breadcrumb: {
      localGroup: "LOCAL GROUP",
      galaxy: "MILKY WAY",
      solarSystem: "SOL",
    },
    breadcrumbNav: "Sky navigation",
    countLabel: "{count} memories, still growing",
    // The backdrop theme switcher (former hardcoded PALETTE_LABELS, localized).
    backdrop: {
      label: "Backdrop theme",
      auroral: "sea glass",
      ember: "amber",
      ice: "moonlit",
    },
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
  // gold star (`irina`). Resolved by `buildSeedSky` — no inline strings.
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
    s07: {
      name: "all the green lights",
      text: "every light turned green the whole way home, and we cheered each one like a small victory.",
    },
    s08: {
      name: "the snow-day morning",
      text: "school cancelled, the whole white morning suddenly ours, pancakes for no reason at all.",
    },
    s09: {
      name: "the last bus",
      text: "the smell of the last bus home from her place. some nights i rode past my stop on purpose.",
    },
    s10: {
      name: "the blue door",
      text: "we painted the front door blue one summer. it is someone else's door now. i hope they kept it.",
    },
    irina: {
      name: "for mom",
      text: "for the one who taught me to look up. the gold was always hers; the rest is the universe she lived in.",
    },
  },
  // Mood-constellation captions (Layer B) — the one-word MOOD label beside a group.
  // Widened 7→12 (#193-B): the 5 new emotions + the wistful rename ("LONGING" →
  // "WISTFUL") so the new `longing` emotion owns "LONGING".
  moods: {
    joyful: "JOY",
    tender: "LOVE",
    grieving: "GRIEF",
    wistful: "WISTFUL",
    peaceful: "PEACE",
    nostalgic: "MEMORY",
    wonder: "WONDER",
    hope: "HOPE",
    gratitude: "GRATITUDE",
    courage: "COURAGE",
    pride: "PRIDE",
    longing: "LONGING",
    memory: "MEMORY",
  },
  // Card chrome (#146/#5) — the soft-glass panel's own labels; object copy is elsewhere.
  card: {
    fieldLog: "FIELD LOG",
    close: "Close",
    // The trigger chip (BR28) — what sparked the memory; re-added with its render (#193-D).
    trigger: {
      person: "person",
      action: "moment",
    },
  },
  // Scale net (#112, spec §5.3) — the bottom-left range rings' accessible name;
  // the visible ring distances are formatted from values, not from the catalog.
  scaleNet: {
    label: "Distance scale",
  },
  // "Add your star" chat chrome (#183, ADR-0013 §3/§4) — the write-path copy.
  chat: {
    open: "Add your star",
    label: "Write a memory",
    placeholder: "A memory you want to keep — in a sentence or two…",
    submit: "Add to the sky",
    submitting: "Finding its place…",
    success:
      "Your star is in the sky now — I found it a place among the others. Thank you for sharing it.",
    // Confirm-first routing (#219) — surfaced before persist so a misroute is caught.
    confirm: {
      prompt: "This reads as {emotion} — it belongs in {galaxy}. Add it there?",
      confirm: "Add it there",
      back: "Not quite — go back",
    },
    error: {
      empty: "Write a few words first, and I'll find your star a place.",
      tooLong: "That's a long one — try trimming it to a sentence or two.",
      flagged: "I couldn't add that one. Try sharing a real memory.",
      unclear:
        "I couldn't quite read the feeling in that one. Try saying a little more.",
      failed: "Something went wrong reaching the stars. Please try again.",
    },
  },
  // Discovery star-search (#113) — combobox chrome; no visible copy hardcoded.
  search: {
    label: "Search memories",
    placeholder: "Find a memory by word, mood, or colour…",
    clear: "Clear search",
    results: "Search results",
    option: "Go to {name}",
    count: "{count} memories found",
    empty: "No memories match that search.",
  },
} as const satisfies Messages;
