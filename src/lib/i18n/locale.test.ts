import { describe, expect, it } from "vitest";
import {
  addLocalePrefix,
  DEFAULT_LOCALE,
  getLocale,
  LOCALES,
  stripLocalePrefix,
} from "#/lib/i18n/locale";

describe("LOCALES / DEFAULT_LOCALE", () => {
  it("is exactly en + ru, with en the default", () => {
    expect(LOCALES).toEqual(["en", "ru"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("getLocale — locale is a pure function of the pathname (AC1/AC8)", () => {
  it("returns en for the unprefixed root and routes", () => {
    expect(getLocale("/")).toBe("en");
    expect(getLocale("/galaxy")).toBe("en");
  });

  it("returns ru for /ru (exact) and /ru/… (prefix)", () => {
    expect(getLocale("/ru")).toBe("ru");
    expect(getLocale("/ru/")).toBe("ru");
    expect(getLocale("/ru/galaxy")).toBe("ru");
  });

  it("does NOT false-match /rubicon, /runner, /rust (the ^/ru(/|$) guard)", () => {
    expect(getLocale("/rubicon")).toBe("en");
    expect(getLocale("/runner")).toBe("en");
    expect(getLocale("/rust")).toBe("en");
  });

  it("is case-sensitive — /RU is a normal (en) path", () => {
    expect(getLocale("/RU")).toBe("en");
    expect(getLocale("/Ru")).toBe("en");
  });
});

describe("stripLocalePrefix — history → router (drop /ru)", () => {
  it("strips /ru from a nested ru path", () => {
    expect(stripLocalePrefix("/ru/galaxy")).toBe("/galaxy");
  });

  it("maps the bare /ru to /", () => {
    expect(stripLocalePrefix("/ru")).toBe("/");
    expect(stripLocalePrefix("/ru/")).toBe("/");
  });

  it("leaves non-ru paths unchanged", () => {
    expect(stripLocalePrefix("/galaxy")).toBe("/galaxy");
    expect(stripLocalePrefix("/")).toBe("/");
    expect(stripLocalePrefix("/rubicon")).toBe("/rubicon");
  });
});

describe("addLocalePrefix — router → history (add /ru only for ru)", () => {
  it("adds /ru to a route path", () => {
    expect(addLocalePrefix("/galaxy", "ru")).toBe("/ru/galaxy");
  });

  it("maps / to /ru for ru", () => {
    expect(addLocalePrefix("/", "ru")).toBe("/ru");
  });

  it("leaves paths unchanged for en (no /en/ prefix ever)", () => {
    expect(addLocalePrefix("/galaxy", "en")).toBe("/galaxy");
    expect(addLocalePrefix("/", "en")).toBe("/");
  });
});

describe("strip ∘ add round-trips for ru (input∘output identity)", () => {
  it.each(["/", "/galaxy"])("round-trips %s", (p) => {
    expect(stripLocalePrefix(addLocalePrefix(p, "ru"))).toBe(p);
  });
});
