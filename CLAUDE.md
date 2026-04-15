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
│   ├── index.html      ← HTML + CSS template; JS replaced by <!-- BUILD:JS --> at build time
│   └── main.js         ← All application JavaScript (source of truth)
├── tests/
│   └── test.html       ← Self-contained browser test runner (no server needed, file:// works)
├── build.js            ← Node build script (terser minification + injection)
├── package.json        ← npm project; devDep: terser ^5.37.0
├── package-lock.json
├── SourceDesk.html     ← Compiled output (committed; this is what users open)
├── CHANGELOG.md        ← Versioned changelog; 🗄️ marks DB schema changes
├── README.md           ← User-facing docs; roadmap as checkboxes
├── CLAUDE.md           ← This file
└── .gitignore          ← node_modules/, etc. (already comprehensive)
```

**Never edit `SourceDesk.html` directly.** Edit `src/` files and rebuild.

---

## Dev Workflow

### Build

```sh
npm install          # first time only
npm run build        # production: minified, ~49 KB total
npm run dev          # dev: unminified, ~10 ms, good for devtools debugging
npm run watch        # watch src/ and rebuild on save (dev mode)
```

### Run the app
Open `SourceDesk.html` in a browser. No server needed.

### Run tests
Open `tests/test.html` in a browser. No server needed. Results render immediately.

### Typical feature loop
1. Edit `src/main.js` and/or `src/index.html`
2. `npm run dev` to get a fast unminified build
3. Open/refresh `SourceDesk.html` to test manually
4. Open/refresh `tests/test.html` to run unit tests
5. `npm run build` for the final minified build
6. Update `CHANGELOG.md` and `README.md` checklist
7. Commit with a descriptive message, push

---

## Architecture

### IndexedDB Stores (current schema: `DB_VERSION = 2`)

| Store | keyPath | Indexes | Shape |
|---|---|---|---|
| `templates` | `id` | — | `{id, name, category, type, content, updatedAt}` |
| `projects` | `id` | — | `{id, name, category, templateId, notes, instructions, workingContent, createdAt}` |
| `docs` | `id` | `projectId` | `{id, projectId, name, content, uploadedAt}` |
| `chats` | `id` | `projectId` | `{id, projectId, messages: [{role, content, sources}]}` |
| `settings` | `key` | — | `{key, value}` — keys: `provider`, `model`, `globalContext`, `apiKey_anthropic`, `apiKey_openai`, `apiKey_openrouter`, `apiKey_github` (legacy: `apiKey` migrated → `apiKey_anthropic` on first boot) |
| `notes` | `id` | `projectId` | `{id, projectId, title, content, createdAt, updatedAt}` |

### DB Helper Pattern
All DB access goes through five helpers: `dbGet(store, key)`, `dbPut(store, val)`, `dbDelete(store, key)`, `dbGetAll(store)`, `dbGetByIndex(store, index, val)`. All return Promises. Always await them.

### State Object
```js
let state = {
  projects: [],           // all projects (loaded at boot)
  templates: [],          // all templates (loaded at boot)
  settings: {
    provider: 'anthropic',       // 'anthropic' | 'openai' | 'openrouter' | 'github'
    model: 'claude-sonnet-4-6',
    globalContext: '',
    anthropicKey: '',
    openaiKey: '',
    openrouterKey: '',
    githubKey: '',
  },
  activeProject: null,    // full project object; may have .instructions field
  activeDocs: new Set(),  // doc IDs toggled ON in context
  activeOtherProjects: new Set(), // other project IDs whose docs are pulled in
  messages: [],           // current project's chat history
  streaming: false,       // true while SSE stream is open
  rightPanelOpen: true,
  editingTemplateId: null,
  currentNote: null,      // note object being edited in Notes view, or null
  editingProjectId: null, // project ID being edited in modal, or null (null = create mode)
};
```

### Rendering Pattern
No virtual DOM, no framework — direct DOM manipulation. Key render functions:
- `renderSidebar()` — projects list in sidebar
- `renderMessages()` — full chat replay from `state.messages`
- `appendMessageEl(role, content, sources)` — appends a single message bubble
- `renderRightPanel()` — template ref, project docs, other-project checkboxes
- `renderTemplatesGrid()` — templates library view

### Modal System
One overlay div (`#modal-overlay`), multiple modal divs inside it. `showModal(id)` hides all modals then shows the target one. `closeModal()` hides the overlay. `closeModalOnOverlay(e)` checks `e.target` before closing.

### View System
`showView(v)` toggles between `'chat'`, `'templates'` (and future views). Sets `display:flex` or `display:none` on the respective view divs.

### Retrieval Pipeline (BM25)
`retrieveContext(query, topK=4)`:
1. Collect all active doc IDs (project docs + toggled other-project docs)
2. Optionally prepend template content as a chunk
3. For each doc: `chunkText(content, 400, 60)` → overlapping 400-word windows
4. `buildIndex(chunks)` → IDF table + per-chunk TF + avgLen
5. `bm25Score(query, idx, i)` for each chunk
6. Sort descending, take top-K with score > 0
7. Return `{ context: string, sources: string[] }`
8. `context` is injected into system prompt; `sources` are shown below the reply bubble

### Multi-Provider Architecture

`PROVIDERS` constant (top of `src/main.js`) defines config for each provider:
```js
PROVIDERS[provider] = { label, keyLabel, keyPlaceholder, keyHint, models[], defaultModel }
```

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

**Model IDs** (as of 2025-07-14):
- Anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`
- OpenAI: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`
- OpenRouter: `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`, `google/gemini-2.5-pro-preview`, `google/gemini-2.5-flash-preview`, `meta-llama/llama-3.3-70b-instruct`, `deepseek/deepseek-r1`, `x-ai/grok-3-beta`, `mistralai/mistral-large`
- GitHub Models: `gpt-4o`, `gpt-4o-mini`, `Meta-Llama-3.3-70B-Instruct`, `Phi-4`, `DeepSeek-V3-0324`, `Mistral-Large-2411`

Check provider docs before adding new models — IDs change frequently.

## Flags & Constants (top of `src/main.js`)

```js
const DEBUG       = window.__SOURCEDESK_DEBUG__ || false;
const TEST        = window.__SOURCEDESK_TEST__  || false;
const APP_VERSION = '0.2.0';
function log(...args) { if (DEBUG) console.log('[SD]', ...args); }
```

- Set `window.__SOURCEDESK_DEBUG__ = true` in console to enable logging without a rebuild.
- `TEST` suppresses `DOMContentLoaded` + `boot()` so the test page can load the script without touching the DOM or IndexedDB.
- `APP_VERSION` should be bumped in `src/main.js` **and** `package.json` together.

---

## Build Pipeline Details

### How injection works
`build.js` reads `src/index.html`, finds the literal string `  <!-- BUILD:JS -->`, and replaces it with `<script>\n{js}\n</script>`. If the placeholder is missing, the build throws.

### Terser reserved names — CRITICAL
Terser mangle will rename any function not in the `reserved` list. Every function called from an HTML `onclick="..."` attribute **must** be in `build.js`'s `mangle.reserved` array. Current list:

```
showView, openNewProject, saveProject, openNewTemplate, openEditTemplate,
saveTemplate, deleteTemplate, openFillTemplate, applyFill, viewTemplateContent,
promptAttachTemplate, openSettings, saveSettings, clearAllData, loadProject,
sendMessage, toggleRightPanel, toggleDoc, toggleOtherProject, deleteDoc,
handleDocUpload, selectPill, selectPillByVal, closeModal, closeModalOnOverlay,
onProviderChange, boot
```

**When you add a new function called from HTML, add it to this list or the minified build will silently break.**

---

## Testing

### How it works
`tests/test.html` sets `window.__SOURCEDESK_TEST__ = true` in an inline script, then loads `../src/main.js` via `<script src>`. Because `TEST` is true, `main.js` skips the DOM boot. All pure functions are then available globally and the test suite runs against them.

### Current test coverage (46 tests, 10 suites)
`tokenize`, `chunkText`, `buildIndex`, `bm25Score`, `formatMarkdown`, `uid`, export shape validation, `parseStreamDelta` (all 4 providers), `buildApiCall` (all 4 providers), `PROVIDERS` config integrity.

### Adding a test
1. Add a `describe`/`it` block in `tests/test.html` inside the existing test script block.
2. If testing a new pure function, it just needs to be exported from `src/main.js` as a regular function declaration (all `function` declarations are global in browser JS).
3. If testing something that needs IndexedDB, mock it — don't use the real one.

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
- Color palette: `--bg #0f0e0c`, `--surface #191816`, `--surface2 #22201e`, `--accent #c9a84c`, `--accent-dim #7a6430`, `--text #e8e4dc`, `--text-dim #8a8578`, `--text-muted #504e49`, `--danger #c0513a`, `--success #5a9e6f`.
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

### Committed & working ✅
- Full original app (v0.1.0): projects, templates, BM25 retrieval, doc upload, context panel
- Build pipeline: `src/main.js` + `src/index.html` → `npm run build` → `SourceDesk.html` (~98 KB)
- `DEBUG`, `TEST`, `APP_VERSION` flags; `log()` helper; `DOMContentLoaded` gated on `!TEST`
- **Multi-provider support**: Anthropic, OpenAI, OpenRouter, GitHub Models
  - `PROVIDERS` config constant, `buildApiCall()`, `parseStreamDelta()`
  - Per-provider key storage in DB; legacy `apiKey` → `apiKey_anthropic` migration
  - `onProviderChange()` in settings modal with live UI switching
- **Version string** `v0.3.0` displayed in topbar at boot
- **Global Instructions** label (renamed from "Sourcing Context")
- **Per-project Instructions** field in project creation modal; injected into system prompt; textarea cleared on modal open
- **Database Export** — `exportDatabase()` downloads all stores as timestamped JSON backup
- **Database Import** — `importDatabase(file)` validates, clears, and reimports; Export DB / Import DB buttons in Settings modal
- **`validateImportShape()`** — pure backup-validation helper
- **Project/Chat Export** — `exportProject()` downloads active project + messages + doc metadata; "Export" topbar button visible when project is loaded
- **Notes** (🗄️ DB_VERSION 2) — `notes` store with `projectId` index; two-panel Notes view (list + editor); full CRUD (`openNewNote`, `selectNote`, `saveCurrentNote`, `deleteCurrentNote`, `loadNotes`, `renderNotesList`); "Notes →" sidebar button; `state.currentNote` reset on project switch
- **Notes autosave** — switching notes or navigating away from Notes view auto-saves silently (skips DB write if content unchanged)
- **Notes "Include in chat context"** — per-note checkbox; when on, note title+body injected into system prompt as `## Active Note`; `includeInContext` flag persisted on note
- **Notes search/filter** — `filterNotes(query)` hides non-matching items in real time; filter re-applied after list re-renders
- **Edit Project** — ✏ button on each sidebar item opens modal pre-filled; `openEditProject(id)` sets `state.editingProjectId`; `saveProject()` handles create vs. update
- **Delete Project** — ✕ button on each sidebar item; `deleteProject(id)` cascades to all docs, chats, and notes for that project; resets to welcome screen if active
- **Ctrl+S / Cmd+S** in Notes editor and title input triggers `saveCurrentNote()`
- Test harness: 53 tests across 11 suites (added `validateImportShape` suite with 7 tests)
- `CHANGELOG.md`, `README.md`, `CLAUDE.md`

### Still outstanding (do next session)
- ❌ Project export does not include full doc content (only metadata) — intentional for now but worth revisiting
- ❌ Notes are not searchable across projects (only filters within current project's list)
- ❌ No "recent notes" or cross-project note view
- ❌ Working document editor is read-only in the UI (stored but no edit surface exposed)

---

## Next Steps (Ordered for Next Session)

1. **Working Document editor** — expose `proj.workingContent` as an editable panel or modal; "Working Doc" button in topbar opens a full-screen textarea; Ctrl+S saves back to DB via `dbPut`
2. **Full doc content in Project Export** — add an opt-in flag so `exportProject()` includes raw doc bodies (currently only metadata); warn user that the file may be large
3. **Clear chat history** — per-project "Clear Chat" button that wipes `state.messages` and the `chats` record without deleting the project
4. **Rename / duplicate template** — templates have no rename; add a rename-in-place input or reuse the edit modal; add a "Duplicate" action on template cards
5. **`npm run build`** → verify build, open `SourceDesk.html`, open `tests/test.html` → all green
6. **Update CHANGELOG.md version tag + commit + push**

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
- `tests/test.html` loads `../src/main.js` via a relative `<script src>`. This works from `file://` in Chrome and Firefox without a server.
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

---

## Model Reference

Models are now defined in the `PROVIDERS` constant in `src/main.js` and the `<select id="settings-model">` is populated dynamically by `updateProviderUI()`. To add a model, edit the `models[]` array for the appropriate provider in `PROVIDERS`.

Always verify model IDs against provider docs before adding:
- Anthropic: [docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)
- OpenAI: [platform.openai.com/docs/models](https://platform.openai.com/docs/models)
- OpenRouter: [openrouter.ai/models](https://openrouter.ai/models)
- GitHub Models: [github.com/marketplace/models](https://github.com/marketplace/models)

---

## Git

- Remote: `github.com:CompewterTutor/Sourcedesk.git`
- Branch: `main`
- Commit style: `type(scope): short summary\n\nbody with details`
- Always run `npm run build` and sanity-check `SourceDesk.html` before committing.
- Tag DB-version-bumping commits clearly in the commit message body.