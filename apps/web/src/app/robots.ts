import type { MetadataRoute } from "next";

/**
 * Unlisted model: user content is reachable by link, never by search.
 * The landing/login pages stay indexable so SanGit itself is findable.
 * Belt and suspenders with the per-page `robots: noindex` metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/u/", "/p/", "/s/", "/api/", "/dashboard", "/settings"],
    },
  };
}
