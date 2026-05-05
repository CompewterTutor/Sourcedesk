# Email Ingest — Implementation Progress & Handoff

This document records what was implemented from `feature-request-email-summary` and what remains. Updated as work progresses.

See original feature request: `docs/feature-request-email-summary`

---

## Summary — work completed (current session)

### From previous session (file-backed foundation)
- `POST /api/email-ingest` — token-authenticated ingest endpoint, stores payloads in `.private-documents/email_ingests/`, returns lightweight thread summary.
- `scripts/generate_api_token.js` — CLI to generate tokens; stored in `.private-documents/api_tokens.json`.
- `Dockerfile`, `docker-compose.yml`, `Makefile` — containerisation scaffolding.

### This session — full DB backend + LLM pipeline

**New files:**
- `server/db.js` — DB abstraction supporting SQLite (`better-sqlite3`) and PostgreSQL (`pg`). Both packages are optional — server falls back to file-only if `DATABASE_URL` is not set. Interface: `createDb(url)` → `{ run, get, all, exec, close, type, runMigrations }`.
- `server/llm.js` — Server-side non-streaming LLM helper. Supports `anthropic`, `openai`, `local` providers. No npm dependencies — uses Node.js built-in `https`/`http`.
- `migrations/001_initial.sql` — Initial schema (SQLite + PostgreSQL compatible): `schema_migrations`, `users`, `api_tokens`, `email_ingests`, `email_threads`, `email_messages`, `email_summaries`.
- `scripts/migrate.js` — CLI migration runner. `node scripts/migrate.js` or `npm run migrate`.
- `.env.example` — Updated with all variables: `DATABASE_URL`, `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, etc.

**Modified files:**
- `server.js` — major additions:
  - DB init on startup (synchronous for SQLite, async migration run); `_db` and `_dbInitError` globals.
  - `_uid()` helper for ID generation.
  - `_summarizeIngest(db, ingestId, projectId, userId, threadsMap)` — async fire-and-forget LLM pipeline: per-thread summaries (incremental: only new messages since last run) + overall project summary; persists to `email_summaries` table.
  - `GET /api/email-summaries?token=X&projectId=Y` — fetch LLM summaries for a project.
  - `POST /api/token-revoke` — revoke a token from both file store and DB.
  - Updated `POST /api/email-ingest` — now also persists ingest, threads, and messages to DB; triggers async LLM summarization after sending HTTP response. Response adds `llmSummarizing: bool` flag.
  - Updated `GET /health` — now returns `db` (type or null) and `dbError`.
  - Updated startup logs — shows DB status and server-side LLM config.
- `scripts/generate_api_token.js` — now DB-aware: if `DATABASE_URL` is set in .env, also creates user + token records in DB.
- `package.json` — added `"migrate"` script; `optionalDependencies`: `better-sqlite3 ^9.6.0`, `pg ^8.13.0`.
- `Dockerfile` — adds `python3 make g++` for native module compilation; adds `npm ci --omit=dev` in runtime stage to install DB packages.
- `docker-compose.yml` — `data` volume for SQLite; LLM env vars; `pgvector/pgvector:pg16` image commented out for PostgreSQL option.
- `.gitignore` — added `data/`, `*.db`, `backups/`.

**Frontend — Template Variable popup:**
- `src/index.html` — added `.tv-*` CSS classes; `📖 Variables` button in template modal; `#modal-template-vars` modal with built-in vars section and editable constants section.
- `src/templates.js` — `openTemplateVarsModal()`, `_tvRenderConstants()`, `_tvRenderConstantRows()`, `_tvGetCurrentRows()`, `_tvAddConstantRow()`, `_tvDeleteConstantRow(i)`, `_tvSaveConstants()`, `_tvInsertVar(varName)`, `_tvOffset()`, `_htmlEscape()`.
- `build.js` — added 5 new function names to `mangle.reserved`.

---

## How to run & quick test

### Setup
```sh
npm install                              # install dev deps (terser)
npm install better-sqlite3               # install SQLite driver
cp .env.example .env                     # configure your environment
# edit .env: set DATABASE_URL, LLM_PROVIDER, ANTHROPIC_API_KEY, etc.
npm run dev                              # build (fast unminified)
npm run serve                            # start server
```

### Generate an API token
```sh
node scripts/generate_api_token.js --user you@example.com --label "my-token"
# or (if DATABASE_URL is set in .env):
make gen-token USER=you@example.com
```

### Test email ingest
```sh
curl -X POST http://localhost:3000/api/email-ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "token":"<TOKEN>",
    "projectId":"proj-123",
    "emails":[
      {"subject":"RFP Question","from":"vendor@acme.com","to":"you@org.edu","date":"2026-05-05","body":"Can you clarify the delivery timeline?","threadId":"thread-1"},
      {"subject":"Re: RFP Question","from":"you@org.edu","to":"vendor@acme.com","date":"2026-05-06","body":"Delivery must be by Dec 31.","threadId":"thread-1"}
    ]
  }'
```

Successful response includes `llmSummarizing: true` if DB + LLM are configured. The LLM runs asynchronously after the HTTP response.

### Fetch summaries (after LLM processes)
```sh
curl "http://localhost:3000/api/email-summaries?token=<TOKEN>&projectId=proj-123"
```

### Run DB migrations manually
```sh
npm run migrate
# or: DATABASE_URL=sqlite:./data/sourcedesk.db node scripts/migrate.js
```

---

## Architecture

### DB Schema (v1 — `migrations/001_initial.sql`)
| Table | Key Fields | Notes |
|---|---|---|
| `schema_migrations` | `version`, `applied_at` | Migration bookkeeping |
| `users` | `id`, `email`, `label` | One per human user |
| `api_tokens` | `id`, `user_id`, `token`, `revoked`, `expires_at` | Auth tokens |
| `email_ingests` | `id`, `user_id`, `project_id`, `received_at`, `email_count` | One per POST call |
| `email_threads` | `id`, `project_id`, `user_id`, `thread_key` | Upserted; email_count accumulates |
| `email_messages` | `id`, `thread_id`, `message_key` | Deduplicated by composite key |
| `email_summaries` | `id`, `project_id`, `user_id`, `summary_text`, `per_thread_json`, `version` | One per project, updated incrementally |

### LLM summarization (`server/llm.js` + `_summarizeIngest` in `server.js`)
- **Per-thread**: if a previous summary exists, only NEW messages are sent to the LLM with a diff instruction. `per_thread_json` is a `{ [threadKey]: { summary, processedAt, messageCount } }` map.
- **Overall**: after all threads are summarized, a second LLM call produces a project-level executive summary with action items, deadlines, and vendor contacts.
- Both calls use the model specified by `LLM_MODEL` (default: `claude-sonnet-4-6`).
- Fire-and-forget: the HTTP response is sent before LLM calls start; status `llmSummarizing: true` in response signals the client that a summary is in progress.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | Server health: markitdown, DB type, markitdown docx support |
| `POST` | `/api/email-ingest` | `token` in body | Ingest email batch; triggers async LLM summary if configured |
| `GET` | `/api/email-summaries` | `?token=` | Fetch stored LLM summaries for a project |
| `POST` | `/api/token-revoke` | `adminToken` in body | Revoke a token (file + DB) |
| `POST` | `/convert` | none | Convert doc to Markdown via markitdown |
| `POST` | `/proxy` | none | Proxy requests to local LLM (CORS bypass) |
| `POST` | `/backup` | none | Save DB dump to `backups/` directory |

---

## Next steps (remaining from feature-request-email-summary)

**In priority order:**

1. **Frontend email summary import UI** *(medium)*
   - In the browser app, add an "Email Summaries" import panel (accessible from the project sidebar or Settings).
   - `GET /api/email-summaries?token=X&projectId=Y` → display the summary, per-thread breakdown, and action items.
   - "Import to Notes" button — creates a Note from the summary text.
   - "Create Tasks from Action Items" — parses action items from the summary and creates Task records.
   - Notification area: "email ingest summary updated — click to view".

2. **Token management UI** *(small)*
   - Settings tab "API Tokens" — show existing tokens (from file or DB), generate new ones, revoke.
   - Use `POST /api/token-revoke` endpoint.
   - UUID generation in browser for user identity (`crypto.randomUUID()`).

3. **Incremental ingest deduplication improvements** *(medium)*
   - Currently deduplication key is `threadKey|from|date|subject[:50]`. This is good but may miss messages if any field changes slightly.
   - Add `messageId` field support in the email schema (RFC 2822 `Message-ID` header) as a more reliable dedup key.
   - Expose "re-analyse project" endpoint: `POST /api/email-reanalyze { token, projectId }` — re-runs LLM over all stored messages.

4. **Draft document generation** *(medium)*
   - The `_summarizeIngest` function already saves to `email_summaries.draft_documents` (JSON array).
   - Extend the LLM prompt to produce draft responses/documents based on the email threads.
   - Expose via `GET /api/email-summaries` (already returned in response).

5. **Merge / sync strategy for server DB ↔ local IndexedDB** *(large)*
   - On boot, the client calls `GET /api/sync?token=X` which returns server-side config and project metadata.
   - Implement merge strategy: prefer newest `updatedAt` per record.
   - For document content: three-way diff (local vs server vs base) using existing `diff.js`.
   - Start with read-only sync (server → client) before implementing write-back.

6. **Token expiry** *(small)*
   - `expires_at` column is already in `api_tokens` table.
   - Add `--expires-in 30d` flag to `generate_api_token.js`.
   - Check expiry in token validation (`loadTokens()` and DB query).

7. **PostgreSQL full support testing** *(small)*
   - The `?`→`$N` placeholder conversion in `server/db.js` handles most cases.
   - Test with `docker-compose up` + PostgreSQL service.
   - The `pg` package is already in `optionalDependencies`.

8. **RAG with pgvector** *(future — after Postgres is in production use)*
   - Add `pgvector` extension to the PostgreSQL schema.
   - Add an `embeddings` table mirroring the existing IndexedDB `embeddings` store.
   - Server-side chunking + embedding pipeline: `POST /api/index-doc { token, projectId, docId, content }`.
   - Hybrid BM25 + cosine retrieval: `GET /api/retrieve?query=X&projectId=Y&token=Z`.

---

## Quick-pickup checklist

1. `npm install better-sqlite3` (once per machine — installs SQLite driver)
2. `cp .env.example .env` — set `DATABASE_URL`, `LLM_PROVIDER`, API key
3. `npm run serve` — server starts, migrations run automatically
4. `make gen-token USER=you@example.com` — generate token
5. POST a test ingest (curl above), wait ~10-30s for LLM to process
6. `GET /api/email-summaries?token=X&projectId=Y` — verify summary stored

---

## Where artifacts live

| Path | Description |
|---|---|
| `server/db.js` | DB abstraction (SQLite + PostgreSQL) |
| `server/llm.js` | Server-side LLM helper (no npm deps) |
| `migrations/001_initial.sql` | Initial DB schema |
| `scripts/migrate.js` | Migration runner CLI |
| `scripts/generate_api_token.js` | Token generator (file + DB) |
| `server.js` | Main server with all endpoints |
| `data/sourcedesk.db` | SQLite database file (gitignored) |
| `.private-documents/api_tokens.json` | File-backed token store (gitignored) |
| `.private-documents/email_ingests/` | Raw ingest JSON files |
| `.env.example` | All environment variable documentation |
