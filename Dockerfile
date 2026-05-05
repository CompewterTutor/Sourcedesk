# Multi-stage Dockerfile for SourceDesk
# Stage 1: builds SourceDesk.html and native npm modules (better-sqlite3 etc.)
# Stage 2: lean runtime image — only production artefacts

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

# Native module compilation tools (needed for better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install ALL dependencies (including optionals) for the build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build the single-file output
COPY . .
RUN npm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime
WORKDIR /app

# Same native build tools needed at runtime for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package manifests and install production + optional dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy runtime artefacts from builder
COPY --from=builder /app/SourceDesk.html /app/SourceDesk.html
COPY --from=builder /app/server.js       /app/server.js
COPY --from=builder /app/server          /app/server
COPY --from=builder /app/migrations      /app/migrations
COPY --from=builder /app/scripts         /app/scripts

# Private documents directory (tokens live here; mount as a volume in production)
RUN mkdir -p /app/.private-documents /app/data /app/backups

EXPOSE 3000
ENV PORT=3000
# Set DATABASE_URL in your docker run / compose environment to enable DB persistence
# ENV DATABASE_URL=sqlite:./data/sourcedesk.db

CMD ["node", "server.js"]
