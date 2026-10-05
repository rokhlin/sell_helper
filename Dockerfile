# Multi-stage build for NestJS application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# OCI labels – required to link the package to the repository on GHCR
# (see https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#labelling-container-images)
LABEL org.opencontainers.image.source="https://github.com/rokhlin/sell_helper"
LABEL org.opencontainers.image.description="Sell Helper – Telegram bot service for AI-powered ad generation"
LABEL org.opencontainers.image.licenses="UNLICENSED"

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Create volume mount points for SQLite and uploads
RUN mkdir -p /app/data /app/data/uploads

EXPOSE 3000

CMD ["node", "dist/main.js"]
