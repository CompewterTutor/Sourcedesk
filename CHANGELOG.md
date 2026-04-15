# Changelog

All notable changes to SourceDesk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Versions marked with 🗄️ include IndexedDB schema changes and a migration script.

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