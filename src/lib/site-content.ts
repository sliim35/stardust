import { allSpeakers, allTalks } from "content-collections";
import { siteConfig } from "./site-config";

export type PageType =
  | "home"
  | "page"
  | "speakers-index"
  | "talks-index"
  | "speaker"
  | "talk";

export interface SitePage {
  path: string;
  title: string;
  type: PageType;
}

const STATIC_PAGES: SitePage[] = [
  { path: "/", title: siteConfig.name, type: "home" },
  { path: "/about", title: "About", type: "page" },
  { path: "/schedule", title: "Schedule", type: "page" },
  { path: "/speakers", title: "Speakers", type: "speakers-index" },
  { path: "/talks", title: "Sessions", type: "talks-index" },
];

export const getAllPages = (): SitePage[] => [
  ...STATIC_PAGES,
  ...allSpeakers.map((s) => ({
    path: `/speakers/${s.slug}`,
    title: s.name,
    type: "speaker" as const,
  })),
  ...allTalks.map((t) => ({
    path: `/talks/${t.slug}`,
    title: t.title,
    type: "talk" as const,
  })),
];

const homeMarkdown = (): string =>
  `# ${siteConfig.name}\n\n${siteConfig.description}\n\n` +
  `This demo showcases the Haute Pâtisserie 2026 conference content.\n\n` +
  `- [Speakers](/speakers.md) — ${allSpeakers.length} chefs\n` +
  `- [Sessions](/talks.md) — ${allTalks.length} sessions\n`;

const aboutMarkdown = (): string => `# About\n\n${siteConfig.description}\n`;

const speakersIndexMarkdown = (): string =>
  `# Speakers\n\n${allSpeakers
    .map((s) => `- [${s.name}](/speakers/${s.slug}.md) — ${s.specialty}`)
    .join("\n")}\n`;

const talksIndexMarkdown = (): string =>
  `# Sessions\n\n${allTalks
    .map((t) => `- [${t.title}](/talks/${t.slug}.md) — by ${t.speaker}`)
    .join("\n")}\n`;

/** Return clean markdown for a site path (with or without a trailing `.md`), or null. */
export const getPageMarkdown = (path: string): string | null => {
  const clean = path.replace(/\.md$/, "").replace(/\/+$/, "") || "/";

  if (clean === "/") return homeMarkdown();
  if (clean === "/about") return aboutMarkdown();
  if (clean === "/speakers") return speakersIndexMarkdown();
  if (clean === "/talks") return talksIndexMarkdown();

  const speakerSlug = clean.match(/^\/speakers\/(.+)$/)?.[1];
  if (speakerSlug) {
    const s = allSpeakers.find((x) => x.slug === speakerSlug);
    if (!s) return null;
    const where = [s.restaurant, s.location].filter(Boolean).join(", ");
    return (
      `# ${s.name}\n\n_${s.title}${where ? ` · ${where}` : ""}_\n\n` +
      `**Specialty:** ${s.specialty}\n\n` +
      (s.awards?.length ? `**Awards:** ${s.awards.join("; ")}\n\n` : "") +
      `${s.content}\n`
    );
  }

  const talkSlug = clean.match(/^\/talks\/(.+)$/)?.[1];
  if (talkSlug) {
    const t = allTalks.find((x) => x.slug === talkSlug);
    if (!t) return null;
    return (
      `# ${t.title}\n\n_By ${t.speaker} · ${t.duration}_\n\n` +
      `**Topics:** ${t.topics.join(", ")}\n\n` +
      `${t.content}\n`
    );
  }

  return null;
};

export const listSpeakers = () =>
  allSpeakers.map((s) => ({
    slug: s.slug,
    name: s.name,
    specialty: s.specialty,
    restaurant: s.restaurant,
    location: s.location,
  }));

export const listTalks = () =>
  allTalks.map((t) => ({
    slug: t.slug,
    title: t.title,
    speaker: t.speaker,
    duration: t.duration,
    topics: t.topics,
  }));

export const searchSite = (query: string) => {
  const q = query.toLowerCase();
  const speakers = allSpeakers
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.specialty.toLowerCase().includes(q) ||
        s.restaurant.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
    )
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      specialty: s.specialty,
      restaurant: s.restaurant,
    }));
  const talks = allTalks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.speaker.toLowerCase().includes(q) ||
        t.topics.some((topic) => topic.toLowerCase().includes(q)) ||
        t.content.toLowerCase().includes(q),
    )
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      speaker: t.speaker,
      topics: t.topics,
    }));
  return { speakers, talks };
};
