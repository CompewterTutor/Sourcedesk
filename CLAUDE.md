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
│   ├── autosave.js         ← scheduleAutosave(), scheduleWorkingDocAutosave(),
│   │                          scheduleNoteAutosave(), scheduleTaskAutosave(), scheduleTemplateAutosave()
│   ├── diff.js             ← diffLines(), diffStats(), renderInlineDiffHtml() — LCS line-level diff
│   ├── help.js             ← openHelpModal(), helpSwitchTab() — tabbed Help modal
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
│   │                          toggleTaskCalendar(), exportTasksMarkdown(), exportTasksCSV()
│   ├── contacts.js         ← Contacts & Resources view; loadContacts(), renderContactList(),
│   │                          selectContact(), openNewContact(), saveCurrentContact(), etc.
│   ├── guidelines.js       ← Position Guidelines view; loadGuidelines(), handleGuidelineUpload(),
│   │                          analyzeThisGuideline(), _runAnalyze(), _saveGuidelineAnalysis(),
│   │                          _renderAnalysisBar(), selectGuidelineAnalysis(), deleteGuidelineAnalysis(),
│   │                          openCreateMasterAnalysis(), runCreateMaster(),
│   │                          openGAVersionHistory(), restoreGAVersion(), deleteGAVersion(),
│   │                          openGADiff(), _openGACompareModal() — AI analysis persistence,
│   │                          chips bar, master synthesis, versioning & diff
│   ├── evaluation.js       ← Proposal Evaluation view; loadEvaluation(), switchEvalTab(),
│   │                          openNewCriterion(), evaluateCandidate(), exportScorecardMarkdown()
│   ├── research.js         ← Research Board; Brave Search, crawl4ai, Research Agent,
│   │                          openEditResearchItem(), exportResearchMarkdown(), exportResearchCSV()
│   ├── suggestions.js      ← Feature Suggestion Box; openSuggestionBox(), submitSuggestion(),
│   │                          openManageSuggestions()
│   ├── editor.js           ← Dual-mode RTE; mountRichEditor(), destroyRichEditor(),
│   │                          setRichEditorMode(), _rteMarkdownToHtml(), _rteHtmlToMarkdown()
│   └── ui.js               ← Modal helpers, pill helpers, input resize, keyboard shortcuts
├── tests/
│   └── test.html           ← Self-contained browser test runner (no server needed, file:// works)
├── build.js                ← Node build script; SRC_FILES order; terser mangle.reserved list
├── server.js               ← Local server: env injection, markitdown, proxy, email ingest API
├── server/
│   ├── db.js               ← DB abstraction (SQLite via better-sqlite3 / PostgreSQL via pg)
│   └── llm.js              ← Server-side non-streaming LLM helper (no npm deps)
├── migrations/
│   └── 001_initial.sql     ← Initial schema (SQLite + PostgreSQL compatible)
├── scripts/
│   ├── generate_api_token.js ← CLI: generate tokens (file + DB)
│   └── migrate.js          ← CLI: run pending DB migrations
├── data/                   ← SQLite db files (gitignored; created on first server start)
├── package.json            ← npm project; devDep: terser; optionalDep: better-sqlite3, pg
├── package-lock.json
├── Makefile                ← Common build/run targets
├── Dockerfile              ← Multi-stage builder + runtime; includes native module build tools
├── docker-compose.yml      ← SQLite by default; pgvector Postgres service commented in
├── .env.example            ← All configurable env variables documented
├── SourceDesk.html         ← Compiled output (committed; this is what users open)
├── CHANGELOG.md            ← Versioned changelog; 🗄️ marks IndexedDB changes; 🖥️ marks server additions
├── README.md               ← User-facing docs; roadmap as checkboxes
├── CLAUDE.md               ← This file
└── .gitignore              ← node_modules/, data/, backups/, .env, etc.
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

### End-of-session checklist

Before wrapping up any coding session, always complete the following steps **in order** and **ask for confirmation before committing/pushing**:

1. **`npm run build`** — verify the production build succeeds and `SourceDesk.html` opens cleanly.
2. **`CHANGELOG.md`** — add an entry under `## [Unreleased]` (or bump the version section) describing every user-visible change. Mark DB-version bumps with 🗄️, server additions with 🖥️.
3. **`README.md`** — update the feature list, roadmap checkboxes, Quick Start, or API docs as needed.
4. **`CLAUDE.md`** — update the *Current State* session notes, *Committed & working* checklist, *Still outstanding* list, *Next Steps*, reserved-name list, and any new Gotchas discovered this session.
5. **`src/flags.js` + `package.json`** — bump `APP_VERSION` (and keep `package.json` `version` in sync).
6. **Prepare a commit message** following the format below and **show it to the user for confirmation** before running `git commit`.
7. **After confirmation:** `git add -A && git commit -m "<message>" && git push`.

> **Never commit or push without explicit user confirmation.** Prepare the commit message, show it, and wait.

---

## Architecture

### IndexedDB Stores (current schema: `DB_VERSION = 12`)

| Store | keyPath | Indexes | Shape |
|---|---|---|---|
| `templates` | `id` | — | `{id, name, category, type, content, updatedAt}` |
| `projects` | `id` | — | `{id, name, category, templateId, notes, instructions, workingContent, createdAt}` |
| `docs` | `id` | `projectId` | `{id, projectId, name, content, docType: 'doc'\|'guideline', uploadedAt}` |
| `chats` | `id` | `projectId`, `sessionId` | `{id, projectId, sessionId, title, messages: [{role, content, sources, chunks}], createdAt, updatedAt}` |
| `settings` | `key` | — | `{key, value}` — keys: `provider`, `model`, `globalContext`, `constants`, `localLlmUrl`, `driveToken`, `apiKey_anthropic`, `apiKey_openai`, `apiKey_openrouter`, `apiKey_github` (legacy: `apiKey` migrated → `apiKey_anthropic` on first boot) |
| `notes` | `id` | `projectId` | `{id, projectId, title, content, pinned, includeInContext, createdAt, updatedAt}` |
| `supplierQuestions` | `id` | `projectId` | `{id, projectId, text, draftAnswer, status, confidence, questionNo, topic, vendor, contactName, createdAt, updatedAt}` |
| `promptLibrary` | `id` | — | `{id, title, content, favorite, createdAt, updatedAt}` |
| `docVersions` | `id` | `projectId` | `{id, projectId, content, savedAt, label}` |
| `tasks` | `id` | `projectId` | `{id, projectId, title, description, status, priority, dueDate, includeInContext, createdAt, updatedAt}` |
| `embeddings` | `id` | `docId` | `{id, docId, chunkIndex, vector}` |
| `contacts` | `id` | `projectId` | `{id, projectId, type: 'contact'\|'resource', name, role, org, email, phone, url, notes, tags[], includeInContext, createdAt, updatedAt}` |
| `suggestions` | `id` | — | `{id, title, category, details, createdAt, appVersion, projectId, projectName, posted, postedAt}` |
| `research` | `id` | `projectId` | `{id, projectId, url, title, summary, fullText, tags[], retrievedAt, includeInContext, source: 'brave'\|'manual'}` |
| `evalCriteria` | `id` | `projectId` | `{id, projectId, name, weight, maxScore, description}` |
| `evalCandidates` | `id` | `projectId` | `{id, projectId, name, sourceDocIds[]}` |
| `evalScores` | `id` | `projectId, candidateId, criterionId` | `{id, projectId, candidateId, criterionId, score, justification, evaluator}` |
| `guidelineAnalyses` | `id` | `projectId` | `{id, projectId, label, provider, model, docIds[], docNames[], results, isMaster, sourceIds[], versions: [{id, results, savedAt, label}], createdAt, updatedAt}` |

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
    localKey: '',
    constants: '',          // "KEY=value" lines; parsed by parseConstants(); used in resolveTemplateVars()
    driveToken: '',         // Google Drive OAuth access token (short-lived, ~1 hour)
    localLlmUrl: '',        // base URL for local OpenAI-compat server, e.g. http://localhost:11434/v1
    embeddingModel: '',     // embedding model name for local hybrid retrieval; empty = BM25-only
    braveApiKey: '',        // Brave Search API key
    crawl4aiUrl: 'http://localhost:11235', // crawl4ai endpoint
    markitdownUrl: '',      // MarkItDown server URL (injected by server.js via window.__SOURCEDESK_ENV__)
    suggestionWebhookUrl: '', // optional webhook for feature suggestions
    serverUrl: '',          // base URL of running server.js instance (for email summaries + token mgmt)
    serverToken: '',        // API token for browser → server authenticated calls
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
  currentTask: null,      // task object being edited in Tasks view, or null
  currentContact: null,   // contact object being edited in Contacts view, or null
  currentGuideline: null, // guideline doc object being viewed in Guidelines view, or null
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
const APP_VERSION = '0.8.0';
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
Terser mangle will rename any function not in the `reserved` list. Every function called from an HTML `onclick="..."` attribute **must** be in `build.js`'s `mangle.reserved` array. Current list (as of v0.8.0):

```
showView, openNewProject, saveProject, openNewTemplate, openEditTemplate,
saveTemplate, deleteTemplate, openFillTemplate, applyFill, viewTemplateContent,
promptAttachTemplate, openSettings, saveSettings, clearAllData, loadProject,
sendMessage, stopStreaming, toggleRightPanel, toggleDoc, toggleOtherProject, deleteDoc,
handleDocUpload, selectPill, selectPillByVal, closeModal, closeModalOnOverlay,
onProviderChange, boot, exportDatabase, triggerImportDialog, importDatabase,
exportProject, openNewNote, openEditProject, deleteProject,
selectNote, saveCurrentNote, deleteCurrentNote, loadNotes, renderNotesList,
validateImportShape, filterNotes, toggleNoteInContext,
duplicateTemplate, openWorkingDoc, saveWorkingDoc, clearChatHistory,
previewTemplateVars, openExtractVars, saveExtractedVars, createTemplateFromDoc,
openDriveModal, verifyDriveToken, listDriveFiles, backupToDrive, disconnectDrive,
fetchLocalModels, togglePreviewPanel, searchNotes, searchAllNotes, toggleNotePin,
loadSupplierQuestions, renderSQList, selectQuestion, openAddQuestionsModal,
saveAddedQuestions, generateAnswerForQuestion, generateSelectedAnswers,
saveCurrentSQAnswer, deleteQuestion, copyQuestionToClipboard, copyAnswerToClipboard,
exportSelectedQuestions, exportAllQuestions, exportTasksMarkdown, exportTasksCSV,
filterSQList, toggleAllSQCheckboxes, scheduleSQAutoSave,
topbarModelChange, refreshTopbarModels, syncTopbarModelSelect,
setModelContextLimit, getContextLimit,
openAttachMenu, handleAttachFiles, removeAttachment, clearPendingAttachments,
renderAttachBar, getPendingAttachments, updateContextMeter,
showStreamingIndicator, hideStreamingIndicator,
newChat, renderChatSessionList, loadChatSession, filterChatSessions,
openVersionHistory, restoreDocVersion, deleteDocVersion, saveDocVersion,
_vhStartLabelEdit, _vhSaveLabel, openVersionDiff, diffLines, diffStats, renderInlineDiffHtml,
scheduleAutosave, cancelAutosave, flushAutosave, setAutosaveStatus,
scheduleWorkingDocAutosave, scheduleNoteAutosave, scheduleTaskAutosave, scheduleTemplateAutosave,
openHelpModal, helpSwitchTab,
openSuggestionBox, submitSuggestion, openManageSuggestions, deleteSuggestion, exportSuggestions,
testBraveKey, testCrawl4aiEndpoint, testMarkitdownServer,
openResearchSearch, runResearchSearch, addResearchFromBrave,
openAddResearchManual, submitResearchManual, loadResearchBoard,
crawlResearchItem, summariseResearchItem, deleteResearchItem, toggleResearchInContext,
openResearchAgent, runResearchAgent, generateResearchReport,
_researchExtractJsonArray, openEditResearchItem, saveResearchItemEdit,
_researchInsertTemplate, exportResearchMarkdown, exportResearchCSV,
mountRichEditor, destroyRichEditor, setRichEditorMode, refreshRichEditor,
_rteMarkdownToHtml, _rteHtmlToMarkdown,
loadTasks, renderTaskList, selectTask, openNewTask, saveCurrentTask,
deleteCurrentTask, filterTaskList, toggleTaskStatus, toggleTaskInContext,
toggleTaskCalendar, _calNav, _calToday, _calSelectDay,
loadContacts, renderContactList, selectContact, openNewContact,
saveCurrentContact, deleteCurrentContact, filterContactList,
toggleContactInContext, selectContactTypePill,
loadGuidelines, selectGuideline, deleteGuideline,
handleGuidelineUpload, openGuidelinesAnalyze,
loadEvaluation, switchEvalTab, openNewCriterion, saveCurrentCriterion,
openNewCandidate, saveCurrentCandidate, evaluateCandidate,
exportScorecardMarkdown, _evalDeleteCriterion, _evalDeleteCandidate,
openPromptLibrary, closePromptLibrary, renderPromptLibraryDropdown,
insertPrompt, openSavePromptModal, openManagePromptLibrary,
savePromptEntry, deletePromptEntry, togglePromptFavorite,
openDocEditor, saveDocContent, downloadDocOriginal, downloadDocMarkdown, reconvertDoc,
getOrCreateAppFolder, getOrCreateVisibleRootFolder, getOrCreateProjectFolder,
importSheetsQuestions, importSheetsQuestionsFromInput, exportQuestionsToSheets,
exportQuestionsToCSV, importQuestionsFromCSV, parseBidNetHtml,
openBidNetImportModal, handleBidNetImportFile, executeBidNetImport,
generateBatch, setSQStatus, setSQConfidence, exportSQSummary, _sqEffectiveStatus,
exportToGoogleDoc, exportQuestionsToDoc, exportWorkingDocToDoc,
parseSpreadsheetId, convertFileToDriveText,
testEmbeddingModel, getEmbedding, cosineSimilarity, indexDocEmbeddings, getDocEmbeddings,
backupToServer, openCrossSearch, runCrossSearch,
analyzeThisGuideline, selectGuidelineAnalysis, deleteGuidelineAnalysis,
openCreateMasterAnalysis, runCreateMaster,
openGAVersionHistory, restoreGAVersion, deleteGAVersion,
openGADiff, _gaStartLabelEdit, _gaSaveLabel, _gaSaveAnalysisLabel, _openGACompareModal,
openTemplateVarsModal, _tvAddConstantRow, _tvDeleteConstantRow, _tvSaveConstants, _tvInsertVar,
copyProjectId,
openEmailSummaries, importSummaryToNotes, createTasksFromSummary,
openTokenManager, generateApiToken, revokeApiToken
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
- **Always ask the user to confirm the prepared commit message before running `git commit` or `git push`.**

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

## Skills & Reference Docs

### `skills/hindsight-docs/` — Hindsight Memory System

This skill contains complete offline documentation for [Hindsight](https://github.com/vectorize-io/hindsight) — the biomimetic agent memory system integrated in v0.9.1+. **Always read from this skill before writing Hindsight integration code.** Never fetch from the internet when this skill has the answer.

Key files to read for Hindsight work:

| File | When to read it |
|------|-----------------|
| `skills/hindsight-docs/references/best-practices.md` | Before any integration work — missions, tags, anti-patterns |
| `skills/hindsight-docs/references/faq.md` | Per-user isolation, recall vs reflect, conversation format |
| `skills/hindsight-docs/references/developer/api/retain.md` | Retain params, document_id upsert, tagging |
| `skills/hindsight-docs/references/developer/api/recall.md` | Recall params, budget, tag filtering (use any_strict!) |
| `skills/hindsight-docs/references/developer/api/memory-banks.md` | Bank config, entity labels, dispositions |
| `skills/hindsight-docs/references/sdks/nodejs.md` | HindsightClient TypeScript/JS API |
| `skills/hindsight-docs/references/sdks/hindsight-all-npm.md` | Embedded daemon (Node.js) if needed |
| `skills/hindsight-docs/references/developer/configuration.md` | All HINDSIGHT_API_* env vars |
| `skills/hindsight-docs/references/developer/installation.md` | Docker, pip, bare-metal setup |

**SKILL.md index** is at `skills/hindsight-docs/SKILL.md` — read it first for orientation.

---

## Current State (as of last commit)

**Current version: v0.9.2** (`src/flags.js` + `package.json`) — build output: `SourceDesk.html` committed at HEAD

> **Session note (current — v0.9.2: Chat Memory):**
> All changes below are complete, documented, and built into `SourceDesk.html`.
>
> 1. **`POST /api/hindsight/retain`** (`server.js`) — new token-authenticated endpoint. Validates token, fires `ensureBank(owner)` → `retainContent(owner, ...)` as a fire-and-forget promise chain, and immediately responds `{ ok: true }`. Gracefully no-ops with `{ ok: true, skipped: true }` when Hindsight is not configured.
>
> 2. **`POST /api/hindsight/recall`** (`server.js`) — new token-authenticated endpoint. Returns `{ memories: string[], count: number }`. Calls `recallForQuery(owner, { query, projectId, budget: 2000 })`. Returns `{ memories: [], count: 0 }` when Hindsight is not configured.
>
> 3. **`_hindsightRetain(chatId, messages)`** (`src/chat.js`) — fire-and-forget helper called after every `saveChat()` DB write. Tags retains with `project:<projectId>` and `type:chat`. No-ops when `hindsightEnabled` is false or server not configured.
>
> 4. **`_hindsightRecall(query)`** (`src/chat.js`) — async helper called in parallel with BM25 retrieval at the start of every `sendMessage()`. Returns `string[] | null`. Hard 2-second `AbortController` timeout — never blocks chat. Memories injected into system prompt as `## Relevant Memories` between `## Global Instructions` and `## Current Project`.
>
> 5. **`hindsightEnabled` toggle** (`src/index.html`, `src/settings.js`, `src/state.js`, `src/boot.js`) — new `#settings-hindsight-enabled` checkbox in Settings → Server Connection. Persisted to IndexedDB as `hindsightEnabled`. Loaded at boot into `state.settings.hindsightEnabled`. When unchecked, all Hindsight client calls are suppressed.
>
> 6. **`APP_VERSION = '0.9.2'`** in `src/flags.js` and `package.json`. `toggleHindsight` added to `build.js` `mangle.reserved`.

> **Session note (v0.9.1: Hindsight Foundation):**
> All changes below are complete, documented, and built into `SourceDesk.html`.
>
> 1. **`server/hindsight.js`** — new Hindsight memory adapter module. Gracefully no-ops when `HINDSIGHT_API_URL` is unset or `@vectorize-io/hindsight-client` is not installed. Exports: `getClient()`, `ensureBank(userId)`, `retainContent(userId, opts)`, `recallForQuery(userId, opts)`, `getStatus(userId)`. Bank created with full procurement-domain config (missions, entity labels for vendor/project_type/deadline, disposition traits). `retainContent` always uses `async: true`. `recallForQuery` uses `tagsMatch: 'any_strict'` for project-scoped recall.
>
> 2. **`migrations/002_hindsight_settings.sql`** — new `user_hindsight` table (`user_id`, `bank_id`, `enabled`, timestamps). Compatible with SQLite + PostgreSQL.
>
> 3. **`GET /api/hindsight/status`** (`server.js`) — token-authenticated endpoint; returns `{ available, configured, bankExists, memoryCount }`. No-op response (`available: false, configured: false`) when adapter not loaded. Server startup log shows Hindsight status line.
>
> 4. **🧠 Memory (Hindsight) row in Settings** (`src/index.html`, `src/settings.js`) — read-only status row with **Test** button that calls `testHindsightConnection()`. Shows `— Not configured`, `○ Not connected`, or `● Connected`.
>
> 5. **`docker-compose.yml`** — commented-out `hindsight` service block (`latest-slim` image) in correct `services:` section. `# HINDSIGHT_API_URL` entry in web service environment. `# hindsight_data:` in volumes.
>
> 6. **`@vectorize-io/hindsight-client`** added to `optionalDependencies` in `package.json`. `testHindsightConnection` added to `build.js` `mangle.reserved`.
>
> 7. **`APP_VERSION = '0.9.1'`** in `src/flags.js` and `package.json`.

> **Session note (v0.9.0 — Email Summary frontend + Token Management):**
> All changes below are complete, documented, and built into `SourceDesk.html`.
>
> 1. **Email Summary UI** — new "📧 Email Summaries" sidebar section and `#modal-email-summaries` modal (`src/index.html`, `src/settings.js`). Fetches `GET /api/email-summaries?token=X&projectId=Y`. Displays overall summary + per-thread `<details>` accordion. **Import to Notes** (`importSummaryToNotes()`) and **Create Tasks** (`createTasksFromSummary()`) action buttons.
>
> 2. **Token Management UI** in Settings modal — new "Server Connection" section (`#settings-server-url`, `#settings-server-token`) and "API Token Management" section (`#token-manager-list`, generate form, per-token revoke). Functions: `openTokenManager()`, `generateApiToken()`, `revokeApiToken(t)`.
>
> 3. **`GET /api/token-list`** — new server endpoint; reads raw file (includes expired tokens flagged with `expired: true`); requires `adminToken` query param.
>
> 4. **`POST /api/token-generate`** — new server endpoint; generates `crypto.randomBytes(24)` hex token; writes to `.private-documents/api_tokens.json` + DB (optional); `expiresIn` supported (`30d`, `7d`, `24h`, `1y`).
>
> 5. **Token expiry** — `loadTokens()` now silently skips expired tokens (those with `expiresAt` set and in the past).
>
> 6. **`--expires-in` flag** for `scripts/generate_api_token.js` (`-e` / `--expires-in`, e.g. `30d`).
>
> 7. **`state.settings.serverUrl` + `state.settings.serverToken`** — two new settings fields in `state.js`, loaded in `boot.js`, saved/loaded in `openSettings()` / `saveSettings()`.
>
> 8. **`APP_VERSION = '0.9.0'`** in `src/flags.js` and `package.json`; `build.js` mangle.reserved updated.

> **Session note (current — PostgreSQL existing-database docs):**
> Docs-only change; no source files or build output changed.
>
> 1. **`README.md` — `### Using an existing PostgreSQL database` section** — new section placed between `### Email Ingest API` and `### Running with Docker`. Covers four sub-topics:
>    - **Connection string format** table (USER / PASSWORD / HOST / PORT / DATABASE with notes)
>    - **Scenario A** — native / bare-metal Postgres (`localhost`); Homebrew tip; pgvector extension tip
>    - **Scenario B** — Postgres already in a Docker container: host-process path (localhost), container-to-container path (shared Docker network + `host.docker.internal` fallback for Mac/Windows + Linux `172.17.0.1` / `--add-host` note)
>    - **Scenario C** — rootless Podman container; `host.docker.internal` unavailable; bridge IP workaround
>    - **First-run migrations** — idempotent, auto-run on startup, `npm run migrate` for manual
>    - **Recommended Postgres role setup** SQL block (`CREATE ROLE / DATABASE / EXTENSION vector`)
> 2. **`### Local server setup`** — `.env.example` snippet updated to show SQLite and Postgres `DATABASE_URL` options side-by-side; added `npm run migrate` note.

> **Session note (2025-07-21 — project ID copy UI + container deployment docs + end-of-session checklist):**
> All changes below are complete, documented, and committed.
>
> 1. **Project ID copy in Edit Project modal** (`src/index.html`, `src/projects.js`) — the Edit Project modal now shows a read-only **Project ID** row with a 📋 Copy button. The row is hidden in New Project mode. Allows users to quickly grab the correct `projectId` value for email-ingest API calls. `copyProjectId()` added to `build.js` `mangle.reserved`.
>
> 2. **Expanded container deployment docs** (`README.md`) — replaced the single-line Docker/Podman entry with three full sub-sections: Docker Compose (volume table, Postgres upgrade path), Podman (macOS + Linux install, rootless notes), and Apple Container (Apple’s open-source OCI runtime via `github.com/apple/container` for Apple Silicon Macs — install, CLI command table, `container compose` usage, arm64 notes).
>
> 3. **End-of-session checklist** (`CLAUDE.md`) — new `### End-of-session checklist` in Dev Workflow with the 7-step procedure (build → changelog → README → CLAUDE.md → version bump → draft commit msg → confirm & push). Matching reminder added to `### Commits`.
>
> 4. **`package.json` version synced** — bumped from `0.6.0` to `0.8.0` to match `src/flags.js` `APP_VERSION`.

> **Session note (latest — server DB + LLM email pipeline + Template Variable popup):**
> All features below are complete and committed.
>
> 1. **Server-side DB abstraction** (`server/db.js`) — `createDb(url)` factory supporting SQLite (`better-sqlite3`) and PostgreSQL (`pg`), both optional. Unified async interface: `run/get/all/exec/close/type/runMigrations`. SQLite uses synchronous `better-sqlite3` wrapped in Promises; Postgres uses `pg` Pool with `?`→`$N` conversion.
>
> 2. **Initial DB schema** (`migrations/001_initial.sql`) — seven tables: `schema_migrations`, `users`, `api_tokens`, `email_ingests`, `email_threads`, `email_messages`, `email_summaries`. Migration runner in `scripts/migrate.js` (`npm run migrate`). Migrations also auto-run on server startup.
>
> 3. **Server-side LLM helper** (`server/llm.js`) — non-streaming Anthropic / OpenAI-compat calls using only Node.js built-in `https`/`http`. Configured via `.env`: `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
>
> 4. **Async LLM email summarization** (`server.js` — `_summarizeIngest()`) — fire-and-forget after HTTP response is sent. Per-thread incremental updates (only new messages since last run). Project-level executive summary. Stored in `email_summaries` with version counter.
>
> 5. **New server endpoints** — `GET /api/email-summaries?token&projectId` (fetch stored summaries), `POST /api/token-revoke` (revoke tokens from file + DB). Updated `/api/email-ingest` to persist threads/messages to DB and return `llmSummarizing` flag. Updated `/health` to report `db` type. Updated startup logs.
>
> 6. **DB-aware token generator** (`scripts/generate_api_token.js`) — if `DATABASE_URL` is set, creates user + token records in DB; always writes file fallback.
>
> 7. **Template Variable popup** (`src/index.html`, `src/templates.js`) — `📖 Variables` button in template editor. Two sections: built-in auto-vars with live current values (click to insert at cursor), and editable constants table (add/delete/edit rows, 💾 Save). Functions: `openTemplateVarsModal`, `_tvAddConstantRow`, `_tvDeleteConstantRow`, `_tvSaveConstants`, `_tvInsertVar` — all in `mangle.reserved`.
>
> 8. **DevOps** — Dockerfile updated (build tools for native modules, runtime `npm ci`, copies `server/` + `migrations/`). `docker-compose.yml` uses SQLite by default (`data` volume), `pgvector` Postgres commented in. `.env.example` fully documented. `package.json`: `migrate` script, `better-sqlite3` + `pg` as `optionalDependencies`. `.gitignore`: `data/`, `*.db*`, `backups/`.


> **Session note (2025-07-20):**
> All features below are complete in `src/` and rebuilt into `SourceDesk.html`.
>
> 1. **Local LLM CORS proxy** (`server.js`, `src/flags.js`, `src/api.js`, `src/settings.js`, `src/retrieval.js`)
>    - `POST /proxy` endpoint in `server.js` forwards local LLM requests server-side to bypass the browser CORS restriction that prevents `Authorization` being covered by `Access-Control-Allow-Headers: *`
>    - `_localFetch(url, options)` helper in `flags.js` routes through `/proxy` when `window.__SOURCEDESK_ENV__` is set, falls back to direct `fetch` otherwise
>    - `buildApiCall` wraps local provider calls in the proxy envelope; `fetchLocalModels`, `testEmbeddingModel`, `getEmbedding` all use `_localFetch`
>
> 2. **LM Studio `/api/v1` + model schema fixes** (`src/api.js`, `src/retrieval.js`, `src/settings.js`)
>    - Regex strips `/api` from base URL for chat/embeddings so both `/api/v1` and `/v1` base URLs work
>    - Model detection now recognises LM Studio's `key` (id) and `display_name` (label) fields
>    - `fetchLocalModels` error messages now show the actual failure (401 → actionable hint, empty list → load-a-model message, unknown schema → first model's keys)
>
> 3. **Local API key boot fix** (`src/boot.js`, `src/state.js`)
>    - `apiKey_local` was saved to IndexedDB but never loaded on boot; `state.settings.localKey` was always `""` after a refresh
>    - Fixed: `boot()` now loads `apiKey_local` → `state.settings.localKey`; `localKey: ""` added to initial state
>
> 4. **Doc conversion feedback + original file storage + editor modal** (`src/panel.js`, `src/index.html`)
>    - `docs` records now store `originalData` (base64), `originalMimeType`, `conversionMethod`
>    - Live per-file status messages in the right panel during upload
>    - Doc cards show coloured conversion badge (MarkItDown / Drive / Text)
>    - **Edit** button opens a full doc editor modal: edit markdown, Save, ↓ Markdown, ↓ Original, ⟳ Re-convert
>    - **⟳** card button re-converts using stored original without opening the modal
>    - `convertWithMarkitdown` accepts pre-read base64; `readFileAsBase64` helper added
>    - File inputs now accept `.xlsx` and `.pptx`
>
> 5. **Guidelines uploader parity** (`src/guidelines.js`, `src/index.html`)
>    - `handleGuidelineUpload` now uses the same three-stage pipeline, stores original, shows status
>    - Guideline list items show conversion badge + ✎ Edit button (shared doc editor modal)

> **Session note (2026-05-04 — Unload model probe order inversion):** Change committed and rebuilt into `SourceDesk.html`.
>
> 1. **`unloadLocalModel()` probe order inverted** (`src/settings.js`) — LM Studio's `/api/v1/models/unload` is now tried **first** (deterministic REST endpoint, 0.4.0+); only if it returns 404 does the function fall back to Ollama's `POST /api/generate keep_alive:0` side-effect workaround. Previously Ollama was tried first, causing an unnecessary failed round-trip on LM Studio setups. Status messages unchanged: "✓ Unloaded (LM Studio)" / "✓ Unloaded (Ollama)" / "⚠ HTTP N" / "✗ error".

> **Session note (2025-07-20 — Guidelines global view + task/template tracking + unload model):** All features below committed to `main`.
>
> 1. **Guidelines global view** (`src/guidelines.js`) — `loadGuidelines()` and `_runAnalyze()` now use `dbGetAll("docs")` / `dbGetAll("guidelineAnalyses")` so ALL projects' guideline docs and analyses are visible in the Guidelines view regardless of which project is active. Each doc card and analysis chip shows a project-name badge. Uploads and analysis saves still target the active project.
>
> 2. **Create Task / Create Template — persistent tracking** (`src/guidelines.js`) — buttons now permanently show ✓ Created (green) after a successful creation, and an ↗ Open Task / ↗ Open Template jump button is appended so the user can navigate straight to the new record.
>
> 3. **⏏ Unload model button** (`src/settings.js`, `src/index.html`) — topbar + Settings modal; tries LM Studio first (`POST /api/v1/models/unload {identifier}`), falls back to Ollama (`POST /api/generate keep_alive:0`) on 404; status shows which server responded.

> **Session note (2025-07-20 — Guidelines analysis persistence + proxy envelope fix):** All features below committed and rebuilt into `SourceDesk.html`.
>
> 1. **Guidelines preview truncation fix** (`src/guidelines.js`) — preview limit raised 300 → 2000 chars; rendered in a scrollable box; ✎ View / Edit button added to reach the full doc editor without leaving the view.
>
> 2. **Non-streaming proxy envelope bug** (`src/guidelines.js`, `src/evaluation.js`) — `buildApiCall()` for the local provider wraps the request in a proxy envelope `{ url, method, headers, body: "<inner-JSON-string>" }`. Both the Guidelines analyser and Evaluation candidate scorer tried to patch `stream: false` on the outer parsed object instead of inside the inner body string. Result: LLM received `stream: true`, returned SSE text, `resp.json()` threw `Unexpected token 'd'`. Fixed by detecting the envelope shape and patching the inner body string correctly.
>
> 3. **Guideline Analyses persistence** 🗄️ **DB_VERSION 12** — new `guidelineAnalyses` IndexedDB store. Each analysis record stores provider, model, doc IDs/names, results text, label, `isMaster` flag, `sourceIds`, `versions[]`, and timestamps. Included in export/import/backup/cascade-delete.
>
> 4. **Guidelines action bar + chips bar** — right panel reworked with three action buttons (This Doc / Analyze All / Master) and a chips bar (`_renderAnalysisBar()`) showing all saved analyses; chips support inline label editing, click-to-view, and hover-delete.
>
> 5. **Master synthesis** — `openCreateMasterAnalysis()` / `runCreateMaster()` — multi-analysis LLM synthesis saved as `isMaster: true`; subsequent re-runs append versions rather than creating duplicates.
>
> 6. **Master versioning** — `_saveGAVersion()` / `openGAVersionHistory()` / `restoreGAVersion()` / `deleteGAVersion()` — full version history for master analyses with restore and delete.
>
> 7. **Analysis diff** — `openGADiff()` / `_openGACompareModal()` — line-level LCS diff between any two analyses or master versions via `modal-ga-diff` + `src/diff.js`.

> **Session note (2025-07-20 — markitdown quality fixes):** All features below committed and pushed to `main` (commits `491a73c`, `e0790ce`).
>
> 1. **`markitdown[all]` optional deps fix** (`server.js`, `src/panel.js`, `src/settings.js`)
>    - Root cause: `markitdown` was installed without optional format extras (`mammoth` for docx, etc.), so `/health` returned `markitdownAvailable: true` but actual docx conversions failed with a Python traceback.
>    - `pip install "markitdown[all]"` installs all optional converters. **Required on the server machine.**
>    - `_testDocxConversion()` in `server.js` — writes a tiny embedded test `.docx` and runs markitdown on it; `checkMarkitdown()` now runs this as step 2 after `--help`.
>    - `/health` now returns `{ markitdownAvailable, docxAvailable }` (two distinct booleans).
>    - Settings Test button shows three states: ✓ fully ready / ⚠ installed but missing deps / ✗ not found.
>    - `/convert` error messages truncated to first 400 chars (strips full Python tracebacks).
>    - Binary-only fallback (`docx`/`xlsx`/`pptx`/`pdf`) now saves a human-readable placeholder + `conversionMethod: 'failed'` instead of binary garbage; doc card shows `⚠ Failed` badge in red.
>    - Upload error status auto-hides after 12 s (vs 4 s for success).
>
> 2. **Word TOC link / image placeholder cleanup** (`server.js`)
>    - `_cleanMarkdown(markdown)` post-processes every `/convert` response: strips `[text](#_TocNNNNN)` TOC anchor lines, strips `![](data:image/...;base64...)` placeholders (whole-line and inline), collapses 3+ blank lines to 2.
>    - On a 40-page procurement manual: 733 → 600 lines, ~4 KB of pure TOC noise removed before any real content.

> All features below are complete in `src/` and rebuilt into `SourceDesk.html`. Committed and pushed to `main`.
>
> 1. **MarkItDown server integration** (`server.js`, `src/panel.js`, `src/settings.js`)
>    - `server.js` now exposes `GET /health` (returns `{markitdownAvailable: bool}`) and `POST /convert` (accepts `{filename, data: base64}`, returns Markdown via `markitdown` CLI or `python -m markitdown` fallback)
>    - `state.settings.markitdownUrl` — configurable; default injected by `server.js` via `window.__SOURCEDESK_ENV__`
>    - Upload order: markitdown server → Google Drive convert (opt-in) → fallback text extraction
>    - `testMarkitdownServer()` — Settings test button
>
> 2. **Enhanced Supplier Questions** — BidNet HTML import, question status/confidence pills, batch generation, summary export, metadata panel
>
> 3. **RTE link button** — 🔗 in toolbar; raw mode inserts `[text](url)`; rendered mode uses `createLink`
>
> 4. **Embedding indexing progress toast** — `indexDocEmbeddings(docId, chunks, onProgress)` callback; fixed-position `#embed-progress-toast`
>
> 5. **Server-side backup** — `POST /backup` saves to `backups/`; Settings button visible only when served over HTTP
>
> 6. **Tasks calendar view** — 📅 toggle; month grid highlights task days; day filter; `_calNav`, `_calToday`, `_calSelectDay`
>
> 7. **Research board enhancements** — per-card edit modal, query template quick-fills, Markdown/CSV export
>
> 8. **Position Guidelines view** (`src/guidelines.js`) — `docType:'guideline'` docs excluded from context; AI analyzer extracts responsibilities/tasks/templates; one-click Create Task / Create Template
>
> 9. **LLM-generated session titles** — fire-and-forget LLM call after first message generates 4–6 word title
>
> 10. **Cross-project session search** (`openCrossSearch()` + `runCrossSearch()`) — 🔍 sidebar button + Ctrl+Shift+K
>
> 11. **Proposal Evaluation** (`src/evaluation.js`) 🗄️ **DB_VERSION 11** — `evalCriteria`, `evalCandidates`, `evalScores` stores; three-tab view (Criteria / Candidates / Scorecard); AI scoring via single LLM call returning JSON; Markdown scorecard export
>
> 12. **Stop streaming button** — `stopStreaming()` aborts the active SSE reader; ■ Stop / ▶ Send toggle


### Committed & working ✅

#### Core infrastructure
- Build pipeline: 29 `src/*.js` files + `src/index.html` → `npm run build` → single `SourceDesk.html`
- `DEBUG`, `TEST`, `APP_VERSION` flags in `src/flags.js`; `log()` helper; `DOMContentLoaded` boot gated on `!TEST`
- IndexedDB schema at `DB_VERSION = 11`; five CRUD helpers (`dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbGetByIndex`)
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

#### MarkItDown Server Integration
- `server.js` exposes `GET /health` → `{markitdownAvailable: bool, docxAvailable: bool}` and `POST /convert` → cleaned Markdown text
- `/health` runs two checks: (1) `markitdown --help` confirms the CLI is on PATH; (2) `_testDocxConversion()` writes a tiny embedded test `.docx` to a temp file and runs markitdown on it — `docxAvailable` is only `true` if the output contains the known test string. This catches the common case of `markitdown` installed without optional format dependencies.
- `_cleanMarkdown(markdown)` post-processes every `/convert` response before it is returned: strips Word TOC hyperlinks (`[text](#_TocNNNNN)` lines), strips data-URI image placeholders (whole-line and inline), collapses 3+ blank lines to 2.
- `state.settings.markitdownUrl` — configurable; default injected by `server.js` via `window.__SOURCEDESK_ENV__`
- Upload flow order: markitdown server → Google Drive conversion (opt-in) → fallback text extraction
- For binary-only types (`.docx`, `.xlsx`, `.pptx`, `.pdf`) when markitdown fails and no Drive token is present, a human-readable placeholder is saved instead of garbage binary text; `conversionMethod` is set to `'failed'`; doc card badge shows `⚠ Failed` in red; the ⟳ re-convert button on the card retries after the issue is fixed.
- `testMarkitdownServer()` — Settings test button; shows three states: ✓ fully ready / ⚠ installed but missing format deps / ✗ not found
- **Requirement**: `pip install "markitdown[all]"` on the server machine (installs `mammoth` for docx, `openpyxl` for xlsx, `python-pptx` for pptx, `pdfminer-six` for pdf); `npm run serve` (or `node server.js`) to enable

#### Embedding Indexing Progress Toast
- `indexDocEmbeddings(docId, chunks, onProgress)` — optional `(done, total)` callback
- Fixed-position `#embed-progress-toast` shows live progress `Indexing "<file>": N/M chunks…`; auto-hides on completion

#### Server-Side Backup
- `POST /backup` endpoint in `server.js` saves timestamped JSON files to `backups/` directory
- Settings button "💾 Backup to Server" calls `backupToServer()`; only visible when served over HTTP (not `file://`)

#### Tasks Calendar View
- 📅 toggle in Tasks view header shows a month grid; days with tasks are highlighted
- `toggleTaskCalendar()`, `_calNav()`, `_calToday()`, `_calSelectDay()` — navigation + day filter
- `exportTasksMarkdown()` and `exportTasksCSV()` — export current task list

#### Position Guidelines (`src/guidelines.js`) 🗄️ DB_VERSION 12
- New per-project **Guidelines** view; sidebar nav button revealed after `loadProject()`
- Guideline docs stored in existing `docs` store with `docType: 'guideline'`; excluded from chat context and `state.activeDocs`; preview raised to 2 000 chars with scrollable box + ✎ View/Edit button
- **AI analysis**: **This Doc** button (`analyzeThisGuideline()`) analyzes selected doc; **Analyze All** button (`_runAnalyze()`) analyzes all project guideline docs
- **Analysis persistence**: results auto-saved to `guidelineAnalyses` store (`_saveGuidelineAnalysis()`); chips bar (`_renderAnalysisBar()`) shows all saved analyses with model, relative time, doc count; inline label editing; click to view, ✕ to delete
- **Master synthesis** (`openCreateMasterAnalysis()`, `runCreateMaster()`) — synthesize multiple analyses into a unified master; subsequent re-runs append as versions instead of creating duplicates
- **Master versioning** (`_saveGAVersion()`, `openGAVersionHistory()`, `restoreGAVersion()`, `deleteGAVersion()`) — full history of master synthesis runs with restore and delete
- **Analysis diff** (`openGADiff()`, `_openGACompareModal()`) — line-level LCS diff between any two analyses or master versions via `modal-ga-diff`
- `guidelineAnalyses` included in `exportDatabase()` / `importDatabase()` / `clearAllData()` / `backupToDrive()` / cascade `deleteProject()`

#### LLM-Generated Session Titles & Cross-Project Search
- After first message, a fire-and-forget LLM call generates a 4–6 word session title stored in `chats.title`
- Cross-project session search: `openCrossSearch()` modal (🔍 sidebar button + Ctrl+Shift+K); `runCrossSearch(query)` searches all sessions by title + content; click loads project + session

#### Proposal Evaluation (`src/evaluation.js`) 🗄️ DB_VERSION 11
- New stores: `evalCriteria`, `evalCandidates`, `evalScores` (all with `projectId` index)
- **Evaluation →** sidebar button; three-tab view: Criteria / Candidates / Scorecard
- Criteria editor: `openNewCriterion()`, `saveCurrentCriterion()`, `_evalDeleteCriterion()`
- Candidate manager: `openNewCandidate()`, `saveCurrentCandidate()`, `_evalDeleteCandidate()`; associates project docs to a candidate
- AI scoring: `evaluateCandidate()` — single LLM call returning JSON `[{criterionId, score, justification}]`; saved to `evalScores`
- `exportScorecardMarkdown()` — full Markdown scorecard export
- Cascade-deleted with project; included in `exportDatabase()` / `importDatabase()` / `clearAllData()`

#### Stop Streaming Button
- `stopStreaming()` — aborts the active fetch `ReadableStream` reader; `state.streaming` flag drives ■ Stop / ▶ Send button toggle in the chat input row

#### UI / UX
- Dark theme; CSS custom properties for all colours; font stack: Syne 700 / Inter / JetBrains Mono
- Keyboard shortcuts: Ctrl+Enter (send), Escape (close modal), Ctrl+N (new note), Ctrl+Shift+F (focus notes filter), Ctrl+S (save note / working doc), **F1 (open Help modal)**, **? (open Help modal when not editing)**
- Shortcut reference grid in Settings modal **and** in the new Help modal
- Chat input placeholder: "Ask the AI model anything about this project…"
- `#topbar-local-model` selector hidden for all non-local providers
- **Help modal** (`src/help.js`) — tabbed: Shortcuts / Project Types / Views / Context System / About; opens via `?` topbar button or F1/`?` hotkey
- **Generic autosave** (`src/autosave.js`) — `scheduleAutosave(key, fn)` debounces 1.5 s and updates a `● Saving… / ✓ Saved` status pill (`#autosave-status-<key>`); wired into Working Document, Notes (title + body), and Tasks (title/desc/due) edit forms
- **Version diffs** (`src/diff.js` + extended `src/versioning.js`) — "Diff" button on every row in the Version History modal opens a unified inline diff (line-level LCS) between that snapshot and either the current working document or any other snapshot; +N/-N stats in header; comparator dropdown for switching the right-hand side

### Still outstanding
- ❌ Google Drive connector requires manual token paste — proper OAuth popup not possible from `file://` origin
- ❌ `embeddings` store excluded from `exportDatabase()` / `importDatabase()` / `clearAllData()` / `backupToDrive()` (vectors are large and regenerable; intentional for now)
- ❌ `package.json` version (`0.6.0`) out of sync with `src/flags.js` APP_VERSION (`0.8.0`) — needs a bump
- ❌ Proposal Evaluation: annotation semantics (value-add / deduction / disqualifier highlights) not yet implemented — numeric scores only currently
- ❌ Multi-agent parallel evaluation (multiple LLMs simultaneously) not yet implemented

---

## Next Steps (Ordered for Next Session)

**Current roadmap: v0.9.2 → v1.0.0 (Hindsight integration). Full spec in `docs/hindsight-integration-plan.md`.**

### ~~v0.9.0 — Email Summary Frontend + Token Management~~ ✅ DONE

### ~~v0.9.1 — Hindsight Foundation~~ ✅ DONE
- `server/hindsight.js` adapter; `HINDSIGHT_API_URL` env gate; docker-compose service (commented in)
- Bank auto-creation with procurement domain config; `GET /api/hindsight/status`
- Settings: Hindsight status row; `testHindsightConnection()`

### ~~v0.9.2 — Chat Memory~~ ✅ DONE
- `_hindsightRetain` fire-and-forget after `saveChat()`; `_hindsightRecall` parallel with BM25 in `sendMessage()`
- `POST /api/hindsight/retain` + `POST /api/hindsight/recall` server endpoints
- `state.settings.hindsightEnabled` toggle; `#settings-hindsight-enabled` checkbox in Settings

### Next: v0.9.3 — Deep Content Integration
- Retain notes, SQ answers, working doc versions, email summaries, research items

### Then: v0.9.4 — Memory UI
- Settings memory tab; in-chat citations; clear/export bank

### Then: v1.0.0 — Production release

---

### Legacy checklist (all done)

1. ~~**`npm run build`**~~ ✅ — completed; `SourceDesk.html` committed at HEAD `db6fab2`
2. ~~**Version labels**~~ ✅ — inline-edit a snapshot's label from the History modal (✎ button per row, Enter saves, Esc cancels)
3. ~~**Important Contacts / Resources**~~ ✅ — per-project contacts and resource links with tags + include-in-context (DB_VERSION 8, new `contacts` store, `src/contacts.js`)
4. ~~**Help modal**~~ ✅ — `src/help.js`, `?` topbar button, F1 / `?` hotkey, tabs for shortcuts / project types / views / context / about
5. ~~**Generalised autosave**~~ ✅ — `src/autosave.js`; debounced (1.5 s) save with status pill; wired into Working Document, Notes, Tasks, **Templates** (`scheduleTemplateAutosave()` for in-modal edits of existing templates). Project edit form remains TODO.
6. ~~**Version diffs**~~ ✅ — `src/diff.js` LCS line diff + `openVersionDiff()` modal in `versioning.js`; Diff button per row in History modal
7. ~~**Feature suggestion box (item 16)**~~ ✅ 🗜️ DB_VERSION 9 — `src/suggestions.js`; "💡 Suggest a feature" link in the sidebar footer; new `suggestions` IndexedDB store. Modal lets users submit title + category + details; entries stored locally and optionally POSTed to a configurable webhook (`Settings → Suggestion Webhook URL`). "View All" lists past suggestions with delete + JSON export.
8. ~~**Brave Search + crawl4ai Settings fields (item 5)**~~ ✅ — `state.settings.braveApiKey`, `state.settings.crawl4aiUrl` (default `http://localhost:11235`); persisted via `saveSettings`; loaded on boot. Test buttons: `testBraveKey()` calls `https://api.search.brave.com/res/v1/web/search?q=test&count=1`, `testCrawl4aiEndpoint()` calls `<url>/health`. Wires into the upcoming Research project workflow (item 4).
9. ~~**Rich-text editor scaffolding (item 15)**~~ ✅ — `src/editor.js` exports `mountRichEditor(textarea, opts)` / `destroyRichEditor` / `setRichEditorMode`. Dual-mode toolbar (Raw markdown ⇄ Rendered contenteditable). Toolbar: H1/H2/H3, **B** / *I* / <u>U</u> / `code`, • list, 1. list, blockquote, 2x2 table, page break, mode toggle. Mounted at boot on `#working-doc-editor`, `#note-editor`, `#tmpl-content`, `#sq-answer-editor`. Round-trip safe markdown ⇄ HTML conversion; existing autosave wiring (input event) preserved. 10 tests added (`tests/test.html` → `describe("rich-text editor")`).
10. ~~**Research project type — first cut (item 4)**~~ ✅ 🗄️ DB_VERSION 10 — new `Research` project category (🔍 icon), new `research` IndexedDB store, new `src/research.js` module, dedicated **Research Board** view accessible from the sidebar (visible whenever a project is loaded; not gated to Research-category projects so RFP/RFI workflows can still pull research). Brave Search integration (10 results / call, `<strong>` highlight tags stripped). "+ Add" per result writes to the board. "+ Add URL" manual entry with optional title and tags. Per-card actions: **⤓ Crawl** (POST `<crawl4aiUrl>/crawl` with the documented body, prefer `fit_markdown` → `markdown` → `html`), **✨ Summarise** (sends crawled text through the active LLM provider with a procurement-tuned system prompt), **delete**, **Include in context** toggle. Research items with `includeInContext: true` are injected into the chat system prompt under `## Research`. Research store is included in `clearAllData()` / `exportDatabase()` / `backupToDrive()` / `importDatabase()`. 3 tests added.

**Still TODO** for full item 4: AI "Research Topic" agent (auto-Brave → auto-crawl → auto-summarise → write to Working Document); "Export Research to Drive" (per-item Google Doc + per-board CSV/Markdown); per-card edit modal for tags & summary; suggested research-query templates.
11. ~~**MarkItDown server integration**~~ ✅ — `server.js` `/health` + `/convert` endpoints; `markitdownUrl` setting; upload order: markitdown → Drive → text fallback; `testMarkitdownServer()`
12. ~~**Enhanced Supplier Questions**~~ ✅ — BidNet HTML import, status/confidence pills, batch generation, summary export, metadata fields
13. ~~**RTE link button**~~ ✅ — `src/editor.js`; raw mode inserts `[text](url)`; rendered mode `createLink`
14. ~~**Embedding progress toast**~~ ✅ — `#embed-progress-toast`; `indexDocEmbeddings(docId, chunks, onProgress)` callback
15. ~~**Server-side backup**~~ ✅ — `POST /backup` endpoint; Settings button visible when served over HTTP
16. ~~**Tasks calendar view**~~ ✅ — 📅 toggle; month grid; `_calNav`, `_calToday`, `_calSelectDay`; `exportTasksMarkdown/CSV()`
17. ~~**Research board enhancements**~~ ✅ — per-card edit modal; query template quick-fills; Markdown/CSV export
18. ~~**Position Guidelines view**~~ ✅ — `src/guidelines.js`; `docType:'guideline'`; AI analyzer; one-click Create Task/Template
19. ~~**LLM-generated session titles**~~ ✅ — fire-and-forget LLM call after first message; title stored in `chats.title`
20. ~~**Cross-project session search**~~ ✅ — `openCrossSearch()` + `runCrossSearch()`; 🔍 sidebar button + Ctrl+Shift+K
21. ~~**Proposal Evaluation**~~ ✅ 🗄️ DB_VERSION 11 — `src/evaluation.js`; `evalCriteria`, `evalCandidates`, `evalScores`; AI scoring; Markdown export
22. ~~**Stop streaming button**~~ ✅ — `stopStreaming()`; ■ Stop / ▶ Send toggle

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

13. ~~**Proper Help system**~~ ✅ — `src/help.js`, `?` topbar button, F1/`?` hotkey, tabbed modal: Shortcuts / Project Types / Views / Context System / About

14. ~~**Autosave everywhere**~~ ✅ — `src/autosave.js`; debounced 1.5 s save with `● Saving…` / `✓ Saved` status pill

15. ~~**Rich-text editors with raw / rendered toggle**~~ ✅ — `src/editor.js`; dual-mode toolbar; mounted on Working Doc, Notes, Templates, SQ answer field

16. ~~**Feature suggestion box**~~ ✅ — `src/suggestions.js`; DB_VERSION 9; `suggestions` store; webhook integration

17. ~~**Versioning a deliverable document with diffs**~~ ✅ — `src/diff.js` LCS diff; `openVersionDiff()` in `versioning.js`; Diff button per row in History modal

18. **Highlights & comments as document metadata** *(medium)* — in the rendered editor users can select text → "Highlight" (color picker) or "Add Comment" (popup); stored as a sidecar `{ docId, range, color, comment, author, createdAt }` in a new `annotations` store, NOT inline in the document text. Annotations rendered as overlay spans. **Export options**: "Export with annotations" (HTML/PDF with highlights baked in + comment footnotes) vs. "Export clean" (plain markdown).

19. **Versioning with branching support** *(large)* — model versions as a DAG instead of a flat list. Each version gets `parentVersionId`. "Branch from this version" button creates a new branch with a name; branches selectable in History modal as a tree view. Merge support is *out of scope* for v1 — branches are independent forks with optional manual copy-paste.

20. **Highlights as a notes section** *(small/medium)* — auto-aggregate all annotations of type `highlight` from a project's docs into a per-project "Highlights" panel (next to Notes). Each highlight is a row showing source doc, snippet, color, jump-to-source link. Each highlight has an "Include in context" checkbox — checked highlights injected into system prompt as `## Highlighted Excerpts`.

21. ~~**Proposal Evaluation project type**~~ ✅ 🗄️ DB_VERSION 11 — `src/evaluation.js`; `evalCriteria`, `evalCandidates`, `evalScores` stores; three-tab view; AI scoring; Markdown export. **Note**: annotation semantics (value-add / deduction / disqualifier) and multi-agent parallel evaluation not yet implemented.

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
- This project runs on **macOS**. Most shell features work normally.
- Shell substitutions (`$VAR`, `$(...)`, backticks) are blocked in the terminal tool. Resolve values before calling terminal, or chain with `&&`.
- Heredocs (`<< 'EOF'`) also do not work in the terminal tool. Workaround: Write scripts to a file using `edit_file`, then run with `node script.js` or `python3 script.py`. Delete the temp file after.

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

### LM Studio model unload API vs Ollama keep_alive trick
Two completely different mechanisms are used to evict a model from VRAM depending on which local server is running:

- **Ollama**: `POST {root}/api/generate` with `{"model": "name", "keep_alive": 0}` — this is a side-effect of the generate endpoint; Ollama evicts the model when `keep_alive` is 0 rather than running inference.
- **LM Studio 0.4+**: `POST {root}/api/v1/models/unload` with `{"identifier": "name"}` — a dedicated management endpoint in LM Studio's native v1 REST API (introduced in 0.4.0; not present in older versions).

`unloadLocalModel()` tries LM Studio first, then falls back to Ollama if LM Studio returns 404. LM Studio's endpoint is well-defined and version-gated (0.4.0+), making it the correct primary probe. If LM Studio returns 404 (endpoint not present), the function falls back to Ollama's `keep_alive: 0` side-effect approach. Note that Ollama's `/api/generate keep_alive:0` always returns 200 regardless of whether a model was actually loaded — it is a workaround, not a management endpoint. The server root for both is derived by stripping `/v1` (or `/api/v1`) from the configured base URL — the same regex used by `fetchLocalModels()` for the OpenAI-compat URL normalisation.

### LM Studio `/api/v1` vs `/v1`
- LM Studio's newer API versions expose model listing at `/api/v1/models` (their own schema: `key` for model ID, `display_name` for label) but the OpenAI-compatible chat/embeddings endpoints live at `/v1/chat/completions` and `/v1/embeddings`.
- SourceDesk strips `/api` from the configured base URL when building chat and embedding URLs via a regex: `.replace(/\/api(\/v\d+)$/i, '$1')`. This means both `/api/v1` and `/v1` work as a base URL without user configuration.
- Model detection (`fetchLocalModels`) always uses the base URL as-is (appending `/models`), which correctly hits `/api/v1/models`.

### Local LLM CORS proxy
- Browsers enforce a strict rule: `Authorization` cannot be covered by `Access-Control-Allow-Headers: *` (wildcard). LM Studio and Ollama both use the wildcard, so any request that includes an `Authorization` header will be blocked by the browser regardless of the LM Studio CORS setting.
- The fix is the `/proxy` endpoint in `server.js` — it makes the request server-side (no CORS restrictions) and streams the response back. This only works when the app is served via `npm run serve` (i.e., `window.__SOURCEDESK_ENV__` is defined). When running from `file://`, direct fetch is used and CORS issues may still appear if a key is set.
- `_localFetch(url, options)` in `flags.js` is the single switching point — change it there if the proxy logic ever needs updating.

### Non-streaming requests through the local LLM proxy — patch the inner body, not the outer envelope
When you need a synchronous (non-streaming) LLM response (e.g. Guidelines analysis, Proposal Evaluation), you call `buildApiCall()` and then modify the body to set `stream: false` before calling `fetch()`. This works correctly for all direct providers. But for the **local** provider when the app is served via `npm run serve`, `buildApiCall()` returns a proxy envelope:
```Sourcedesk/src/flags.js#L1-1
{ url, headers, body: '{"url":"http://...","method":"POST","headers":{...},"body":"{\"model\":...\"stream\":true}"}' }
```
The outer `body` field is already a JSON *string* (the serialised envelope). If you do `JSON.parse(apiCall.body).stream = false` you're patching the outer envelope object, not the inner body. The LLM still receives `stream: true` and returns an SSE stream; `resp.json()` then throws `Unexpected token 'd', "data: {\"id\"..."`.

**Correct pattern:**
```Sourcedesk/src/guidelines.js#L1-1
let bodyStr = apiCall.body;
try {
  const outer = JSON.parse(bodyStr);
  if (outer && typeof outer.body === 'string') {
    // proxy envelope — patch the inner body string
    const inner = JSON.parse(outer.body);
    inner.stream = false;
    outer.body = JSON.stringify(inner);
    bodyStr = JSON.stringify(outer);
  } else {
    outer.stream = false;
    bodyStr = JSON.stringify(outer);
  }
} catch { /* leave as-is */ }
```
See `_runAnalyze()` in `src/guidelines.js` and `evaluateCandidate()` in `src/evaluation.js` for the reference implementation.

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