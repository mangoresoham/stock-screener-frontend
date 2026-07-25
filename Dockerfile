# Stage 1: install deps with bun (this repo is bun.lock-based) and build the
# production server bundle. Nitro's node-server preset (set in vite.config.ts)
# emits a standalone Node app at .output/, so bun is only needed here.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Baked into the client JS bundle at build time (Vite env vars are compile-time,
# not runtime) -- must be a URL every browser that loads this app can reach,
# i.e. the server's LAN IP, never "localhost". Rebuild the image to change these.
ARG VITE_API_BASE_URL=http://127.0.0.1:8000
ARG VITE_API_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_KEY=$VITE_API_KEY

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
