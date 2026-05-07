# Changelog

All notable changes to SourceDesk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Versions marked with 🗄️ include IndexedDB schema changes and a migration script.
> Versions marked with 🖥️ include a local helper/server addition for hosted or homelab use.

---

## [Unreleased]

### Fixed
- **Chrome Extension CSP compliance** (`SourceDesk_chrome_extension/`) -- MV3 extensions reject inline scripts and inline event handlers at runtime. Extracted the entire `<script>` block from `side-panel.html` into a new external `side-panel.js` file and removed every inline event attribute (`onclick`, `ondragover`, `ondragleave`, `ondrop`, `onchange`, `oninput`) from the HTML. All event wiring now lives in a `DOMContentLoaded` handler inside `side-panel.js` using `addEventListener`. Dynamically-generated table rows (`renderQuestionsTable`) were also refactored away from inline-handler strings in `innerHTML` to `addEventListener` calls after the row is built. Added missing element IDs for newly-referenced elements (`btn-clear-csv`, `btn-apply-vis`, `btn-deselect`) and `data-card` attributes on card headers for the collapse-toggle listener loop.

### Added
- **SourceDesk Chrome Extension** (`SourceDesk_chrome_extension/`) — new companion MV3 Chrome extension with a sidebar UI for utility workflows that complement SourceDesk. Matches the SourceDesk dark theme (same CSS variables, color palette, and fonts).
  - **Bidnet module** — sidebar panel for bulk Q&A management on [BidNet Direct](https://www.bidnetdirect.com):
    - **Load All Questions** — manipulates the page URL querystring (`searchCriteria.pageSize=9999`) to bypass the 100-per-page UI limit and show all questions at once
    - **Extract Q&A to CSV** — scrapes the Q&A table and downloads a CSV with question ID, number, vendor, question text, answer text, visibility, status, and date
    - **Load CSV** — drag-and-drop or browse for a CSV (`question_number, answer, visibility, comment` columns); preview first 5 rows; count badge
    - **Batch Fill Answers** — iterates CSV rows, navigates to each answer form, fills visibility dropdown (`#answerTypeDropdown`), answer textarea (`#answerQuestion_answer_input_EN`), and optional comment (`#answer.workingRevision.internalComment`), then clicks "Save & Quit" (`button[data-href*="target=save"]`); configurable delay between actions; progress bar with Stop button; supports UI-click or programmatic form submit
    - **Batch Visibility Change** — select questions via checkboxes in the Questions table, choose Public or Private, apply in batch
    - **Questions Table** — refresh from page, search/filter, Select All / Deselect All, per-row "Go" button to navigate directly to that question's answer form; CSV match indicator
    - Collapsible cards, timestamped colour-coded status log (success/error/info), per-action progress label
  - **Bottom tab bar** — persistent navigation with placeholder tabs for future modules (SourceDesk integration, Settings)
  - All DOM selectors confirmed against captured live BidNet HTML source in `docs/bidnet_src/`
  - `generate-icons.html` — open in any browser tab to draw and download the 4 required extension icon PNGs
- **Multiple Working Documents** 🗄️ **DB_VERSION 13** — each project can now hold multiple named working documents. A dropdown selector in the Working Doc view header lets you switch between documents, create new ones (+), rename (✏), and delete (✕) them. Existing `projects.workingContent` is auto-migrated to a "Working Document" entry in the new `workingDocs` store on first load. Version history is scoped per document. `workingDocs` included in export / import / backup / cascade-delete flows.
- **Writing Style Capture** (`src/style.js`, Settings modal) — new ✍ Writing Style row in Settings with a **Configure** modal. Paste or upload old communications (emails, reports, messages); click **✨ Generate Profile** to run them through the active LLM and extract a compact style profile. When "Apply to AI responses" is checked, the profile is injected into every chat system prompt as `## Writing Style`. Profile is stored in IndexedDB; samples are transient (not stored).
- **Multiple Docker Compose variants + Makefile targets** — `docker-compose.sqlite.yml` (SQLite only, no db/Hindsight services) and `docker-compose.pgsql-local.yml` (connect to an existing/host PostgreSQL, optional Hindsight). `Makefile` gains `compose-up-sqlite`, `compose-down-sqlite`, `compose-up-pgsql-local`, `compose-down-pgsql-local`. `make help` now shows a structured multi-section output.
- **Hindsight LLM/embedding env-var substitution** (`docker-compose.yml`) — Hindsight's provider, API key, model, and base URL are now controlled via env vars (`HINDSIGHT_LLM_*` / `HINDSIGHT_EMBEDDINGS_*`). To share the same local Ollama/LM Studio model with SourceDesk, set `HINDSIGHT_LLM_PROVIDER=openai`, `HINDSIGHT_LLM_MODEL=<your-model>`, and `HINDSIGHT_LLM_BASE_URL=http://host.docker.internal:11434/v1` in `.env` — no container rebuild required.

---

## [1.0.0-rc.1] — 2025-07-22 🖥️

### Added — v1.0.0
- **Exponential backoff retry for Hindsight retain** (`server/hindsight.js`) — `retainContent()` now retries failed retain calls up to 3 times with exponential backoff (1 s → 2 s → 4 s) before logging a warning. This handles transient network hiccups and brief Hindsight server restarts without dropping memory data. Always fails silently — Hindsight errors never propagate to the caller.
- **Per-token rate limiting for Hindsight endpoints** (`server.js`) — simple in-memory sliding-window rate limiter (`_hindsightRateCheck`) applied to `POST /api/hindsight/retain` (60 req/min) and `POST /api/hindsight/recall` (120 req/min) per API token. Returns HTTP 429 with a descriptive message on excess. Constants `RL_RETAIN_MAX` / `RL_RECALL_MAX` / `RL_WINDOW_MS` at top of `server.js` for easy tuning.
- **Hindsight setup guide in README** — new `### AI Memory (Hindsight)` section under `Building from Source`, covering: what gets remembered (table of content types, retention triggers, and tag scopes), Docker Compose quick-start, bare-metal pip install, single-container Docker run, app-side enable steps, image size comparison, and rate limit reference.

### Changed — v1.0.0
- **`APP_VERSION`** bumped to `1.0.0` in `src/flags.js` and `package.json`.

---

### Added — v0.9.4 🖥️
- **Memory Browser** (`src/settings.js`, `src/index.html`) — new "Browse" button in Settings → 🧠 Memory row opens `#modal-memory-browser`. The modal shows all retained memories for the current user with:
  - Search input (filters server-side via Hindsight `listMemories` `q` param)
  - Paginated list — 20 per page, **Load More** for subsequent pages
  - Per-item badges: memory type (fact, observation, …) and source document ID
  - Hover-reveal 🗑 delete button per row — removes all memories for that document ID via `DELETE /api/hindsight/memory`
  - **⬇ Export** — downloads the full bank as `sourcedesk-memories.json` via `GET /api/hindsight/export`
  - **🗑 Clear All** — clears the entire bank via `DELETE /api/hindsight/memories` (with double-confirm)
- **In-chat memory citations** (`src/messages.js`, `src/chat.js`) — when Hindsight memories are recalled before a response, a **🧠 N memories recalled** collapsible pill is shown below the assistant bubble (same expand/collapse pattern as sources, but with a teal accent to distinguish from BM25 sources). `memories` is saved on the message object and replayed on `renderMessages()`.
- **4 new server endpoints** (`server.js`) — all token-authenticated, all gracefully no-op when Hindsight is not configured:
  - `GET /api/hindsight/memories?token&q&limit&offset` — paginated memory list
  - `GET /api/hindsight/export?token` — full export download (all pages, `Content-Disposition: attachment`)
  - `DELETE /api/hindsight/memory` (body `{token, documentId}`) — delete one document's memories
  - `DELETE /api/hindsight/memories` (body `{token}`) — clear all; returns `{ok, deleted: N}`
- **4 new server adapter methods** (`server/hindsight.js`) — `listMemories(userId, opts)`, `listDocuments(userId, opts)`, `deleteDocument(userId, documentId)`, `clearAll(userId)` (paginated deletion loop).

### Changed — v0.9.4
- **`APP_VERSION`** bumped to `0.9.4` in `src/flags.js` and `package.json`.
- **`build.js` `mangle.reserved`** — added `openMemoryBrowser`, `_memBrowseLoad`, `_memBrowseClear`, `_memBrowseExport`, `_memBrowseDeleteDoc`.

---

### Added — v0.9.3 🖥️
- **`src/hindsight.js`** — new shared `_hindsightRetainItem(documentId, content, tags, context)` helper. All browser-side retain calls now go through this single function. Guard checks (`serverUrl`, `serverToken`, `hindsightEnabled`, `activeProject`) are centralised here; calling code is concise and consistent. Content is truncated to 4 000 chars before sending.
- **Notes retain** (`src/notes.js`) — `_hindsightRetainItem()` is called from three note-save paths: `_autoSaveCurrentNote()`, `saveCurrentNote()`, and `toggleNoteInContext()`. Only notes with `includeInContext = true` are retained, using `documentId: "note:<id>"` and tag `type:note`. Toggling include-in-context ON immediately retains the note.
- **Supplier Q&A retain** (`src/supplierQuestions.js`) — `_hindsightRetainItem()` is called after every answer save in `saveCurrentSQAnswer()` and after every AI-generated answer completes in `generateAnswerForQuestion()`. Only retained when `draftAnswer` is non-empty. Uses `documentId: "sq:<id>"`, tag `type:sq-answer`, and optional vendor context string.
- **Working-document retain** (`src/versioning.js`) — `_hindsightRetainItem()` is called from `saveDocVersion()` after each version snapshot is written to IndexedDB. Uses a **stable** `documentId: "wdoc:<projectId>:latest"` so Hindsight upserts (keeps only the latest content instead of accumulating one entry per version). Tags: `type:working-doc`.
- **Research item retain** (`src/research.js`) — `_hindsightRetainItem()` is called in `summariseResearchItem()` after a summary is streamed and stored. Only fires when `item.summary` is non-empty. Uses `documentId: "research:<id>"`, tag `type:research`. Includes the item URL and title in the retained content.
- **Email-summary retain** (`server.js` `_summarizeIngest()`) — after the LLM overall summary is written to `email_summaries`, a fire-and-forget call to `_hindsight.retainContent()` is made directly on the server (no browser round-trip needed). Uses `documentId: "email-summary:<projectId>"`, tags `type:email-summary` and `project:<projectId>`.
- **`_hindsightRetain()` refactored** (`src/chat.js`) — now delegates to `_hindsightRetainItem()` instead of duplicating the fetch logic. Behaviour is unchanged.

### Changed — v0.9.3
- **`APP_VERSION`** bumped to `0.9.3` in `src/flags.js` and `package.json`.
- **`build.js` `SRC_FILES`** — added `src/hindsight.js` (loaded after `src/api.js`, before `src/chat.js`).

---

### Added — v0.9.2 🖥️
- **`POST /api/hindsight/retain`** (`server.js`) — new token-authenticated endpoint. Body: `{ token, documentId?, content, context?, tags? }`. Validates token, then fires `ensureBank(owner)` → `retainContent(owner, ...)` as a **fire-and-forget** promise chain and immediately responds `{ ok: true }` — the caller never waits on the retain. If Hindsight is not configured, responds `{ ok: true, skipped: true }` with HTTP 200 (graceful no-op).
- **`POST /api/hindsight/recall`** (`server.js`) — new token-authenticated endpoint. Body: `{ token, query, projectId?, budget? }`. Returns `{ memories: string[], count: number }`. Calls `recallForQuery(owner, { query, projectId, budget: 2000 })` on the Hindsight adapter. If Hindsight is not configured, returns `{ memories: [], count: 0 }` with HTTP 200.
- **`_hindsightRetain(chatId, messages)`** (`src/chat.js`) — fire-and-forget helper that POSTs the current session's messages to `/api/hindsight/retain` after every `saveChat()` DB write. Tags each retain with `project:<projectId>` and `type:chat`. No-ops silently when `hindsightEnabled` is false, server URL/token is missing, or no project is active.
- **`_hindsightRecall(query)`** (`src/chat.js`) — async helper called at the start of every `sendMessage()` in parallel with BM25 retrieval. Returns `string[] | null`. Has a hard 2-second `AbortController` timeout — never blocks chat. Returns `null` on timeout, HTTP error, or when not configured.
- **Parallel recall + retrieval** (`src/chat.js` `sendMessage()`) — `retrieveContext(text)` and `_hindsightRecall(text)` now run concurrently via `Promise.all`. If memories are returned, they are injected into the system prompt as `## Relevant Memories` between `## Global Instructions` and `## Current Project`.
- **"Enable memory recall in chat" toggle** (`src/index.html`, `src/settings.js`, `src/state.js`) — new `#settings-hindsight-enabled` checkbox in Settings → Server Connection, below the Hindsight status row. Saved to IndexedDB as `hindsightEnabled`. Loaded at boot into `state.settings.hindsightEnabled`. When unchecked, all Hindsight calls are suppressed client-side.

### Changed — v0.9.2
- **`APP_VERSION`** bumped to `0.9.2` in `src/flags.js` and `package.json`.
- **`build.js` `mangle.reserved`** — added `toggleHindsight`.

---

### Added — v0.9.1 🖥️
- **`server/hindsight.js`** — new Hindsight memory adapter module. Wraps `@vectorize-io/hindsight-client` with full graceful degradation: if `HINDSIGHT_API_URL` is not set or the SDK is not installed, all exports are safe no-ops that return `null`/empty arrays. Exports: `getClient()`, `ensureBank(userId)`, `retainContent(userId, opts)`, `recallForQuery(userId, opts)`, `getStatus(userId)`. Bank auto-creation applies a procurement-domain config (retain/observations/reflect missions, disposition traits, entity labels for vendor, project_type, deadline) via `updateBankConfig`. Bank ID = userId (one bank per SourceDesk user). `retainContent` always uses `async: true` (fire-and-forget). `recallForQuery` uses `tagsMatch: 'any_strict'` for project-scoped recall to prevent cross-project memory bleed.
- **`migrations/002_hindsight_settings.sql`** — new `user_hindsight` table tracking per-user bank ID and enabled flag; compatible with SQLite and PostgreSQL.
- **`GET /api/hindsight/status`** (`server.js`) — new token-authenticated endpoint; returns `{ available, configured, bankExists, memoryCount }`. If `HINDSIGHT_API_URL` is not set or the adapter failed to load, returns `{ available: false, configured: false, ... }` with HTTP 200 (not an error — just not configured). Server startup log now shows the Hindsight status line.
- **🧠 Memory (Hindsight) row in Settings** (`src/index.html`, `src/settings.js`) — read-only status row in Settings → Server Connection section with a **Test** button that calls `testHindsightConnection()`. Status shows `— Not configured` (server URL/token missing), `○ Not connected` (service unreachable), or `● Connected` (green). Requires Server URL + API Token to be configured.
- **`docker-compose.yml`** — commented-out `hindsight` service block (using `latest-slim` image, ~500 MB) with full environment variable documentation and a matching `# HINDSIGHT_API_URL` entry in the `web` service. Also documents the separate Hindsight database requirement (`sourcedesk_hindsight`).
- **`@vectorize-io/hindsight-client`** added to `optionalDependencies` in `package.json`.

### Changed — v0.9.1
- **`APP_VERSION`** bumped to `0.9.1` in `src/flags.js` and `package.json`.
- **`build.js` `mangle.reserved`** — added `testHindsightConnection`.

---

## [Unreleased — v0.9.0] 🖥️

### Added — v0.9.0
- **Email Summary UI** (`src/index.html`, `src/settings.js`) — new "📧 Email Summaries" sidebar section (shown when a project is loaded and a Server URL is configured); clicking `→` opens the `#modal-email-summaries` modal which fetches `GET /api/email-summaries?token=X&projectId=Y` from the configured server. Displays an overall LLM-generated summary and a per-thread `<details>` accordion. Two action buttons:
  - **📝 Import to Notes** (`importSummaryToNotes()`) — saves the overall summary text as a new Note in the active project.
  - **✅ Create Tasks** (`createTasksFromSummary()`) — parses bullet/numbered action items from the summary and creates Task records in the active project.
- **Token Management UI** in Settings modal (`src/index.html`, `src/settings.js`) — new "Server Connection" + "API Token Management" sections above the MarkItDown settings. Fields: `#settings-server-url` (server base URL) and `#settings-server-token` (API token stored locally, never sent to AI providers). Token list auto-populates when Settings opens if both fields are set; `openTokenManager()` refreshes the list from `GET /api/token-list`. Generate new tokens via `generateApiToken()` with optional label and expiry dropdown. Revoke tokens with per-row `revokeApiToken(token)` button.
- **`GET /api/token-list`** (`server.js`) — new server endpoint; requires `adminToken` query param; returns all tokens from file store (including expired ones marked `expired: true`) so users can audit and clean up. The `token` field is included to allow display of partial token strings in the UI.
- **`POST /api/token-generate`** (`server.js`) — new server endpoint; body `{ adminToken, label?, expiresIn? }`; generates a `crypto.randomBytes(24)` hex token; writes to `.private-documents/api_tokens.json` and optionally to DB; supports `expiresIn` strings like `"30d"`, `"7d"`, `"24h"`, `"1y"` via inline `_parseExpiresIn()` helper; returns `{ status, token, label, createdAt, expiresAt }`.
- **Token expiry** (`server.js` `loadTokens()`) — tokens with `expiresAt` set and in the past are silently skipped; all callers (email-ingest auth, email-summaries auth, token-revoke auth, token-generate auth) automatically reject expired tokens.
- **`--expires-in` flag for `scripts/generate_api_token.js`** — `-e` / `--expires-in` CLI flag accepts duration strings (`30d`, `7d`, `24h`, `1y`); computed `expiresAt` stored in file record; printed to console when set.
- **`state.settings.serverUrl` + `state.settings.serverToken`** (`src/state.js`, `src/boot.js`) — two new settings fields loaded from IndexedDB at boot; saved/loaded in `openSettings()` / `saveSettings()`. Stored under keys `serverUrl` and `serverToken`.

### Changed — v0.9.0
- **`APP_VERSION`** bumped to `0.9.0` in `src/flags.js` and `package.json`.
- **`build.js` `mangle.reserved`** — added `openEmailSummaries`, `importSummaryToNotes`, `createTasksFromSummary`, `openTokenManager`, `generateApiToken`, `revokeApiToken`.

---
---

## [Unreleased] 🖥️

### Changed
- **README — `### Using an existing PostgreSQL database` section** 🖥️ — new section between `### Email Ingest API` and `### Running with Docker` covering how to connect SourceDesk's server to an already-running Postgres instance without spinning up a new one:
  - *Connection string format* table (`USER / PASSWORD / HOST / PORT / DATABASE` with notes on privileges and URL-encoding).
  - *Scenario A — native / bare-metal* — Postgres installed via Homebrew, `apt`, or Postgres.app; `localhost` connection string; macOS Homebrew `brew services` tip; pgvector extension tip for future RAG.
  - *Scenario B — existing Docker container* — host-side Node.js → published port (`localhost`); container-to-container via shared Docker network (by container name) or `host.docker.internal` (Mac/Windows) / `172.17.0.1` / `--add-host` (Linux).
  - *Scenario C — rootless Podman container* — `host.docker.internal` unavailable; bridge IP (`10.0.2.2`) workaround.
  - *First-run migrations* — idempotent, auto-run on `npm run serve`, manual `npm run migrate` also documented.
  - *Recommended Postgres role setup* SQL block (`CREATE ROLE / DATABASE / EXTENSION vector`).
- **README — `### Local server setup`** — `.env` snippet now shows both SQLite and Postgres `DATABASE_URL` options side-by-side with install hints; added `npm run migrate` note below the snippet.

### Added
- **Project ID copy in Edit Project modal** (`src/index.html`, `src/projects.js`) — when editing an existing project the modal now shows a read-only **Project ID** field in `DM Mono` font with a **📋 Copy** button. Clicking copies the ID to the clipboard and shows a brief "✓ Copied!" flash. The row is hidden entirely in New Project (create) mode. Useful for constructing `projectId` values in email-ingest API calls, curl scripts, and Power Automate flows. `copyProjectId()` added to `build.js` `mangle.reserved`.
- **End-of-session checklist in `CLAUDE.md`** — new `### End-of-session checklist` under Dev Workflow enumerates the 7-step sequence (build → changelog → README → CLAUDE.md → version bump → commit message draft → confirm & push) that every coding session must complete before wrapping up. A matching one-liner reminder added to the `### Commits` section.

### Changed
- **README — expanded container deployment section** — the previous single-line `### Docker / Podman` section is replaced by three dedicated sub-sections:
  - `### Running with Docker` — full `docker compose` workflow, volume mount table, Postgres upgrade path.
  - `### Running with Podman` — Homebrew + apt install steps, `podman-compose` workflow, notes on named volumes, native module compilation, and rootless port binding.
  - `### Running with Apple Container (macOS, Apple Silicon)` — covers [`apple/container`](https://github.com/apple/container) (Apple's open-source OCI runtime using the Virtualization framework on M-series Macs): install via Homebrew cask, CLI command mapping table vs Docker, `container run` quick-start with all flags, `container compose` Compose-file support, and notes on native arm64 execution and image isolation from Docker Desktop.
- **`package.json` version** — synced to `0.8.0` (was `0.6.0`; `src/flags.js` `APP_VERSION` was already `0.8.0`).

---

## [Unreleased — previous] 🖥️

### Added
- **Server-side DB backend** (`server/db.js`) — new module supporting SQLite (`better-sqlite3`) and PostgreSQL (`pg`). Both packages are optional `optionalDependencies`; the server falls back to file-only storage when `DATABASE_URL` is not set. Unified async API: `createDb(url)` → `{ run, get, all, exec, close, type, runMigrations }`. SQLite uses the synchronous `better-sqlite3` API wrapped in Promises; PostgreSQL uses `pg` Pool with `?` → `$N` placeholder conversion. `runMigrations(dir)` reads all `.sql` files in the `migrations/` directory in alphabetical order, skipping already-applied ones tracked in `schema_migrations`.
- **Initial DB schema** (`migrations/001_initial.sql`) — SQLite/PostgreSQL-compatible: `schema_migrations`, `users`, `api_tokens` (with `revoked` and `expires_at` columns), `email_ingests`, `email_threads` (upserted per-project, email_count accumulates), `email_messages` (deduplicated by composite `message_key`), `email_summaries` (one per project+user, updated incrementally with `version` counter and `per_thread_json`). All tables use `TEXT PRIMARY KEY` IDs (same `uid()` pattern as the client).
- **Migration runner CLI** (`scripts/migrate.js`) — `npm run migrate` or `DATABASE_URL=… node scripts/migrate.js`; reads `DATABASE_URL` from `.env` or environment; reports newly-applied files; graceful error if DB module is not installed. Migrations also run automatically on server startup.
- **Server-side LLM helper** (`server/llm.js`) — non-streaming LLM calls using only Node.js built-in `https`/`http`. Supports `anthropic` (direct API), `openai` (OpenAI-compat), and `local` (OpenAI-compat at `LOCAL_LLM_URL`). Configured via `.env`: `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. 120-second request timeout.
- **Async LLM email summarization pipeline** (`server.js` — `_summarizeIngest()`) — fire-and-forget function called after the HTTP response is sent. Per-thread: if a previous summary exists for that thread key, only NEW messages are sent to the LLM with an incremental-update instruction (avoids re-processing the full history on every ingest). After all threads are summarized, a second LLM call produces a project-level executive summary (action items, deadlines, vendor contacts, next steps). Results stored in `email_summaries` table with `version` counter, `per_thread_json`, `model`, and `provider` fields.
- **`GET /api/email-summaries`** — new endpoint; query params: `token`, `projectId`. Returns the stored LLM summary for a project including parsed `per_thread_json` and `draft_documents`. Returns 503 if DB is not configured.
- **`POST /api/token-revoke`** — new endpoint; body: `{ adminToken, revokeToken }`. Removes the token from the file-based store and marks it `revoked = 1` in DB (both paths attempted). Returns which stores were updated.
- **DB persistence in `/api/email-ingest`** — when DB is configured, ingest records, thread upserts, and individual messages (deduplicated) are persisted asynchronously after the HTTP response is sent. The response now includes a `llmSummarizing: bool` flag.
- **Token generator now DB-aware** (`scripts/generate_api_token.js`) — if `DATABASE_URL` is set, also creates a `users` record (idempotent — finds existing user by email) and an `api_tokens` record. File-based `.private-documents/api_tokens.json` always written regardless.
- **`📖 Variables` button in Template editor modal** (`src/index.html`) — opens the new Template Variables popup from the template editor footer.
- **Template Variables popup modal** (`#modal-template-vars`, `src/templates.js`, `src/index.html`) — two-section modal:
  - *Built-in Variables* — live table showing all auto-computed variables (`{{PROJECT_NAME}}`, `{{TODAY}}`, date arithmetic examples) with their current values; click any row or its Insert button to insert the `{{VARIABLE}}` reference at the cursor position in the template editor.
  - *Your Constants* — inline-editable table of `KEY=value` pairs from `state.settings.constants`; add rows, delete rows, edit keys/values inline, then 💾 Save to persist back to IndexedDB and sync to the Settings modal textarea.
- **`.env.example`** — fully documented with all variables: `PORT`, `ENVIRONMENT`, `LOCAL_LLM_URL`, `LOCAL_LLM_DEFAULT_MODEL`, `MARKITDOWN_URL`, `DATABASE_URL` (both SQLite and PostgreSQL examples), `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `SUGGESTION_WEBHOOK_URL`.

### Changed
- **`server.js` startup logs** — now show `DB: <type: url>` and `Server LLM: <provider / model>` lines (masked passwords in URLs); also prints `Email ingest:` endpoint URL. DB init errors reported at startup.
- **`GET /health`** — now returns `db` (type string or null) and `dbError` (string or undefined) fields alongside existing `markitdownAvailable` and `docxAvailable`.
- **`Dockerfile`** — adds `python3 make g++` in both builder and runtime stages for native module compilation (`better-sqlite3`); runtime stage now runs `npm ci --omit=dev` to install optional DB packages; copies `server/` and `migrations/` directories; creates `/app/data` and `/app/backups` directories.
- **`docker-compose.yml`** — default `DATABASE_URL` is now `sqlite:./data/sourcedesk.db` with a `data` named volume; Postgres service replaced with `pgvector/pgvector:pg16` (commented out) for future RAG support; LLM env vars (`LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`) added.
- **`.gitignore`** — added `data/` (SQLite db files), `*.db`, `*.db-wal`, `*.db-shm`, `backups/`.

### Build
- `package.json`: adds `"migrate": "node scripts/migrate.js"` script; adds `optionalDependencies`: `better-sqlite3 ^9.6.0`, `pg ^8.13.0`.
- `build.js`: adds `openTemplateVarsModal`, `_tvAddConstantRow`, `_tvDeleteConstantRow`, `_tvSaveConstants`, `_tvInsertVar` to `mangle.reserved`.

---

## [Unreleased]

### Fixed
- **`unloadLocalModel()` probe order inverted** (`src/settings.js`) — previously the function tried Ollama's `/api/generate keep_alive:0` trick first and fell back to LM Studio's `/api/v1/models/unload` on 404. This is now reversed: LM Studio's `/api/v1/models/unload` is tried first because it is a deterministic, version-gated REST endpoint (LM Studio 0.4.0+) with well-defined success/failure semantics. Only if LM Studio returns 404 (endpoint not present) does the function fall back to the Ollama `keep_alive:0` side-effect workaround. This avoids an unnecessary failed round-trip on LM Studio setups and more accurately reflects which server is running.

---

## [Unreleased] 🗄️

### Fixed
- **Guidelines preview truncation** (`src/guidelines.js`) — the guideline detail panel previously showed only a 300-character teaser of the converted document’s content. The preview limit has been raised to 2 000 characters, rendered in a scrollable box, with a **✎ View / Edit** button always visible so the full content is reachable via the doc editor modal without leaving the Guidelines view.
- **Non-streaming request body silently ignored through local LLM proxy** (`src/guidelines.js`, `src/evaluation.js`) — when routing local LLM requests through the server-side `/proxy` endpoint, `buildApiCall()` wraps the real request body in a proxy envelope: `{ url, method, headers, body: "<inner-JSON-string>" }`. Both the Guidelines analyser and the Proposal Evaluation candidate scorer attempted to disable streaming by calling `JSON.parse(apiCall.body)` and setting `bodyObj.stream = false` — but `apiCall.body` in the proxy case is the *outer* envelope object, not the inner body string. The LLM therefore still received `stream: true`, returned an SSE text response, and the subsequent `resp.json()` call failed with `Unexpected token 'd', "data: {\"id\"...is not valid JSON"`. Fixed in both files by detecting the proxy envelope shape (`typeof apiCall.body === 'string'` vs. `typeof apiCall.body === 'object'`) and patching `stream: false` inside the serialised inner body before re-stringifying the envelope.

### Added
- **Guideline Analyses persistence** 🗄️ (`src/guidelines.js`, `src/db.js`) — analysis results are now saved to a new `guidelineAnalyses` IndexedDB store (DB_VERSION bumped 11 → 12, `projectId` index). Each record stores provider name, model ID, analysed doc IDs and names, full results text, a user-editable label, timestamps, an `isMaster` flag, `sourceIds` for master provenance, and a `versions[]` array for master synthesis history.
- **"This Doc" and "Analyze All" action buttons** (`src/guidelines.js`, `src/index.html`) — the Guidelines right panel now shows a persistent action bar with three buttons: **This Doc** (analyzes only the currently selected guideline doc via `analyzeThisGuideline()`), **Analyze All** (analyzes all guideline docs for the project), and **Master** (opens the master synthesis modal). A single `#guidelines-content-area` div hosts whichever view is active (doc preview, analysis results, or the chips bar).
- **Analysis chips bar** (`src/guidelines.js`) — a row of chips rendered by `_renderAnalysisBar()` shows all saved analyses for the project. Each chip displays a short model name (`_gaModelShort()`), a relative timestamp (`_gaRelTime()`), and a doc count. Clicking a chip calls `selectGuidelineAnalysis(id)` to display that analysis; a hover ✕ calls `deleteGuidelineAnalysis(id)`. The active chip is highlighted with `var(--accent)`.
- **Inline label editing for analyses** (`_gaStartLabelEdit()`, `_gaSaveLabel()`, `_gaSaveAnalysisLabel()`) — each analysis chip's label can be edited in-place; Enter saves, Esc cancels. Auto-generated labels default to `"Analysis N (M docs)"` or `"Master N"` but can be renamed freely. Same pattern applies to master version rows.
- **Master synthesis** (`openCreateMasterAnalysis()`, `runCreateMaster()`) — the **Master** button opens `modal-ga-master` which lists all non-master saved analyses with checkboxes and a count, model, and label per row. Selecting two or more and clicking **Create Master** sends a structured synthesis prompt (all analysis texts concatenated) to the active LLM as a non-streaming request, then saves the result as a new `guidelineAnalyses` record with `isMaster: true`. If a previous master already exists for the project, the new synthesis is appended as a new entry in `versions[]` on the existing master record rather than creating a duplicate.
- **Master versioning** (`_saveGAVersion()`, `openGAVersionHistory()`, `restoreGAVersion()`, `deleteGAVersion()`) — master analyses accumulate all past synthesis runs in `record.versions[]`. A **History** button in the analysis display opens a versioned list in `#guidelines-content-area`; each row shows an auto or custom label, timestamp, and a 100-char preview. **Restore** replaces the master's current results text (saving the displaced content as a new version first); **Delete** removes that version entry.
- **Analysis diff** (`openGADiff()`, `_openGACompareModal()`) — a **Diff** button on analysis chips and on version rows opens `modal-ga-diff` (a new modal powered by `src/diff.js` LCS line-level diff) to compare any two analyses or master versions. The modal header shows `+N/-N` change stats; the body renders the inline colour-coded diff.
- **`guidelineAnalyses` in export / import / backup / cascade delete** (`src/settings.js`, `src/drive.js`, `src/projects.js`) — the new store is included in the `exportDatabase()`, `importDatabase()`, `clearAllData()`, and `backupToDrive()` store arrays, and is cascade-deleted when `deleteProject()` removes a project.

### Build
- `build.js`: adds `analyzeThisGuideline`, `selectGuidelineAnalysis`, `deleteGuidelineAnalysis`, `openCreateMasterAnalysis`, `runCreateMaster`, `openGAVersionHistory`, `restoreGAVersion`, `deleteGAVersion`, `openGADiff`, `_gaStartLabelEdit`, `_gaSaveLabel`, `_gaSaveAnalysisLabel`, `_openGACompareModal` to `mangle.reserved`

---

## [Unreleased]

### Added
- **Guidelines — global view across all projects** (`src/guidelines.js`) — `loadGuidelines()` and `_runAnalyze()` now load ALL guideline docs from ALL projects using `dbGetAll("docs")` instead of filtering by the active project. Similarly, all saved analyses are loaded globally with `dbGetAll("guidelineAnalyses")`. Each doc card in the list shows a small muted project-name badge in the sub-line; each analysis chip shows a matching badge so you can tell at a glance which project an item belongs to. Uploads and new analysis runs still save to the currently active project.
- **Create Task / Create Template — persistent tracking** (`src/guidelines.js`) — after clicking **+ Create Task** or **+ Create Template** in an analysis result, the button now permanently shows **✓ Created** (green) rather than resetting after 2 seconds. An **↗ Open Task** or **↗ Open Template** button is appended immediately beside it; clicking either navigates to the relevant view and opens the newly created record directly.
- **⏏ Unload model button** (`src/settings.js`, `src/index.html`) — new button visible only when provider = Local LLM; appears in both the topbar local-model selector and the Settings modal Base URL row. Clicking it attempts to evict the current model from VRAM using two sequential strategies: (1) **Ollama** — `POST {root}/api/generate` with `{"model": model, "keep_alive": 0}`; (2) **LM Studio 0.4+** — `POST {root}/api/v1/models/unload` with `{"identifier": model}` (only tried if Ollama returns 404). Both paths derive the server root by stripping the `/v1` suffix from the configured base URL. Status feedback ("✓ Unloaded (Ollama)" / "✓ Unloaded (LM Studio)" / "⚠ HTTP N" / "✗ error") auto-clears after 4 seconds.

### Fixed
- **Unload model — LM Studio fallback** (`src/settings.js`) — initial implementation only tried the Ollama `/api/generate keep_alive: 0` path. LM Studio does not expose that endpoint and returns 404. The function now detects a 404 response and falls back to LM Studio's own `POST /api/v1/models/unload` endpoint (introduced in LM Studio 0.4.0), so the button works on both servers.

### Known limitation / next-session TODO
- The Ollama-first / LM Studio-fallback order in `unloadLocalModel()` should be **inverted** in a future session: LM Studio's `/api/v1/models/unload` endpoint is deterministic and version-gated (0.4.0+), making it the better primary probe; Ollama's `/api/generate keep_alive: 0` approach is a side-effect-based workaround and should be the fallback. Inverting the order avoids an unnecessary round-trip failure on Ollama setups where LM Studio's path would also 404. See `unloadLocalModel()` in `src/settings.js`.

### Build
- `build.js`: adds `unloadLocalModel` to `mangle.reserved`

---

## [Unreleased]

### Added
- **Local LLM server-side proxy** (`server.js`, `src/flags.js`, `src/api.js`, `src/settings.js`, `src/retrieval.js`) — browsers enforce a strict CORS rule that prevents `Authorization` from being covered by a wildcard `Access-Control-Allow-Headers: *`, which LM Studio and Ollama both use. When running via `npm run serve`, all local LLM requests (chat completions, model detection, embeddings) are now routed through a new `POST /proxy` endpoint in `server.js`. Node.js makes the outbound request server-side with no CORS restrictions, then streams the SSE response back transparently. A new `_localFetch(url, options)` helper in `src/flags.js` automatically routes through the proxy when `window.__SOURCEDESK_ENV__` is present, and falls back to direct `fetch` otherwise (e.g. `file://` origin).
- **LM Studio `/api/v1` compatibility** (`src/api.js`, `src/retrieval.js`) — newer LM Studio versions expose model listing at `/api/v1/models` (their own schema with `key` and `display_name` fields) but the OpenAI-compatible chat/embeddings endpoints live at `/v1/`. A regex normalisation step now strips `/api` from the configured base URL when building chat-completion and embedding request URLs, so both `/api/v1` and `/v1` base URLs work transparently without any extra configuration. Model identifiers (`key`) and display names (`display_name`) from the LM Studio schema are now recognised alongside the standard OpenAI `id`/`name`/`model` fields.
- **Doc conversion: original file storage + editor modal** (`src/panel.js`, `src/index.html`) — uploaded documents now preserve their original binary content (stored as base64 in the `docs` IndexedDB record alongside the converted Markdown). New fields on `docs` records: `originalData`, `originalMimeType`, `conversionMethod` (`markitdown` | `drive` | `text`). The upload pipeline now shows live per-file status messages in the right panel (`Reading…` → `Converting with MarkItDown…` → `✓ Converted with MarkItDown`). Each doc card shows a coloured conversion badge (MarkItDown / Drive / Text) and two new buttons: **Edit** (opens a markdown editor modal with Save, ↓ Markdown, ↓ Original, and ⟳ Re-convert) and **⟳** (re-runs MarkItDown on the stored original directly from the card). `convertWithMarkitdown` now accepts a pre-read base64 string to avoid reading the file twice. New helper `readFileAsBase64(file)` in `src/panel.js`.
- **Guidelines uploader parity** (`src/guidelines.js`, `src/index.html`) — `handleGuidelineUpload` now uses the same three-stage pipeline (MarkItDown → text fallback), stores `originalData`/`originalMimeType`/`conversionMethod`, and shows live status via `#guidelines-upload-status`. Guideline list items now show a conversion badge and a ✎ Edit button that opens the shared doc editor modal.
- File inputs in both the right panel and the Guidelines view now accept `.xlsx` and `.pptx` in addition to existing types.

### Fixed
- **Local provider API key not loaded on boot** (`src/boot.js`, `src/state.js`) — `apiKey_local` was written to IndexedDB by `saveSettings()` but never read back on page load. `state.settings.localKey` was always `""` after a refresh, causing chat completions to omit the `Authorization` header and the Settings modal to show a blank API key field for the local provider. Fixed by loading `apiKey_local` → `state.settings.localKey` in `boot()` and initialising `localKey: ""` in the state object.
- **Misleading "check URL & CORS" error for all model-detection failures** (`src/settings.js`) — `fetchLocalModels` previously showed the same generic message for every failure including HTTP 401 and empty model lists. The catch block now surfaces the actual error. A 401 specifically shows "HTTP 401 — enter the API key in the field above". An empty model list shows "Empty model list — load a model in LM Studio first (response keys: …)". Models returned but with unrecognised ID fields shows the first model's actual key names to aid diagnosis.

### Fixed (continued)
- **`.docx` / `.xlsx` / `.pptx` conversion silently falling back to binary garbage** (`server.js`, `src/panel.js`) — `markitdown` was installed without its optional format-support extras (`mammoth` for docx, `openpyxl` for xlsx, `python-pptx` for pptx). The `/health` check only verified that the `markitdown` command existed (via `--help`), so the Settings Test button incorrectly showed "✓ markitdown ready" even though actual conversions failed. Fixed by:
  - Running `pip install "markitdown[all]"` to install all optional format dependencies.
  - Adding `_testDocxConversion()` in `server.js` — writes a tiny embedded test `.docx` to a temp file and runs markitdown on it; only passes if the output contains the known test string. `checkMarkitdown` now runs this as a second step after the basic `--help` check.
  - `/health` now returns a new `docxAvailable` boolean that reflects whether the real docx conversion test passed.
  - The Settings "Test" button for MarkItDown now shows three distinct states: ✓ fully ready / ⚠ installed but missing format deps (with exact `pip install` hint) / ✗ not found.
  - Error messages from `/convert` are now truncated to 400 characters (first-line extraction) so long Python tracebacks don't overflow the status bar.
  - For binary-only file types (`.docx`, `.xlsx`, `.pptx`, `.pdf`), the upload fallback no longer calls `readFileAsText()` which produced unreadable binary garbage. Instead a human-readable placeholder is stored (with recovery instructions and the ⟳ re-convert hint), and `conversionMethod` is set to `"failed"`. The doc card badge now shows `⚠ Failed` in red for these records.
  - The upload status auto-hides after **12 seconds** for errors/warnings vs 4 seconds for success, giving users time to read actionable messages.
  - The server startup log now correctly distinguishes between markitdown-not-found, markitdown-installed-but-no-docx-support, and fully-functional.

- **Word TOC links and embedded image placeholders polluting converted Markdown** (`server.js`) — markitdown faithfully reproduces a Word document's Table of Contents as Markdown hyperlinks (`[Section Name 6](#_Toc224551634)`) and embedded images as data-URI placeholders (`![](data:image/jpeg;base64...)`). For a 40-page manual this produced ~133 lines / 4 KB of TOC noise at the top of the document before any real content, significantly hurting BM25 retrieval quality. Fixed by `_cleanMarkdown(markdown)` in `server.js`, called on every `/convert` response before it is returned to the browser:
  - Line filter drops any line whose trimmed content matches `[text](#_TocNNNNN)` (TOC anchor links).
  - Line filter drops any line that is *only* a data-URI image placeholder.
  - Global string replace strips inline data-URI image placeholders that appear mid-line (e.g. a logo prepended to the first paragraph).
  - Collapses 3+ consecutive blank lines to 2.
  - Result on a real 40-page procurement manual: 733 → 600 lines, 49894 → 45834 chars.

### Build
- `build.js`: adds `openDocEditor`, `saveDocContent`, `downloadDocOriginal`, `downloadDocMarkdown`, `reconvertDoc` to `mangle.reserved`
- `server.js`: adds `POST /proxy` endpoint; requires `https` module; startup log now includes the proxy URL

---

## [Unreleased]

### Added
- **Enhanced Supplier Questions view** — major upgrade adapting the BidNet Q&A toolkit workflow into the web UI:
  - **BidNet HTML import** — `📥 BidNet HTML` toolbar button opens a file picker for saved BidNet Q&A HTML pages; in-browser `parseBidNetHtml()` (adapted from `scripts/extract_qna_consolidated.py` + `bidnet_export.js`) uses `DOMParser` to extract `questionNo`, `vendor`, `contactName`, `topic`, and `text` from `.questionAnswerTitle` / `#questionContainer_*` / `.vendorName` / `.questionNo` elements; preview modal shows first 20 rows (Q# | Vendor | Topic | Question) with item count; `executeBidNetImport()` writes all items to IndexedDB with `status: 'unanswered'` and preserved insertion order
  - **Question status** — four statuses: `unanswered` (○), `answered` (✅), `needs-review` (⚠), `todo` (🔲); pill row in the detail panel; `setSQStatus()` persists to DB; backward-compatible via `_sqEffectiveStatus()` which derives status from `draftAnswer` for legacy records
  - **AI confidence** — system prompt instructs the model to append `[CONFIDENCE: HIGH/MEDIUM/LOW]` marker; `generateAnswerForQuestion()` parses and strips the marker, auto-sets status (`HIGH → answered`, `MEDIUM → needs-review`, `LOW → todo`), saves `confidence` field to DB; confidence pill row shown only for answered/needs-review questions; `setSQConfidence()` allows manual override
  - **Question metadata** — `sq-meta` panel shows questionNo, topic (accent colour), vendor (with 🏢 icon), and contactName (with 👤 icon) when available; hidden when all fields are empty; populated from BidNet import or manually set
  - **Batch generation** — `⚡ Batch (10)` button finds the next 10 unanswered questions and generates answers sequentially with live progress counter (`Generating N/10…`) in the button; completion alert shows how many remain
  - **Summary export** — `📊 Summary` button generates a structured Markdown report: statistics table, vendor breakdown, @TODO items table, needs-review section, and full Q&A table with status/confidence; saved as `qa-summary-<project>-<timestamp>.md`
  - **Enhanced list** — count row shows `N total · N open · N ⚠ · N @todo` breakdown; list items show vendor name as sub-text and questionNo prefix in monospace; status icon coloured (green ✅ / amber ⚠ / muted ○🔲)
  - **Auto-promote on manual save** — `saveCurrentSQAnswer()` auto-sets `status: 'answered'` when text is typed into a previously unanswered question
  - **Enhanced export** — `exportSelectedQuestions()` / `exportAllQuestions()` now include topic, vendor, and `[Confidence: HIGH]` annotation in the Markdown output
- **RTE link button** — `🔗` button added to the rich-text editor toolbar (between `</>` code and the separator before lists); works in **both** raw and rendered modes — raw mode wraps the selected text as `[text](url)` in the textarea; rendered mode uses `execCommand('createLink', url)`; `markdownToHtml()` already converted `[text](url)` to `<a href=...>` so round-trip is fully supported

### Changed
- `supplierQuestions` records now support new optional fields: `status`, `confidence`, `vendor`, `contactName`, `topic`, `questionNo` — existing records without these fields are handled defensively (no DB migration needed, no DB version bump)

### Build
- `build.js`: adds `parseBidNetHtml`, `openBidNetImportModal`, `handleBidNetImportFile`, `executeBidNetImport`, `generateBatch`, `setSQStatus`, `setSQConfidence`, `exportSQSummary`, `_sqEffectiveStatus` to `mangle.reserved`
- Production build: ~383.9 KB total / ~189.6 KB JS

---

## [Unreleased] 🗄️

### Added
- **Research project type — first cut** (roadmap item 4) — new `Research` project category with dedicated 🔍 **Research Board** view, new `research` IndexedDB store, new module `src/research.js`. Brave Search modal queries `https://api.search.brave.com/res/v1/web/search` (`X-Subscription-Token` header) and renders 10 results with per-row "+ Add" buttons. "+ Add URL" modal supports manual entries with title and comma-separated tags. Per-card actions: **⤓ Crawl** (POST `<crawl4aiUrl>/crawl` with the documented browser/crawler config, prefers `fit_markdown` → `markdown` → `html`), **✨ Summarise** (active LLM via `buildApiCall()` + `parseStreamDelta()` streaming, procurement-tuned system prompt, ~12 KB content cap), **✕ Delete**, and **Include in context** toggle. Items toggled into context are injected into the chat system prompt under `## Research`. Sidebar gains a "Research" section with a nav button shown whenever a project is loaded.
- **Rich-text editor scaffolding** (roadmap item 15) — new module `src/editor.js` exposes `mountRichEditor(textarea, opts)`, `destroyRichEditor`, `setRichEditorMode`, and `refreshRichEditor`. Each editor wraps an existing `<textarea>` with a toolbar (H1/H2/H3, **Bold**, *Italic*, <u>Underline</u>, `code`, bullet list, numbered list, blockquote, 2x2 table, page break) and a Raw ⇄ Rendered mode toggle. Round-trip safe markdown ⇄ HTML conversion preserves headings, inline marks, lists, blockquotes, code fences, links, and tables. Mounted at boot on the Working Document, Notes, Templates, and Supplier-Q answer textareas. Existing autosave wiring is preserved (the rendered surface dispatches an `input` event on the underlying textarea after every edit). Programmatic `textarea.value` assignments now call `refreshRichEditor()` to keep the rendered surface in sync (notes selection, working-doc fill, version restore, template open/edit, SQ select, SQ generation, createTemplateFromDoc).
- **Feature suggestion box** (roadmap item 16) — 💡 button in the topbar opens a modal where you can submit feature ideas with a title, category, and details. Suggestions are persisted locally to the new `suggestions` IndexedDB store and, if a `Suggestion Webhook URL` is configured in Settings, also POSTed there as JSON. Includes a "View All" manager (delete + JSON export). New module `src/suggestions.js`.
- **Brave Search + crawl4ai Settings fields** (roadmap item 5) — prerequisite for the Research project type. New settings inputs: **Brave Search API Key**, **crawl4ai Endpoint** (default `http://localhost:11235`), **Suggestion Webhook URL**. Each test button calls the appropriate health/test endpoint and reports status. Persisted via `saveSettings()` and loaded on boot. New helpers `testBraveKey()` and `testCrawl4aiEndpoint()` in `src/settings.js`.
- **Templates autosave** (follow-up for roadmap item 14) — when editing an existing template, name and content fields are debounced-autosaved (1.5 s) to IndexedDB without closing the modal. New helper `scheduleTemplateAutosave()` in `src/templates.js`; status pill `#autosave-status-template` shown in the modal title row. New templates still require an explicit Save click before autosave activates.
- **Help modal**: link to the Suggestion Box added to the Shortcuts and About panes.

### Changed
- DB schema bumped to **`DB_VERSION = 10`** — adds `research` object store (`projectId` index). Existing data migrates with no further changes.
- `clearAllData()`, `exportDatabase()`, `importDatabase()`, and `backupToDrive()` now include `research` (and `suggestions`) in their store list.

### Build
- `build.js`: includes `src/suggestions.js`, `src/research.js`, and `src/editor.js`; adds reserved names for the research module (`openResearchSearch`, `runResearchSearch`, `addResearchFromBrave`, `openAddResearchManual`, `submitResearchManual`, `loadResearchBoard`, `crawlResearchItem`, `summariseResearchItem`, `deleteResearchItem`, `toggleResearchInContext`) and the editor (`mountRichEditor`, `destroyRichEditor`, `setRichEditorMode`, `refreshRichEditor`, `_rteMarkdownToHtml`, `_rteHtmlToMarkdown`).
- Production build now ships at ~343 KB total / ~168 KB JS.

### Tests
- `tests/test.html`: includes `suggestions.js`, `research.js`, and `editor.js`; new suites cover `SUGGESTION_CATEGORIES`, the local HTML escaper, public function presence, the new settings defaults (`braveApiKey`, `crawl4aiUrl`, `suggestionWebhook`), the Templates autosave hook, the rich-text editor (10 tests — markdown→HTML, HTML→markdown, round-trip, mount/destroy lifecycle, raw ⇄ rendered mode toggle), and the research module (3 tests — public function presence, `_stripBraveTags`, `_escResearch`).

---

## [0.8.0] - 2025-07-19 🗄️

### Added
- **Chat session titles** — each chat session now has an auto-generated short title derived from the first 8 words of the first user message (title-cased); displayed in the sidebar "Chats" list instead of the raw content preview; stored as a `title` field on the `chats` record; existing sessions fall back gracefully to the content preview
- **Chat session search** — a live search input above `#chat-session-list` in the sidebar filters sessions by title and message content in real time; `filterChatSessions(query)` fetches all sessions for the active project and delegates to a shared `_renderChatSessionItems()` helper used by both search and the standard list render
- **Message editing and regeneration**:
  - **✏ Edit** button appears on hover on every user message bubble; clicking it replaces the bubble with an inline textarea pre-filled with the original content plus **✓ Resend** and **✗ Cancel** buttons; Resend truncates `state.messages` at that index, removes DOM elements from that index onward, and calls `sendMessage()` with the new text
  - **↺ Regenerate** button appears on hover on every assistant message bubble; clicking it removes the last assistant message from state and the DOM, restores the preceding user message into `#chat-input`, and calls `sendMessage()`
  - `appendMessageEl()` now accepts an optional `msgIndex` parameter; `renderMessages()` passes the forEach index so edit/regen always know their position in history
  - New CSS classes: `.msg-action-btn`, `.msg-edit-btn`, `.msg-regen-btn`, `.msg-edit-textarea`, `.msg-edit-actions`
- **Working Document versioning** — every `saveWorkingDoc()` call silently snapshots the content into a new `docVersions` store:
  - **History button** added to the Working Document view header (between ← Back and Save); opens a modal listing all snapshots for the active project, sorted newest-first, each showing auto-label ("Version N"), timestamp, and 100-char content preview
  - **Restore** — prompts for confirmation, saves the current content as a snapshot first, then applies the selected version to `state.activeProject.workingContent`, writes to DB, and updates the editor textarea if open
  - **Delete** — removes a single snapshot with confirmation; re-renders the history modal in place
  - `saveDocVersion(content)`, `openVersionHistory()`, `restoreDocVersion(versionId)`, `deleteDocVersion(versionId)` in new `src/versioning.js`
- **Task Management** — per-project task list, accessible via "Tasks →" in the sidebar (appears when a project is loaded):
  - Two-panel layout: left panel is a scrollable task list with real-time filter; right panel is a detail/edit form
  - Task fields: title (required), description (optional), status (To Do / In Progress / Done), priority (Low / Medium / High), due date (date picker), include-in-context toggle
  - Full CRUD: `openNewTask()`, `selectTask(taskId)`, `saveCurrentTask()`, `deleteCurrentTask()`
  - `filterTaskList(value)` — real-time filter on task title
  - **Include in context** — tasks with `includeInContext = true` and `status !== 'done'` are injected into the system prompt as `## Active Tasks` on every `sendMessage()` call
  - `state.currentTask` added to the global state object
  - `src/tasks.js` — new source file; all task view logic

### Changed
- `DB_VERSION` bumped `5 → 6`; `onupgradeneeded` adds two new stores: `docVersions` (keyPath `id`, index `projectId`) and `tasks` (keyPath `id`, index `projectId`)
- `docVersions` store shape: `{ id, projectId, content, savedAt, label }`
- `tasks` store shape: `{ id, projectId, title, description, status, priority, dueDate, includeInContext, createdAt, updatedAt }`
- `saveWorkingDoc()` in `src/settings.js` now calls `saveDocVersion(ta.value)` after writing to the `projects` store
- `sendMessage()` in `src/chat.js` now queries `tasks` for `includeInContext` items and appends `## Active Tasks` to the system prompt
- `showView()` in `src/boot.js` handles `'tasks'` view; `loadProject()` shows `#tasks-nav-btn`
- `renderChatSessionList()` refactored to call shared `_renderChatSessionItems()` helper; respects current search input value on re-render
- `build.js` — `src/versioning.js` and `src/tasks.js` added to `SRC_FILES`; `filterChatSessions`, `openVersionHistory`, `restoreDocVersion`, `deleteDocVersion`, `saveDocVersion`, `loadTasks`, `renderTaskList`, `selectTask`, `openNewTask`, `saveCurrentTask`, `deleteCurrentTask`, `filterTaskList`, `toggleTaskStatus`, `toggleTaskInContext` added to `mangle.reserved`

### Build
- Total bundle size: 230.6 KB (+28.7 KB over v0.7.0)  |  JS 95.1 KB

---

## [0.7.0] - 2025-07-19 🗄️

### Added
- **Prompt Library** — save, organise, and reuse prompts across any chat session:
  - **📚 book icon button** left of the chat input (between the 📎 attach button and the textarea) opens a dropdown showing library entries; favorites at the top, then the 5 most recent non-favorited entries below a divider; clicking any entry inserts it directly into the chat input
  - **Save to library button** — a 📚 button appears on hover next to any user message bubble; clicking it opens a modal to give the prompt a title, preview the content, and optionally mark it as a ★ favorite
  - **Manage Library modal** — accessible from the "Manage library" footer link in the dropdown; shows all entries sorted favorites-first then newest; each row has inline ★/☆ favorite toggle, ✎ inline edit (title + content), and ✕ delete with confirmation
  - `openPromptLibrary()` / `closePromptLibrary()` — toggle the dropdown; closes on outside click
  - `renderPromptLibraryDropdown()` — renders favorites section + up to 5 recent entries; wires click handlers via `addEventListener`
  - `insertPrompt(content)` — sets `#chat-input` value and fires `input` event so the textarea auto-resizes
  - `openSavePromptModal(content)` — modal with title input, content preview, and favorite checkbox; content stashed in a data attribute to avoid escaping issues
  - `openManagePromptLibrary()` — full manager modal with inline edit/delete/favorite per entry
  - `savePromptEntry(entry)` / `deletePromptEntry(id)` / `togglePromptFavorite(id)` — DB wrappers
  - `src/promptLibrary.js` — new source file; all prompt library logic

### Changed
- `DB_VERSION` bumped `4` → `5`; `onupgradeneeded` adds the `promptLibrary` object store (keyPath `id`, no indexes)
- `promptLibrary` store shape: `{ id, title, content, favorite, createdAt, updatedAt }`
- `appendMessageEl()` in `src/messages.js` — user message bubbles now include a hover-revealed 📚 save-to-library button; click handler attached via `addEventListener` to avoid content-escaping issues
- `build.js` — `src/promptLibrary.js` added to `SRC_FILES` (between `src/attachments.js` and `src/ui.js`); `openPromptLibrary`, `closePromptLibrary`, `renderPromptLibraryDropdown`, `insertPrompt`, `openSavePromptModal`, `openManagePromptLibrary`, `savePromptEntry`, `deletePromptEntry`, `togglePromptFavorite` added to `mangle.reserved`

### Build
- Total bundle size: 201.9 KB (+13.7 KB over v0.6.0)  |  JS 81.3 KB

---

## [0.6.0] - 2025-07-19

### Added
- **Multi-session chat** — each project now supports multiple saved chat sessions instead of a single rolling conversation:
  - **New Chat button** — `+` button in the sidebar "Chats" section starts a fresh session (prompts for confirmation if the current session has messages); previous sessions are preserved and accessible from the list
  - **Chat session list** — sidebar "Chats" section shows all saved sessions for the active project, sorted newest-first, each showing timestamp and a 60-char preview of the first message; clicking a session loads it
  - **`newChat()`** — clears `state.messages` and `state.activeChatId`, resets the message pane
  - **`renderChatSessionList()`** — fetches all chat records for the active project and renders them into `#chat-session-list`; called on project load and after every save
  - **`loadChatSession(chatId)`** — loads a specific session's messages into state and re-renders
  - **`state.activeChatId`** — tracks the `id` of the currently loaded chat record; `null` for a brand-new unsaved session
  - **`saveChat()` rewritten** — creates a new record (with `createdAt`/`updatedAt`) on first save of a new session; updates the existing record (bumps `updatedAt`) on subsequent saves
- **Temporary file attachments** — paperclip 📎 button left of the chat input attaches files to the current message without saving them to the project document store:
  - Supports `.txt`, `.md`, `.csv`, `.json`, `.pdf`, `.docx`, and all image formats
  - Text files are extracted and injected into the system prompt under `## Attached Files (this message only)`
  - Images are base64-encoded and sent as vision content (Anthropic native vision format and OpenAI-compat `image_url`)
  - Attached files shown as removable chips in `#chat-attachments-bar` above the input row; cleared automatically after send
  - `openAttachMenu()`, `handleAttachFiles(files)`, `removeAttachment(index)`, `clearPendingAttachments()`, `renderAttachBar()`, `getPendingAttachments()` — all in new `src/attachments.js`
- **Streaming / "AI is writing" indicator** — animated three-dot pulse bar (`#streaming-indicator`) appears above the input area while a response is streaming; hidden at rest; `showStreamingIndicator()` / `hideStreamingIndicator()` called from `sendMessage()`
- **Context usage meter** — thin bar and token counter below the chat input shows approximate context fill vs. the model's context window:
  - Estimates tokens as `chars / 4`; tallies all messages + pending attachment text + current input
  - Bar colour transitions: accent (< 60 %) → amber (60–85 %) → danger (> 85 %)
  - Label format: `~Xk / 200k`; updates on every keystroke and after each streaming response
  - Per-model context limits defined in `CONTEXT_LIMITS` map in `src/attachments.js`; defaults to 100k for unknown models
  - `updateContextMeter()` — pure DOM update; safe to call at any time
- **`src/attachments.js`** — new source file; all attachment, context-meter, and streaming-indicator logic

### Changed
- `DB_VERSION` bumped `3` → `4`; `onupgradeneeded` adds a `sessionId` index to the existing `chats` store on upgrade (idempotent guard via `indexNames.contains`)
- `chats` store schema extended: records now carry `{ id, projectId, sessionId, messages[], createdAt, updatedAt }`
- `loadProject()` now selects the session with the highest `updatedAt`/`createdAt` as the active session on project load
- `clearChatHistory()` resets `state.activeChatId = null` and calls `renderChatSessionList()` after wiping messages
- `sendMessage()` — snapshots and clears `_pendingAttachments` before async work; injects text attachments into system prompt; builds vision content arrays for image attachments (Anthropic and OpenAI-compat formats); calls `showStreamingIndicator` / `hideStreamingIndicator` / `updateContextMeter`
- Chat input `oninput` handler now calls `updateContextMeter()` so the meter stays live as the user types
- Sidebar "Chats" section added above "Recent" with `+` (New Chat) button and `#chat-session-list` scroll area (max-height 140 px)
- `build.js` — `src/attachments.js` added to `SRC_FILES`; `newChat`, `renderChatSessionList`, `loadChatSession`, `openAttachMenu`, `handleAttachFiles`, `removeAttachment`, `clearPendingAttachments`, `renderAttachBar`, `getPendingAttachments`, `updateContextMeter`, `showStreamingIndicator`, `hideStreamingIndicator` added to `mangle.reserved`

### Build
- Total bundle size: 188.2 KB (+13.2 KB over v0.5.1)

---

## [0.5.1] - 2025-07-19

### Added
- **Local model quick-selector** — when provider is set to Local LLM, a compact model `<select>` dropdown and ⟳ re-detect button appear directly in the topbar, letting you switch models or re-query `/models` without opening Settings; hidden for all other providers
- **`topbarModelChange(modelId)`** — persists the selected model to `state.settings` and IndexedDB; syncs the Settings modal selector if it is open
- **`refreshTopbarModels()`** — re-runs `fetchLocalModels()` then calls `syncTopbarModelSelect()` to mirror the updated list in the topbar
- **`syncTopbarModelSelect()`** — copies options and selected value from the settings-modal `<select>` into the topbar selector; called automatically after every model detection run and when Settings opens on the local provider

### Changed
- Chat input placeholder updated from "Ask Claude anything about this project…" to "Ask the AI model anything about this project…"
- Working Document editor placeholder updated to replace "Claude" with "the AI model"
- `updateProviderUI()` now toggles visibility of `#topbar-local-model` alongside the existing local-URL row
- `build.js` — `topbarModelChange`, `refreshTopbarModels`, `syncTopbarModelSelect` added to `mangle.reserved`
- README roadmap — marked **Template variable date expressions** and **Template variable preview** as completed (both shipped in v0.4.x); added **Local model quick-selector** as completed; added new **AI Provider UX** roadmap section with future items

---

## [0.5.0] - 2026-04-28 🗄️

### Added
- **Supplier Questions** — new full-screen view (sidebar → "Supplier Q →") for managing supplier/vendor questions against an RFP or procurement document:
  - **Add Questions modal** — paste questions one at a time or in bulk; smart parsing splits on blank lines first, then falls back to numbered-list detection (`1.`, `2)`, etc.), then treats the whole input as a single question
  - **Question list** — checkboxes for batch operations; ✅ icon when a draft answer exists, ○ when not; real-time filter input; question count badge; hover-reveal delete button; Select All checkbox
  - **Detail panel** — full question text with **📋 Copy Q** button; draft answer textarea with **📋 Copy A** button; auto-saves 1.5 s after you stop typing; manual **Save Answer** button
  - **⚡ Generate** — streams an LLM-generated answer for the current question; uses BM25 retrieval against active project documents as context; live streaming preview while generating
  - **⚡ Generate Selected** — runs answer generation sequentially for all checked questions
  - **⬇ Export Selected / Export All** — downloads a clean Markdown `.md` file (`## Question N` / `### Answer` / `---` format) for sharing with vendors or internal review
  - **Notes →** button in the view header for quick access to the project's Notes view
- **`supplierQuestions` IndexedDB store** — schema: `{id, projectId, text, draftAnswer, createdAt, updatedAt}`; indexed by `projectId`; cascade-deleted when the parent project is deleted

### Changed
- `DB_VERSION` bumped `2` → `3` to add the `supplierQuestions` store
- `APP_VERSION` bumped to `v0.5.0`
- `package.json` version bumped to `0.5.0`
- `build.js` — `src/supplierQuestions.js` added to `SRC_FILES`; all 15 new SQ functions added to `mangle.reserved`

---

## [0.4.6] - 2025-07-18

### Fixed
- **Provider API key switching** — switching providers in the Settings modal now correctly saves the previously-typed key under the old provider before loading the new provider's key. Previously, `onProviderChange()` called `getActivePill("provider-pills")` to determine the old provider, but `selectPill()` runs first in the onclick handler, so the pill had already switched to the new provider — causing the key to be saved under the wrong slot. Fixed by reading `state.settings.provider` instead, which still holds the previous provider until Save is clicked.

### Changed
- `APP_VERSION` bumped to `v0.4.6`
- `package.json` version bumped to `0.4.6`

---

## [0.4.5] - 2025-07-17

### Added
- **Font redesign** — replaced the DM Serif Display / Instrument Sans / DM Mono stack with Syne 700 (display headings), Inter 400/500/600 (body UI), and JetBrains Mono 400/500 (labels, badges, code); more distinctive, less "Claude-flavored"
- **Keyboard shortcuts** — global `keydown` handler added: `Ctrl+Enter` sends chat message; `Escape` closes any open modal; `Ctrl+N` creates a new note (Notes view only); `Ctrl+Shift+F` focuses the notes search bar; existing `Ctrl+S` for notes and working doc unchanged; shortcut reference grid added to Settings modal
- **Pin / star notes** — ☆/★ toggle on every note item; pinned notes sort to the top of the list regardless of `updatedAt`; `toggleNotePin(noteId)` flips `pinned` flag and persists via `dbPut`; pin button works in both per-project and cross-project (global search) list views
- **Retrieval debug panel** — after each assistant message, a collapsible `▸ N sources referenced` row appears; expanding it shows `.chunk-item` cards with the source doc/template name and a 120-char snippet for each BM25-retrieved chunk; `retrieveContext()` now returns `chunks: { source, snippet }[]` alongside `context` and `sources`; `chunks` persisted on message records

### Changed
- `APP_VERSION` bumped to `v0.4.5`
- `package.json` version bumped to `0.4.5`

---

## [0.4.4] - 2025-07-17

### Added
- **Cross-project Notes Search** — "All projects" checkbox toggle in the Notes panel header; when checked, `searchAllNotes(query)` fetches every note across all projects, filters by title and body, and renders results with a project-name badge and date; clicking a result switches to the correct project (via `loadProject()`) and opens the note; a `#notes-scope-label` bar shows the match count; the toggle and label reset automatically on project switch
- **Template Preview inline panel** — the Preview button in the template editor no longer opens a separate modal; instead it reveals `#tmpl-preview-panel`, a collapsible panel directly below the content textarea so the editor stays visible; a ✕ Hide link (`togglePreviewPanel()`) collapses it; the panel is hidden whenever the template editor is opened fresh
- **Expanded Extract Variables** — `extractVarsFromText(text)` replaces `extractDatesFromText` as the primary extraction engine; now detects four entity types: **date** (4 existing regex patterns, `DATE_N` keys), **money** (`$N,NNN` / `$N.NN`, `AMOUNT_N` keys), **percent** (`N%` / `N.N%`, `PCT_N` keys), and **key-value** (`LABEL: value` lines with uppercase-starting label ≤ 80 chars, keys normalized to `UPPER_SNAKE_CASE`); results are deduplicated across types and sorted date → money → percent → kv; the Extract modal now shows a type badge pill on each row and its title reads "Variables detected in …"

### Changed
- `extractDatesFromText(text)` kept as a backward-compatible alias (filters `extractVarsFromText` output to `type === 'date'` and maps to `string[]`); existing tests continue to pass
- `APP_VERSION` bumped to `v0.4.4`
- `package.json` version bumped to `0.4.4`

### Removed
- Separate `modal-preview` modal — superseded by the inline `#tmpl-preview-panel` inside the template editor

---

## [0.4.3] - 2025-07-16

### Added
- **Local helper server** — `server.js` serves `SourceDesk.html` at `http://localhost:PORT`, injects `window.__SOURCEDESK_ENV__` from `.env`, and exposes `npm run serve` for local hosted/homelab workflows; supports `PORT`, `ENVIRONMENT`, `LOCAL_LLM_URL`, and `LOCAL_LLM_DEFAULT_MODEL`
- **`.env.example`** — sample configuration file for the local server and local LLM defaults
- **Google Drive Connector** — import files from Drive into a project, verify OAuth tokens, list supported file types, and back up the full database to Drive (see auth note below)
- **Local LLM provider** — `fetchLocalModels()` auto-detects available models from the configured local endpoint's `/models` API; model list is dynamically populated in Settings

### Fixed
- **`exportDatabase()` / `importDatabase()` missing `notes` store** — the `notes` IndexedDB store was silently excluded from local JSON backups and restores; both functions now include `notes` in the stores list; `validateImportShape()` treats `notes` as optional so older backups without it still import cleanly; `importDatabase()` skips absent stores gracefully

### Changed
- `APP_VERSION` bumped to `v0.4.3`
- `package.json` version bumped to `0.4.3`

---

## [0.4.2] - 2025-07-16

### Added
- **OpenRouter free-tier models** — five new no-cost models added to the OpenRouter provider model list:
  - `google/gemma-4-26b-a4b-it:free` — Google Gemma 4 26B (MoE)
  - `google/gemma-4-31b-it:free` — Google Gemma 4 31B
  - `nvidia/nemotron-3-super-120b-a12b:free` — Nvidia Nemotron Super 120B
  - `minimax/minimax-m2.5:free` — Minimax M2.5
  - `openai/gpt-oss-120b:free` — OpenAI GPT-OSS 120B

### Fixed
- **Text contrast** — `--text-dim` raised from `#8a8578` → `#a8a49c` and `--text-muted` raised from `#504e49` → `#72706a`; the old muted value was ~2.2:1 contrast ratio on dark surfaces (below WCAG AA); both are now noticeably more readable while preserving the visual hierarchy

### Changed
- `APP_VERSION` bumped to `v0.4.2`
- `package.json` version bumped to `0.4.2`

---

## [0.4.1] - 2025-07-16

### Added
- **Date arithmetic in template variables** — `resolveTemplateVars()` now handles relative date expressions after all named-variable substitution:
  - `{{TODAY+N}}` / `{{TODAY-N}}` — N days forward or back
  - `{{TODAY+Nw}}` / `{{TODAY-Nw}}` — N weeks
  - `{{TODAY+Nm}}` / `{{TODAY-Nm}}` — N calendar months (uses `Date.setMonth`)
  - Unit suffix is case-insensitive; omitting the suffix defaults to days
- **Extract Variables from Document** — `openExtractVars(docId)` scans an uploaded document for dates in four formats (ISO `YYYY-MM-DD`, US `M/D/YYYY`, long month `July 16, 2025`, short month `Jul 16, 2025`), deduplicates, and opens a modal listing each with a checkbox and editable constant-name input; `saveExtractedVars()` appends checked items to `state.settings.constants` and persists to IndexedDB; an **Extract** button appears on each document entry in the right-panel context list
- **`extractDatesFromText(text)`** — pure function that matches four date regex patterns and returns a deduplicated `string[]`; tested in the test suite
- **Template Variable Preview** — `previewTemplateVars()` reads the current template content textarea, runs `resolveTemplateVars()` against the active project, and shows the resolved output in a read-only `modal-preview` textarea; **Preview** button added to the template editor modal actions row
- **Tests** — 14 new tests across 2 new suites (`resolveTemplateVars — date arithmetic` × 6, `extractDatesFromText` × 8); total now 79 tests across 16 suites

### Changed
- `APP_VERSION` bumped to `v0.4.1`
- `package.json` version bumped to `0.4.1`

### Build
- `build.js`: added `previewTemplateVars`, `openExtractVars`, `saveExtractedVars` to terser `mangle.reserved`

---

## [0.4.0] - 2025-07-16

### Added
- **Template Variables** — `resolveTemplateVars(content)` automatically substitutes built-in project variables before any manual fill step:
  - `{{PROJECT_NAME}}` → active project name
  - `{{PROJECT_CATEGORY}}` → active project category (RFP, RFI, etc.)
  - `{{PROJECT_NOTES}}` → active project notes/context
  - `{{PROJECT_INSTRUCTIONS}}` → active project instructions
  - `{{TODAY}}` → current date in `YYYY-MM-DD` format
  - `{{TIMESTAMP}}` → current date and time (locale string)
- **Template Constants** — new `Template Constants` textarea in Settings (stored as `constants` in the `settings` IndexedDB store, `KEY=value` one per line); constants are available as `{{KEY}}` in any template; built-in project variables take priority over user-defined constants with the same key
- **`parseConstants(text)`** — pure helper that parses `KEY=value` lines into a plain object (keys normalised to UPPER_CASE); also tested in the test suite
- **Auto-resolve in Fill modal** — `openFillTemplate()` now calls `resolveTemplateVars()` first; a monospace info bar (`#fill-auto-resolved`) lists which variables were auto-filled; only the remaining unresolved `{{PLACEHOLDER}}` fields are shown for manual entry; if all placeholders are resolved automatically the content is inserted into the chat input directly without showing the modal
- **`viewTemplateContent()` resolves vars** — the "View" shortcut on a template also runs auto-resolution before inserting content into the chat input
- **Create Template from Document** — `createTemplateFromDoc(docId)` reads a project document from IndexedDB and opens the template creation modal pre-filled with the document's content and a name derived from the filename (extension stripped); a `→Tmpl` button appears on each document entry in the right-panel context list
- **Notes autosave** — switching to a different note or navigating away from the Notes view now silently auto-saves the current note (skips the DB write when nothing changed)
- **"Include in chat context" toggle** — per-note checkbox in the editor; when checked, the note's title and body are injected into the system prompt under `## Active Note`; persisted on the note object as `includeInContext`
- **Notes search/filter** — text input above the notes list filters items by title in real time; filter state is preserved across list re-renders
- **Edit Project** — ✏ button on each sidebar project item opens the project modal pre-filled; `saveProject()` now handles both create and update; `state.editingProjectId` tracks mode
- **Delete Project** — ✕ button on each sidebar project item deletes the project with full cascade (all docs, chats, and notes for that project); resets to welcome screen if the deleted project was active
- **Ctrl+S / Cmd+S in Notes** — keyboard shortcut attached to both `#note-editor` and `#note-title-input` to trigger `saveCurrentNote()` without reaching for the mouse
- **Working Document editor** — `openWorkingDoc()` switches to a full-screen `#working-doc-view` with the project's `workingContent` in an editable textarea; `saveWorkingDoc()` persists back to IndexedDB with a brief "Saved ✓" button flash; Ctrl+S / Cmd+S also saves; "Working Doc" topbar button becomes visible when a project is loaded
- **Clear Chat History** — `clearChatHistory()` deletes the `chats` record for the active project and clears `state.messages`; "Clear Chat" topbar button visible when a project is loaded
- **Duplicate Template** — "Dup" action button on each template card calls `duplicateTemplate(id)`, which creates a copy with the suffix `(copy)` and saves it immediately
- **Tests** — 16 new tests across 2 new suites (`parseConstants` — 8 tests, `resolveTemplateVars` — 8 tests); total now 65 tests across 13 suites

### Changed
- `applyFill()` now calls `resolveTemplateVars()` on the base template content before applying manual substitutions, ensuring constants and project vars are always resolved even if the user navigates to the fill modal from a different path
- Template content label hint updated to document both manual-fill syntax and the available auto-fill variables
- `state.settings` extended with `constants: ''`
- `boot()` loads `constants` from IndexedDB `settings` store on startup
- `openSettings()` populates the new `settings-constants` textarea
- `saveSettings()` reads and persists `constants` to IndexedDB
- `openNewProject()` now resets `state.editingProjectId` and updates modal title/button text dynamically
- `selectNote()` promoted to `async` to support auto-save before switching notes
- `renderSidebar()` renders edit and delete action buttons per project item (visible on hover)
- Project modal title (`#modal-project-title`) and save button (`#proj-save-btn`) are now dynamic IDs updated by `openNewProject()` / `openEditProject()`
- `state` extended with `editingProjectId: null`
- `showView()` extended to toggle `#working-doc-view` and call `_fillWorkingDocEditor()` on activation
- `loadProject()` now also unhides `#working-doc-btn` and `#clear-chat-btn`; `deleteProject()` re-hides them
- `APP_VERSION` bumped to `v0.4.0`
- `package.json` version bumped to `0.4.0`

### Build
- `build.js`: added `createTemplateFromDoc`, `openEditProject`, `deleteProject`, `filterNotes`, `toggleNoteInContext`, `openWorkingDoc`, `saveWorkingDoc`, `clearChatHistory`, `duplicateTemplate` to terser `mangle.reserved`

---

## [0.3.0] - 2025-07-15 🗄️

### Added
- **Database Export** — `exportDatabase()` serialises all stores (`templates`, `projects`, `docs`, `chats`, `settings`) plus `version`, `appVersion`, and `exportedAt` to a timestamped `.json` file downloaded via `<a download>`
- **Database Import** — `importDatabase(file)` reads a backup JSON, validates with `validateImportShape()`, confirms with the user, clears all stores, reimports every record via `dbPut`, then reloads the page
- **`validateImportShape()`** — pure validation helper (also tested in `tests/test.html`) that checks the backup object has the correct shape
- **Import/Export buttons** — "Export DB" and "Import DB" buttons added to the Settings modal actions row; hidden `<input type="file" id="import-file-input">` triggers the file picker
- **Project/Chat Export** — `exportProject()` downloads the active project object, full `state.messages` array, and doc metadata (id, name, uploadedAt) as a named `.json` file; "Export" button in topbar becomes visible when a project is loaded
- **Notes 🗄️** — per-project text notes backed by a new `notes` IndexedDB store (`DB_VERSION` bumped 1 → 2):
  - Two-panel Notes view: list on left, title + editor on right
  - CRUD: `openNewNote()`, `selectNote()`, `saveCurrentNote()`, `deleteCurrentNote()`, `loadNotes()`, `renderNotesList()`
  - "Notes →" navigation button in sidebar
  - `showView('notes')` added to the view system (auto-calls `loadNotes()`)
  - `state.currentNote` tracks the note being edited; reset on project switch
- **Fix `openNewProject()`** — `proj-instructions` textarea now cleared alongside name/notes when the modal opens
- **Tests** — 7 new tests for `validateImportShape` (11th suite); total now 53 tests across 11 suites

### Changed
- `DB_VERSION` bumped from `1` to `2`; `openDB()` upgrade path adds `notes` store with `projectId` index
- `showView()` extended to handle `'notes'` view
- `loadProject()` now shows the topbar Export button and resets `state.currentNote`
- `APP_VERSION` bumped to `v0.3.0`

### Build
- `build.js`: added `exportDatabase`, `triggerImportDialog`, `importDatabase`, `exportProject`, `openNewNote`, `selectNote`, `saveCurrentNote`, `deleteCurrentNote`, `loadNotes`, `renderNotesList`, `validateImportShape` to terser `mangle.reserved`

---

## [0.2.0] - 2025-07-14

### Added
- **Build pipeline** — `src/main.js` + `src/index.html` compiled to `SourceDesk.html` via `node build.js`; terser minification in production, `--dev` and `--watch` modes
- **`DEBUG` / `TEST` / `APP_VERSION` flags** — `window.__SOURCEDESK_DEBUG__` and `window.__SOURCEDESK_TEST__` control runtime behaviour; `log()` helper no-ops unless `DEBUG`
- **Version string** — `v0.2.0` injected into topbar at boot via `APP_VERSION` constant
- **Multi-provider support** — Settings now has an AI Provider selector: **Anthropic**, **OpenAI**, **OpenRouter**, **GitHub Models**
  - Per-provider API key storage (DB keys `apiKey_anthropic`, `apiKey_openai`, `apiKey_openrouter`, `apiKey_github`)
  - Legacy single `apiKey` value automatically migrated to `apiKey_anthropic` on first boot
  - Provider-specific model lists, key labels, placeholders, and help links
  - Anthropic uses `x-api-key` + `anthropic-version` headers and `system` field; OpenAI-compatible providers use `Authorization: Bearer` and system-as-first-message
  - OpenRouter adds `HTTP-Referer` and `X-Title` headers
  - `buildApiCall(systemPrompt, messages)` — returns `{url, headers, body}` for any provider
  - `parseStreamDelta(data)` — handles both Anthropic `content_block_delta` and OpenAI `choices[0].delta.content` SSE formats
- **Model lists updated** — Anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`; OpenAI: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`; OpenRouter: 8 popular models; GitHub Models: 6 models
- **Global Instructions** — Settings field renamed from "Sourcing Context" to "Global Instructions"; DB key unchanged (`globalContext`)
- **Per-Project Instructions** — New textarea on project creation form; persisted on the project object; injected into system prompt under `## Project Instructions`
- **Test harness** — `tests/test.html` loads `../src/main.js` with `window.__SOURCEDESK_TEST__ = true`; 46 tests across 10 suites including `parseStreamDelta` and `buildApiCall` coverage for all 4 providers

### Changed
- `sendMessage()` delegates to `buildApiCall()` + `parseStreamDelta()` instead of hardcoded Anthropic fetch; `max_tokens` raised from 2048 → 4096
- `checkApiKey()` uses `getCurrentProviderKey()` instead of `state.settings.apiKey`
- Settings modal subtitle updated to reference "the selected AI provider" instead of "the Anthropic API"
- `state.settings` shape updated: `apiKey` removed; `provider`, `anthropicKey`, `openaiKey`, `openrouterKey`, `githubKey` added
- `openNewProject()` modal now clears `proj-instructions` textarea
- `CLAUDE.md` added — persistent session context doc for AI-assisted development

### Build
- `build.js`: `onProviderChange` added to terser mangle reserved list
- `package.json` version bumped to `0.2.0`

---

## [0.1.0] - 2025-07-14

### Initial Release
- IndexedDB persistence: API key, templates, projects, docs, chat history (`DB_VERSION = 1`)
- Project management with categories: RFP, RFI, Vendor Q, Contract, Other
- Template system: skeleton (`{{PLACEHOLDER}}`) and example types; fill-template modal
- BM25 retrieval over chunked project documents
- Streaming chat with Claude API (Sonnet 4 / Haiku 4.5)
- Context panel: per-doc include/exclude toggles; pull in other project docs
- File upload: `.txt`, `.md`, `.csv`, `.pdf`, `.docx`
- Global settings: API key, model selector, sourcing context