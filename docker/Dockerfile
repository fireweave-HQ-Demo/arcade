# syntax=docker/dockerfile:1
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/game-core/package.json ./packages/game-core/
COPY packages/engines/package.json ./packages/engines/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS build
ARG PUBLIC_FW_API_URL=https://app-server.fireweave.ai
ARG PUBLIC_FW_PROJECT_API_KEY=
ENV PUBLIC_FW_API_URL=$PUBLIC_FW_API_URL \
    PUBLIC_FW_PROJECT_API_KEY=$PUBLIC_FW_PROJECT_API_KEY
COPY packages ./packages
COPY apps ./apps
RUN bun run --filter '@arcade/web' build

FROM oven/bun:1.2-alpine AS runtime
WORKDIR /app
ARG PORT=3000
ENV NODE_ENV=production \
    PORT=${PORT}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/apps/api/package.json ./apps/api/
COPY packages ./packages
COPY apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE ${PORT}
CMD ["bun", "run", "apps/api/src/main.ts"]
