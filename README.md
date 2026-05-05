# Sourcedesk

An in-browser RAG and project management tool that talks to AI providers directly from the browser. Runs completely client-side as a single HTML file for normal use — open it, it works. For local LLM support and the optional environment-injected server workflow, you can also run it through the included Node server. No install is needed for the browser app itself.

An in-browser RAG and project management tool that talks to AI providers directly from the browser. Runs completely client-side as a single HTML file — open it, it works. No server, no install, no account.

**Current version:** v0.8.0 — Task management, working doc versioning, chat session titles & search, message edit/regen, prompt library, email ingest API, server-side DB, Template Variable popup

---

## Quick Start

**Browser-only (no server needed):**
1. Download `SourceDesk.html` and open it in any modern browser.
2. Go to **Settings** → paste your API key for your chosen provider.
3. Create a project, upload documents, and start chatting. The AI model will use your docs as context automatically.

**With the local server** (enables Local LLM, MarkItDown doc conversion, Email Ingest API, and server-side DB):
```sh
npm install              # install dev deps + optional DB drivers
npm run build            # build SourceDesk.html
cp .env.example .env     # configure (DATABASE_URL, LLM_PROVIDER, API keys…)
npm run serve            # start server at http://localhost:3000
```

---

## Features

### Projects
Create a project from a template or start blank. Each project has its own:
- **Document collection** — upload `.txt`, `.md`, `.csv`, `.pdf`, `.docx` files
- **Chat history** — full conversation per project, stored locally
- **Working document** — the template content lands here as an editable draft (Working Doc button in the topbar)
- **Multi-session chat** — each project keeps multiple named chat sessions; start a new one from the sidebar without losing history
- **Notes** — per-project note editor with title + body; notes can be toggled into chat context individually
- **Instructions** — per-project system prompt additions, separate from global instructions

### Templates
Create reusable skeleton documents or example docs. Templates support:
- **`{{PLACEHOLDER}}` syntax** — manual fill-in fields; the Fill modal collects them before inserting into chat
- **Built-in auto-variables** — automatically substituted from the active project context:

  | Variable | Value |
  |---|---|
  | `{{PROJECT_NAME}}` | Active project name |
  | `{{PROJECT_CATEGORY}}` | Project category (RFP, RFI…) |
  | `{{PROJECT_NOTES}}` | Project notes/context field |
  | `{{PROJECT_INSTRUCTIONS}}` | Project instructions field |
  | `{{TODAY}}` | Current date — `YYYY-MM-DD` |
  | `{{TIMESTAMP}}` | Current date and time |

- **Global constants** — define `KEY=value` pairs in Settings → Template Constants; use them as `{{KEY}}` in any template (e.g. `COMPANY_NAME=Acme University`)
- **Template Variables popup** — click **📖 Variables** in the template editor to browse all available variables: built-in auto-variables with live current values, and your constants as an editable `KEY=value` table; click any row to insert the reference at the cursor
- **Create from document** — click `→Tmpl` on any uploaded document in the context panel to open the template editor pre-filled with that document's content
- **Duplicate** — copy any template with one click

### Context Panel
Shows exactly what the AI can "see" for the current chat:
- Attached template with Fill and View shortcuts
- All uploaded project docs with per-doc include/exclude toggles, each labelled with how it was converted (**MarkItDown** / **Drive** / **Text**)
- **Edit** button on every doc card opens a markdown editor — view and edit the converted content, **↓ Download** as `.md`, **↓ Download** the original file, or **⟳ Re-convert** with MarkItDown
- Checkboxes to pull in documents from other projects
- Upload `.txt`, `.md`, `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.csv` — binary formats are automatically converted to Markdown via [MarkItDown](https://github.com/microsoft/markitdown) (when the local server is running) with live status feedback during upload

### Retrieval (BM25)
When you send a message, BM25 scores all active document chunks against your query, pulls the top 4 matches, and injects them into the system prompt. Each reply bubble shows which documents were referenced.

### Multi-Provider Support
Settings → AI Provider supports:
- **Anthropic** — Claude Sonnet 4.6, Opus 4.6, Haiku 4.5
- **OpenAI** — GPT-5.4, GPT-5.4-mini, GPT-5.4-nano, GPT-4o, GPT-4o-mini, o4-mini
- **OpenRouter** — Claude, GPT-4o, Gemini 2.5 Pro/Flash, Llama 3.3 70B, DeepSeek R1, Grok 3, Mistral Large; plus free-tier models: Google Gemma 4 (26B/31B), Nvidia Nemotron Super 120B, Minimax M2.5, OpenAI GPT-OSS 120B
- **GitHub Models** — GPT-4o, Phi-4, Llama 3.3 70B, DeepSeek V3, Mistral Large

Per-provider API keys stored separately in IndexedDB. Switch providers at any time without losing keys.

**Local LLM** — works with [Ollama](https://ollama.com) and [LM Studio](https://lmstudio.ai) via their OpenAI-compatible API. When running via `npm run serve`, all local LLM requests are automatically proxied through the SourceDesk server to bypass browser CORS restrictions (including the `Authorization` header limitation). LM Studio's newer `/api/v1` base URL is supported alongside the standard `/v1` — both work without any extra configuration. The API key field is optional (Ollama doesn't require one; LM Studio's auth can be toggled in its server settings).

The topbar local-model selector (visible when provider = Local LLM) includes two utility buttons alongside the model dropdown: **⟳** re-detects available models, and **⏏ Unload** evicts the current model from VRAM. Unload tries the Ollama native API first (`POST /api/generate` with `keep_alive: 0`), then falls back to LM Studio's `POST /api/v1/models/unload` endpoint if Ollama is not the target server. This makes it easy to free VRAM before switching to a different model without leaving SourceDesk. Requires LM Studio 0.4.0+ for the LM Studio path.

### Notes
Per-project note editor (sidebar → Notes →):
- Create, edit, save, delete notes with title and body
- **Include in chat context** toggle — checked notes are injected into the system prompt as `## Active Note`
- Auto-saves when you switch notes or navigate away
- Filter notes by title in real time
- Ctrl+S / Cmd+S to save without leaving the keyboard

### Supplier Questions
Per-project Q&A manager for RFP/procurement workflows (sidebar → Supplier Q →):
- **Add Questions** — paste questions one at a time or in bulk; smart parsing splits on blank lines, then numbered-list detection, then falls back to a single question
- **Question list** — checkboxes for batch selection; ✅ icon when a draft answer exists, ○ when not; real-time filter; Select All toggle
- **Detail panel** — full question text with **Copy Q** clipboard button; draft answer textarea with **Copy A** clipboard button; auto-saves 1.5 s after you stop typing
- **⚡ Generate** — streams an LLM-generated answer for the selected question using BM25 retrieval against active project documents as context
- **⚡ Generate Selected** — runs answer generation sequentially for all checked questions
- **⬇ Export Selected / Export All** — downloads a Markdown file (`## Question N` / `### Answer` / `---` format) for sharing with vendors or internal review
- **Notes →** button in the header for quick access to the project's Notes view

### Multi-Session Chat
Each project supports multiple saved chat sessions. Use the **+** button in the sidebar "Chats" section to start a fresh session — prior sessions are preserved and listed with a timestamp and message preview. Click any session to reload it.

### Chat Session Titles & Search
Each saved chat session now displays an auto-generated title (first 8 words of the first message) in the sidebar instead of a raw content preview. A live search input above the session list filters sessions by title and message content in real time.

### Message Editing and Regeneration
Hover any user message bubble to reveal a **✏ Edit** button — clicking it opens an inline textarea so you can adjust the message and resend. Everything after that point in the conversation is discarded and regenerated. Hover any assistant message bubble to reveal a **↺ Regenerate** button, which removes that response and replays the preceding user message from scratch.

### Working Document Versioning
Every time you save the working document a snapshot is stored automatically. Click the **History** button in the Working Document header to browse all snapshots — each shows a timestamp, auto-label, and content preview. Restore any version (your current content is snapshotted first) or delete old ones you no longer need.

### Task Management
Per-project task list, accessible from **Tasks →** in the sidebar when a project is loaded:
- Two-panel layout — task list with real-time filter on the left, detail/edit form on the right
- Task fields: title, description, status (To Do / In Progress / Done), priority (Low / Medium / High), due date
- **Include in context** toggle — checked tasks with non-done status are injected into the system prompt as `## Active Tasks` on every message

### Position Guidelines
Per-project guideline document manager, accessible from **Guidelines →** in the sidebar when a project is loaded:
- Upload job descriptions, SOPs, org charts, and policy documents as guideline docs (stored separately from chat-context documents)
- **Analyze** guideline docs with the active LLM — **This Doc** analyzes the selected file; **Analyze All** analyzes every guideline doc at once
- Results are saved automatically as labelled analysis records — browse them as chips in the action bar; click a chip to view, ✕ to delete, or click the label to rename it inline
- **Compare analyses** — the **Diff** button on any chip shows a colour-coded line-level diff between two analyses or versions
- **Master synthesis** — select two or more saved analyses and click **Master** to have the LLM synthesize a unified findings report; master analyses are versioned so you can restore any previous synthesis
- One-click actions in analysis results: **Create Task** scaffolds a new task from an extracted responsibility; **Create Template** generates a template from a suggested template outline

### Prompt Library
Save and reuse prompts across any chat session. Click the 📚 book icon button left of the chat input to open the library dropdown:
- **Favorites** appear at the top (★ toggle per entry); the 5 most recent non-favorited entries appear below a divider
- **Click any entry** to insert it directly into the chat input
- **Save from a message** — hover any user message bubble and click the 📚 button to open a save modal; give the prompt a title and optionally mark it as a favorite
- **Manage library** — the dropdown footer opens a full manager modal where you can inline-edit titles and content, toggle favorites, and delete entries
- Stored in IndexedDB; persists across sessions; not tied to any specific project

### Temporary File Attachments
Click the 📎 button left of the chat input to attach files to the current message only — they are **not** saved to the project document store.
- Text files (`.txt`, `.md`, `.csv`, `.json`, `.docx`) are extracted and injected into the system prompt for that message
- Images are sent as vision content (Anthropic native vision + OpenAI-compat `image_url`)
- Attached files appear as removable chips above the input; they are cleared automatically after sending

### Context Usage Meter
A thin bar and token counter sit below the chat input, showing estimated context fill vs. the active model's context window. The bar shifts from accent → amber → red as the window fills. Updates on every keystroke and after each response.

### Working Document
Every project has a working document — the editable draft that starts from the attached template's content. Open it with the **Working Doc** button in the topbar. Ctrl+S saves back to IndexedDB.

### Google Drive / Sheets / Docs Connector
Click the **Drive** button in Settings to connect via a Google OAuth access token (paste from [OAuth Playground](https://developers.google.com/oauthplayground)). Once connected:

**Drive — Import & Backup**
- Browse and import `.txt`, `.md`, `.csv`, `.json`, and Google Docs from your Drive into the active project
- Back up the full SourceDesk database as a timestamped JSON file, automatically saved to a **SourceDesk** folder in your Drive (created on first backup)

**Google Sheets v4 — Vendor Questions**
- **Import Questions from Sheet** — paste a Spreadsheet ID or URL; the connector reads `A:Z`, maps `question`/`answer` columns (case-insensitive headers), and imports rows as supplier questions for the active project
- **Export Questions to Sheets** — creates a new Google Spreadsheet titled `SourceDesk Questions – <project> – <date>`, writes header + Q&A rows, and opens the sheet in a new tab

**CSV — Portable Question Exchange**
- **Export Questions (CSV)** — downloads a properly quoted CSV file locally (no token required)
- **Import Questions (CSV)** — upload a CSV; maps `question`/`answer` columns and imports into the active project

**Google Docs v1 — Rich Export**
- **Export Questions to Google Doc** — formats all Q&A as numbered text, creates a Google Doc, and opens it for formatting and `.docx` export
- **Export Working Doc to Google Doc** — sends the active project's working document to a new Google Doc

**Suggested OAuth scopes** (select all three in OAuth Playground, or add to your Google Cloud Console OAuth client):

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/drive` | Create the SourceDesk folder; upload backups; read your Drive files |
| `https://www.googleapis.com/auth/spreadsheets` | Create & read spreadsheets for vendor questions |
| `https://www.googleapis.com/auth/documents` | Create Google Docs for deliverables and Q&A exports |

Use `drive.readonly`, `spreadsheets.readonly`, or `documents.readonly` instead if you only want read access to other people's files and don't need to create your own.

### Database Export / Import
Settings → **Export DB** downloads all stores (templates, projects, docs, chats, settings, notes) as a single timestamped JSON backup. **Import DB** validates and restores from that file.

### Project Export
The **Export** topbar button (visible when a project is loaded) downloads the active project, its full chat history, and document metadata as a JSON file.

### Storage
100% IndexedDB. API keys, templates, projects, docs, chat history, notes — everything persists across sessions. Nothing goes anywhere except the AI provider you've configured.

---

## Testing

Open `tests/test.html` in a browser to run the unit test suite (92 tests, 17 suites). Covers BM25 search, markdown formatting, text chunking, stream parsing for all 4 providers, `buildApiCall` for all 4 providers, import shape validation, `parseConstants`, `resolveTemplateVars`, date arithmetic, and `extractDatesFromText`. No build step or server required.

---

## Building from Source

```sh
npm install          # install dev deps (terser)
npm run build        # production minified build → SourceDesk.html
npm run dev          # unminified dev build (fast, ~10 ms)
npm run watch        # watch src/ and rebuild on save
npm run serve        # local server for env injection, doc conversion, email ingest
npm run migrate      # run pending DB migrations (requires DATABASE_URL in .env)
```

Edit source files in `src/`. Never edit `SourceDesk.html` directly.

### Local server setup

Copy `.env.example` to `.env` and configure:

```ini
PORT=3000
LOCAL_LLM_URL=http://localhost:11434/v1  # Ollama / LM Studio base URL

# Optional: SQLite persistence (install: npm install better-sqlite3)
DATABASE_URL=sqlite:./data/sourcedesk.db

# Optional: server-side LLM for email summarization
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-…
```

Then `npm run serve` and open `http://localhost:3000`.

### Email Ingest API

With a running server and a token generated by:
```sh
node scripts/generate_api_token.js --user you@example.com
```

POST email threads from any HTTP client (PowerAutomate, curl, …):
```sh
curl -X POST http://localhost:3000/api/email-ingest \
  -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","projectId":"my-rfp","emails":[…]}'
```

If `DATABASE_URL` and `LLM_PROVIDER` are configured, the server stores threads and asynchronously generates per-thread and project-level summaries with the configured LLM. Retrieve them with `GET /api/email-summaries?token=<TOKEN>&projectId=my-rfp`.

### Running with Docker

The fastest way to get the server running is with Docker Compose. SQLite is used by default; see `docker-compose.yml` to enable PostgreSQL.

```sh
# Build and start (SQLite, port 3000)
docker compose up -d --build

# Generate your first API token inside the container
docker compose exec web node scripts/generate_api_token.js --user you@example.com

# Tail logs
docker compose logs -f web

# Stop
docker compose down
```

Three directories are bind-mounted from the host so data survives container restarts:

| Host path | Container path | Contents |
|---|---|---|
| `data` (named volume) | `/app/data` | SQLite database file |
| `./.private-documents/` | `/app/.private-documents` | API token store + raw email ingest files |
| `./backups/` | `/app/backups` | Server-side DB backups |

To switch to PostgreSQL, uncomment the `db` service in `docker-compose.yml` and update `DATABASE_URL` to the Postgres connection string shown in that file.

---

### Running with Podman

[Podman](https://podman.io/) is a daemonless, rootless OCI container engine that is largely Docker-compatible. The same `Dockerfile` and `docker-compose.yml` work without modification.

**Compose support** requires `podman-compose` (Python) or Podman Desktop (ships a built-in compose engine):

```sh
# macOS (Homebrew)
brew install podman podman-compose
podman machine init && podman machine start   # one-time VM setup on macOS

# Debian / Ubuntu
sudo apt install podman podman-compose
```

Then use `podman-compose` exactly like `docker compose`:

```sh
podman-compose up -d --build
podman-compose exec web node scripts/generate_api_token.js --user you@example.com
podman-compose logs -f web
podman-compose down
```

**Podman notes:**
- Named volumes (`data:` in `docker-compose.yml`) are managed by Podman's own storage. Run `podman volume ls` to inspect them.
- The `better-sqlite3` native module is compiled at build time inside the `builder` stage using `python3 / make / g++` (already in the `Dockerfile`). No extra host-side tooling is required.
- Rootless Podman on some Linux distributions may have trouble binding low-numbered ports. If port 3000 is unreachable, try `--userns=keep-id` or check your system's `net.ipv4.ip_unprivileged_port_start` sysctl.

---

### Running with Apple Container (macOS, Apple Silicon)

[Apple Container](https://github.com/apple/container) is Apple's open-source OCI container runtime for macOS. It uses Apple's Virtualization framework to run Linux containers natively on Apple Silicon (M1/M2/M3/M4) — with lower overhead than Docker Desktop because each container runs directly on the VZ framework without a separate emulation layer.

> **Requirements:** Apple Silicon Mac (M-series chip), macOS 15 Sequoia or later.

**Install:**

```sh
# Via Homebrew
brew install --cask container

# Verify
container --version
```

Apple Container uses the same Docker Hub images and `Dockerfile` format as Docker. Basic CLI commands map 1-to-1:

| Docker | Apple Container |
|---|---|
| `docker build -t sourcedesk .` | `container build -t sourcedesk .` |
| `docker run -p 3000:3000 sourcedesk` | `container run -p 3000:3000 sourcedesk` |
| `docker images` | `container images` |
| `docker ps` | `container ps` |

**Quick start (single container, SQLite):**

```sh
# Build the image
container build -t sourcedesk .

# Create local persistence directories
mkdir -p data .private-documents backups

# Run
container run -d \
  --name sourcedesk \
  -p 3000:3000 \
  -e DATABASE_URL=sqlite:./data/sourcedesk.db \
  -e LLM_PROVIDER=anthropic \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/.private-documents:/app/.private-documents" \
  -v "$(pwd)/backups:/app/backups" \
  sourcedesk

# Generate a token
container exec sourcedesk node scripts/generate_api_token.js --user you@example.com

# Tail logs
container logs -f sourcedesk

# Stop and remove
container stop sourcedesk && container rm sourcedesk
```

**Compose support:**

Apple Container ships a `container compose` subcommand that reads the same `docker-compose.yml` format:

```sh
container compose up -d --build
container compose exec web node scripts/generate_api_token.js --user you@example.com
container compose logs -f web
container compose down
```

The `docker-compose.yml` in this repo works with `container compose` without modification.

**Apple Container notes:**
- Runs natively as `linux/arm64` on Apple Silicon — `better-sqlite3` compiles and runs without Rosetta.
- Volume mounts use the standard `-v host:container` syntax; relative paths work from the project directory.
- Images and containers are isolated from Docker Desktop — you will need to `container build` separately even if a Docker image already exists locally.
- Apple Container does not share a daemon with Docker or Podman; `docker ps` and `container ps` show independent sets of containers.

---

## Roadmap

### Core Workflow
- [x] **Projects** — create, edit, delete with full cascade; categories (RFP, RFI, Vendor Q, Contract, Other)
- [x] **Working Document editor** — editable draft per project, opened from the topbar, Ctrl+S saves
- [x] **Clear Chat History** — wipe the chat for a project without deleting the project
- [x] **Global Instructions** — a system prompt addition applied to every chat
- [x] **Per-Project Instructions** — per-project system prompt additions
- [x] **Notes** — per-project note editor; include-in-context toggle; autosave; real-time filter; Ctrl+S
- [x] **Supplier Questions** — per-project Q&A view; bulk paste & smart parsing; AI answer generation with streaming & BM25 context; batch generate; clipboard copy for Q and A; Markdown export (selected or all)
- [x] **Multi-Provider LLM Support** — Anthropic, OpenAI, OpenRouter, GitHub Models, Local LLM (Ollama / LM Studio) with per-provider key storage and model lists
- [x] **Multi-Session Chat** — multiple saved chat sessions per project; New Chat button in sidebar; session list with timestamps and message previews; load any previous session
- [x] **Temporary File Attachments** — paperclip button attaches files to a single message without persisting to the doc store; text extracted for context injection; images sent as vision content
- [x] **Streaming Indicator** — animated pulse bar while AI is generating a response
- [x] **Context Usage Meter** — live token estimate bar and label below the chat input; colour-coded fill vs. model context window
- [x] **Database Export / Import** — full JSON backup and restore via Settings
- [x] **Local Server / Env Injection** — optional `npm run serve` workflow for `window.__SOURCEDESK_ENV__`, local LLM URL defaults, and hosted/homelab deployments
- [x] **Project / Chat Export** — export active project + messages + doc metadata as JSON

### Templates
- [x] **Custom Prompt Templates** — skeleton (with `{{PLACEHOLDER}}`) and example types; fill modal; view shortcut; global template library
- [x] **Duplicate Template** — one-click copy of any template
- [x] **Template Variables & Constants** — built-in auto-variables (`{{PROJECT_NAME}}`, `{{TODAY}}`, etc.) plus user-defined constants (`KEY=value` in Settings); auto-resolved before manual fill; fill modal shows what was auto-filled
- [x] **Create Template from Document** — `→Tmpl` button on any uploaded doc opens the template editor pre-filled with the document's content
- [x] **Template variable date expressions** — `{{TODAY+7}}`, `{{TODAY-2w}}`, `{{TODAY+1m}}` etc.; auto-extraction of dates, monetary amounts, percentages, and key-value pairs from uploaded docs as suggested constants
- [x] **Template variable preview** — inline “Preview resolved” panel in the template editor that shows the output against the current active project without saving
- [x] **Template Variable popup** — **📖 Variables** button in the template editor; lists all built-in vars with live values and your editable constants; click any row to insert `{{VAR}}` at cursor

### Retrieval & Context
- [x] **docx / xlsx / pptx → Google Docs conversion on upload** — optional Drive-based server-side text extraction; falls back to client-side reader
- [x] **Local LLM embeddings + hybrid retrieval** — Embedding Model field in Settings (Local LLM only); calls `/embeddings`; 40% BM25 + 60% cosine similarity re-ranking; DB\_VERSION 7
- [ ] **In-browser semantic embeddings** *(low priority)* — `transformers.js` + WASM `all-MiniLM-L6-v2`; ~30 MB one-time download
- [x] **Local model quick-selector** — topbar dropdown when provider = Local LLM; includes ⟳ re-detect button
- [x] **Enhanced Retrieval** — hybrid BM25 + semantic re-ranking (active when Embedding Model is set)

### Research & Web Intelligence
- [ ] **"Research" project type** *(planned)* — new category alongside RFP, RFI, Vendor Q, Contract, Other; dedicated Research Board view with source URL, summary, tags (competitor/regulation/org-chart/vendor), retrieved date, and include-in-context toggle per item; DB\_VERSION 8
- [ ] **Brave Search integration** *(planned)* — Settings: `Brave API Key`; `GET https://api.search.brave.com/res/v1/web/search?q=<query>&count=10` with `X-Subscription-Token` header; results shown in a Search panel; click to add to Research Board; free tier: $5/month credit
- [ ] **crawl4ai integration** *(planned)* — Settings: `crawl4ai Endpoint` (default `http://localhost:11235`); self-hosted Docker service (`docker run -p 11235:11235 unclecode/crawl4ai`); `POST /crawl` with URL, returns `fit_markdown`; "Crawl" button on any Research Board item; full-page clean Markdown stored and injected into context
- [ ] **AI research agent flow** *(planned)* — "Research Topic" button: user describes a topic, AI uses Brave Search to find URLs, auto-crawls them, summarises each, writes a structured report to the Working Document
- [ ] **Export research to Google Drive** *(planned)* — `SourceDesk/<project>/Research/` subfolder; each item as a Google Doc, or full board as CSV/Markdown

### Document Editing & Versioning
- [x] **Working Document versioning** — automatic snapshots on every save; History modal to browse, restore, or delete
- [ ] **Target Document** *(planned)* — secondary editable artifact per project (e.g. the actual RFP response being drafted), separate from working notes; same versioning system; DB\_VERSION 8
- [ ] **MS Word MCP integration** *(planned, requires user setup)* — recommended server: `word-mcp-live` (`pip install word-mcp-live`; 124 tools; cross-platform python-docx + Windows COM + macOS JXA; track changes, comments, tables); configure endpoint in Settings; "Open in Word" button round-trips Working/Target Document through Word
- [ ] **LibreOffice MCP integration** *(planned, experimental)* — best available: `jwingnut/libreoffice-mcp-ubuntu` (FastMCP + `.oxt` extension; track changes, comments, search/replace, save/export; Ubuntu only, single-commit proof-of-concept); `.docx`→PDF only: `chfle/word-to-pdf-mcp` (Docker, unoserver, production-quality for that one task)

### Project Data & Contacts
- [x] **Task Management** — per-project tasks with title, description, status, priority, due date; include-in-context toggle; export as Markdown or CSV
- [x] **Position Guidelines & Responsibilities parser** — upload job descriptions, SOPs, org charts, and policy docs; AI extracts responsibilities, tasks, template outlines, and reminders; one-click "Create Task" and "Create Template" actions; saved analyses with chips bar, inline label editing, model tracking, master synthesis (multi-analysis LLM aggregation), master versioning, and line-level diff comparison between any two analyses
- [ ] **Important Contacts / Resources** — per-project contact info and links with tags; include-in-context toggle
- [ ] **Vendor Catalog** — directory of vendors and agencies categorised by expertise; include in context for relevant projects
- [ ] **Project Deliverables** — define expected outputs/artifacts with deadlines and milestones; export as a zip of generated files or structured JSON/CSV

### Google Workspace Integration
- [x] **Google Drive** — import files, export DB backup to SourceDesk app folder
- [x] **Google Sheets v4** — import/export vendor questions; CSV fallback for offline use
- [x] **Google Docs v1** — export Q&A and working documents as rich Google Docs for formatting and `.docx` download
- [ ] **Google Tasks API** *(future)* — sync per-project tasks to/from Google Tasks; scope: `auth/tasks`
- [ ] **Google Calendar API** *(future)* — push task due dates and project milestones to Calendar; pull events into context; scope: `auth/calendar`
- [ ] **Google Keep API** *(future)* — sync project notes to/from Google Keep (currently Workspace enterprise only); scope: `auth/keep`
- [ ] **People API v1 (Contacts)** *(future)* — sync per-project vendor contacts to a Google Contacts group; scope: `auth/contacts`

### Visualisation & Planning
- [ ] **Org Charts** — lightweight org chart creator and viewer for team structures and project stakeholders; include in context
- [ ] **Calendar Integration** — sync deadlines and milestones from an external calendar; surface dates in project context
- [x] **Task Management** — per-project tasks with due dates, priority, and status; track progress without leaving the app
- [x] **Versioning** — automatic snapshots on every working document save; History button to browse, restore, or delete any snapshot

### Platform
- [ ] **Mobile Optimisation** — responsive layout for the context panel and chat on smaller screens
- [x] **Docker / Podman support** — multi-stage `Dockerfile` + `docker-compose.yml`; SQLite by default, `pgvector/pgvector:pg16` Postgres available; `Makefile` targets for build, run, token generation

### Server & Integrations
- [x] **Server-side DB** — optional SQLite (`better-sqlite3`) or PostgreSQL (`pg`) backend; `DATABASE_URL` in `.env`; migrations in `migrations/`; auto-runs on server startup or `npm run migrate`
- [x] **Email Ingest API** (`POST /api/email-ingest`) — token-authenticated HTTP endpoint; accepts email thread batches from PowerAutomate, curl, or any HTTP client; stores threads and messages in DB with deduplication; async LLM summarization pipeline (per-thread incremental + project-level overview); `GET /api/email-summaries` to retrieve results
- [x] **API token management** — `scripts/generate_api_token.js`; tokens stored in file + DB; `POST /api/token-revoke` endpoint
- [ ] **Frontend email summary import** — view server-side summaries in the browser app; “Import to Notes” and “Create Tasks from Action Items” buttons; notifications for new ingest runs
- [ ] **Server–client sync** — read-only sync on boot: server DB → local IndexedDB; merge strategy prefers newest `updatedAt`; three-way diff (local vs server vs base) for document conflicts using existing `diff.js`
- [ ] **RAG with pgvector** — server-side chunking + embedding pipeline; `POST /api/index-doc`; hybrid BM25 + cosine retrieval via `GET /api/retrieve`; requires PostgreSQL with `pgvector` extension

### AI Provider UX
- [x] **Local model quick-selector** — topbar dropdown (visible only when provider = Local LLM) lets you switch models and re-detect available models without opening Settings
- [ ] **Per-project provider override** — allow a project to pin a specific provider/model independently of the global setting

### Chat & Conversation
- [x] **Multi-session chat** — multiple named sessions per project with full history preserved
- [x] **Temporary file attachments** — attach files to a single message; text injected into context, images sent via vision API
- [x] **Streaming indicator** — animated pulse while AI is writing
- [x] **Context usage meter** — live token estimate with colour-coded fill bar
- [x] **Prompt Library** — save prompts from any user message (📚 hover button); insert from a dropdown left of the chat input; favorites pinned at top; manage all entries with inline edit, delete, and favorite toggle
- [x] **Chat session titles** — auto-generated from first 8 words of the first message; displayed in sidebar session list
- [x] **Session search** — live filter input above the chat session list; searches title and message content
- [x] **Message editing / regeneration** — ✏ edit any user message inline and resend (discards everything after); ↺ regenerate any assistant response