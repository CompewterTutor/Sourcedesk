SHELL := /bin/sh
IMAGE := sourcedesk
TAG := latest
PORT ?= 3000

.PHONY: help build docker-build docker-run compose-up compose-down serve dev gen-token logs clean

help:
	@echo "SourceDesk Makefile"
	@echo "Targets: build, docker-build, docker-run, compose-up, compose-down, serve, dev, gen-token, logs, clean"

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

# Bring up a development stack (Postgres + web)
compose-up:
	docker-compose up -d --build

compose-down:
	docker-compose down

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
