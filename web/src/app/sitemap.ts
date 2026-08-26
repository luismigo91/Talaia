import type { MetadataRoute } from "next";

const SITE_URL = process.env.SITE_URL ?? "https://talaia.luismi.dev";

/** Páginas públicas. Las de localidad (`/l/…`) se omiten: cambian de contenido a diario. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/mapa",
    "/avisos",
    "/comparativa",
    "/verificacion",
    "/embalses",
    "/como-funciona",
  ];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/como-funciona" ? "monthly" : "hourly",
    priority: path === "" ? 1 : 0.6,
  }));
}
