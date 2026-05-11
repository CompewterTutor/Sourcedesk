SHELL := /bin/sh
IMAGE := sourcedesk
TAG := latest
PORT ?= 3000

.PHONY: help build docker-build docker-run compose-up compose-down compose-up-sqlite compose-down-sqlite compose-up-pgsql-local compose-down-pgsql-local compose-up-homelab compose-down-homelab serve dev gen-token logs clean

help:
	@echo "SourceDesk Makefile"
	@echo ""
	@echo "Build:"
	@echo "  build               Build SourceDesk.html (minified)"
	@echo "  dev                 Dev build (unminified)"
	@echo "  docker-build        Build Docker image"
	@echo ""
	@echo "Compose variants:"
	@echo "  compose-up          Default: PostgreSQL + Hindsight (recommended)"
	@echo "  compose-up-sqlite   SQLite only (simple local dev)"
	@echo "  compose-up-pgsql-local  External/host PostgreSQL"
	@echo "  compose-up-homelab  Homelab: Postgres+pgvector, Hindsight, pgAdmin, dual-network"
	@echo "  compose-down        Stop default stack"
	@echo "  compose-down-sqlite Stop SQLite stack"
	@echo "  compose-down-pgsql-local  Stop external-PG stack"
	@echo "  compose-down-homelab  Stop homelab stack"
	@echo ""
	@echo "Utilities:"
	@echo "  serve               Run local Node server"
	@echo "  gen-token           Generate API token (USER=email)"
	@echo "  logs                Tail container logs"
	@echo "  clean               Remove build artifacts"

# Build the single-file static output (SourceDesk.html)
build:
	npm ci
	npm run build

# Build a Docker image (includes running the build step)
docker-build: build
	docker build -t $(IMAGE):$(TAG) .

# Run the built image (binds to $(PORT) on the host)
# Mounts .private-documents so API tokens and ingests persist locally
docker-run: docker-build
	docker run --rm -it -p $(PORT):3000 -e PORT=3000 -v $$(pwd)/.private-documents:/app/.private-documents $(IMAGE):$(TAG)

# Bring up the default stack (PostgreSQL + Hindsight)
compose-up:
	docker-compose up -d --build

compose-down:
	docker-compose down

# SQLite variant (no Postgres, no Hindsight)
compose-up-sqlite:
	docker-compose -f docker-compose.sqlite.yml up -d --build

compose-down-sqlite:
	docker-compose -f docker-compose.sqlite.yml down

# External/host PostgreSQL variant
compose-up-pgsql-local:
	docker-compose -f docker-compose.pgsql-local.yml up -d --build

compose-down-pgsql-local:
	docker-compose -f docker-compose.pgsql-local.yml down

# Homelab variant: Postgres+pgvector + Hindsight + pgAdmin, dual-network (mediastack)
# Requires: cp .env.homelab .env  and  docker network create mediastack (if it doesn't exist)
compose-up-homelab:
	docker compose -f docker-compose.homelab.yml up -d --build

compose-down-homelab:
	docker compose -f docker-compose.homelab.yml down

# Run the local server (node)
serve:
	npm run serve

# Dev build (fast, unminified)
dev:
	npm run dev

# Generate an API token (convenience wrapper)
# Usage: make gen-token USER=user@example.com [LABEL=dev]
gen-token:
	@echo "Generate API token for USER=$(USER)"
	@if [ -z "$(USER)" ]; then \
	  echo "Provide USER env var: make gen-token USER=user@example.com"; exit 1; \
	fi
	node scripts/generate_api_token.js --user "$(USER)" --label "$(LABEL)"

# Tail logs for the running container (by image name)
logs:
	docker logs -f $(IMAGE) || true

# Cleanup local artifacts (does NOT remove source files)
clean:
	rm -rf backups || true
	docker image rm $(IMAGE):$(TAG) || true
	@echo "Cleaned build artifacts (where applicable)."
