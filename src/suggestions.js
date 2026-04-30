// ─── FEATURE SUGGESTIONS ─────────────────────────────────────────────────────
// A small "💡 Suggest a feature" modal. Suggestions are stored locally in
// the `suggestions` IndexedDB store. If the user has configured a webhook
// URL in Settings (`suggestionWebhook`), the suggestion is also POSTed to
// that endpoint as JSON. Failures to POST are non-fatal — the local copy
// is always written first.
//
// Public API used from HTML attributes:
//   openSuggestionBox()
//   submitSuggestion()
//   openManageSuggestions()
//   deleteSuggestion(id)
//   exportSuggestions()

const SUGGESTION_CATEGORIES = [
    "UX / Polish",
    "New View",
    "Integration",
    "AI / Prompting",
    "Performance",
    "Bug",
    "Other",
];

function _renderSuggestionModal() {
    const cats = SUGGESTION_CATEGORIES.map(
        (c) => `<option value="${c}">${c}</option>`,
    ).join("");
    return `<div class="modal" style="max-width:560px;width:95%">
  <div class="modal-header">
    <span class="modal-title">💡 Suggest a Feature</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="padding:14px 18px">
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;line-height:1.55">
      Suggestions are stored locally in your browser. If you've configured a
      Suggestion Webhook URL in Settings, your submission will also be POSTed
      there as JSON. Nothing is sent anywhere else.
    </p>
    <div class="form-row">
      <label class="form-label">Title</label>
      <input class="form-input" id="suggestion-title" type="text" placeholder="Short summary, e.g. 'Side-by-side diff view'" />
    </div>
    <div class="form-row">
      <label class="form-label">Category</label>
      <select class="form-select" id="suggestion-category">${cats}</select>
    </div>
    <div class="form-row">
      <label class="form-label">Details</label>
      <textarea class="form-textarea" id="suggestion-details" style="min-height:120px" placeholder="What problem does it solve? How would you use it?"></textarea>
    </div>
    <div id="suggestion-status" style="font-size:12px;color:var(--text-muted);min-height:16px"></div>
  </div>
  <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:10px 18px;border-top:1px solid var(--border)">
    <button class="btn-secondary" onclick="openManageSuggestions()">View All</button>
    <button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitSuggestion()">Submit</button>
  </div>
</div>`;
}

function openSuggestionBox() {
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return;
    overlay.innerHTML = _renderSuggestionModal();
    overlay.classList.remove("hidden");
    setTimeout(function () {
        const t = document.getElementById("suggestion-title");
        if (t) t.focus();
    }, 30);
}

async function submitSuggestion() {
    const titleEl = document.getElementById("suggestion-title");
    const catEl = document.getElementById("suggestion-category");
    const detailsEl = document.getElementById("suggestion-details");
    const statusEl = document.getElementById("suggestion-status");
    if (!titleEl || !detailsEl) return;
    const title = titleEl.value.trim();
    const category = catEl ? catEl.value : "Other";
    const details = detailsEl.value.trim();
    if (!title) {
        if (statusEl) {
            statusEl.textContent = "Please enter a title.";
            statusEl.style.color = "var(--danger)";
        }
        titleEl.focus();
        return;
    }
    const entry = {
        id: uid(),
        title,
        category,
        details,
        createdAt: Date.now(),
        appVersion: typeof APP_VERSION !== "undefined" ? APP_VERSION : "?",
        projectId: state.activeProject ? state.activeProject.id : null,
        projectName: state.activeProject ? state.activeProject.name : null,
        posted: false,
    };
    try {
        await dbPut("suggestions", entry);
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = "Failed to save locally: " + err.message;
            statusEl.style.color = "var(--danger)";
        }
        return;
    }
    // Optional webhook
    const url = (state.settings.suggestionWebhook || "").trim();
    if (url) {
        if (statusEl) {
            statusEl.textContent = "Saved locally · sending to webhook…";
            statusEl.style.color = "var(--text-muted)";
        }
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry),
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
            entry.posted = true;
            entry.postedAt = Date.now();
            await dbPut("suggestions", entry);
        } catch (err) {
            if (statusEl) {
                statusEl.textContent =
                    "✓ Saved locally — webhook failed: " + err.message;
                statusEl.style.color = "var(--accent)";
            }
            log("suggestion webhook failed:", err.message);
            // Leave modal open so user can retry / copy details
            return;
        }
    }
    if (statusEl) {
        statusEl.textContent = "✓ Thanks — your suggestion was saved.";
        statusEl.style.color = "var(--success)";
    }
    setTimeout(closeModal, 900);
}

async function openManageSuggestions() {
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return;
    let items = [];
    try {
        items = await dbGetAll("suggestions");
    } catch (e) {
        items = [];
    }
    items.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
    const rows = items.length
        ? items
              .map(function (s) {
                  const date = new Date(s.createdAt).toLocaleString();
                  const postedBadge = s.posted
                      ? '<span style="color:var(--success);font-size:10px;margin-left:6px">✓ posted</span>'
                      : "";
                  const proj = s.projectName
                      ? `<span style="color:var(--text-muted);font-size:11px"> · ${_escSugg(s.projectName)}</span>`
                      : "";
                  return `<div style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="font-weight:600;font-size:13px">${_escSugg(s.title)} <span style="color:var(--accent);font-size:11px;font-weight:400">[${_escSugg(s.category || "")}]</span>${postedBadge}</div>
            <button class="btn-ghost" style="padding:2px 8px;font-size:11px" onclick="deleteSuggestion('${s.id}')">Delete</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${date}${proj}</div>
          ${s.details ? `<div style="font-size:12px;color:var(--text);margin-top:6px;white-space:pre-wrap">${_escSugg(s.details)}</div>` : ""}
        </div>`;
              })
              .join("")
        : '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center">No suggestions yet.</div>';
    overlay.innerHTML = `<div class="modal" style="max-width:680px;width:95%">
  <div class="modal-header">
    <span class="modal-title">Suggestions (${items.length})</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="padding:14px 18px;max-height:60vh;overflow-y:auto">
    ${rows}
  </div>
  <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:10px 18px;border-top:1px solid var(--border)">
    <button class="btn-secondary" onclick="exportSuggestions()" ${items.length ? "" : "disabled"}>Export JSON</button>
    <button class="btn-secondary" onclick="openSuggestionBox()">+ New</button>
    <button class="btn-ghost" onclick="closeModal()">Close</button>
  </div>
</div>`;
    overlay.classList.remove("hidden");
}

async function deleteSuggestion(id) {
    if (!confirm("Delete this suggestion?")) return;
    try {
        await dbDelete("suggestions", id);
    } catch (e) {
        // ignore
    }
    openManageSuggestions();
}

async function exportSuggestions() {
    let items = [];
    try {
        items = await dbGetAll("suggestions");
    } catch (e) {
        items = [];
    }
    const json = JSON.stringify(items, null, 2);
    const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
        "sourcedesk-suggestions-" +
        new Date().toISOString().slice(0, 10) +
        ".json";
    a.click();
    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

function _escSugg(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
