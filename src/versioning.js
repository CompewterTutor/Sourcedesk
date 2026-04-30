// ─── WORKING DOCUMENT VERSIONING ─────────────────────────────────────────────

async function saveDocVersion(content) {
    if (!state.activeProject) return;
    const now = Date.now();
    await dbPut("docVersions", {
        id: uid(),
        projectId: state.activeProject.id,
        content,
        savedAt: now,
        label: "",
    });
}

async function openVersionHistory() {
    if (!state.activeProject) return;
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return;

    let versions = await dbGetByIndex(
        "docVersions",
        "projectId",
        state.activeProject.id,
    );
    versions.sort((a, b) => b.savedAt - a.savedAt);

    overlay.innerHTML = _renderVersionHistoryModal(versions);
    overlay.classList.remove("hidden");
}

function _escapeHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function _renderVersionHistoryModal(versions) {
    const rows =
        versions.length === 0
            ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">No saved versions yet. Save the working document to create a snapshot.</div>'
            : versions
                  .map((v, i) => {
                      const date = new Date(v.savedAt);
                      const dateStr =
                          date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                          }) +
                          " " +
                          date.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                          });
                      const defaultLabel = "Version " + (versions.length - i);
                      const hasLabel = !!(v.label && v.label.trim());
                      const displayLabel = hasLabel ? v.label : defaultLabel;
                      const labelStyle = hasLabel
                          ? "color:var(--text);font-weight:500"
                          : "color:var(--text-muted);font-weight:500;font-style:italic";
                      const preview = (v.content || "")
                          .slice(0, 100)
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;");
                      return `<div data-vid="${v.id}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
  <div style="flex:1;min-width:0">
    <div class="vh-label-row" style="display:flex;align-items:center;gap:6px">
      <span class="vh-label-text" style="font-size:12px;${labelStyle}">${_escapeHtml(displayLabel)}</span>
      <button class="vh-label-edit" title="Rename version" onclick="_vhStartLabelEdit('${v.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text-muted);padding:0 4px">✎</button>
    </div>
    <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);margin:2px 0">${dateStr}</div>
    <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}${v.content && v.content.length > 100 ? "…" : ""}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
    <button onclick="restoreDocVersion('${v.id}')" class="btn-primary" style="font-size:11px;padding:3px 10px">Restore</button>
    <button onclick="deleteDocVersion('${v.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text-muted);padding:2px 4px" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">✕ Delete</button>
  </div>
</div>`;
                  })
                  .join("");

    return `<div class="modal" style="max-width:560px;width:95%">
  <div class="modal-header">
    <span class="modal-title">Version History — ${(state.activeProject?.name || "").replace(/</g, "&lt;")}</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="padding:0;max-height:440px;overflow-y:auto">${rows}</div>
  <div class="modal-footer">
    <button class="btn-ghost" onclick="closeModal()">Close</button>
  </div>
</div>`;
}

async function _vhStartLabelEdit(versionId) {
    const row = document.querySelector(
        `[data-vid="${versionId}"] .vh-label-row`,
    );
    if (!row) return;
    // Look up current stored label (may be empty)
    const versions = await dbGetByIndex(
        "docVersions",
        "projectId",
        state.activeProject.id,
    );
    const v = versions.find((x) => x.id === versionId);
    if (!v) return;
    const currentLabel = v.label || "";
    row.innerHTML = `<input type="text" class="vh-label-input" value="${_escapeHtml(currentLabel)}" placeholder="Version label…" style="flex:1;font-size:12px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text)">
<button onclick="_vhSaveLabel('${versionId}')" class="btn-primary" style="font-size:11px;padding:2px 8px">✓</button>
<button onclick="openVersionHistory()" style="background:none;border:1px solid var(--border);cursor:pointer;font-size:11px;padding:2px 8px;color:var(--text-muted);border-radius:3px">✕</button>`;
    const input = row.querySelector(".vh-label-input");
    if (input) {
        input.focus();
        input.select();
        input.onkeydown = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                _vhSaveLabel(versionId);
            } else if (e.key === "Escape") {
                e.preventDefault();
                openVersionHistory();
            }
        };
    }
}

async function _vhSaveLabel(versionId) {
    const row = document.querySelector(
        `[data-vid="${versionId}"] .vh-label-row`,
    );
    if (!row) return;
    const input = row.querySelector(".vh-label-input");
    const newLabel = input ? input.value.trim() : "";
    const v = await dbGet("docVersions", versionId);
    if (!v) return;
    v.label = newLabel;
    await dbPut("docVersions", v);
    await openVersionHistory();
}

async function restoreDocVersion(versionId) {
    const versions = await dbGetByIndex(
        "docVersions",
        "projectId",
        state.activeProject.id,
    );
    const v = versions.find((x) => x.id === versionId);
    if (!v) return;
    if (
        !confirm(
            "Restore this version? The current working document content will be replaced (a new snapshot will be saved first).",
        )
    )
        return;
    // Save current as a version first
    const current = state.activeProject.workingContent || "";
    if (current.trim()) await saveDocVersion(current);
    // Apply restored content
    state.activeProject.workingContent = v.content;
    await dbPut("projects", state.activeProject);
    // Update editor if visible
    const editor = document.getElementById("working-doc-editor");
    if (editor) editor.value = v.content;
    closeModal();
}

async function deleteDocVersion(versionId) {
    if (!confirm("Delete this version snapshot? This cannot be undone."))
        return;
    await dbDelete("docVersions", versionId);
    await openVersionHistory();
}
