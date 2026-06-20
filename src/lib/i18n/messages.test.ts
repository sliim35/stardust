import { describe, expect, it } from "vitest";
import type { Emotion } from "#/lib/galaxy/types";
import { getMessages, interpolate } from "#/lib/i18n";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

describe("getMessages — pure locale → dictionary lookup (AC4)", () => {
  it("returns the en dictionary for en", () => {
    expect(getMessages("en")).toBe(en);
  });

  it("returns the ru dictionary for ru", () => {
    expect(getMessages("ru")).toBe(ru);
  });
});

describe("interpolate — {token} replacement (AC8)", () => {
  it("renders {count} in the en countLabel", () => {
    expect(interpolate(en.chrome.countLabel, { count: 8 })).toBe(
      "8 memories, still growing",
    );
  });

  it("renders {count} in the ru countLabel", () => {
    expect(interpolate(ru.chrome.countLabel, { count: 8 })).toBe(
      "8 воспоминаний и продолжает расти",
    );
  });

  it("coerces numbers to strings", () => {
    expect(interpolate("{count}", { count: 0 })).toBe("0");
  });

  it("leaves unknown {token}s intact (no params crash)", () => {
    expect(interpolate("hi {x}", { count: 1 })).toBe("hi {x}");
  });
});

describe("catalog parity + non-empty values (guards AC4 beyond the type check)", () => {
  const flatKeys = (m: object, prefix = ""): string[] =>
    Object.entries(m).flatMap(([k, v]) =>
      v && typeof v === "object"
        ? flatKeys(v, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    );

  it("en and ru have identical key sets", () => {
    expect(flatKeys(ru).sort()).toEqual(flatKeys(en).sort());
  });

  it("ships no blank strings in either locale", () => {
    const values = (m: object): string[] =>
      Object.values(m).flatMap((v) =>
        v && typeof v === "object" ? values(v) : [v as string],
      );
    for (const v of [...values(en), ...values(ru)]) {
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("owner-confirmed final strings (the authoritative table)", () => {
  it("carries the exact en chrome + meta strings (source of truth)", () => {
    // Owner rebrand + relayout 2026-06-10: Memory Galaxy → Stardust; the
    // "For Mom" dedication + subtitle are retired (must not pull attention).
    expect(en.chrome.brand).toBe("Stardust");
    expect(en.chrome.srOnly).toBe(
      "Stardust — a sky of stars, each one a memory.",
    );
    expect(en.chrome.breadcrumb).toEqual({
      localGroup: "LOCAL GROUP",
      galaxy: "MILKY WAY",
      solarSystem: "SOL",
    });
    expect(en.chrome.breadcrumbNav).toBe("Sky navigation");
    expect(en.chrome.countLabel).toBe("{count} memories, still growing");
    expect(en.meta.title).toBe("Stardust");
    expect(en.meta.description).toBe(
      "A growing galaxy of memories — each star is a memory someone shared.",
    );
  });

  it("carries the exact owner-confirmed ru translations", () => {
    // The brand wordmark stays latin in every locale (owner rebrand 2026-06-10).
    expect(ru.chrome.brand).toBe("Stardust");
    expect(ru.chrome.srOnly).toBe(
      "Stardust — небо из звёзд, и каждая — чьё-то воспоминание.",
    );
    expect(ru.chrome.breadcrumb).toEqual({
      localGroup: "МЕСТНАЯ ГРУППА",
      galaxy: "МЛЕЧНЫЙ ПУТЬ",
      solarSystem: "СОЛНЦЕ",
    });
    expect(ru.chrome.breadcrumbNav).toBe("Навигация по небу");
    expect(ru.chrome.countLabel).toBe(
      "{count} воспоминаний и продолжает расти",
    );
    expect(ru.meta.title).toBe("Stardust");
    expect(ru.meta.description).toBe(
      "Растущая галактика воспоминаний — каждая звезда хранит чьё-то воспоминание.",
    );
  });
});

describe("ASTRO narration catalog (#72 copy, localized — #103 fold-in)", () => {
  it("carries the exact en greeting + click set (source of truth)", () => {
    expect(en.astro.greeting).toBe(
      "Every star here is a memory someone left behind. The pulsing one is hers — but add your own, and I'll find its place.",
    );
    expect(en.astro.clickLines).toEqual([
      "Every light you see used to be someone's warmth.",
      "I've been here a long time. So have they.",
      "Add a star. I'll find it a good place in the sky.",
      "Some stars pulse a little brighter. Those are the ones most loved.",
      "The sky keeps growing. It always does.",
    ]);
  });

  it("carries the AI-generated ru narration", () => {
    expect(ru.astro.greeting).toBe(
      "Каждая звезда здесь — чьё-то оставленное воспоминание. Та, что мерцает, — её, но добавь свою, и я найду ей место.",
    );
    expect(ru.astro.clickLines).toEqual([
      "Каждый огонёк, что ты видишь, когда-то был чьим-то теплом.",
      "Я здесь уже очень давно. И они тоже.",
      "Добавь звезду. Я найду ей хорошее место на небе.",
      "Некоторые звёзды мерцают чуть ярче. Это те, кого любили больше всего.",
      "Небо продолжает расти. Так было всегда.",
    ]);
  });

  it("ships the same number of click lines per locale (rotation parity)", () => {
    expect(ru.astro.clickLines.length).toBe(en.astro.clickLines.length);
  });

  it("keeps every line distinct, sentence-case, and never the greeting (both locales)", () => {
    for (const loc of [en, ru]) {
      const { greeting, clickLines } = loc.astro;
      expect(greeting[0]).toBe(greeting[0].toUpperCase());
      expect(new Set(clickLines).size).toBe(clickLines.length);
      expect(clickLines).not.toContain(greeting);
      for (const line of clickLines) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line[0]).toBe(line[0].toUpperCase());
      }
    }
  });
});

describe("ASTRO loading screen catalog (#79 copy, localized — #103 fold-in)", () => {
  it("carries the exact en loader copy (source of truth)", () => {
    expect(en.loader.thinking).toBe("thinking");
    expect(en.loader.label).toBe("gathering her stars");
  });

  it("carries the AI-generated ru loader copy", () => {
    expect(ru.loader.thinking).toBe("думаю");
    expect(ru.loader.label).toBe("собираю её звёзды");
  });
});

describe("mood-caption catalog widening 7→12 (#193-B, AC1–AC3)", () => {
  // The 12 partitioned emotions (the `Emotion` union) + Mom's standalone
  // `memory` caption — 13 keys total. Listing them explicitly here so a dropped
  // or typo'd key is a test failure, not only a (silently waived) compile error.
  const emotions: readonly Emotion[] = [
    "joyful",
    "tender",
    "grieving",
    "wonder",
    "nostalgic",
    "hope",
    "peaceful",
    "wistful",
    "gratitude",
    "courage",
    "pride",
    "longing",
  ];

  it("AC1 — en.moods declares all 12 emotions plus `memory` (13 keys)", () => {
    for (const e of emotions) {
      expect(en.moods[e].length).toBeGreaterThan(0);
    }
    expect(en.moods.memory.length).toBeGreaterThan(0);
    expect(Object.keys(en.moods).sort()).toEqual(
      [...emotions, "memory"].sort(),
    );
  });

  it("AC1 — ru.moods declares the identical 13-key set (parity)", () => {
    expect(Object.keys(ru.moods).sort()).toEqual(Object.keys(en.moods).sort());
  });

  it("AC2 — en carries the 5 new caption values + the wistful rename", () => {
    expect(en.moods.hope).toBe("HOPE");
    expect(en.moods.gratitude).toBe("GRATITUDE");
    expect(en.moods.courage).toBe("COURAGE");
    expect(en.moods.pride).toBe("PRIDE");
    expect(en.moods.longing).toBe("LONGING");
    // wistful renamed "LONGING" → "WISTFUL" so `longing` owns "LONGING".
    expect(en.moods.wistful).toBe("WISTFUL");
  });

  it("AC3 — ru carries the 5 new caption values + the wistful rename", () => {
    expect(ru.moods.hope).toBe("НАДЕЖДА");
    expect(ru.moods.gratitude).toBe("БЛАГОДАРНОСТЬ");
    expect(ru.moods.courage).toBe("СМЕЛОСТЬ");
    expect(ru.moods.pride).toBe("ГОРДОСТЬ");
    expect(ru.moods.longing).toBe("ТОСКА");
    // wistful renamed "ТОСКА" → "МЕЧТАТЕЛЬНОСТЬ" so `longing` owns "ТОСКА".
    expect(ru.moods.wistful).toBe("МЕЧТАТЕЛЬНОСТЬ");
  });

  it("AC2/AC3 — `LONGING`/`ТОСКА` belongs to `longing`, freed from `wistful`", () => {
    // The rename's whole point: the two captions must not collide. `wistful`
    // must no longer carry the value `longing` now owns.
    expect(en.moods.wistful).not.toBe(en.moods.longing);
    expect(ru.moods.wistful).not.toBe(ru.moods.longing);
  });
});

describe("card.trigger.* chip catalog (BR28, #193-B AC2/AC3)", () => {
  it("AC2 — en gains the trigger chip copy (person / moment)", () => {
    expect(en.card.trigger.person).toBe("person");
    expect(en.card.trigger.action).toBe("moment");
  });

  it("AC3 — ru gains the trigger chip copy (человек / событие)", () => {
    expect(ru.card.trigger.person).toBe("человек");
    expect(ru.card.trigger.action).toBe("событие");
  });
});
