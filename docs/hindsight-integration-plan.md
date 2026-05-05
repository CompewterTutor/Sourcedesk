# Hindsight Integration Plan — SourceDesk

> **Status**: Planning  
> **Covers versions**: v0.9.0 → v1.0.0  
> **Current version**: v0.8.0  
> **Feature request**: `docs/feature-request-hindsight.md`  
> **Reference skill**: `skills/hindsight-docs/` — always consult this before writing Hindsight integration code

---

## What Hindsight Is

[Hindsight](https://github.com/vectorize-io/hindsight) is a **biomimetic agent memory system** built on PostgreSQL + pgvector. It is NOT a RAG pipeline — it stores *structured facts* extracted from content (conversations, docs, notes) and retrieves them via 4 parallel strategies: semantic, BM25, graph traversal, and temporal ranking.

The three core operations:

| Operation | What it does | SourceDesk use |
|-----------|-------------|----------------|
| **Retain** | Extract facts/entities/relationships from raw content | Store chat sessions, notes, email summaries, Q&A |
| **Recall** | Retrieve relevant memories for a query | Inject project history into chat system prompt |
| **Reflect** | Autonomous reasoning loop over memories | Future: "What have we learned about this vendor?" |

**Key concept — Memory Banks**: one isolated store per user. `bank_id = userId`. Banks do not share data. Auto-created on first use.

---

## Prerequisites Completed

Before starting the Hindsight phases, the following server-side email summary work is **already done** (see `docs/email_ingest_progress.md`):

- ✅ `POST /api/email-ingest` — ingest + async LLM summarization  
- ✅ `GET /api/email-summaries` — fetch stored summaries  
- ✅ `server/db.js` — SQLite + PostgreSQL abstraction  
- ✅ `server/llm.js` — server-side LLM helper  
- ✅ `migrations/001_initial.sql` — DB schema  
- ✅ Token-based auth with file + DB stores  

**Not yet done** (addressed in v0.9.0 below):
- ❌ Frontend email summary import UI  
- ❌ Token management UI in Settings  
- ❌ Token expiry support  
- ❌ Message-ID deduplication  

---

## Architecture Overview

```
Browser (SourceDesk.html)
    │
    │  HTTPS (existing)
    ▼
SourceDesk Server (server.js / Node.js)
    │                           │
    │ existing DB calls         │ NEW: /api/hindsight/* endpoints
    ▼                           ▼
SQLite / PostgreSQL         Hindsight API (http://localhost:8888)
(email ingests,                 │
 tokens, summaries)             │ PostgreSQL + pgvector
                                ▼
                        Hindsight DB (separate DB on same Postgres server)
                        (memory banks, facts, entities, knowledge graph)
```

**Key rules:**
1. Hindsight runs as its own process (Docker container or `pip install hindsight-api`). SourceDesk's `server.js` calls it via HTTP using `@vectorize-io/hindsight-client`.
2. Hindsight manages its own Postgres database (`HINDSIGHT_API_DATABASE_URL`). This is a SEPARATE database from SourceDesk's app DB — same Postgres server is fine, different DB name (e.g., `sourcedesk_hindsight`). This is required because Hindsight runs its own migrations.
3. All Hindsight calls in `server.js` are **optional** — if `HINDSIGHT_API_URL` is not configured, the adapter returns `null` and all retain/recall operations are no-ops. Zero regression on deployments without Hindsight.
4. The browser never calls Hindsight directly. All Hindsight operations go through `server.js` → token-authenticated endpoints.

---

## Per-User Isolation Strategy

As documented in Hindsight's FAQ and `best-practices.md`:

```
bank_id = userId   // e.g. "usr_abc123" — the user's ID from SourceDesk api_tokens.user_id
```

- One bank per SourceDesk user (the `users.id` value from `migrations/001_initial.sql`).
- Banks are auto-created on first retain. We configure them explicitly before first use (procurement mission, disposition traits).
- For browser-only users with no server: Hindsight is unavailable (no way to authenticate securely from the browser). The feature degrades gracefully — chat works exactly as before.
- A browser-only user who later connects to a SourceDesk server instance will have a new bank created on first use.

**Optional future pattern** — shared bank with project tags (enables cross-user analytics):
```
bank_id = "sourcedesk-global"
tags = ["user:{userId}", "project:{projectId}"]
```
This is NOT the phase 1 approach. Start with per-user banks for simplicity and privacy.

---

## Bank Configuration (Procurement Domain)

Applied once when a user's bank is first created (via `server/hindsight.js → ensureBank(userId)`):

```json
{
  "retain_mission": "Extract procurement decisions, vendor facts, pricing data, deadlines, key contacts, action items, commitments, and compliance requirements. Ignore greetings, small talk, and scheduling logistics.",
  "observations_mission": "Identify recurring vendor patterns, budget trends, deadline patterns, and relationship dynamics. Flag when a vendor's reliability or pricing contradicts prior observations.",
  "reflect_mission": "You are an experienced procurement analyst with full context of this user's project history. Reference past decisions, vendor relationships, deadlines, and commitments when relevant. Be direct and concise.",
  "disposition_skepticism": 3,
  "disposition_literalism": 4,
  "disposition_empathy": 2,
  "entity_labels": [
    {
      "key": "vendor",
      "type": "text",
      "description": "A vendor, supplier, or contractor mentioned in the conversation"
    },
    {
      "key": "project_type",
      "type": "value",
      "tag": true,
      "values": [
        {"value": "rfp", "description": "Request for Proposal"},
        {"value": "rfi", "description": "Request for Information"},
        {"value": "vendor_q", "description": "Vendor Questionnaire"},
        {"value": "contract", "description": "Contract or agreement"},
        {"value": "research", "description": "Research or analysis"}
      ]
    },
    {
      "key": "deadline",
      "type": "text",
      "description": "A date, deadline, or timeline mentioned"
    }
  ]
}
```

---

## Version Plan

### v0.9.0 — Email Summary Frontend + Token Management
> *Close the loop on the server-side email pipeline.*

**Scope:**
- **Email Summary UI** — new panel in the project sidebar (or Settings tab): "📧 Email Summaries"
  - `GET /api/email-summaries?token=X&projectId=Y` → display summary text + per-thread breakdown
  - "Import to Notes" button — creates a Note from the summary
  - "Create Tasks" button — parses action items from `summary_text` using a lightweight regex/heuristic (look for bullet list items or numbered items under "Action Items"), creates Task records
  - Polling: if `llmSummarizing: true` was returned from a recent ingest, poll every 5s until summary appears
- **Token Management UI** in Settings → "API Tokens" sub-section
  - Display active tokens from `GET /api/token-list` (new endpoint) — show label, created_at, expiry
  - "Generate Token" button — calls `POST /api/token-generate` (new endpoint, wraps `generate_api_token.js` logic)
  - "Revoke" per-token button — calls existing `POST /api/token-revoke`
- **Token expiry** — `--expires-in 30d` flag in `generate_api_token.js`; check expiry in token validation
- **Message-ID deduplication** — add `messageId` field to email schema; if provided, use as dedup key instead of hash

**New endpoints in server.js:**
- `GET /api/token-list?adminToken=X` — list tokens for authenticated user
- `POST /api/token-generate` — `{ adminToken, label, expiresIn? }` → generate + return new token

**Files changed:**
- `src/index.html` — email summary panel HTML + token management section
- `src/settings.js` — token management functions; email summary fetch + display
- `server.js` — two new endpoints + token expiry check in `loadTokens()`
- `scripts/generate_api_token.js` — `--expires-in` flag

**Mangle reserved additions:** `openEmailSummaries`, `importSummaryToNotes`, `createTasksFromSummary`, `openTokenManager`, `generateApiToken`, `revokeApiToken`

**Version bump:** `APP_VERSION = '0.9.0'`

---

### v0.9.1 — Hindsight Foundation 🧠
> *Deploy Hindsight alongside SourceDesk. Zero user-visible change until v0.9.2.*

**Scope:**
- Install and configure Hindsight (optional, gated on `HINDSIGHT_API_URL` env var)
- `server/hindsight.js` adapter module
- Bank auto-creation with procurement-domain configuration
- Health check endpoint
- Settings UI: Hindsight status row (connected / disconnected / not configured)

**New file: `server/hindsight.js`**
```javascript
// Hindsight adapter for SourceDesk server.js
// All exports are no-ops when HINDSIGHT_API_URL is not set.
// Requires: npm install @vectorize-io/hindsight-client
```

Exports:
- `getClient()` → `HindsightClient | null`  
- `ensureBank(userId)` → creates bank with procurement config if not exists (idempotent)  
- `retainContent(userId, { content, documentId, context, tags })` → fire-and-forget  
- `recallForQuery(userId, { query, projectId, budget })` → returns `{ memories: string[], raw: RecallResult[] } | null`
- `getStatus(userId)` → `{ available, bankExists }` for the Settings panel

**New endpoint in server.js:**
- `GET /api/hindsight/status?token=X` → `{ available: bool, bankExists: bool, memoryCount?: number }`

**`docker-compose.yml` additions** (commented out by default, like pgvector):
```yaml
# Hindsight memory service (optional — remove comment to enable)
# hindsight:
#   image: ghcr.io/vectorize-io/hindsight:latest-slim
#   ports: ["8888:8888", "9999:9999"]
#   environment:
#     HINDSIGHT_API_LLM_PROVIDER: anthropic
#     HINDSIGHT_API_LLM_API_KEY: ${ANTHROPIC_API_KEY}
#     HINDSIGHT_API_LLM_MODEL: claude-haiku-4-5-20251001
#     HINDSIGHT_API_DATABASE_URL: postgresql://.../${POSTGRES_DB}_hindsight
#   volumes:
#     - hindsight_data:/home/hindsight/.pg0
```

**`.env.example` additions:**
```
# Hindsight memory service (optional — run separately; see docker-compose.yml)
# HINDSIGHT_API_URL=http://localhost:8888
# (Hindsight uses its own LLM config via HINDSIGHT_API_* env vars, separate from SourceDesk's LLM_*)
```

**Settings UI change:**
- New read-only row in Settings → Server section: "🧠 Memory (Hindsight)" with status badge: `● Connected (N memories)` / `○ Not connected` / `— Not configured`
- `testHindsightConnection()` function (test button)

**Package change:**
- `npm install @vectorize-io/hindsight-client` → add to `dependencies` in `package.json` (optional dep, same pattern as `better-sqlite3`)

**Mangle reserved additions:** `testHindsightConnection`

**Version bump:** `APP_VERSION = '0.9.1'`

---

### v0.9.2 — Chat Memory 🧠
> *Retain chat sessions. Recall relevant memories before responding. Most impactful single change.*

**Retain flow:**
1. `saveChat()` in `src/chat.js` calls existing `dbPut`. No change.
2. After the DB write, `src/chat.js` fires `POST /api/hindsight/retain` with:
   ```json
   {
     "token": "<user_token>",
     "documentId": "<chatId>",
     "content": "<messages as JSON array: [{role, content, timestamp?}]>",
     "context": "project:<projectId> category:<projectCategory>",
     "tags": ["project:<projectId>", "type:chat"]
   }
   ```
3. Fire-and-forget — `saveChat()` does not await this. Uses `_localFetch` / `fetch` depending on whether server is available.

**Recall flow:**
1. `sendMessage()` in `src/chat.js` checks if server is available and Hindsight is connected.
2. If yes: calls `POST /api/hindsight/recall`:
   ```json
   {
     "token": "<user_token>",
     "query": "<user's current message>",
     "projectId": "<projectId>",
     "budget": "mid"
   }
   ```
3. Server calls `recallForQuery(userId, { query, projectId, budget: 'mid' })` → Hindsight API.
4. Returns `{ memories: string[] }` — a list of formatted memory strings.
5. Client injects them into system prompt as:
   ```
   ## Relevant Memories
   <memory 1>
   <memory 2>
   ...
   ```
   Above the project instructions but below global context.
6. Recall is awaited (parallel with existing retrieval) before building the system prompt. If it times out (>2s) or errors, silently skip — never block the chat.

**New endpoints in server.js:**
- `POST /api/hindsight/retain` — `{ token, documentId, content, context?, tags? }` → fires retain async, returns `{ ok: true }`
- `POST /api/hindsight/recall` — `{ token, query, projectId, budget? }` → returns `{ memories: string[], count: number }`

**Browser state additions:**
- `state.settings.serverToken` — the user's API token (stored in IndexedDB under key `serverToken`); user pastes it in Settings → Server section alongside the server URL. Used to authenticate all `/api/hindsight/*` calls.
- `state.settings.serverUrl` — the SourceDesk server URL (stored under key `serverUrl`). Defaults to empty (browser-only) or to `window.__SOURCEDESK_ENV__.serverUrl` if injected.
- `state.settings.hindsightEnabled` — boolean; default `true` if `serverUrl` is set; user can toggle off

**Settings UI additions:**
- "Server URL" text field (only shown if not injected by server)
- "Server API Token" text field (user pastes the token from Settings → API Tokens)
- Hindsight toggle: "Enable memory recall in chat" checkbox

**IndexedDB settings keys added:** `serverToken`, `serverUrl`, `hindsightEnabled`

**Mangle reserved additions:** `toggleHindsight`

**Version bump:** `APP_VERSION = '0.9.2'`

---

### v0.9.3 — Deep Content Integration 🧠
> *Retain all project content — not just chat. Make Hindsight truly project-aware.*

**Additional retain triggers:**

| Content | Trigger | `document_id` | `tags` |
|---------|---------|--------------|--------|
| Notes (`includeInContext=true`) | On save | `note:{noteId}` | `["project:{id}", "type:note"]` |
| Supplier Q&A answers | When answer status → `answered` | `sq:{questionId}` | `["project:{id}", "type:supplier_qa", "vendor:{vendor}"]` |
| Working document version | On `saveDocVersion()` | `wdoc:{projectId}:v{n}` | `["project:{id}", "type:working_doc"]` |
| Email summary | After `_summarizeIngest()` completes | `email-summary:{projectId}` | `["project:{id}", "type:email_summary"]` |
| Research items | When crawl + summarise completes | `research:{researchId}` | `["project:{id}", "type:research", "url:{url}"]` |

**Implementation:**
- Notes/SQ/working-doc retain: browser-side fire-and-forget POST to `/api/hindsight/retain` using `serverToken`
- Email summary retain: server-side, called at the end of `_summarizeIngest()` in `server.js` (already has `userId`, `projectId`, summary text)
- Research retain: browser-side, called at end of `summariseResearchItem()` in `src/research.js`

**Bank config enhancement:**
- Add `entity_labels` entry for `vendor` (type: `text`) and `project` (type: `text`) so Hindsight auto-tags vendor mentions
- Configure `retain_extraction_mode: "verbose"` for document-type content (notes, working doc, research) for richer fact extraction

**New endpoint in server.js:**
- `POST /api/hindsight/retain-email-summary` — internal endpoint called after `_summarizeIngest()`; not exposed to browser

**Version bump:** `APP_VERSION = '0.9.3'`

---

### v0.9.4 — Memory UI 🧠
> *Give users visibility into and control over their memory bank.*

**New "Memory" tab in Settings modal** (`#settings-tab-memory`):
- **Status row**: Connected / not connected + memory count
- **Recent memories**: list of last 20 retained facts (calls `GET /api/hindsight/memories?token=X&limit=20`)
- **Search**: text input → calls `POST /api/hindsight/recall` with `budget: 'low'` for fast lookup
- **Clear all memories**: calls `DELETE /api/hindsight/bank?token=X` (requires confirmation)
- **Export memories**: downloads all recalled memories as Markdown

**In-chat memory citations:**
- Recalled memories shown in a collapsible "🧠 N memories recalled" row below AI responses (same pattern as BM25 sources row)

**New endpoints in server.js:**
- `GET /api/hindsight/memories?token=X&limit=N&query=Q` — list/search memories; calls Hindsight `listMemories` or `recall`
- `DELETE /api/hindsight/bank?token=X` — wipe the user's bank (destructive; confirm required)

**Mangle reserved additions:** `openMemoryTab`, `searchMemories`, `clearMemoryBank`, `exportMemories`

**Version bump:** `APP_VERSION = '0.9.4'`

---

### v1.0.0 — Production Release 🎉
> *Polish, performance, documentation. Mark the feature set stable.*

**Scope:**
- Recall latency tuning: make recall async/parallel with the BM25 retrieval; total latency budget ≤ 500ms before falling back
- Token auth hardening: rotate tokens; server-side rate limiting on `/api/hindsight/*`
- Retry logic in `server/hindsight.js`: if Hindsight is temporarily unavailable, retry retain with exponential backoff, queue recalls as no-ops
- README updates: full Hindsight setup guide (Docker, bare-metal, cloud)
- CLAUDE.md: document all Hindsight endpoints, bank config, and gotchas learned in integration sessions
- Final `npm run build` + tag `v1.0.0`

---

## File Inventory (New + Changed)

### New files
| File | Purpose |
|------|---------|
| `server/hindsight.js` | Hindsight adapter — client init, bank config, retain/recall wrappers |
| `migrations/002_hindsight_settings.sql` | Stores per-user `hindsight_bank_id` and `hindsight_enabled` flag in server DB |

### Modified files
| File | Change |
|------|--------|
| `server.js` | Import hindsight.js; add `/api/hindsight/*` endpoints; retain email summary after `_summarizeIngest()` |
| `src/chat.js` | `saveChat()`: fire retain; `sendMessage()`: await recall → inject into system prompt |
| `src/notes.js` | `saveCurrentNote()`: fire retain if `includeInContext` |
| `src/supplierQuestions.js` | `saveCurrentSQAnswer()`: fire retain when status → answered |
| `src/versioning.js` | `saveDocVersion()`: fire retain |
| `src/research.js` | `summariseResearchItem()`: fire retain |
| `src/settings.js` | Token management; server URL/token fields; Hindsight status + memory tab |
| `src/index.html` | Email summary panel; token mgmt; Hindsight settings rows; memory tab |
| `docker-compose.yml` | Hindsight service (commented in) |
| `.env.example` | `HINDSIGHT_API_URL` and related Hindsight vars |
| `package.json` | `@vectorize-io/hindsight-client` in `optionalDependencies` |
| `build.js` | New mangle.reserved entries per phase |
| `CHANGELOG.md` | Version entries per phase |
| `README.md` | Hindsight setup section |

---

## Environment Variables (`.env.example` additions)

```bash
# ─── Hindsight Memory Service (optional) ─────────────────────────────────────
# Run Hindsight separately (see docker-compose.yml for the service definition).
# When HINDSIGHT_API_URL is unset, all memory features are disabled — no errors.
HINDSIGHT_API_URL=

# Hindsight manages its own LLM config (separate from SourceDesk's LLM_PROVIDER).
# Point it at a fast/cheap model — haiku-class is ideal for fact extraction.
# These are passed to the Hindsight container, not to server.js.
# HINDSIGHT_API_LLM_PROVIDER=anthropic
# HINDSIGHT_API_LLM_API_KEY=${ANTHROPIC_API_KEY}
# HINDSIGHT_API_LLM_MODEL=claude-haiku-4-5-20251001
# HINDSIGHT_API_DATABASE_URL=postgresql://user:pass@localhost:5432/sourcedesk_hindsight
```

---

## Using the Hindsight Skill During Development

The `skills/hindsight-docs/` directory contains complete offline documentation for Hindsight. Always read from it before writing integration code:

```
# Core operations
skills/hindsight-docs/references/developer/api/retain.md    — retain params + options
skills/hindsight-docs/references/developer/api/recall.md    — recall params + response shape
skills/hindsight-docs/references/developer/api/memory-banks.md — bank config + entity labels
skills/hindsight-docs/references/best-practices.md         — missions, tags, anti-patterns
skills/hindsight-docs/references/sdks/nodejs.md            — HindsightClient TypeScript API
skills/hindsight-docs/references/sdks/hindsight-all-npm.md — embedded server (Node.js)
skills/hindsight-docs/references/developer/configuration.md — HINDSIGHT_API_* env vars
skills/hindsight-docs/references/faq.md                    — per-user isolation, recall vs reflect
```

**Quick reference for common patterns:**

```javascript
// server/hindsight.js — typical adapter pattern
const { HindsightClient } = require('@vectorize-io/hindsight-client');
let _client = null;

function getClient() {
  if (!process.env.HINDSIGHT_API_URL) return null;
  if (!_client) _client = new HindsightClient({ baseUrl: process.env.HINDSIGHT_API_URL });
  return _client;
}

// Retain a chat session (upsert by documentId)
await client.retain(userId, {
  id: chatId,               // document_id — same ID = upsert
  content: JSON.stringify(messages),  // [{role, content}] array
  context: `project:${projectId}`,
  tags: [`project:${projectId}`, 'type:chat'],
  async: true               // fire-and-forget
});

// Recall before a chat response
const recall = await client.recall(userId, userMessage, {
  budget: 'mid',
  tags: [`project:${projectId}`],
  tagsMatch: 'any_strict'   // only tagged memories, not untagged world facts
});
const memories = recall.results.map(r => r.text).join('\n');
```

---

## Gotchas to Watch For

1. **Hindsight manages its own DB** — never mix SourceDesk tables and Hindsight tables in the same Postgres database schema. Use a separate DB name (e.g., `sourcedesk_hindsight`).

2. **Bank creation is idempotent** — `createBank()` returns `409 Conflict` if the bank already exists; this is fine, catch and ignore it. `ensureBank()` in the adapter always does `.catch(() => {})`.

3. **`async: true` for retain** — always pass `async: true` (or `{async: true}` in the SDK) for chat/note retain to avoid blocking the SourceDesk response. Only use sync retain for small content where you need confirmation.

4. **Recall budget** — `'low'` for fast (<100ms) approximate recall (pre-generation suggestions); `'mid'` for normal chat (50-200ms); `'high'` for research agent (200-500ms, most thorough). If recall latency > 2s, fall back silently.

5. **Tags match mode** — use `tagsMatch: 'any_strict'` (not `'any'`) when filtering by project tags; `'any'` includes untagged memories which will surface irrelevant cross-project facts.

6. **Document ID upsert** — re-retaining with the same `document_id` replaces the document and re-extracts facts. For chat sessions use `chatId` as the document ID and call retain after every save (upsert pattern). This keeps memory fresh without duplicates.

7. **Node.js SDK name** — the package is `@vectorize-io/hindsight-client` (not `hindsight` or `@vectorize-io/hindsight`). Install as an `optionalDependency` in `package.json` so the server still starts if it's not installed.

8. **Slim image for docker-compose** — use `ghcr.io/vectorize-io/hindsight:latest-slim` in `docker-compose.yml`. The full image is ~9 GB (ARM64: ~3.7 GB) — too large for most dev setups. The slim image (~500 MB) delegates embeddings + reranking to the configured LLM provider (same one SourceDesk uses). Requires `HINDSIGHT_API_EMBEDDINGS_PROVIDER` pointing to an external embeddings service (OpenAI `text-embedding-3-small` is the easiest option).

---

## Testing Strategy

- **Unit tests**: Mock `HindsightClient` in `tests/test.html`; test `_buildMemoriesBlock(results)`, `_tagSetForProject(projectId, category)`, and `_parseRecallResults(response)` pure functions
- **Integration tests**: Add `POST /api/hindsight/status` to the manual test curl script in `email_ingest_progress.md`
- **Regression**: All existing tests must continue passing — Hindsight is opt-in, no existing logic changes

---

## Success Metrics

After v0.9.2 ships:
- Recalled memories appear in the system prompt for returning users (verifiable via browser devtools network tab → POST `/api/hindsight/retain` and `/api/hindsight/recall`)
- Chat retains vendor decisions, deadlines, and commitments across sessions without the user re-explaining context
- Zero regression for browser-only users (all tests pass; `HINDSIGHT_API_URL` unset = no errors)

After v0.9.4 ships:
- Users can see and search their memory bank from Settings
- Users can clear memories per-project or globally
- Chat response shows "🧠 N memories recalled" citation row (same UX as BM25 sources)

---

*Last updated: session planning for v0.9.0–v1.0.0. See `CLAUDE.md` for session-by-session progress notes.*
