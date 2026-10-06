# syntax=docker/dockerfile:1
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY client ./client
COPY server ./server
RUN bun run --filter client build

FROM oven/bun:1.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/server/package.json ./server/
COPY server/src ./server/src
COPY --from=build /app/client/dist ./client/dist
EXPOSE 3000
CMD ["bun", "run", "server/src/index.ts"]
