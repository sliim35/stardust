import { describe, expect, it } from "vitest";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdScript,
  personSchema,
  profilePageSchema,
  talkSchema,
  webSiteSchema,
} from "./structured-data";

const parse = (entry: { type: string; children: string }) =>
  JSON.parse(entry.children);

describe("structured-data", () => {
  it("jsonLdScript wraps a node as an ld+json script entry", () => {
    const entry = jsonLdScript({ "@type": "Thing" });
    expect(entry.type).toBe("application/ld+json");
    expect(parse(entry)).toEqual({ "@type": "Thing" });
  });

  it("webSiteSchema has context, WebSite type, and a Person publisher", () => {
    const node = parse(webSiteSchema());
    expect(node["@context"]).toBe("https://schema.org");
    expect(node["@type"]).toBe("WebSite");
    expect(node.url).toBe("https://mdvoy.org");
    expect(node.publisher["@type"]).toBe("Person");
    expect(node.publisher.name).toBe("Maksim Dvoinishnikov");
  });

  it("personSchema is a top-level Person with context", () => {
    const node = parse(personSchema());
    expect(node["@type"]).toBe("Person");
    expect(node["@context"]).toBe("https://schema.org");
  });

  it("breadcrumbSchema numbers items from 1 with absolute URLs", () => {
    const node = parse(
      breadcrumbSchema([
        { name: "Speakers", path: "/speakers" },
        { name: "Jane", path: "/speakers/jane" },
      ]),
    );
    expect(node["@type"]).toBe("BreadcrumbList");
    expect(node.itemListElement[0].position).toBe(1);
    expect(node.itemListElement[1].item).toBe(
      "https://mdvoy.org/speakers/jane",
    );
  });

  it("faqSchema maps Q&A pairs to Question/Answer", () => {
    const node = parse(faqSchema([{ q: "When?", a: "March 2026." }]));
    expect(node["@type"]).toBe("FAQPage");
    expect(node.mainEntity[0]["@type"]).toBe("Question");
    expect(node.mainEntity[0].acceptedAnswer.text).toBe("March 2026.");
  });

  it("profilePageSchema wraps a Person with absolute image/url", () => {
    const node = parse(
      profilePageSchema({
        name: "Jane",
        jobTitle: "Chef",
        description: "Bio",
        image: "/speakers/jane.jpg",
        path: "/speakers/jane",
      }),
    );
    expect(node["@type"]).toBe("ProfilePage");
    expect(node.mainEntity.image).toBe("https://mdvoy.org/speakers/jane.jpg");
    expect(node.mainEntity.url).toBe("https://mdvoy.org/speakers/jane");
  });

  it("talkSchema is a CreativeWork with author and keywords", () => {
    const node = parse(
      talkSchema({
        title: "Macarons",
        description: "A session",
        image: "/talks/macarons.jpg",
        path: "/talks/macarons",
        author: "Jane",
        keywords: ["pastry", "french"],
      }),
    );
    expect(node["@type"]).toBe("CreativeWork");
    expect(node.author.name).toBe("Jane");
    expect(node.keywords).toBe("pastry, french");
  });
});
