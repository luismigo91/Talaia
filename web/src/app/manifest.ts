import type { MetadataRoute } from "next";

/** Manifest de la PWA: hace a Talaia instalable y en pantalla completa. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    short_name: "Talaia",
    description:
      "Semáforo de riesgo de inundación para Albal, Benetússer, el Mareny de Barraquetes y Benaguasil.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e9edee",
    theme_color: "#0f6e7a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
