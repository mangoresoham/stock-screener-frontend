# Stage 1: install deps with bun (this repo is bun.lock-based) and build the
# production server bundle. Nitro's node-server preset (set in vite.config.ts)
# emits a standalone Node app at .output/, so bun is only needed here.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# Stage 2: run the built Nitro output on plain Node -- no bun/dev deps at runtime.
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
