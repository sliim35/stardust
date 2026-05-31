import { absoluteUrl, siteConfig } from "./site-config";

export interface SeoInput {
  title: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
}

/** Build `{ meta, links }` to spread into a route `head()`. */
export const seo = ({ title, description, image, canonicalPath }: SeoInput) => {
  const desc = description ?? siteConfig.description;
  const img = absoluteUrl(image ?? siteConfig.defaultOgImage);
  const url = absoluteUrl(canonicalPath ?? "/");

  const meta = [
    { title },
    { name: "description", content: desc },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:image", content: img },
    { property: "og:url", content: url },
    { property: "og:site_name", content: siteConfig.name },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: desc },
    { name: "twitter:image", content: img },
  ];
  const links = [{ rel: "canonical", href: url }];
  return { meta, links };
};
