import type { NextConfig } from "next";

const config: NextConfig = {
  // Imagen de producción independiente: el target `web` del Dockerfile copia solo esto.
  output: "standalone",
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  reactStrictMode: true,
};

export default config;
