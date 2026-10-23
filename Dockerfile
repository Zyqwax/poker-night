# Production Dockerfile for Poker Night
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies and build all packages + apps
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Prune dev dependencies for production
RUN pnpm --filter @poker-night/server --prod deploy /app/deployed-server

# Production runtime container
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/poker-night.db

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN mkdir -p /app/data

# Copy built server and web client
COPY --from=builder /app/deployed-server ./
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/dist ./web-dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
