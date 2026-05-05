// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function renderTemplatesGrid() {
  const grid = document.getElementById("templates-grid");
  grid.innerHTML = "";
  if (!state.templates.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="30" height="30" rx="3"/><line x1="12" y1="14" x2="28" y2="14"/><line x1="12" y1="20" x2="28" y2="20"/><line x1="12" y1="26" x2="20" y2="26"/></svg><span>No templates yet — create your first one.</span></div>`;
    return;
  }
  state.templates.forEach((t) => {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <div class="template-card-actions">
        <span class="tcard-btn" onclick="openEditTemplate('${t.id}')">Edit</span>
        <span class="tcard-btn" onclick="duplicateTemplate('${t.id}')">Dup</span>
        <span class="tcard-btn del" onclick="deleteTemplate('${t.id}')">Delete</span>
      </div>
      <div class="template-card-type ${t.type === "skeleton" ? "type-skeleton" : "type-example"}">${t.type}</div>
      <div class="template-card-name">${t.name}</div>
      <div class="template-card-category">${t.category}</div>`;
    grid.appendChild(card);
  });
}

function openNewTemplate() {
  state.editingTemplateId = null;
  document.getElementById("modal-template-title").textContent = "New Template";
  document.getElementById("tmpl-name").value = "";
  document.getElementById("tmpl-content").value = "";
  {
    const _ta = document.getElementById("tmpl-content");
    if (typeof refreshRichEditor === "function" && _ta) refreshRichEditor(_ta);
  }
  selectPillByVal("tmpl-category-pills", "RFP");
  selectPillByVal("tmpl-type-pills", "skeleton");
  const pp = document.getElementById("tmpl-preview-panel");
  if (pp) pp.style.display = "none";
  showModal("modal-template");
}

function openEditTemplate(id) {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return;
  state.editingTemplateId = id;
  document.getElementById("modal-template-title").textContent = "Edit Template";
  document.getElementById("tmpl-name").value = t.name;
  document.getElementById("tmpl-content").value = t.content;
  {
    const _ta = document.getElementById("tmpl-content");
    if (typeof refreshRichEditor === "function" && _ta) refreshRichEditor(_ta);
  }
  selectPillByVal("tmpl-category-pills", t.category);
  selectPillByVal("tmpl-type-pills", t.type);
  const pp = document.getElementById("tmpl-preview-panel");
  if (pp) pp.style.display = "none";
  showModal("modal-template");
}

async function saveTemplate() {
  const name = document.getElementById("tmpl-name").value.trim();
  const content = document.getElementById("tmpl-content").value.trim();
  const category = getActivePill("tmpl-category-pills");
  const type = getActivePill("tmpl-type-pills");
  if (!name || !content) {
    alert("Please fill in the name and content.");
    return;
  }
  const id = state.editingTemplateId || uid();
  const tmpl = { id, name, category, type, content, updatedAt: Date.now() };
  await dbPut("templates", tmpl);
  if (state.editingTemplateId) {
    state.templates = state.templates.map((t) => (t.id === id ? tmpl : t));
  } else {
    state.templates.push(tmpl);
  }
  closeModal();
  renderTemplatesGrid();
}

async function duplicateTemplate(id) {
  const tmpl = state.templates.find((t) => t.id === id);
  if (!tmpl) return;
  const copy = {
    id: uid(),
    name: `${tmpl.name} (copy)`,
    category: tmpl.category,
    type: tmpl.type,
    content: tmpl.content,
    updatedAt: Date.now(),
  };
  await dbPut("templates", copy);
  state.templates.push(copy);
  renderTemplatesGrid();
}

// Templates autosave: when editing an existing template, persist field
// changes 1.5s after the user stops typing without closing the modal.
// New (un-saved) templates are NOT autosaved — user must click Save first.
function scheduleTemplateAutosave() {
  if (!state.editingTemplateId) return;
  scheduleAutosave("template", async function () {
    const id = state.editingTemplateId;
    if (!id) return;
    const name = document.getElementById("tmpl-name").value.trim();
    const content = document.getElementById("tmpl-content").value;
    const category = getActivePill("tmpl-category-pills");
    const type = getActivePill("tmpl-type-pills");
    if (!name || !content) return; // skip incomplete autosave
    const tmpl = {
      id,
      name,
      category,
      type,
      content,
      updatedAt: Date.now(),
    };
    await dbPut("templates", tmpl);
    state.templates = state.templates.map(function (t) {
      return t.id === id ? tmpl : t;
    });
  });
}

async function deleteTemplate(id) {
  if (!confirm("Delete this template?")) return;
  await dbDelete("templates", id);
  state.templates = state.templates.filter((t) => t.id !== id);
  renderTemplatesGrid();
}

// ─── TEMPLATE VARIABLES MODAL ─────────────────────────────────────────────────
function openTemplateVarsModal() {
  // Populate built-ins section
  const proj = state.activeProject;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const builtins = [
    { key: "PROJECT_NAME", value: proj ? proj.name : "(no project active)" },
    {
      key: "PROJECT_CATEGORY",
      value: proj ? proj.category : "(no project active)",
    },
    {
      key: "PROJECT_NOTES",
      value: proj
        ? (proj.notes || "").slice(0, 60) +
          (proj.notes && proj.notes.length > 60 ? "\u2026" : "")
        : "(no project active)",
    },
    {
      key: "PROJECT_INSTRUCTIONS",
      value: proj
        ? (proj.instructions || "").slice(0, 60) +
          (proj.instructions && proj.instructions.length > 60 ? "\u2026" : "")
        : "(no project active)",
    },
    { key: "TODAY", value: today },
    { key: "TIMESTAMP", value: now.toLocaleString() },
    {
      key: "TODAY+7",
      value: _tvOffset(now, 7, "d") + "  (date arithmetic example)",
    },
    {
      key: "TODAY-7",
      value: _tvOffset(now, -7, "d") + "  (date arithmetic example)",
    },
    { key: "TODAY+2w", value: _tvOffset(now, 2, "w") + "  (weeks)" },
    { key: "TODAY+3m", value: _tvOffset(now, 3, "m") + "  (months)" },
  ];

  const builtinsList = document.getElementById("tv-builtins-list");
  builtinsList.innerHTML = builtins
    .map(function (b) {
      return (
        '<div class="tv-builtin-row" onclick="_tvInsertVar(\'' +
        b.key +
        "')\">" +
        '<span class="tv-var-chip">{{' +
        b.key +
        "}}</span>" +
        '<span class="tv-var-value">' +
        _htmlEscape(b.value) +
        "</span>" +
        '<button class="tv-insert-btn" onclick="event.stopPropagation();_tvInsertVar(\'' +
        b.key +
        '\')" type="button">Insert</button>' +
        "</div>"
      );
    })
    .join("");

  // Populate constants section
  _tvRenderConstants();

  showModal("modal-template-vars");
}

function _tvOffset(date, n, unit) {
  const d = new Date(date);
  if (unit === "m") d.setMonth(d.getMonth() + n);
  else if (unit === "w") d.setDate(d.getDate() + n * 7);
  else d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function _htmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _tvRenderConstants() {
  const constants = parseConstants(state.settings.constants || "");
  const keys = Object.keys(constants);
  const list = document.getElementById("tv-constants-list");
  if (!list) return;

  if (keys.length === 0) {
    list.innerHTML =
      '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No constants yet. Click "+ Add Constant" to create one.</div>';
    list.dataset.rows = "[]";
    return;
  }

  const rows = keys.map(function (k) {
    return { key: k, val: constants[k] };
  });
  list.dataset.rows = JSON.stringify(rows);
  _tvRenderConstantRows(rows);
}

function _tvRenderConstantRows(rows) {
  const list = document.getElementById("tv-constants-list");
  if (!list) return;
  list.innerHTML = rows
    .map(function (r, i) {
      return (
        '<div class="tv-const-row" id="tv-const-row-' +
        i +
        '">' +
        '<input class="tv-const-key" value="' +
        _htmlEscape(r.key) +
        '" placeholder="KEY" id="tv-ck-' +
        i +
        '">' +
        '<span style="color:var(--text-muted);font-size:13px">=</span>' +
        '<input class="tv-const-val" value="' +
        _htmlEscape(r.val) +
        '" placeholder="value" id="tv-cv-' +
        i +
        '">' +
        '<button class="tv-insert-btn" type="button" onclick="_tvInsertVar(document.getElementById(&#39;tv-ck-&#39;+' +
        i +
        ').value.trim().toUpperCase())">Insert</button>' +
        '<button class="tv-const-del" type="button" onclick="_tvDeleteConstantRow(' +
        i +
        ')" title="Delete">\u00d7</button>' +
        "</div>"
      );
    })
    .join("");
  list.dataset.rows = JSON.stringify(rows);
  // Wire up Insert buttons via JS to avoid quoting issues
  rows.forEach(function (r, i) {
    const row = document.getElementById("tv-const-row-" + i);
    if (!row) return;
    const insertBtn = row.querySelector(".tv-insert-btn");
    if (insertBtn) {
      insertBtn.onclick = function () {
        const keyEl = document.getElementById("tv-ck-" + i);
        if (keyEl) _tvInsertVar(keyEl.value.trim().toUpperCase());
      };
    }
  });
}

function _tvGetCurrentRows() {
  const rows = [];
  let i = 0;
  while (true) {
    const keyEl = document.getElementById("tv-ck-" + i);
    const valEl = document.getElementById("tv-cv-" + i);
    if (!keyEl) break;
    rows.push({
      key: keyEl.value.trim().toUpperCase(),
      val: valEl ? valEl.value.trim() : "",
    });
    i++;
  }
  return rows;
}

function _tvAddConstantRow() {
  const rows = _tvGetCurrentRows();
  rows.push({ key: "", val: "" });
  _tvRenderConstantRows(rows);
  // Focus the new key input
  const newIdx = rows.length - 1;
  const newEl = document.getElementById("tv-ck-" + newIdx);
  if (newEl) newEl.focus();
}

function _tvDeleteConstantRow(index) {
  const rows = _tvGetCurrentRows();
  rows.splice(index, 1);
  if (rows.length === 0) {
    const list = document.getElementById("tv-constants-list");
    if (list)
      list.innerHTML =
        '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No constants yet. Click "+ Add Constant" to create one.</div>';
  } else {
    _tvRenderConstantRows(rows);
  }
}

async function _tvSaveConstants() {
  const rows = _tvGetCurrentRows();
  const validRows = rows.filter(function (r) {
    return r.key && r.key !== "";
  });
  const text = validRows
    .map(function (r) {
      return r.key + "=" + r.val;
    })
    .join("\n");
  state.settings.constants = text;
  await dbPut("settings", { key: "constants", value: text });
  // Sync to settings modal textarea if it's open
  const ta = document.getElementById("settings-constants");
  if (ta) ta.value = text;
  // Visual feedback
  const saveBtn = document.querySelector("#modal-template-vars .btn-primary");
  if (saveBtn) {
    const orig = saveBtn.textContent;
    saveBtn.textContent = "\u2713 Saved";
    saveBtn.disabled = true;
    setTimeout(function () {
      saveBtn.textContent = orig;
      saveBtn.disabled = false;
    }, 1500);
  }
}

function _tvInsertVar(varName) {
  if (!varName) return;
  const ta = document.getElementById("tmpl-content");
  if (!ta) return;
  const insert = "{{" + varName.trim().toUpperCase() + "}}";
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + insert.length;
  ta.focus();
  // Trigger autosave
  ta.dispatchEvent(new Event("input"));
}
