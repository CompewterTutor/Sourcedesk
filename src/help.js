// ─── HELP / TOURS ────────────────────────────────────────────────────────────
// A central Help modal: keyboard shortcuts, project-type glossary, view
// walkthroughs, and links to README / docs. Opens via the "?" topbar button
// or by pressing F1 (or Shift+/ when not focused on an input).

function openHelpModal() {
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return;
    overlay.innerHTML = _renderHelpModal();
    overlay.classList.remove("hidden");
    // Default tab: shortcuts
    helpSwitchTab("shortcuts");
}

function helpSwitchTab(tab) {
    document.querySelectorAll(".help-tab-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll(".help-tab-pane").forEach(function (p) {
        p.style.display = p.dataset.tab === tab ? "block" : "none";
    });
}

function _renderHelpModal() {
    return `<div class="modal" style="max-width:720px;width:95%">
  <div class="modal-header">
    <span class="modal-title">SourceDesk Help</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="padding:0">
    <div style="display:flex;gap:4px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <button class="help-tab-btn type-pill" data-tab="shortcuts" onclick="helpSwitchTab('shortcuts')">⌨ Shortcuts</button>
      <button class="help-tab-btn type-pill" data-tab="projects" onclick="helpSwitchTab('projects')">📁 Project Types</button>
      <button class="help-tab-btn type-pill" data-tab="views" onclick="helpSwitchTab('views')">🧭 Views</button>
      <button class="help-tab-btn type-pill" data-tab="context" onclick="helpSwitchTab('context')">🧠 Context System</button>
      <button class="help-tab-btn type-pill" data-tab="about" onclick="helpSwitchTab('about')">ℹ About</button>
    </div>
    <div style="padding:14px 18px;max-height:55vh;overflow-y:auto;font-size:13px;line-height:1.55;color:var(--text)">
      ${_helpShortcutsPane()}
      ${_helpProjectsPane()}
      ${_helpViewsPane()}
      ${_helpContextPane()}
      ${_helpAboutPane()}
    </div>
  </div>
  <div class="modal-footer">
    <button class="btn-ghost" onclick="closeModal()">Close</button>
  </div>
</div>`;
}

function _helpKbdRow(keys, desc) {
    const html = keys
        .map(
            (k) =>
                `<kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text)">${k}</kbd>`,
        )
        .join(
            ' <span style="color:var(--text-muted);font-size:11px">+</span> ',
        );
    return `<tr><td style="padding:4px 12px 4px 0;white-space:nowrap">${html}</td><td style="padding:4px 0;color:var(--text-muted)">${desc}</td></tr>`;
}

function _helpShortcutsPane() {
    return `<div class="help-tab-pane" data-tab="shortcuts" style="display:none">
      <h3 style="margin-top:0">Keyboard Shortcuts</h3>
      <table style="border-collapse:collapse;width:100%">
        <tbody>
          ${_helpKbdRow(["F1"], "Open this Help modal")}
          ${_helpKbdRow(["?"], "Open this Help modal (when not editing text)")}
          ${_helpKbdRow(["Esc"], "Close any modal")}
          ${_helpKbdRow(["Enter"], "Send chat message / save inline edits")}
          ${_helpKbdRow(["Shift", "Enter"], "New line in chat input")}
          ${_helpKbdRow(["Ctrl/⌘", "S"], "Save current view (where applicable)")}
        </tbody>
      </table>
      <p style="color:var(--text-muted);font-size:12px;margin-top:14px">Have an idea? Open the <a href="#" onclick="event.preventDefault();closeModal();openSuggestionBox()" style="color:var(--accent)">💡 Suggestion Box</a> from the topbar to file a feature request.</p>
    </div>`;
}

function _helpProjectsPane() {
    return `<div class="help-tab-pane" data-tab="projects" style="display:none">
      <h3 style="margin-top:0">Project Types</h3>
      <ul style="padding-left:18px;margin:0">
        <li style="margin-bottom:8px"><b>📋 RFP</b> — Request for Proposal. Use for full proposal drafting workflows: working document, supplier questions, version snapshots, target document export.</li>
        <li style="margin-bottom:8px"><b>📄 RFI</b> — Request for Information. Lighter weight than RFP — typically information gathering before a formal RFP.</li>
        <li style="margin-bottom:8px"><b>🏢 Vendor Q</b> — Vendor questionnaire. Use the Supplier Questions view for structured Q/A workflows.</li>
        <li style="margin-bottom:8px"><b>📑 Contract</b> — Contract review / drafting. Working Document + Notes + Tasks for redlines and clauses.</li>
        <li style="margin-bottom:8px"><b>📁 Other</b> — Catch-all for any procurement-adjacent project that doesn't fit the above.</li>
      </ul>
      <p style="color:var(--text-muted);font-size:12px;margin-top:12px">More types coming: <i>Research</i>, <i>Evaluation</i>, <i>Position Guidelines</i>. See roadmap in CLAUDE.md.</p>
    </div>`;
}

function _helpViewsPane() {
    return `<div class="help-tab-pane" data-tab="views" style="display:none">
      <h3 style="margin-top:0">Views (per project)</h3>
      <ul style="padding-left:18px;margin:0">
        <li style="margin-bottom:8px"><b>Chat</b> — your AI workspace. Attach docs, switch sessions, edit messages, regenerate replies. The right panel controls what context the model sees.</li>
        <li style="margin-bottom:8px"><b>Working Document</b> — the primary editable artifact. Saves create version snapshots; use the History modal to restore, rename, or diff versions.</li>
        <li style="margin-bottom:8px"><b>Notes</b> — quick scratchpad notes. Each note has an "include in context" toggle to inject it into the system prompt.</li>
        <li style="margin-bottom:8px"><b>Supplier Questions</b> — structured question/answer list, ideal for RFI/Vendor Q. AI can draft answers; export to Markdown/CSV/Sheets/Doc.</li>
        <li style="margin-bottom:8px"><b>Tasks</b> — per-project task list with status, priority, due date. Toggle into context for AI awareness.</li>
        <li style="margin-bottom:8px"><b>Contacts &amp; Resources</b> — people and links relevant to the project. Toggle into context to expose them to the AI.</li>
        <li style="margin-bottom:8px"><b>Templates Library</b> — reusable text scaffolds with <code>{{VARIABLES}}</code>. Fill them in via the Fill Template flow.</li>
      </ul>
    </div>`;
}

function _helpContextPane() {
    return `<div class="help-tab-pane" data-tab="context" style="display:none">
      <h3 style="margin-top:0">How Context Works</h3>
      <p>The AI sees a system prompt assembled from several sources, in this order:</p>
      <ol style="padding-left:18px;margin:0">
        <li>Global Context (Settings → Global Context)</li>
        <li>Project name, category, instructions, and notes</li>
        <li>Working Document content</li>
        <li>Documents you've toggled on in the right panel (BM25-retrieved or full)</li>
        <li>Notes / Tasks / Contacts marked "include in context"</li>
        <li>Other projects you've cross-linked via the right panel</li>
        <li>Temporary attachments (paperclip in chat input — current message only)</li>
      </ol>
      <p style="color:var(--text-muted);font-size:12px;margin-top:12px">Watch the <b>Context Meter</b> at the bottom of the chat input — it estimates token usage vs the active model's window so you can trim aggressively when you're approaching the limit.</p>
    </div>`;
}

function _helpAboutPane() {
    return `<div class="help-tab-pane" data-tab="about" style="display:none">
      <h3 style="margin-top:0">About SourceDesk</h3>
      <p>SourceDesk is a single-file, local-first procurement copilot. All data lives in your browser's IndexedDB — nothing is uploaded except prompts you explicitly send to your selected AI provider.</p>
      <ul style="padding-left:18px;margin:0">
        <li><b>Version:</b> v${typeof APP_VERSION !== "undefined" ? APP_VERSION : "?"}</li>
        <li><b>Storage:</b> IndexedDB <code>sourcedesk</code> (DB v${typeof DB_VERSION !== "undefined" ? DB_VERSION : "?"})</li>
        <li><b>Backups:</b> Settings → Export Database (JSON), or Drive → Backup to Drive</li>
        <li><b>Source / docs:</b> see <code>CLAUDE.md</code> in the project repo</li>
      </ul>
      <p style="color:var(--text-muted);font-size:12px;margin-top:12px">Have feedback? Open the <a href="#" onclick="event.preventDefault();closeModal();openSuggestionBox()" style="color:var(--accent)">💡 Suggestion Box</a> from the topbar (or here) to file a feature request — your suggestions are stored locally and optionally POSTed to a webhook you configure in Settings.</p>
    </div>`;
}

// Global hotkey: F1 anywhere; "?" only when not typing into a text field.
function _helpKeyHandler(e) {
    if (e.key === "F1") {
        e.preventDefault();
        openHelpModal();
        return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        const tag = t && t.tagName;
        const isEditable =
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            (t && t.isContentEditable);
        if (!isEditable) {
            e.preventDefault();
            openHelpModal();
        }
    }
}

// Auto-bind once DOM is ready
if (typeof document !== "undefined") {
    document.addEventListener("keydown", _helpKeyHandler);
}
