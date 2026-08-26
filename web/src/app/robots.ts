import type { MetadataRoute } from "next";

const SITE_URL = process.env.SITE_URL ?? "https://talaia.luismi.dev";

/** Indexable, salvo los proxies internos hacia la API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
