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
  // Retain the latest working-doc snapshot in Hindsight (upsert via stable documentId).
  if (content && content.trim()) {
    const _pid = state.activeProject.id;
    const _pname = state.activeProject.name || "";
    _hindsightRetainItem(
      "wdoc:" + _pid + ":latest",
      "# Working Document: " + _pname + "\n\n" + content,
      ["project:" + _pid, "type:working-doc"],
      "project:" + _pid + " working document",
    );
  }
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
    <button onclick="openVersionDiff('${v.id}')" class="btn-ghost" style="font-size:11px;padding:3px 10px" title="Diff this version against the current working document or another version">Diff</button>
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
  const row = document.querySelector(`[data-vid="${versionId}"] .vh-label-row`);
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
  const row = document.querySelector(`[data-vid="${versionId}"] .vh-label-row`);
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
  if (typeof refreshRichEditor === "function" && editor)
    refreshRichEditor(editor);
  closeModal();
}

// ─── VERSION DIFF VIEWER ─────────────────────────────────────────────────────
// Opens a modal that diffs the chosen version against either the current
// working document or another saved version. Defaults to comparing against
// current working document.
async function openVersionDiff(versionId, compareToId) {
  if (!state.activeProject) return;
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;

  const versions = await dbGetByIndex(
    "docVersions",
    "projectId",
    state.activeProject.id,
  );
  versions.sort((a, b) => b.savedAt - a.savedAt);

  const target = versions.find((x) => x.id === versionId);
  if (!target) return;

  let other,
    otherLabel,
    otherId = compareToId || "__current__";
  if (otherId === "__current__") {
    other = { content: state.activeProject.workingContent || "" };
    otherLabel = "Current working document";
  } else {
    other = versions.find((x) => x.id === otherId);
    if (!other) {
      other = { content: state.activeProject.workingContent || "" };
      otherId = "__current__";
      otherLabel = "Current working document";
    } else {
      const idx = versions.findIndex((x) => x.id === other.id);
      otherLabel =
        (other.label && other.label.trim()) ||
        "Version " + (versions.length - idx);
    }
  }

  const targetIdx = versions.findIndex((x) => x.id === target.id);
  const targetLabel =
    (target.label && target.label.trim()) ||
    "Version " + (versions.length - targetIdx);

  // a = older/baseline (target snapshot), b = newer (compare-to). Since we
  // can't be sure which is older, sort by savedAt to keep diff intuitive.
  let aText, bText, aLabel, bLabel;
  const targetTs = target.savedAt || 0;
  const otherTs = otherId === "__current__" ? Date.now() : other.savedAt || 0;
  if (targetTs <= otherTs) {
    aText = target.content || "";
    aLabel = targetLabel;
    bText = other.content || "";
    bLabel = otherLabel;
  } else {
    aText = other.content || "";
    aLabel = otherLabel;
    bText = target.content || "";
    bLabel = targetLabel;
  }

  const ops = diffLines(aText, bText);
  const stats = diffStats(ops);
  const html = renderInlineDiffHtml(ops);

  // Build compare-to selector options (exclude target itself)
  const optsHtml = [
    `<option value="__current__"${otherId === "__current__" ? " selected" : ""}>Current working document</option>`,
  ]
    .concat(
      versions
        .filter((v) => v.id !== target.id)
        .map((v, _i) => {
          const idx = versions.findIndex((x) => x.id === v.id);
          const lbl =
            (v.label && v.label.trim()) || "Version " + (versions.length - idx);
          const sel = v.id === otherId ? " selected" : "";
          return `<option value="${v.id}"${sel}>${_escapeHtml(lbl)}</option>`;
        }),
    )
    .join("");

  overlay.innerHTML = `<div class="modal" style="max-width:860px;width:97%">
  <div class="modal-header">
    <span class="modal-title">Diff — ${_escapeHtml(targetLabel)}</span>
    <button class="modal-close" onclick="openVersionHistory()">✕</button>
  </div>
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <span style="font-size:12px;color:var(--text-muted)">Compare</span>
    <span style="font-size:12px;font-weight:500">${_escapeHtml(targetLabel)}</span>
    <span style="font-size:12px;color:var(--text-muted)">↔</span>
    <select onchange="openVersionDiff('${target.id}', this.value)" style="font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 6px">${optsHtml}</select>
    <span style="flex:1"></span>
    <span style="font-size:11px;color:#7adb96">+${stats.add}</span>
    <span style="font-size:11px;color:#e88b8b">-${stats.del}</span>
    <span style="font-size:11px;color:var(--text-muted)">${stats.eq} unchanged</span>
  </div>
  <div class="modal-body" style="padding:0;max-height:60vh;overflow:auto;background:var(--bg)">${html}</div>
  <div class="modal-footer">
    <button class="btn-ghost" onclick="openVersionHistory()">← Back to History</button>
    <button class="btn-ghost" onclick="closeModal()">Close</button>
  </div>
</div>`;
  overlay.classList.remove("hidden");
}

async function deleteDocVersion(versionId) {
  if (!confirm("Delete this version snapshot? This cannot be undone.")) return;
  await dbDelete("docVersions", versionId);
  await openVersionHistory();
}
