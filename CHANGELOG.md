# Changelog

All notable changes to SourceDesk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Versions marked with 🗄️ include IndexedDB schema changes and a migration script.
> Versions marked with 🖥️ include a local helper/server addition for hosted or homelab use.

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