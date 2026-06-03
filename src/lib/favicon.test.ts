import { describe, expect, it } from "vitest";
import { FAVICON_LINKS } from "#/lib/favicon";

// Story #80 — the ASTRO favicon set, copied from the gitignored `astro/` handoff
// into `public/favicon/` and wired into the root route `head()`. These tests pin
// the AC2 link set so a regression (wrong rel/type/sizes/href, or a stray default
// favicon sneaking back in) fails loudly.

const findByRel = (rel: string) => FAVICON_LINKS.filter((l) => l.rel === rel);

describe("FAVICON_LINKS (root head wiring — AC2)", () => {
  it("declares the scalable SVG as the primary icon", () => {
    expect(FAVICON_LINKS).toContainEqual({
      rel: "icon",
      type: "image/svg+xml",
      href: "/favicon/favicon.svg",
    });
  });

  it("declares the 32x32 PNG raster fallback", () => {
    expect(FAVICON_LINKS).toContainEqual({
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: "/favicon/favicon-32.png",
    });
  });

  it("declares the 16x16 PNG raster fallback", () => {
    expect(FAVICON_LINKS).toContainEqual({
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: "/favicon/favicon-16.png",
    });
  });

  it("declares the 180x180 Apple touch icon", () => {
    expect(FAVICON_LINKS).toContainEqual({
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: "/favicon/favicon-180.png",
    });
  });

  it("links the web manifest (AC5)", () => {
    expect(FAVICON_LINKS).toContainEqual({
      rel: "manifest",
      href: "/site.webmanifest",
    });
  });

  it("every href resolves under /favicon/ or the manifest — never the gitignored astro/ source", () => {
    for (const link of FAVICON_LINKS) {
      expect(link.href).toMatch(/^\/(favicon\/|site\.webmanifest)/);
      expect(link.href).not.toContain("astro/");
    }
  });

  it("ships no TanStack/Vite scaffold default icon (no favicon.ico / vite.svg / logoNNN)", () => {
    for (const link of FAVICON_LINKS) {
      expect(link.href).not.toMatch(/favicon\.ico|vite\.svg|logo\d+\.png/);
    }
  });

  it("has exactly one icon per role (no duplicate rels except rel=icon raster set)", () => {
    expect(findByRel("apple-touch-icon")).toHaveLength(1);
    expect(findByRel("manifest")).toHaveLength(1);
    // rel="icon": one svg + two png rasters
    expect(findByRel("icon")).toHaveLength(3);
  });
});
