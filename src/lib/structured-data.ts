import { absoluteUrl, siteConfig } from "./site-config";

type JsonLd = Record<string, unknown>;

/** Wrap a JSON-LD node as a TanStack head `scripts` entry (server-rendered). */
export const jsonLdScript = (node: JsonLd) => ({
  type: "application/ld+json" as const,
  children: JSON.stringify(node),
});

const personNode = (): JsonLd => ({
  "@type": "Person",
  name: siteConfig.owner.name,
  url: siteConfig.owner.url,
  ...(siteConfig.owner.sameAs.length
    ? { sameAs: siteConfig.owner.sameAs }
    : {}),
});

export const webSiteSchema = () =>
  jsonLdScript({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    publisher: personNode(),
  });

export const personSchema = () =>
  jsonLdScript({ "@context": "https://schema.org", ...personNode() });

export const breadcrumbSchema = (items: { name: string; path: string }[]) =>
  jsonLdScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  });

export const faqSchema = (qas: { q: string; a: string }[]) =>
  jsonLdScript({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });

export const profilePageSchema = (p: {
  name: string;
  jobTitle: string;
  description: string;
  image: string;
  path: string;
  sameAs?: string[];
}) =>
  jsonLdScript({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: p.name,
      jobTitle: p.jobTitle,
      description: p.description,
      image: absoluteUrl(p.image),
      url: absoluteUrl(p.path),
      ...(p.sameAs?.length ? { sameAs: p.sameAs } : {}),
    },
  });

export const talkSchema = (t: {
  title: string;
  description: string;
  image: string;
  path: string;
  author: string;
  keywords: string[];
}) =>
  jsonLdScript({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: t.title,
    description: t.description,
    image: absoluteUrl(t.image),
    url: absoluteUrl(t.path),
    author: { "@type": "Person", name: t.author },
    keywords: t.keywords.join(", "),
  });
