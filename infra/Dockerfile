# Imagen única para api, collectors (scheduler) y migrate; el comando se elige en compose.
# Contexto de build: la raíz del repo (context: ..).
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY db/package.json db/
COPY collectors/open-meteo/package.json collectors/open-meteo/
COPY collectors/aemet/package.json collectors/aemet/
COPY collectors/scheduler/package.json collectors/scheduler/
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages packages
COPY db db
COPY collectors collectors
COPY api api
RUN pnpm -r --workspace-concurrency=1 run build \
 && rm -rf node_modules */node_modules */*/node_modules \
 && pnpm install --frozen-lockfile --prod --offline 2>/dev/null || pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production TZ=UTC
RUN apk add --no-cache tini
COPY --from=build /app /app
# Usuario sin privilegios
RUN addgroup -S talaia && adduser -S talaia -G talaia && chown -R talaia:talaia /app
USER talaia
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "api/dist/main.js"]
