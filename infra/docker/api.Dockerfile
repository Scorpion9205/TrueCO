# syntax=docker/dockerfile:1.4
# ========================================================
# TrueCO WhatsApp-First Coaching ERP - API Server
# Production Multi-Stage Dockerfile
# ========================================================

# 1. Base Image
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# 3. Build Stage
FROM deps AS builder
COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Generate Prisma Client & compile TypeScript
RUN pnpm --filter @trueco/api prisma:generate
RUN pnpm --filter @trueco/types build
RUN pnpm --filter @trueco/api build

# 4. Production Runner Stage
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Security: Run as non-root user
USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/apps/api/src/database/prisma ./apps/api/dist/database/prisma

WORKDIR /app/apps/api

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health/live || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]
