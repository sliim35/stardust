import { describe, expect, it } from "vitest";
import { seo } from "./seo";

type MetaTag = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};

const metaVal = (meta: MetaTag[], key: "title" | string) =>
  key === "title"
    ? meta.find((m) => "title" in m)?.title
    : meta.find((m) => m.name === key || m.property === key)?.content;

describe("seo", () => {
  it("produces title, description and canonical", () => {
    const { meta, links } = seo({
      title: "Speakers",
      description: "All speakers",
      canonicalPath: "/speakers",
    });
    expect(metaVal(meta, "title")).toBe("Speakers");
    expect(metaVal(meta, "description")).toBe("All speakers");
    expect(links[0]).toEqual({
      rel: "canonical",
      href: "https://mdvoy.org/speakers",
    });
  });

  it("emits OpenGraph and Twitter tags with absolute image", () => {
    const { meta } = seo({
      title: "T",
      image: "/talks/x.jpg",
      canonicalPath: "/talks/x",
    });
    expect(metaVal(meta, "og:title")).toBe("T");
    expect(metaVal(meta, "og:image")).toBe("https://mdvoy.org/talks/x.jpg");
    expect(metaVal(meta, "og:url")).toBe("https://mdvoy.org/talks/x");
    expect(metaVal(meta, "twitter:card")).toBe("summary_large_image");
  });

  it("falls back to site description and default OG image", () => {
    const { meta } = seo({ title: "Home" });
    expect(metaVal(meta, "description")).toContain("TanStack Start playground");
    expect(metaVal(meta, "og:image")).toBe(
      "https://mdvoy.org/conference-logo.png",
    );
    expect(metaVal(meta, "og:url")).toBe("https://mdvoy.org/");
  });
});
