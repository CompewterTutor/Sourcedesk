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

### IndexedDB Stores (current schema: `DB_VERSION = 4`)

| Store | keyPath | Indexes | Shape |
|---|---|---|---|
| `templates` | `id` | — | `{id, name, category, type, content, updatedAt}` |
| `projects` | `id` | — | `{id, name, category, templateId, notes, instructions, workingContent, createdAt}` |
| `docs` | `id` | `projectId` | `{id, projectId, name, content, uploadedAt}` |
| `chats` | `id` | `projectId`, `sessionId` | `{id, projectId, sessionId, messages: [{role, content, sources, chunks}], createdAt, updatedAt}` |
| `settings` | `key` | — | `{key, value}` — keys: `provider`, `model`, `globalContext`, `constants`, `localLlmUrl`, `driveToken`, `apiKey_anthropic`, `apiKey_openai`, `apiKey_openrouter`, `apiKey_github` (legacy: `apiKey` migrated → `apiKey_anthropic` on first boot) |
| `notes` | `id` | `projectId` | `{id, projectId, title, content, pinned, includeInContext, createdAt, updatedAt}` |
| `supplierQuestions` | `id` | `projectId` | `{id, projectId, text, draftAnswer, createdAt, updatedAt}` |

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

**Current version: v0.6.0** — build output: `SourceDesk.html` (188.2 KB, 71.9 KB JS)

### Committed & working ✅

#### Core infrastructure
- Build pipeline: 18 `src/*.js` files + `src/index.html` → `npm run build` → single `SourceDesk.html`
- `DEBUG`, `TEST`, `APP_VERSION` flags in `src/flags.js`; `log()` helper; `DOMContentLoaded` boot gated on `!TEST`
- IndexedDB schema at `DB_VERSION = 4`; five CRUD helpers (`dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbGetByIndex`)
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

#### Google Drive Connector
- Token-based auth (OAuth Playground workaround for `file://` origin restriction)
- `verifyDriveToken()`, `listDriveFiles()`, `importFromDrive()`, `backupToDrive()`, `disconnectDrive()`
- Backup to Drive includes the `notes` store (unlike local `exportDatabase()` — actually both include it now)
- Token persisted in `settings` store under key `driveToken`; `state.settings.driveToken` loaded at boot

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

1. **`npm run build`** → verify 188 KB output, open `SourceDesk.html`, open `tests/test.html` → all 92 green
2. **Chat session titles** *(small)* — auto-generate a short title from the first user message (first 8 words or LLM-generated via a cheap model); store as `title` on the chat record; display in `#chat-session-list` instead of the raw content preview
3. **Message editing / regeneration** *(medium)* — add an edit button on user message bubbles; re-run from that point, discarding later messages
4. **Client-side Semantic Embeddings** *(low priority)* — `transformers.js` + WASM running `all-MiniLM-L6-v2` in-browser (~30 MB one-time download, then browser-cached); or API-based embedding provider (OpenAI `text-embedding-3-small`) as an alternative; hybrid BM25 + semantic re-ranking once in place

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