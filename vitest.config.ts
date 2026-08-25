import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@talaia/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
  "@talaia/db/testing": fileURLToPath(new URL("./db/src/testing.ts", import.meta.url)),
  "@talaia/db": fileURLToPath(new URL("./db/src/migrate.ts", import.meta.url)),
  "@talaia/collector-aemet": fileURLToPath(
    new URL("./collectors/aemet/src/index.ts", import.meta.url),
  ),
  "@talaia/collector-open-meteo": fileURLToPath(
    new URL("./collectors/open-meteo/src/index.ts", import.meta.url),
  ),
  "@talaia/collector-saih": fileURLToPath(
    new URL("./collectors/saih/src/index.ts", import.meta.url),
  ),
  "@talaia/collector-meteoalarm": fileURLToPath(
    new URL("./collectors/meteoalarm/src/index.ts", import.meta.url),
  ),
  "@": fileURLToPath(new URL("./web/src", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Las suites de integración comparten una base de datos: nunca en paralelo.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["**/test/**/*.test.ts", "**/src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts", "web/**"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["web/test/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/.next/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["**/*.integration.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
