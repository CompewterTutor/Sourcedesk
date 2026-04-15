# Sourcedesk

An in-browser RAG and project management tool that talks to AI providers directly from the browser. Runs completely client-side as a single HTML file — open it, it works. No server, no install, no account.

**Current version:** v0.4.0 — template variables & constants, create template from document

---

## Quick Start

1. Download `SourceDesk.html` and open it in any modern browser.
2. Go to **Settings** → paste your API key for your chosen provider.
3. Create a project, upload documents, and start chatting. Claude (or any other supported model) will use your docs as context automatically.

---

## Features

### Projects
Create a project from a template or start blank. Each project has its own:
- **Document collection** — upload `.txt`, `.md`, `.csv`, `.pdf`, `.docx` files
- **Chat history** — full conversation per project, stored locally
- **Working document** — the template content lands here as an editable draft (Working Doc button in the topbar)
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
- **OpenRouter** — Claude, GPT-4o, Gemini 2.5 Pro/Flash, Llama 3.3 70B, DeepSeek R1, Grok 3, Mistral Large
- **GitHub Models** — GPT-4o, Phi-4, Llama 3.3 70B, DeepSeek V3, Mistral Large

Per-provider API keys stored separately in IndexedDB. Switch providers at any time without losing keys.

### Notes
Per-project note editor (sidebar → Notes →):
- Create, edit, save, delete notes with title and body
- **Include in chat context** toggle — checked notes are injected into the system prompt as `## Active Note`
- Auto-saves when you switch notes or navigate away
- Filter notes by title in real time
- Ctrl+S / Cmd+S to save without leaving the keyboard

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

Open `tests/test.html` in a browser to run the unit test suite (65 tests, 13 suites). Covers BM25 search, markdown formatting, text chunking, stream parsing for all 4 providers, `buildApiCall` for all 4 providers, import shape validation, `parseConstants`, and `resolveTemplateVars`. No build step or server required.

---

## Building from Source

```sh
npm install          # first time only
npm run build        # production minified build → SourceDesk.html
npm run dev          # unminified dev build (fast, ~10 ms)
npm run watch        # watch src/ and rebuild on save
```

Edit `src/main.js` and `src/index.html`. Never edit `SourceDesk.html` directly.

---

## Roadmap

### Core Workflow
- [x] **Projects** — create, edit, delete with full cascade; categories (RFP, RFI, Vendor Q, Contract, Other)
- [x] **Working Document editor** — editable draft per project, opened from the topbar, Ctrl+S saves
- [x] **Clear Chat History** — wipe the chat for a project without deleting the project
- [x] **Global Instructions** — a system prompt addition applied to every chat
- [x] **Per-Project Instructions** — per-project system prompt additions
- [x] **Notes** — per-project note editor; include-in-context toggle; autosave; real-time filter; Ctrl+S
- [x] **Multi-Provider LLM Support** — Anthropic, OpenAI, OpenRouter, GitHub Models with per-provider key storage and model lists
- [x] **Database Export / Import** — full JSON backup and restore via Settings
- [x] **Project / Chat Export** — export active project + messages + doc metadata as JSON

### Templates
- [x] **Custom Prompt Templates** — skeleton (with `{{PLACEHOLDER}}`) and example types; fill modal; view shortcut; global template library
- [x] **Duplicate Template** — one-click copy of any template
- [x] **Template Variables & Constants** — built-in auto-variables (`{{PROJECT_NAME}}`, `{{TODAY}}`, etc.) plus user-defined constants (`KEY=value` in Settings); auto-resolved before manual fill; fill modal shows what was auto-filled
- [x] **Create Template from Document** — `→Tmpl` button on any uploaded doc opens the template editor pre-filled with the document's content
- [ ] **Template variable date expressions** — e.g. `{{TODAY+7}}` for relative dates; auto-extraction of names, dates, and entities from uploaded docs as suggested constants
- [ ] **Template variable preview** — "Preview resolved" button in the template editor that shows the output against the current active project without saving

### Retrieval & Context
- [ ] **Enhanced Retrieval** — semantic search with embeddings, or a hybrid BM25 + semantic approach for improved relevance
- [ ] **Google Drive Connector** — search and fetch Drive docs on demand; auto-sync a project with a specific Drive folder for backup and cross-device access

### Project Data & Contacts
- [ ] **Important Contacts / Resources** — per-project contact info and links with tags; include-in-context toggle
- [ ] **Vendor Catalog** — directory of vendors and agencies categorised by expertise; include in context for relevant projects
- [ ] **Project Deliverables** — define expected outputs/artifacts with deadlines and milestones; export as a zip of generated files or structured JSON/CSV
- [ ] **Project Type Templates** — predefined project configurations with instructions, doc structures, and settings for common use cases (meeting notes, research, writing, etc.)

### Visualisation & Planning
- [ ] **Org Charts** — lightweight org chart creator and viewer for team structures and project stakeholders; include in context
- [ ] **Calendar Integration** — sync deadlines and milestones from an external calendar; surface dates in project context
- [ ] **Task Management** — per-project tasks with due dates, priority, and status; track progress without leaving the app
- [ ] **Versioning** — save named snapshots of the working document; roll back to any previous version

### Platform
- [ ] **Mobile Optimisation** — responsive layout for the context panel and chat on smaller screens