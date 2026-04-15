# Changelog

All notable changes to SourceDesk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Versions marked with 🗄️ include IndexedDB schema changes and a migration script.

---

## [0.2.0] - 2025-07-14 🗄️

### Database Changes
- Bumped `DB_VERSION` from `1` → `2`
- Added **`notes`** object store (`keyPath: 'id'`, index on `projectId`)
- Migration: automatic — no data loss, new store is additive

### Added
- **Version string** — `v0.2.0` displayed in the topbar (monospace, muted)
- **DEBUG flag** — `const DEBUG = false` at top of script; use `log()` helper for dev logging
- **Database Export** — Settings → "Export Database" downloads all IndexedDB stores as a timestamped `.json` file
- **Database Import** — Settings → "Import Database" restores from a previously exported JSON (clears all existing data first, then reloads)
- **Notes** — Per-project note-taking. Sidebar "Notes" section opens a split-panel editor. Notes have a title and free-text body. Accessible only when a project is active.
- **Global Instructions** — Settings field renamed from "Sourcing Context" to "Global Instructions" for clarity; functionally unchanged (injected into every system prompt)
- **Per-Project Instructions** — New field on the project creation form. Added to the system prompt below global instructions when the project is active
- **Project/Chat Export** — Topbar "Export" button (visible when a project is active) downloads the project metadata, notes, and full chat history as a JSON file

### Changed
- Settings modal: "Sourcing Context" label → "Global Instructions"
- Settings modal: added "Export Database" and "Import Database" buttons
- Project creation modal: added "Project Instructions" textarea field
- System prompt now includes per-project instructions section when set
- `showView()` extended to handle `'notes'` view

### Testing
- Created `Sourcedesk/tests/test.html` — self-contained browser-based test runner
- Covers: `tokenize`, `buildIndex`, `bm25Score`, `chunkText`, `formatMarkdown`, `uid`, export format validation

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