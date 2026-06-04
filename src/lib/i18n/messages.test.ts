import { describe, expect, it } from "vitest";
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
    expect(en.chrome.forMom).toBe("For Mom");
    expect(en.chrome.subtitle).toBe("A QUIET PLACE IN THE MILKY WAY");
    expect(en.chrome.srOnly).toBe(
      "Memory Galaxy — a sky of stars, each one a memory.",
    );
    expect(en.chrome.breadcrumbMilkyWay).toBe("MILKY WAY");
    expect(en.chrome.breadcrumbSolEarth).toBe(" › SOL › EARTH");
    expect(en.chrome.countLabel).toBe("{count} memories, still growing");
    expect(en.meta.title).toBe("Memory Galaxy");
    expect(en.meta.description).toBe(
      "A growing galaxy of memories — each star is a memory someone shared.",
    );
  });

  it("carries the exact owner-confirmed ru translations", () => {
    expect(ru.chrome.forMom).toBe("Маме");
    expect(ru.chrome.subtitle).toBe("ТИХИЙ УГОЛОК В МЛЕЧНОМ ПУТИ");
    expect(ru.chrome.srOnly).toBe(
      "Галактика воспоминаний — небо из звёзд, и каждая — чьё-то воспоминание.",
    );
    expect(ru.chrome.breadcrumbMilkyWay).toBe("МЛЕЧНЫЙ ПУТЬ");
    expect(ru.chrome.breadcrumbSolEarth).toBe(" › СОЛНЦЕ › ЗЕМЛЯ");
    expect(ru.chrome.countLabel).toBe(
      "{count} воспоминаний и продолжает расти",
    );
    expect(ru.meta.title).toBe("Галактика воспоминаний");
    expect(ru.meta.description).toBe(
      "Растущая галактика воспоминаний — каждая звезда хранит чьё-то воспоминание.",
    );
  });
});
