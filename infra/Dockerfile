# Una imagen independiente por servicio (targets `api` y `collectors`), cada una con solo
# su paquete y sus dependencias de producción (pnpm deploy). Contexto de build: raíz del repo.
#
#   docker build -f infra/Dockerfile --target api        -t talaia-api .
#   docker build -f infra/Dockerfile --target collectors -t talaia-collectors .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable
WORKDIR /app

# ---- build: instala todo el workspace y compila
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY db/package.json db/
COPY collectors/open-meteo/package.json collectors/open-meteo/
COPY collectors/aemet/package.json collectors/aemet/
COPY collectors/saih/package.json collectors/saih/
COPY collectors/scheduler/package.json collectors/scheduler/
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages packages
COPY db db
COPY collectors collectors
COPY api api
RUN pnpm -r --workspace-concurrency=1 run build

# ---- deploy: un árbol podado por servicio (solo prod deps + dist de sus paquetes)
FROM build AS deploy-api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @talaia/api deploy --prod --legacy /out

FROM build AS deploy-collectors
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @talaia/scheduler deploy --prod --legacy /out

# ---- runtime común
FROM node:22-alpine AS runtime
ENV NODE_ENV=production TZ=UTC
RUN apk add --no-cache tini && addgroup -S talaia && adduser -S talaia -G talaia
WORKDIR /app
USER talaia
ENTRYPOINT ["/sbin/tini", "--"]

FROM runtime AS api
COPY --from=deploy-api --chown=talaia:talaia /out /app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

FROM runtime AS collectors
COPY --from=deploy-collectors --chown=talaia:talaia /out /app
ENV HEARTBEAT_FILE=/tmp/talaia-heartbeat
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s --retries=3 \
  CMD test -f /tmp/talaia-heartbeat && test $(( $(date +%s) - $(stat -c %Y /tmp/talaia-heartbeat) )) -lt 7200
CMD ["node", "dist/main.js"]
