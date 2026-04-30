# CLAUDE.md — SourceDesk Session Context

> Read this at the start of every session. Update it when decisions change, new gotchas are found, or features ship.

---

## What This Project Is

**SourceDesk** is a single-file, in-browser RAG + project management tool that talks to the Anthropic API directly from the browser. It was originally built for university procurement workflows (RFPs, RFIs, vendor questionnaires) but is general enough for any document-heavy project work.

**Core constraints that must never be broken:**
- The output (`SourceDesk.html`) must be a single self-contained file — open it, it works. No server, no install.
- No user data ever leaves the browser except to the Anthropic API.
- All persistence is IndexedDB. No localStorage, no cookies, no backend.

---

## Repo Structure

```
Sourcedesk/
├── src/
│   ├── index.html          ← HTML + CSS template; JS injected at build time via <!-- BUILD:JS -->
│   ├── flags.js            ← DEBUG, TEST, APP_VERSION, PROVIDERS constant, log()
│   ├── db.js               ← IndexedDB open/CRUD helpers; DB_VERSION
│   ├── state.js            ← Global `state` object; getCurrentProviderKey / setProviderKey
│   ├── boot.js             ← boot(), showView(), renderSidebar(), loadProject()
│   ├── messages.js         ← renderMessages(), appendMessageEl(), formatMarkdown()
│   ├── retrieval.js        ← BM25 tokenize/index/score, chunkText(), retrieveContext()
│   ├── api.js              ← buildApiCall(), parseStreamDelta()
│   ├── chat.js             ← sendMessage(), saveChat(), newChat(),
│   │                          renderChatSessionList(), loadChatSession()
│   ├── panel.js            ← renderRightPanel(), toggleDoc(), toggleOtherProject(),
│   │                          handleDocUpload(), deleteDoc(), toggleRightPanel()
│   ├── templates.js        ← Template CRUD, renderTemplatesGrid(), duplicateTemplate(),
│   │                          createTemplateFromDoc(), openExtractVars(), extractVarsFromText()
│   ├── projects.js         ← openNewProject(), saveProject(), openEditProject(), deleteProject()
│   ├── fill.js             ← openFillTemplate(), applyFill(), viewTemplateContent(),
│   │                          resolveTemplateVars(), parseConstants(), previewTemplateVars()
│   ├── settings.js         ← openSettings(), saveSettings(), fetchLocalModels(),
│   │                          updateProviderUI(), onProviderChange(), clearChatHistory(),
│   │                          openWorkingDoc(), saveWorkingDoc(), exportDatabase(),
│   │                          importDatabase(), clearAllData(), topbarModelChange(),
│   │                          refreshTopbarModels(), syncTopbarModelSelect()
│   ├── drive.js            ← Google Drive connector (openDriveModal, verifyDriveToken,
│   │                          listDriveFiles, importFromDrive, backupToDrive, disconnectDrive)
│   ├── notes.js            ← Notes view CRUD, renderNotesList(), filterNotes(),
│   │                          searchNotes(), searchAllNotes(), toggleNotePin()
│   ├── supplierQuestions.js← Supplier Questions view; all SQ CRUD + AI generation + export
│   ├── attachments.js      ← Temporary file attachments, context usage meter,
│   │                          streaming indicator (showStreamingIndicator / hide),
│   │                          _runtimeContextLimits, setModelContextLimit(), getContextLimit()
│   ├── promptLibrary.js    ← Prompt Library CRUD + UI; openPromptLibrary(), insertPrompt(),
│   │                          openSavePromptModal(), openManagePromptLibrary(),
│   │                          savePromptEntry(), deletePromptEntry(), togglePromptFavorite()
│   ├── versioning.js       ← Working document snapshots; saveDocVersion(), openVersionHistory(),
│   │                          restoreDocVersion(), deleteDocVersion()
│   ├── tasks.js            ← Per-project task management view; full CRUD; loadTasks(),
│   │                          openNewTask(), selectTask(), saveCurrentTask(),
│   │                          deleteCurrentTask(), filterTaskList(), toggleTaskInContext()
│   └── ui.js               ← Modal helpers, pill helpers, input resize, keyboard shortcuts
├── tests/
│   └── test.html           ← Self-contained browser test runner (no server needed, file:// works)
├── build.js                ← Node build script; SRC_FILES order; terser mangle.reserved list
├── server.js               ← Optional local server for env injection / local LLM defaults
├── package.json            ← npm project; devDep: terser ^5.37.0
├── package-lock.json
├── SourceDesk.html         ← Compiled output (committed; this is what users open)
├── CHANGELOG.md            ← Versioned changelog; 🗄️ marks DB schema changes
├── README.md               ← User-facing docs; roadmap as checkboxes
├── CLAUDE.md               ← This file
└── .gitignore              ← node_modules/, etc.
```

**Never edit `SourceDesk.html` directly.** Edit `src/` files and rebuild.

---

## Dev Workflow

### Build

```sh
npm install          # first time only
npm run build        # production: minified, ~188 KB total
npm run dev          # dev: unminified, fast, good for devtools debugging
npm run watch        # watch src/ and rebuild on save (dev mode)
npm run serve        # optional local server for env injection / local LLM defaults
```

### Run the app
Open `SourceDesk.html` in a browser. No server needed.

### Run tests
Open `tests/test.html` in a browser. No server needed. Results render immediately.

### Typical feature loop
1. Edit the relevant `src/*.js` file(s) and/or `src/index.html`
2. `npm run dev` to get a fast unminified build
3. Open/refresh `SourceDesk.html` to test manually
4. Open/refresh `tests/test.html` to run unit tests
5. `npm run build` for the final minified build
6. Update `CHANGELOG.md` and `README.md` checklist
7. Commit with a descriptive message, push

---

## Architecture

### IndexedDB Stores (current schema: `DB_VERSION = 8`)

| Store | keyPath | Indexes | Shape |
|---|---|---|---|
| `templates` | `id` | — | `{id, name, category, type, content, updatedAt}` |
| `projects` | `id` | — | `{id, name, category, templateId, notes, instructions, workingContent, createdAt}` |
| `docs` | `id` | `projectId` | `{id, projectId, name, content, uploadedAt}` |
| `chats` | `id` | `projectId`, `sessionId` | `{id, projectId, sessionId, messages: [{role, content, sources, chunks}], createdAt, updatedAt}` |
| `settings` | `key` | — | `{key, value}` — keys: `provider`, `model`, `globalContext`, `constants`, `localLlmUrl`, `driveToken`, `apiKey_anthropic`, `apiKey_openai`, `apiKey_openrouter`, `apiKey_github` (legacy: `apiKey` migrated → `apiKey_anthropic` on first boot) |
| `notes` | `id` | `projectId` | `{id, projectId, title, content, pinned, includeInContext, createdAt, updatedAt}` |
| `supplierQuestions` | `id` | `projectId` | `{id, projectId, text, draftAnswer, createdAt, updatedAt}` |
| `promptLibrary` | `id` | — | `{id, title, content, favorite, createdAt, updatedAt}` |
| `docVersions` | `id` | `projectId` | `{id, projectId, content, savedAt, label}` |
| `tasks` | `id` | `projectId` | `{id, projectId, title, description, status, priority, dueDate, includeInContext, createdAt, updatedAt}` |
| `embeddings` | `id` | `docId` | `{id, docId, chunkIndex, vector}` |
| `contacts` | `id` | `projectId` | `{id, projectId, type: 'contact'\|'resource', name, role, org, email, phone, url, notes, tags[], includeInContext, createdAt, updatedAt}` |

### DB Helper Pattern
All DB access goes through five helpers: `dbGet(store, key)`, `dbPut(store, val)`, `dbDelete(store, key)`, `dbGetAll(store)`, `dbGetByIndex(store, index, val)`. All return Promises. Always await them.

### State Object
```js
let state = {
  projects: [],           // all projects (loaded at boot)
  templates: [],          // all templates (loaded at boot)
  settings: {
    provider: 'anthropic',  // 'anthropic' | 'openai' | 'openrouter' | 'github' | 'local'
    model: 'claude-sonnet-4-6',
    globalContext: '',
    anthropicKey: '',
    openaiKey: '',
    openrouterKey: '',
    githubKey: '',
    constants: '',          // "KEY=value" lines; parsed by parseConstants(); used in resolveTemplateVars()
    driveToken: '',         // Google Drive OAuth access token (short-lived, ~1 hour)
    localLlmUrl: '',        // base URL for local OpenAI-compat server, e.g. http://localhost:11434/v1
  },
  activeProject: null,    // full project object; may have .instructions, .workingContent fields
  activeDocs: new Set(),  // doc IDs toggled ON in context
  activeOtherProjects: new Set(), // other project IDs whose docs are pulled in
  messages: [],           // current chat session's messages
  activeChatId: null,     // id of the currently loaded chats record; null = unsaved new session
  streaming: false,       // true while SSE stream is open
  rightPanelOpen: true,
  editingTemplateId: null,
  currentNote: null,      // note object being edited in Notes view, or null
  editingProjectId: null, // project ID being edited in modal, or null (null = create mode)
  currentQuestion: null,  // supplier question object being viewed, or null
};
```

### Rendering Pattern
No virtual DOM, no framework — direct DOM manipulation. Key render functions:
- `renderSidebar()` — projects list in sidebar
- `renderMessages()` — full chat replay from `state.messages`
- `appendMessageEl(role, content, sources, chunks)` — appends a single message bubble
- `renderRightPanel()` — template ref, project docs, other-project checkboxes
- `renderTemplatesGrid()` — templates library view
- `renderChatSessionList()` — sidebar "Chats" section; all saved sessions for active project
- `renderNotesList()` — notes list panel in Notes view
- `renderSQList()` — supplier questions list panel

### Modal System
One overlay div (`#modal-overlay`), multiple modal divs inside it. `showModal(id)` hides all modals then shows the target one. `closeModal()` hides the overlay. `closeModalOnOverlay(e)` checks `e.target` before closing.

### View System
`showView(v)` toggles between `'chat'`, `'templates'`, `'notes'`, `'working-doc'`, `'sq'`. Sets `display:flex` or `display:none` on the respective view divs. Auto-saves the current note when leaving the notes view.

### Retrieval Pipeline (BM25)
`retrieveContext(query, topK=4)`:
1. Collect all active doc IDs (project docs + toggled other-project docs)
2. Optionally prepend template content as a chunk
3. For each doc: `chunkText(content, 400, 60)` → overlapping 400-word windows
4. `buildIndex(chunks)` → IDF table + per-chunk TF + avgLen
5. `bm25Score(query, idx, i)` for each chunk
6. Sort descending, take top-K with score > 0
7. Return `{ context: string, sources: string[], chunks: {source, snippet}[] }`
8. `context` is injected into system prompt; `sources` + `chunks` are shown as a collapsible "▸ N sources referenced" row below the reply bubble

### Multi-Provider Architecture

`PROVIDERS` constant (in `src/flags.js`) defines config for each provider:
```js
PROVIDERS[provider] = { label, keyLabel, keyPlaceholder, keyHint, models[], defaultModel }
```
Providers: `anthropic`, `openai`, `openrouter`, `github`, `local`.

For the `local` provider, `models[]` starts as `[{ id: "", label: "— click Detect Models —" }]` and is populated at runtime by `fetchLocalModels()`, which calls `GET {localLlmUrl}/models`. Context window sizes reported by the server (`context_length` / `context_window` / `n_ctx` / `max_context_length`) are stored in `_runtimeContextLimits{}` via `setModelContextLimit()` and used by `getContextLimit()` in `attachments.js` — taking priority over the static `CONTEXT_LIMITS` map.

### Temporary Attachments & Context Meter (`src/attachments.js`)
- `_pendingAttachments[]` — `{ name, type: 'text'|'image', content }` — cleared after every send
- Text files injected into system prompt as `## Attached Files (this message only)`
- Images sent as vision content arrays (Anthropic `source.base64` / OpenAI-compat `image_url`)
- `updateContextMeter()` — estimates tokens as `totalChars / 4`; tallies messages + pending attachments + current input; updates `#context-meter-bar` width and colour (accent < 60% → amber → danger)
- `showStreamingIndicator()` / `hideStreamingIndicator()` — toggle `#streaming-indicator` pulse animation

### Multi-Session Chat
Each project stores multiple chat records in the `chats` store, each with its own `id`, `sessionId` (same as `id`), `createdAt`, and `updatedAt`. `state.activeChatId` tracks the currently loaded session. `saveChat()` creates a new record if `activeChatId` is null (first send in a new session) or updates the existing record. `loadProject()` loads the session with the highest `updatedAt`. `newChat()` clears messages and `activeChatId`. `renderChatSessionList()` renders all sessions for the active project into `#chat-session-list` in the sidebar.

Two helper functions:
- `getCurrentProviderKey()` — returns `state.settings[provider + 'Key']`
- `setProviderKey(provider, key)` — writes to `state.settings[provider + 'Key']`

`buildApiCall(systemPrompt, apiMessages)` returns `{url, headers, body}`:
- **Anthropic**: `POST api.anthropic.com/v1/messages`, headers `x-api-key` + `anthropic-version` + `anthropic-dangerous-direct-browser-access`, body has top-level `system` field
- **OpenAI**: `POST api.openai.com/v1/chat/completions`, `Authorization: Bearer`, system injected as first message `{role:'system', content}`
- **OpenRouter**: same as OpenAI but `openrouter.ai/api/v1/...`, adds `HTTP-Referer: https://sourcedesk.app` and `X-Title: SourceDesk`
- **GitHub Models**: same as OpenAI but `models.inference.ai.azure.com/chat/completions`, auth is a GitHub PAT with `models:read` scope

`parseStreamDelta(data)` handles both SSE formats:
- Anthropic: `parsed.type === 'content_block_delta'` → `parsed.delta.text`
- OpenAI-compat: `parsed.choices[0].delta.content`
- Returns `null` for `[DONE]`, non-delta events, or parse errors

`onProviderChange(provider)` (called from HTML onclick) — snapshots the typed key for the old provider into state, then updates the UI for the new provider. Does NOT save to DB until the user clicks Save.

### Streaming Chat
`sendMessage()` calls `buildApiCall()` to get the fetch params, then reads the SSE stream with `ReadableStream.getReader()` + `TextDecoder`, calling `parseStreamDelta()` per line. `max_tokens` is 4096.

---

## Provider Reference

| Provider | API Base URL | Auth Header | System Prompt |
|---|---|---|---|
| Anthropic | `api.anthropic.com/v1/messages` | `x-api-key: {key}` | Top-level `system` field |
| OpenAI | `api.openai.com/v1/chat/completions` | `Authorization: Bearer {key}` | First message `{role:'system'}` |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer {key}` | First message `{role:'system'}` |
| GitHub Models | `models.inference.ai.azure.com/chat/completions` | `Authorization: Bearer {PAT}` | First message `{role:'system'}` |
| Local LLM | `{localLlmUrl}/chat/completions` | `Authorization: Bearer {key}` (optional) | First message `{role:'system'}` |

**Model IDs** (as of 2025-07-19):
- Anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`
- OpenAI: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`
- OpenRouter: `openai/gpt-4o`, `google/gemini-2.5-pro-preview`, `google/gemini-2.5-flash-preview`, `meta-llama/llama-3.3-70b-instruct`, `deepseek/deepseek-r1`, `x-ai/grok-3-beta`, `mistralai/mistral-large`; free-tier: `google/gemma-4-26b-a4b-it:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `minimax/minimax-m2.5:free`, `openai/gpt-oss-120b:free`
- GitHub Models: `gpt-4o`, `gpt-4o-mini`, `Meta-Llama-3.3-70B-Instruct`, `Phi-4`, `DeepSeek-V3-0324`, `Mistral-Large-2411`
- Local LLM: populated at runtime by `fetchLocalModels()` from `GET {localLlmUrl}/models`

Check provider docs before adding new models — IDs change frequently.

## Flags & Constants (`src/flags.js`)

```js
const DEBUG       = window.__SOURCEDESK_DEBUG__ || false;
const TEST        = window.__SOURCEDESK_TEST__  || false;
const APP_VERSION = '0.6.0';
function log(...args) { if (DEBUG) console.log('[SD]', ...args); }
```

- Set `window.__SOURCEDESK_DEBUG__ = true` in console to enable logging without a rebuild.
- `TEST` suppresses `DOMContentLoaded` + `boot()` so the test page can load the script without touching the DOM or IndexedDB.
- `APP_VERSION` should be bumped in `src/flags.js` **and** `package.json` together.

---

## Build Pipeline Details

### How injection works
`build.js` reads `src/index.html`, finds the literal string `  <!-- BUILD:JS -->`, and replaces it with `<script>\n{js}\n</script>`. If the placeholder is missing, the build throws.

### Terser reserved names — CRITICAL
Terser mangle will rename any function not in the `reserved` list. Every function called from an HTML `onclick="..."` attribute **must** be in `build.js`'s `mangle.reserved` array. Current list (as of v0.6.0):

```
showView, openNewProject, saveProject, openNewTemplate, openEditTemplate,
saveTemplate, deleteTemplate, openFillTemplate, applyFill, viewTemplateContent,
promptAttachTemplate, openSettings, saveSettings, clearAllData, loadProject,
sendMessage, toggleRightPanel, toggleDoc, toggleOtherProject, deleteDoc,
handleDocUpload, selectPill, selectPillByVal, closeModal, closeModalOnOverlay,
onProviderChange, boot, exportDatabase, triggerImportDialog, importDatabase,
exportProject, openNewNote, selectNote, saveCurrentNote, deleteCurrentNote,
loadNotes, renderNotesList, validateImportShape, filterNotes, toggleNoteInContext,
openEditProject, deleteProject, duplicateTemplate, openWorkingDoc, saveWorkingDoc,
clearChatHistory, previewTemplateVars, openExtractVars, saveExtractedVars,
createTemplateFromDoc, openDriveModal, verifyDriveToken, listDriveFiles,
backupToDrive, disconnectDrive, fetchLocalModels, togglePreviewPanel,
searchNotes, searchAllNotes, toggleNotePin,
loadSupplierQuestions, renderSQList, selectQuestion, openAddQuestionsModal,
saveAddedQuestions, generateAnswerForQuestion, generateSelectedAnswers,
saveCurrentSQAnswer, deleteQuestion, copyQuestionToClipboard,
copyAnswerToClipboard, exportSelectedQuestions, exportAllQuestions,
filterSQList, toggleAllSQCheckboxes, scheduleSQAutoSave,
topbarModelChange, refreshTopbarModels, syncTopbarModelSelect,
newChat, renderChatSessionList, loadChatSession,
openAttachMenu, handleAttachFiles, removeAttachment, clearPendingAttachments,
renderAttachBar, getPendingAttachments, updateContextMeter,
showStreamingIndicator, hideStreamingIndicator,
setModelContextLimit, getContextLimit
```

**When you add a new function called from HTML, add it to this list or the minified build will silently break.**

---

## Testing

### How it works
`tests/test.html` sets `window.__SOURCEDESK_TEST__ = true` in an inline script, then loads all `src/*.js` source files (in the same order as `build.js` `SRC_FILES`) via `<script src>` tags. Because `TEST` is true, `ui.js` skips the `DOMContentLoaded` handler and `boot()` never runs. All pure functions are available globally and the test suite runs against them.

### Current test coverage (92 tests, 17 suites)
`tokenize`, `chunkText`, `buildIndex`, `bm25Score`, `formatMarkdown`, `uid`, `validateImportShape`, `parseStreamDelta` (all 5 providers including local), `buildApiCall` (all 5 providers), `PROVIDERS` config integrity, `parseConstants`, `resolveTemplateVars`, `resolveTemplateVars — date arithmetic`, `extractDatesFromText`, `extractVarsFromText`.

### Adding a test
1. Add a `describe`/`it` block in `tests/test.html` inside the existing test script block.
2. The function under test must be a `function` declaration (not `const fn = () => {}`) in one of the `src/*.js` files — all declarations are global in browser JS.
3. If testing something that needs IndexedDB, mock it — don't use the real one.
4. If the function lives in a source file not yet loaded by `tests/test.html`, add a matching `<script src="../src/filename.js">` tag to the test page in the correct load order.

---

## Coding Standards

### JavaScript
- Vanilla JS only. No frameworks, no imports, no modules (everything is global).
- `async/await` everywhere for async operations. No raw `.then()` chains.
- All new functions: use `function` declarations (not `const fn = () => {}`), because declarations are hoisted and available globally.
- `uid()` for all new record IDs: `Date.now().toString(36) + Math.random().toString(36).slice(2,7)`
- Guard DB operations: always check that `db` is open and `state.activeProject` exists before accessing project-scoped data.
- Keep functions focused. If a function is >40 lines, consider splitting.

### HTML / CSS
- Design tokens live in `:root` in `src/index.html`. Use CSS variables everywhere — never hardcode colors.
- Color palette: `--bg #0f0e0c`, `--surface #191816`, `--surface2 #22201e`, `--accent #c9a84c`, `--accent-dim #7a6430`, `--text #e8e4dc`, `--text-dim #a8a49c`, `--text-muted #72706a`, `--danger #c0513a`, `--success #5a9e6f`.
- Fonts: `DM Serif Display` (headings, logo, project title), `DM Mono` (labels, badges, code, monospace UI), `Instrument Sans` (body, buttons, forms).
- Use `--radius: 6px` and `--radius-lg: 10px` for border-radius. Never hardcode radii.
- New modals: add the div inside `#modal-overlay` in `src/index.html`, give it `id="modal-{name}"`, add `class="modal hidden"`. Then call `showModal('modal-{name}')` to open it.
- New views: add a sibling div to `#chat-view` and `#templates-view` in `#main`, extend `showView()` in `src/main.js`.

### DB Schema Changes
See the migration guide section below.

### Commits
- Prefix: `feat:`, `fix:`, `build:`, `test:`, `docs:`, `refactor:`
- Body should mention any DB version bumps, reserved-list additions, or breaking changes.
- Always run `npm run build` and verify `SourceDesk.html` opens before committing.

---

## DB Migration Guide

When adding a new object store or index:

1. Bump `DB_VERSION` in `src/main.js` (e.g. `1` → `2`).
2. In `openDB()`'s `onupgradeneeded`, add the new store inside an `if (!d.objectStoreNames.contains(...))` guard:
   ```js
   req.onupgradeneeded = e => {
     const d = e.target.result;
     // existing stores...
     if (!d.objectStoreNames.contains('notes')) {
       const s = d.createObjectStore('notes', { keyPath: 'id' });
       s.createIndex('projectId', 'projectId', { unique: false });
     }
   };
   ```
3. Use `e.oldVersion` if you need to migrate existing record data:
   ```js
   req.onupgradeneeded = e => {
     const d = e.target.result;
     if (e.oldVersion < 2) { /* run v1→v2 migrations */ }
   };
   ```
4. **New fields on existing records** (e.g. adding `instructions` to projects): no DB change needed. Just access them defensively in code: `proj.instructions || ''`. IndexedDB doesn't enforce record shape.
5. Document in `CHANGELOG.md` under a 🗄️ version entry with the store name, keyPath, indexes, and a migration note.
6. Update the schema table in this file (the "IndexedDB Stores" section above).

---

## Current State (as of last commit)

**Current version: v0.8.0** — build output: `SourceDesk.html` (230.6 KB, 95.1 KB JS)

### Committed & working ✅

#### Core infrastructure
- Build pipeline: 21 `src/*.js` files + `src/index.html` → `npm run build` → single `SourceDesk.html`
- `DEBUG`, `TEST`, `APP_VERSION` flags in `src/flags.js`; `log()` helper; `DOMContentLoaded` boot gated on `!TEST`
- IndexedDB schema at `DB_VERSION = 8`; five CRUD helpers (`dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbGetByIndex`)
- `uid()` for all record IDs; defensive field access everywhere (old records missing new fields just return `undefined`)

#### Projects & Documents
- Full project CRUD — create, edit (✏), delete (✕ with cascade to docs/chats/notes/supplierQuestions)
- Categories: RFP, RFI, Vendor Q, Contract, Other
- Per-project **Instructions** field injected into system prompt
- **Working Document** — editable draft per project; opened from topbar; Ctrl+S saves
- Document upload (`.txt`, `.md`, `.csv`, `.pdf`, `.docx`); per-doc include/exclude toggle in context panel
- Cross-project document inclusion via checkboxes in context panel

#### Chat & Sessions (🗄️ DB_VERSION 4)
- **Multi-session chat** — each project stores multiple `chats` records; `state.activeChatId` tracks the loaded session
- `saveChat()` creates a new record (with `createdAt`/`updatedAt`) on first send; updates `updatedAt` on subsequent sends
- `loadProject()` loads the session with the highest `updatedAt`
- **New Chat** `+` button in sidebar "Chats" section — `newChat()` clears messages + `activeChatId` (prompts confirm if session has messages)
- `renderChatSessionList()` — sidebar list of all sessions for active project, sorted newest-first, with timestamp + 60-char preview
- `loadChatSession(chatId)` — swap messages and `activeChatId`, re-render
- `clearChatHistory()` — deletes all chat records for project, resets `activeChatId`, refreshes session list
- **Streaming indicator** — `#streaming-indicator` animated 3-dot pulse shown while SSE stream is open; `showStreamingIndicator()` / `hideStreamingIndicator()` called from `sendMessage()`

#### Temporary File Attachments (`src/attachments.js`)
- Paperclip button left of chat input → hidden `<input type=file>` (no modal)
- `_pendingAttachments[]` — `{ name, type: 'text'|'image', content }` — cleared after every send
- Text files injected into system prompt as `## Attached Files (this message only — not saved to project)`
- Images sent as vision content (Anthropic: `source.base64` / OpenAI-compat: `image_url`)
- Chips rendered in `#chat-attachments-bar` above input row; each chip has an ✕ remove button

#### Context Usage Meter (`src/attachments.js`)
- Thin bar + `~Xk / Yk` label below chat input; updates on every keystroke and after each response
- Estimates tokens as `totalChars / 4`; tallies all messages + pending attachment text + current input
- Bar colour: accent (< 60%) → amber (60–85%) → danger (> 85%)
- Static `CONTEXT_LIMITS` map in `attachments.js` for known model IDs; `_runtimeContextLimits{}` populated by `setModelContextLimit()` when `fetchLocalModels()` reads `context_length` / `context_window` / `n_ctx` / `max_context_length` from `/models` response — takes priority over static map
- `getContextLimit(modelId)` — runtime map → static map → 100k default

#### Multi-Provider LLM Support
- Providers: `anthropic`, `openai`, `openrouter`, `github`, `local`
- `PROVIDERS` constant in `src/flags.js`; `buildApiCall()` + `parseStreamDelta()` in `src/api.js`
- Per-provider key storage in DB; legacy `apiKey` → `apiKey_anthropic` migration on first boot
- `onProviderChange()` snapshots the old provider's key before switching UI (bug fixed v0.4.6)
- **Local LLM provider** — Ollama / LM Studio / llama.cpp via OpenAI-compat API; key optional; `fetchLocalModels()` queries `GET {localLlmUrl}/models` and populates the model list + runtime context limits
- **Local model topbar quick-selector** — compact `<select>` + ⟳ button in topbar, visible only when `provider = local`; `topbarModelChange()`, `refreshTopbarModels()`, `syncTopbarModelSelect()`

#### Templates
- Full CRUD; skeleton (`{{PLACEHOLDER}}`) and example types; Fill modal with auto-resolve
- `resolveTemplateVars()` — auto-substitutes `{{PROJECT_NAME}}`, `{{PROJECT_CATEGORY}}`, `{{PROJECT_NOTES}}`, `{{PROJECT_INSTRUCTIONS}}`, `{{TODAY}}`, `{{TIMESTAMP}}`, `{{TODAY±N}}`, `{{TODAY±Nw}}`, `{{TODAY±Nm}}`, plus user-defined constants
- `parseConstants(text)` — parses `KEY=value` lines; keys normalised to UPPER_CASE
- Template Variable Preview — inline `#tmpl-preview-panel` below content textarea; `togglePreviewPanel()` hides it
- Create Template from Document (`→Tmpl` button); Duplicate template
- Extract Variables from Document — `extractVarsFromText(text)` finds dates, money, percentages, `LABEL: value` pairs; `saveExtractedVars()` appends to settings constants

#### Notes (🗄️ DB_VERSION 2)
- Per-project notes with title + body; full CRUD; `state.currentNote`
- Autosave on view switch or note switch (skips DB write if content unchanged)
- Include-in-context toggle — checked notes injected into system prompt as `## Active Note`
- Pin/star toggle — `toggleNotePin(noteId)`; pinned notes sort to top
- Real-time filter; cross-project search via `searchAllNotes()`; Ctrl+S to save
- Ctrl+N (new note), Ctrl+Shift+F (focus filter) keyboard shortcuts

#### Supplier Questions (🗄️ DB_VERSION 3)
- Full-screen two-panel view (sidebar → "Supplier Q →"); `state.currentQuestion`; cascade-deleted with project
- Smart paste parsing (blank-line → numbered-list → single question)
- Checkboxes for batch ops; ✅/○ answer status icon; real-time filter; Select All toggle; hover-reveal delete
- AI answer generation with BM25 retrieval context; live streaming preview; batch generate for checked questions
- 1.5 s debounced autosave; manual Save button; 📋 Copy Q / Copy A clipboard buttons
- Markdown export (selected or all): `## Question N` / `### Answer` / `---` format

#### Retrieval (BM25)
- `retrieveContext(query, topK=4)` — chunks all active docs + template; BM25 scores; returns `{ context, sources, chunks }`
- Each reply bubble shows collapsible "▸ N sources referenced" with per-chunk source name and 120-char snippet

#### Database & Export
- `exportDatabase()` — all stores as timestamped JSON; `importDatabase(file)` validates + restores
- `validateImportShape()` — pure shape-check helper
- `exportProject()` — active project + messages + doc metadata as JSON
- `clearAllData()` — iterates each store, deletes all records one by one (intentional; avoids multi-store transaction conflicts)

#### Google Drive / Sheets / Docs Connector
- Token-based auth (OAuth Playground workaround for `file://` origin restriction)
- `verifyDriveToken()`, `listDriveFiles()`, `importFromDrive()`, `backupToDrive()`, `disconnectDrive()`
- Backup to Drive includes the `notes` store; token persisted in `settings` store under key `driveToken`
- **App Folder (hidden)** — `appDataFolder` magic alias used directly; no folder creation needed. DB backups and `sourcedesk-config.json` (which stores visible folder IDs) live here. Requires `drive.appdata` scope.
- **Visible folder structure (drive.file)** — `getOrCreateVisibleRootFolder(token)` creates/finds a `SourceDesk` root folder in the user's My Drive; `getOrCreateProjectFolder(token, projectId, projectName)` creates a per-project subfolder inside it (`SourceDesk/<projectName>/`). Both persist their IDs to `sourcedesk-config.json` in appDataFolder to avoid duplicate creation.
- **Config persistence** — `_loadDriveConfig(token)` reads `sourcedesk-config.json` from `?spaces=appDataFolder`; `_saveDriveConfig(token, config)` PATCHes existing or POSTs new. Shape: `{ visibleRootFolderId, projectFolderIds: { [projectId]: folderId } }`
- **Exports placed in project folder** — `exportQuestionsToSheets` and `exportToGoogleDoc` both call `getOrCreateProjectFolder` after file creation and use `PATCH ?addParents=folderId` to move the file in (non-fatal if it fails, file still exists)
- **docx / xlsx / pptx → Google Docs conversion on upload** — `convertFileToDriveText(file, token)` in `src/drive.js`; uploads to `appDataFolder` with Google Apps `mimeType` in metadata (triggers server-side conversion), exports as `text/plain` (or `text/csv` for sheets), then DELETEs the temp file; `handleDocUpload` in `src/panel.js` prompts the user for `.docx`/`.xlsx`/`.pptx` files when a Drive token is present, falls back to `readFileAsText` on cancel or error
- **Suggested OAuth scopes** (for OAuth Playground or a real OAuth client):
  - `drive.appdata` — read/write hidden app data folder (config + backups + temp conversion files)
  - `drive.file` — create/update files and folders *this app creates* (visible exports)
  - `drive.metadata.readonly` — list file metadata without reading content
  - `drive.readonly` — read any Drive file for import
  - `https://www.googleapis.com/auth/spreadsheets` — create/read spreadsheets
  - `https://www.googleapis.com/auth/documents` — create/write Google Docs

#### Local LLM Embeddings + Hybrid Retrieval (🗄️ DB_VERSION 7)
- `state.settings.embeddingModel` — name of an embedding model served by the local LLM (e.g. `nomic-embed-text`); empty = BM25-only; persisted to IndexedDB
- **`getEmbedding(text)`** in `src/retrieval.js` — POSTs to `{localLlmUrl}/embeddings` with `{model, input}`; returns float array or `null` on any error (never throws)
- **`cosineSimilarity(a, b)`** — standard dot-product cosine similarity; returns 0 for null/mismatched vectors
- **`indexDocEmbeddings(docId, chunks)`** — opportunistically stores per-chunk vectors in the new `embeddings` store; called at upload time
- **`getDocEmbeddings(docId)`** — retrieves stored vectors by docId index
- **Hybrid retrieval in `retrieveContext`** — if `getEmbedding(query)` returns a vector, fans out embedding calls to all chunks, combines BM25 (40%) + cosine similarity (60%) scores, re-ranks and returns top-K; falls through to pure BM25 if embedding model not set or call fails
- **`embeddings` store** — `{ id, docId, chunkIndex, vector }` with `docId` index; DB_VERSION 7 migration
- ⚠️ **TODO**: add `embeddings` store to `exportDatabase()`, `importDatabase()`, `clearAllData()`, and `backupToDrive()` stores arrays (currently excluded from backup/restore)
- **Settings UI** — `#embedding-model-row` (hidden unless provider = local); text input `#embedding-model-input`; **Test** button calls `testEmbeddingModel()` which shows vector dimension + latency on success
- **`updateProviderUI`** shows/hides `#embedding-model-row` alongside `#local-llm-url-row`

#### Chat Session Titles & Search
- `saveChat()` derives a title from the first 8 words of the first user message (title-cased); stored as `title` on the `chats` record; existing sessions fall back to the 60-char content preview
- `renderChatSessionList()` refactored to call shared `_renderChatSessionItems(container, chats, filterQuery)` helper; respects current value of `#chat-session-search` on every re-render
- `filterChatSessions(query)` — `oninput` handler on the search input above `#chat-session-list`; searches both `title` and raw message content

#### Message Editing and Regeneration
- `appendMessageEl(role, content, sources, chunks, msgIndex)` — optional `msgIndex` param; `renderMessages()` passes the forEach index
- **✏ Edit** button (`.msg-edit-btn`) on user bubbles — hover-revealed; calls `editMessageInline(msgDiv, index)`; replaces bubble with inline textarea + ✓ Resend / ✗ Cancel; Resend truncates `state.messages` at index, removes DOM elements from that index onward, calls `sendMessage()`
- **↺ Regenerate** button (`.msg-regen-btn`) on assistant bubbles — hover-revealed; calls `regenLastAssistant(assistantDiv)`; removes last assistant message from state and DOM, puts prior user message in `#chat-input`, calls `sendMessage()`
- CSS: `.msg-action-btn`, `.msg-edit-btn`, `.msg-regen-btn`, `.msg-edit-textarea`, `.msg-edit-actions`

#### Working Document Versioning (🗄️ DB_VERSION 6)
- `saveDocVersion(content)` — called automatically by `saveWorkingDoc()` after every `dbPut`; writes `{id, projectId, content, savedAt, label}` to `docVersions` store
- **History button** in Working Document view header → `openVersionHistory()` modal; lists all snapshots for active project newest-first; each row shows auto-label ("Version N"), timestamp, 100-char preview
- **Custom version labels** — each row has a ✎ button next to the label; clicking opens an inline input (`_vhStartLabelEdit` / `_vhSaveLabel`); Enter saves to `docVersions.label`, Esc cancels; empty label falls back to auto "Version N". Custom labels render in solid colour, auto labels in muted italic.
- `restoreDocVersion(versionId)` — confirms, snapshots current content first, applies selected version to `state.activeProject.workingContent`, writes to DB, updates `#working-doc-editor` if visible
- `deleteDocVersion(versionId)` — confirms, deletes from DB, re-renders the modal in place
- All in `src/versioning.js`

#### Task Management (🗄️ DB_VERSION 6)
- Per-project task list; accessible via **Tasks →** sidebar button (shown after `loadProject()`)
- Two-panel view (`#tasks-view`): left = scrollable task list with `filterTaskList()` filter input; right = detail/edit form
- Task fields: `title`, `description`, `status` (todo / in-progress / done), `priority` (low / medium / high), `dueDate` (ISO date string), `includeInContext`
- `includeInContext` tasks with `status !== 'done'` injected into system prompt as `## Active Tasks` in `sendMessage()`
- `state.currentTask` — currently selected task object or null
- All in `src/tasks.js`

#### Prompt Library (🗄️ DB_VERSION 5)
- `promptLibrary` store: `{ id, title, content, favorite, createdAt, updatedAt }` — not tied to any project; global across all sessions
- **📚 book icon button** left of the chat input opens a dropdown: favorites section at top (all starred entries), then up to 5 most recent non-favorited entries below a divider; clicking any entry calls `insertPrompt(content)` which sets `#chat-input` and fires `input` to trigger auto-resize
- **Save from message** — hover any user message bubble to reveal a 📚 button; `openSavePromptModal(content)` opens a modal with title input, content preview, and ★ favorite checkbox; content stashed in `overlay.dataset.plibContent` to avoid escaping issues
- **Manage Library modal** — `openManagePromptLibrary()` shows all entries sorted favorites-first then newest; each row has inline ★/☆ toggle (`_plibToggleFavAndRefresh`), ✎ inline edit (`_plibStartEdit` / `_plibSaveEdit` / `_plibCancelEdit`), ✕ delete with confirm (`_plibDeleteAndRefresh`)
- Dropdown closes on outside click via a `document` click listener registered after a `setTimeout(0)` to avoid the opening click triggering it
- All click handlers on dropdown entries use `addEventListener` (not `onclick` attributes) to avoid content-escaping issues

#### Contacts & Resources (🗄️ DB_VERSION 8)
- New per-project section: **Contacts & Resources** — sidebar nav `→` button revealed after `loadProject()`; full-screen two-panel view (`#contacts-view`)
- `contacts` store: `{ id, projectId, type, name, role, org, email, phone, url, notes, tags[], includeInContext, createdAt, updatedAt }`; cascade-deleted with project (along with `tasks` and `docVersions` — cascade extended in this session)
- **Two types** via type-pills: `contact` (person: name + role + org + email + phone + url) and `resource` (link: title + url). Form re-labels Name→Title and hides contact-only fields when type=resource (`_toggleContactFieldsByType`).
- **Tags** — comma-separated input; rendered as pill chips on each list row
- **Include in chat context** — checked entries injected into system prompt as `## Important Contacts & Resources` block by `_buildContactsContextBlock()` from `chat.js > sendMessage()`
- **Filter** — real-time filter searches name/role/org/email/phone/url/notes/tags via `filterContactList(value)`
- All in `src/contacts.js`; reserved names: `loadContacts`, `renderContactList`, `selectContact`, `openNewContact`, `saveCurrentContact`, `deleteCurrentContact`, `filterContactList`, `toggleContactInContext`, `selectContactTypePill`
- Included in `exportDatabase` / `importDatabase` / `clearAllData` / `backupToDrive` store arrays

#### UI / UX
- Dark theme; CSS custom properties for all colours; font stack: Syne 700 / Inter / JetBrains Mono
- Keyboard shortcuts: Ctrl+Enter (send), Escape (close modal), Ctrl+N (new note), Ctrl+Shift+F (focus notes filter), Ctrl+S (save note / working doc)
- Shortcut reference grid in Settings modal
- Chat input placeholder: "Ask the AI model anything about this project…"
- `#topbar-local-model` selector hidden for all non-local providers

### Still outstanding
- ❌ Google Drive connector requires manual token paste — proper OAuth popup not possible from `file://` origin
- ❌ Chat session titles are auto-generated from first-message preview only (60 chars); no LLM-generated title
- ❌ No message editing / regeneration
- ❌ No cross-project session search
- ❌ No "recent notes" quick-access (cross-project search covers the main use case)

---

## Next Steps (Ordered for Next Session)

1. **`npm run build`** → verify output, open `SourceDesk.html`, open `tests/test.html` → all green
2. ~~**Version labels**~~ ✅ — inline-edit a snapshot's label from the History modal (✎ button per row, Enter saves, Esc cancels)
3. ~~**Important Contacts / Resources**~~ ✅ — per-project contacts and resource links with tags + include-in-context (DB_VERSION 8, new `contacts` store, `src/contacts.js`)

---
### Upcoming Feature Sessions

4. **"Research" project type + AI-assisted research workflow** *(large)*
   - Add `Research` to the project category enum (alongside RFP, RFI, Vendor Q, Contract, Other)
   - Research project has a dedicated **Research Board** view: running list of research items each with source URL, summary, retrieved date, tags (e.g. "competitor", "regulation", "org chart", "vendor"), and include-in-context toggle
   - **Brave Search integration** — new Settings field `Brave API Key`; calls `GET https://api.search.brave.com/res/v1/web/search?q=<query>&count=10` with header `X-Subscription-Token: <key>` and `Accept: application/json`; response `web.results[]` each has `title`, `url`, `description` (HTML snippet); strip `<strong>` tags from description before display; results shown in a "Search Results" panel where user can click → add to research board
   - **crawl4ai integration** — new Settings field `crawl4ai Endpoint` (default `http://localhost:11235`); for any URL on the research board user can click "Crawl" to `POST {endpoint}/crawl` with body `{"urls":[url],"priority":10,"browser_config":{"type":"BrowserConfig","params":{"headless":true}},"crawler_config":{"type":"CrawlerRunConfig","params":{"cache_mode":"bypass"}}}`; use `results[0].fit_markdown` as the retrieved text; store in research item; inject into context via include toggle
   - **AI research agent flow** — "Research Topic" button in the Research Board: user describes a topic (e.g. "RFPs for food services at US universities 2024-2025, who is bidding, major vendors"), the AI uses Brave Search to find relevant URLs, auto-queues them for crawling, summarises each, and writes a structured research report to the Working Document
   - **Save research to Google Drive** — "Export Research to Drive" button: creates `SourceDesk/<project>/Research/` subfolder and uploads each research item as a Google Doc (title + URL + date + full crawled content); or exports the full board as one CSV/Markdown
   - Research items stored in new `research` IndexedDB store: `{ id, projectId, url, title, summary, fullText, tags, retrievedAt, includeInContext }` — DB_VERSION 8 bump
   - Suggested research query templates for procurement: "[vendor type] RFP university [year]", "[vendor] government contract history", "[state] procurement regulations [category]", "[university] org chart procurement department"

5. **Brave Search + crawl4ai Settings fields** *(prerequisite for #4, small on its own)*
   - `braveApiKey` — new Settings input; persisted to IndexedDB; used in Brave Search calls
   - `crawl4aiUrl` — new Settings input (default `http://localhost:11235`); persisted to IndexedDB
   - Both visible always (not gated behind a provider); add test buttons: Brave Test calls the API with `q=test&count=1`, crawl4ai Test calls `GET {url}/health` (crawl4ai exposes a health endpoint)
   - Add both to `state.settings`, `openSettings()`, `saveSettings()`, boot load
   - Add to `mangle.reserved`: `testBraveKey`, `testCrawl4aiEndpoint`

6. **Position Guidelines & Responsibilities parser** *(medium)*
   - New per-project section: **Position Guidelines** — accessible from sidebar when a project is loaded
   - User uploads documents (job descriptions, org charts, SOPs, policy docs) via the existing doc upload flow but tagged as `type: "guideline"` to distinguish from context docs
   - **Parse & analyse** button: sends guideline docs through the AI with a structured prompt that extracts:
     - Key responsibilities and ownership areas
     - Recommended task types and workflows for this role
     - Suggested project template structures (maps to existing Template system)
     - Recurring reminders / deadlines (maps to Task system with suggested due date offsets)
     - Relevant procurement categories or vendor types
   - AI output lands in a structured "Recommendations" panel with one-click actions: "Create Task", "Create Template", "Add to Context", "Set Reminder"
   - Guideline docs stored with existing `docs` store but with `docType: "guideline"` field; excluded from default BM25 context but injectable on demand
   - Useful for onboarding: new procurement officer uploads their position description and gets a pre-populated project + task scaffold

7. **MS Word / LibreOffice MCP server integration** *(medium, requires user setup)*
   - **Word MCP** — recommended: `word-mcp-live` by ykarapazar (`pip install word-mcp-live` / `uvx word-mcp-live`). 124 tools; cross-platform via python-docx (80 tools) + Windows COM live editing (44) + macOS JXA live (40). Supports track changes, comments, tables, TOC. Configure transport via `MCP_TRANSPORT=streamable-http` to expose as an HTTP endpoint SourceDesk can call.
   - **LibreOffice MCP** — best available: `jwingnut/libreoffice-mcp-ubuntu` (FastMCP Python server + LibreOffice `.oxt` extension; 9 tools covering track changes, comments, search/replace, insert, save/export). Only Ubuntu, single commit, experimental. Alternative for `.docx` → PDF only: `chfle/word-to-pdf-mcp` (Docker, unoserver-based, production-quality for that one task).
   - **SourceDesk integration approach**: new Settings section "MCP Endpoints"; user pastes `http://localhost:<port>` for each MCP server they have running; SourceDesk treats them as tool endpoints. On project load, if a Word/LibreOffice MCP is configured and the project has a Working Document, show "Open in Word" / "Open in LibreOffice" button that calls the MCP's `create` or `open` tool with the current working content. On close/save, pull the modified content back via the MCP's `content` tool and update the Working Document in IndexedDB.
   - **Target document versioning for RFP/Research projects**: the Working Document already has version snapshots (DB_VERSION 6). Extend this with a "Target Document" concept — a secondary editable artifact (e.g. the actual RFP response being drafted) separate from the working notes document. Same versioning system applies. MCP round-trip would target this document. Store as `{ id, projectId, content, label, savedAt }` in a new `targetDocs` store — DB_VERSION 8 (alongside research store).
   - Add to `mangle.reserved`: `openInWordMcp`, `openInLibreofficeMcp`, `pullFromWordMcp`, `syncMcpDoc`
   - **Note on maturity**: no Word/LibreOffice MCP is from a major publisher or has >100 stars. Frame as "bring your own MCP server" — SourceDesk provides the connection UI and round-trip sync logic; users are responsible for installing/running the MCP server. Document setup steps in README.

8. **Google Tasks sync** *(future)* — `auth/tasks` scope; Tasks API v1; sync per-project tasks bidirectionally
9. **Google Calendar sync** *(future)* — `auth/calendar` scope; push task due dates and project milestones; pull events into context
10. **Google Keep notes sync** *(future)* — Keep API; currently restricted to Workspace enterprise; watch for public access
11. **Vendor Contact sync via People API** *(future)* — `auth/contacts`; People API v1; sync per-project contacts to a Google Contacts group
12. **In-browser semantic embeddings** *(low priority, after local LLM path is proven)* — `transformers.js` + WASM `all-MiniLM-L6-v2`; ~30 MB one-time download

13. **Proper Help system** *(small/medium)* — replace ad-hoc tooltips with a proper Help modal: keyboard shortcut reference, glossary of project types, walkthrough/tour of each major view, links to README sections; accessible via `?` button in topbar and `F1` key.

14. **Autosave everywhere** *(small)* — generalise the supplier-questions debounced-autosave pattern (1.5 s) to: Working Document, Notes (already on switch — add live), Tasks edit form, Project edit fields, Templates edit. Visual `● Saving…` / `✓ Saved` indicator near the title bar.

15. **Rich-text editors with raw / rendered toggle** *(medium)* — Working Document, Notes, Templates, and Supplier Q answer field get a dual-mode editor: **Raw markdown** (current textarea) and **Rendered** (contenteditable with style toolbar). Toolbar buttons (initial set): H1 / H2 / H3, **Bold**, *Italic*, <u>Underline</u>, `inline code`, table, bullet list, numbered list, page break (`<div class="page-break">`), block quote. Toggle preserves content via markdown <-> HTML conversion. New module `src/editor.js` exporting `mountRichEditor(textarea, opts)`.

16. **Feature suggestion box** *(small)* — sidebar/footer link "💡 Suggest a feature" → modal with title + description + optional category dropdown; saved to a new local `suggestions` IndexedDB store and optionally POSTed to a configurable webhook URL (Settings field) or appended to a Google Doc in the SourceDesk Drive folder.

17. **Versioning a deliverable document with diffs** *(medium)* — extend Working Document Versioning: each row in History modal gets a "Diff" button → side-by-side or inline diff view (line-level, additions green / removals red). Use a small JS LCS diff implementation (no external deps). Apply to the upcoming `targetDocs` store as well.

18. **Highlights & comments as document metadata** *(medium)* — in the rendered editor users can select text → "Highlight" (color picker) or "Add Comment" (popup); stored as a sidecar `{ docId, range, color, comment, author, createdAt }` in a new `annotations` store, NOT inline in the document text. Annotations rendered as overlay spans. **Export options**: "Export with annotations" (HTML/PDF with highlights baked in + comment footnotes) vs. "Export clean" (plain markdown).

19. **Versioning with branching support** *(large)* — model versions as a DAG instead of a flat list. Each version gets `parentVersionId`. "Branch from this version" button creates a new branch with a name; branches selectable in History modal as a tree view. Merge support is *out of scope* for v1 — branches are independent forks with optional manual copy-paste.

20. **Highlights as a notes section** *(small/medium)* — auto-aggregate all annotations of type `highlight` from a project's docs into a per-project "Highlights" panel (next to Notes). Each highlight is a row showing source doc, snippet, color, jump-to-source link. Each highlight has an "Include in context" checkbox — checked highlights injected into system prompt as `## Highlighted Excerpts`.

21. **Proposal Evaluation project type** *(large)* — new project category `Evaluation`. Dedicated views:
    - **Criteria editor** — list of weighted scoring criteria `{ name, weight, maxScore, description }`; sum of weights normalised to 100
    - **Candidate list** — each candidate is a sub-project or document set (uploaded proposal). Per-candidate scorecard auto-computed from per-criterion scores
    - **Annotation semantics** — highlights tagged as `value-add` (green), `deduction` (yellow w/ point delta), or `disqualifier` (red strikethrough); deductions and disqualifiers feed into auto-scoring math
    - **Auto-evaluator** — "Evaluate with AI" button: runs the active LLM (or multiple LLMs in parallel — multi-agent panel) against each criterion + candidate; produces a draft score + justification; user can accept/override. Multi-agent mode shows scorecards side-by-side
    - New stores: `evalCriteria` `{id, projectId, name, weight, maxScore, description}`, `evalCandidates` `{id, projectId, name, sourceDocIds[]}`, `evalScores` `{id, projectId, candidateId, criterionId, score, justification, evaluator}` — DB_VERSION bump

22. **Collaborative evaluation (multi-user)** *(very long term — gated on v2 rewrite)* — real-time multi-user scoring with per-evaluator scorecards aggregated into a consensus view; comments threaded per criterion; requires a real backend, auth, and sync — punt to v2.

---

## V2 Roadmap (separate branch / target — TODO: have Opus draft a full plan)

When the v1 single-file static-app phase is feature-complete (through item 21 above), start a **`v2`** branch targeting:

- **TypeScript** end-to-end with strict mode
- A modern framework (likely **SvelteKit** or **Next.js** — to be decided in the planning session)
- A real database — **Postgres** (via Supabase or self-hosted) or **SQLite/Turso** for the small-team tier; replaces IndexedDB; offline-first sync layer (RxDB / electric-sql / loro)
- **Better Auth** (`better-auth.com`) for auth — email/password, OAuth (Google, GitHub, Microsoft), passkeys, org/team scoping
- Multi-user collaboration (item 22) — CRDT-based document sync, presence, comment threads
- **Compliance**: SOC 2 readiness, GDPR data export/erasure endpoints, HIPAA-aligned options for healthcare procurement use cases, audit log of all evaluator actions, encryption at rest, configurable data residency
- File storage: S3-compatible (R2 / B2 / MinIO)
- Background jobs (BullMQ / Inngest) for crawl / embed / evaluate workflows
- Migration tool: import a v1 IndexedDB JSON export → v2 DB
- Plugin/MCP architecture as first-class — Word/LibreOffice MCPs, Brave, crawl4ai, Drive all become uniform plugin connectors

**Action item before starting v2**: spin up a separate Opus session with this CLAUDE.md + the full feature list, ask it to produce a detailed migration plan, schema design, framework decision matrix, and a phased rollout (alpha → beta → GA) before any code is written.

---

## Gotchas & Learnings

### Shell environment
- This is WSL on Windows. **Heredocs (`<< 'EOF'`) do not work** in the terminal tool — causes "end of file unexpected" syntax error.
- Workaround: Write Python (or JS) scripts to a file using `edit_file`, then run them with `python3 script.py`. Delete the temp file after.
- Shell substitutions (`$VAR`, `$(...)`, backticks) are also blocked in the terminal tool. Resolve values before calling terminal, or chain with `&&`.

### Editor vs terminal-created files
- Files created by shell commands (`sed`, `cat`, redirects) are **not immediately visible to the `edit_file` tool**. The tool returns "path not found" even though the file exists on disk.
- Workaround: After creating a file via terminal, read it first with `read_file` to register it, or use `edit_file` in `create` mode to write the file directly from the start.

### Terser mangle reserved list
- Any function referenced in an `onclick="..."` HTML attribute **must** be in the `mangle.reserved` array in `build.js`. Missing entries cause silent failures in the minified build — the function gets renamed, the onclick does nothing.
- The `--dev` build (unminified) does not mangle, so bugs from missing reserved names only appear in the production build.

### String matching on box-drawing characters
- The section comment headers use Unicode box-drawing characters (e.g., `─`). Their exact byte sequence can vary depending on how text was copied or encoded. Don't rely on matching these characters in Python/shell string replacements — match the code content around them instead.

### Test page and file:// protocol
- `tests/test.html` loads each `../src/*.js` file via individual `<script src>` tags in the same order as `build.js` `SRC_FILES`. This works from `file://` in Chrome and Firefox without a server.
- If a browser blocks it (some security settings), run a simple local server: `python3 -m http.server 8080` from the `Sourcedesk/` directory, then open `http://localhost:8080/tests/test.html`.

### IndexedDB in tests
- `src/main.js` attempts no IndexedDB access when `TEST = true` (because `boot()` never runs). Any test that exercises async DB code would need to mock `window.indexedDB` or use a fake IDB library — avoid writing such tests for now and stick to pure-function coverage.

### `formatMarkdown` is not a real markdown parser
- It's a series of regex replacements. It handles bold, italic, inline code, fenced code blocks, h2/h3, unordered lists, and double-newline paragraphs. It does NOT handle: nested lists, ordered lists properly, tables, blockquotes, horizontal rules, or complex nesting. Extend with caution — regex order matters.

### Streaming & error handling
- The Anthropic streaming API sends `data: [DONE]` as the final event, which is not valid JSON. The parser already skips it with `if (data === '[DONE]') continue`. Don't remove that guard.
- If the API returns a non-OK status before streaming starts, `resp.json()` is called to extract the error message. After streaming begins, errors mid-stream will be swallowed silently (the current UI just stops updating). This is acceptable for now.

### `clearAllData()` pattern
- Iterates each store, gets all items, deletes them one by one (no `store.clear()` shortcut). This is intentional — it avoids needing a readwrite transaction on all stores simultaneously, which can fail if any store is locked.
- `clearAllData()` already includes the `notes` store (CLAUDE.md previously said it didn't — that was wrong). `exportDatabase()` / `importDatabase()` now also include `notes` (fixed v0.4.3).

### Google Drive connector auth
- Google OAuth 2.0 does not allow `file://` as a JavaScript origin (Google treats it as `null`), so the standard GIS popup flow cannot be used when `SourceDesk.html` is opened directly from disk.
- The implemented approach: user visits [Google OAuth Playground](https://developers.google.com/oauthplayground/?scope=https://www.googleapis.com/auth/drive), authorizes "Drive API v3", and copies the short-lived access token into the Drive modal.
- Token verification calls `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=TOKEN` — returns email + `expires_in` seconds.
- Tokens expire in ~3600 seconds (1 hour). The UI shows the expiry but does not auto-refresh. Users must re-paste a new token after expiry.
- If users serve `SourceDesk.html` from a local server (e.g. `python3 -m http.server`) and register `http://localhost:PORT` as an authorized JavaScript origin in their Google Cloud Console, a full GIS popup OAuth flow could replace the manual token approach.

---

## Model Reference

Models are defined in the `PROVIDERS` constant in `src/flags.js`. The `<select id="settings-model">` is populated dynamically by `updateProviderUI()` in `src/settings.js`. To add a model, edit the `models[]` array for the appropriate provider in `PROVIDERS`.

For the `local` provider, models are populated at runtime by `fetchLocalModels()` — do not add static entries there.

Always verify model IDs against provider docs before adding:
- Anthropic: [docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)
- OpenAI: [platform.openai.com/docs/models](https://platform.openai.com/docs/models)
- OpenRouter: [openrouter.ai/models](https://openrouter.ai/models)
- GitHub Models: [github.com/marketplace/models](https://github.com/marketplace/models)
- Local LLM: populated automatically from `GET {localLlmUrl}/models` — no manual entry needed

---

## Git

- Remote: `github.com:CompewterTutor/Sourcedesk.git`
- Branch: `main`
- Commit style: `type(scope): short summary\n\nbody with details`
- Always run `npm run build` and sanity-check `SourceDesk.html` before committing.
- Tag DB-version-bumping commits clearly in the commit message body.