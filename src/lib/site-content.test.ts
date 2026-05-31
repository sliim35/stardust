import { describe, expect, it } from "vitest";
import {
  getAllPages,
  getPageMarkdown,
  listSpeakers,
  listTalks,
  searchSite,
} from "./site-content";

describe("site-content", () => {
  it("lists static pages plus one entry per speaker and talk", () => {
    const pages = getAllPages();
    expect(pages.some((p) => p.path === "/")).toBe(true);
    expect(pages.some((p) => p.type === "speaker")).toBe(true);
    expect(pages.some((p) => p.type === "talk")).toBe(true);
  });

  it("renders a speaker page as markdown with an H1", () => {
    const speaker = listSpeakers()[0];
    const md = getPageMarkdown(`/speakers/${speaker.slug}`);
    expect(md).toContain(`# ${speaker.name}`);
  });

  it("accepts a trailing .md and returns the same content", () => {
    const speaker = listSpeakers()[0];
    expect(getPageMarkdown(`/speakers/${speaker.slug}.md`)).toBe(
      getPageMarkdown(`/speakers/${speaker.slug}`),
    );
  });

  it("returns null for unknown pages", () => {
    expect(getPageMarkdown("/speakers/does-not-exist")).toBeNull();
    expect(getPageMarkdown("/nope")).toBeNull();
  });

  it("renders the home page markdown", () => {
    expect(getPageMarkdown("/")).toContain("# ");
  });

  it("searchSite finds talks/speakers by keyword", () => {
    const anyTalk = listTalks()[0];
    const term = anyTalk.title.split(" ")[0];
    const res = searchSite(term);
    expect(res.speakers.length + res.talks.length).toBeGreaterThan(0);
  });
});
