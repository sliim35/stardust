import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { localeRewrite } from "#/lib/i18n/rewrite";

/**
 * A minimal fake router: `output` reads the *active* locale from
 * `router.latestLocation.publicHref` (the external, still-prefixed href of the
 * page the user is on). The stub carries only that field so the rewrite stays a
 * pure unit under test — no real router needed.
 */
const fakeRouter = (publicHref: string): AnyRouter =>
  ({ latestLocation: { publicHref } }) as unknown as AnyRouter;

const onPage = (publicHref: string) => localeRewrite(fakeRouter(publicHref));

/** Mirror the framework: rewrite fns receive a real URL and may mutate/return it. */
const runInput = (rewrite: ReturnType<typeof localeRewrite>, href: string) => {
  const url = new URL(href, "http://x");
  const out = rewrite.input?.({ url });
  return out === undefined ? undefined : new URL(out, "http://x").pathname;
};

const runOutput = (
  rewrite: ReturnType<typeof localeRewrite>,
  href: string,
): { pathname: string; search: string; hash: string } | undefined => {
  const url = new URL(href, "http://x");
  const out = rewrite.output?.({ url });
  if (out === undefined) return undefined;
  const u = new URL(out, "http://x");
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};

describe("localeRewrite.input — history → router (strip /ru) (AC1)", () => {
  const r = onPage("/anything"); // input never reads the router
  it("strips /ru from a nested ru path", () => {
    expect(runInput(r, "/ru/galaxy")).toBe("/galaxy");
  });
  it("maps the bare /ru to /", () => {
    expect(runInput(r, "/ru")).toBe("/");
  });
  it("is a no-op (undefined) for unprefixed paths", () => {
    expect(runInput(r, "/galaxy")).toBeUndefined();
    expect(runInput(r, "/")).toBeUndefined();
  });
  it("does NOT strip /rubicon (false-match guard)", () => {
    expect(runInput(r, "/rubicon")).toBeUndefined();
  });
});

describe("localeRewrite.output — router → history (add /ru only for ru) (AC5)", () => {
  it("adds /ru when the current page is a /ru/… page", () => {
    const out = runOutput(onPage("/ru/galaxy"), "/galaxy");
    expect(out?.pathname).toBe("/ru/galaxy");
  });

  it("adds /ru to the root Link when on a ru page", () => {
    expect(runOutput(onPage("/ru"), "/")?.pathname).toBe("/ru");
  });

  it("leaves en hrefs byte-identical (undefined) when on an en page", () => {
    expect(runOutput(onPage("/galaxy"), "/galaxy")).toBeUndefined();
    expect(runOutput(onPage("/"), "/")).toBeUndefined();
  });

  it("preserves search + hash when prefixing", () => {
    const out = runOutput(onPage("/ru/galaxy"), "/galaxy?a=1#h");
    expect(out).toEqual({ pathname: "/ru/galaxy", search: "?a=1", hash: "#h" });
  });
});
