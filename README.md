# Sourcedesk

An in-browser RAG and project management tool that talks to AI providers directly from the browser. Runs completely client-side as a single HTML file for normal use — open it, it works. For local LLM support and the optional environment-injected server workflow, you can also run it through the included Node server. No install is needed for the browser app itself.

An in-browser RAG and project management tool that talks to AI providers directly from the browser. Runs completely client-side as a single HTML file — open it, it works. No server, no install, no account.

**Current version:** v0.8.0 — Task management, working doc versioning, chat session titles & search, message edit/regen, prompt library

---

## Quick Start

1. Download `SourceDesk.html` and open it in any modern browser.
2. Go to **Settings** → paste your API key for your chosen provider.
3. Create a project, upload documents, and start chatting. The AI model will use your docs as context automatically.

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
- **Create from document** — click `→Tmpl` on any uploaded document in the context panel to open the template editor pre-filled with that document's content
- **Duplicate** — copy any template with one click

### Context Panel
Shows exactly what the AI can "see" for the current chat:
- Attached template with Fill and View shortcuts
- All uploaded project docs with per-doc include/exclude toggles
- Checkboxes to pull in documents from other projects
- Upload new files directly from the panel

### Retrieval (BM25)
When you send a message, BM25 scores all active document chunks against your query, pulls the top 4 matches, and injects them into the system prompt. Each reply bubble shows which documents were referenced.

### Multi-Provider Support
Settings → AI Provider supports:
- **Anthropic** — Claude Sonnet 4.6, Opus 4.6, Haiku 4.5
- **OpenAI** — GPT-5.4, GPT-5.4-mini, GPT-5.4-nano, GPT-4o, GPT-4o-mini, o4-mini
- **OpenRouter** — Claude, GPT-4o, Gemini 2.5 Pro/Flash, Llama 3.3 70B, DeepSeek R1, Grok 3, Mistral Large; plus free-tier models: Google Gemma 4 (26B/31B), Nvidia Nemotron Super 120B, Minimax M2.5, OpenAI GPT-OSS 120B
- **GitHub Models** — GPT-4o, Phi-4, Llama 3.3 70B, DeepSeek V3, Mistral Large

Per-provider API keys stored separately in IndexedDB. Switch providers at any time without losing keys.

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
npm install          # first time only
npm run build        # production minified build → SourceDesk.html
npm run dev          # unminified dev build (fast, ~10 ms)
npm run watch        # watch src/ and rebuild on save
npm run serve        # optional local server for env injection / local LLM defaults
```

Edit source files in `src/`. Never edit `SourceDesk.html` directly.

If you want to use the local server workflow:
- create a `.env` file next to `server.js`
- set `LOCAL_LLM_URL` and optionally `LOCAL_LLM_DEFAULT_MODEL`
- run `npm run serve`
- open `http://localhost:3000` in your browser

Example `.env` values:
- `PORT=3000`
- `ENVIRONMENT=homelab`
- `LOCAL_LLM_URL=http://localhost:11434/v1`
- `LOCAL_LLM_DEFAULT_MODEL=llama3.2`

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
- [x] **Template variable preview** — inline "Preview resolved" panel in the template editor that shows the output against the current active project without saving

### Retrieval & Context
- [ ] **Client-side Semantic Embeddings** *(low priority)* — run `all-MiniLM-L6-v2` directly in the browser via `transformers.js` + WASM for true semantic search with no API cost; warn users about a ~30 MB one-time model download (cached by the browser after first use); alternative: use an API-based embedding provider (OpenAI `text-embedding-3-small`, etc.) so users who don't want the WASM download can still get semantic search
- [x] **Local model quick-selector** — when the Local LLM provider is active, a compact model dropdown appears in the topbar so you can switch models without opening Settings; includes a ⟳ re-detect button that re-queries `/models` from the configured base URL
- [ ] **Enhanced Retrieval** — hybrid BM25 + semantic similarity re-ranking once embeddings are available
- [x] **Google Drive Connector** — import supported Drive files into projects, verify short-lived OAuth Playground tokens, and back up the database to Drive

### Project Data & Contacts
- [x] **Task Management** — per-project tasks with title, description, status, priority, due date; include-in-context toggle injects active tasks into every chat message
- [ ] **Important Contacts / Resources** — per-project contact info and links with tags; include-in-context toggle
- [ ] **Vendor Catalog** — directory of vendors and agencies categorised by expertise; include in context for relevant projects
- [ ] **Project Deliverables** — define expected outputs/artifacts with deadlines and milestones; export as a zip of generated files or structured JSON/CSV
- [ ] **Project Type Templates** — predefined project configurations with instructions, doc structures, and settings for common use cases (meeting notes, research, writing, etc.)

### Visualisation & Planning
- [ ] **Org Charts** — lightweight org chart creator and viewer for team structures and project stakeholders; include in context
- [ ] **Calendar Integration** — sync deadlines and milestones from an external calendar; surface dates in project context
- [ ] **Task Management** — per-project tasks with due dates, priority, and status; track progress without leaving the app
- [x] **Versioning** — automatic snapshots on every working document save; History button to browse, restore, or delete any snapshot

### Platform
- [ ] **Mobile Optimisation** — responsive layout for the context panel and chat on smaller screens

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