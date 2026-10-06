# syntax=docker/dockerfile:1
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/game-core/package.json ./packages/game-core/
COPY packages/engine-tictactoe/package.json ./packages/engine-tictactoe/
COPY packages/engine-connectfour/package.json ./packages/engine-connectfour/
COPY packages/engine-rps/package.json ./packages/engine-rps/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS build
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
