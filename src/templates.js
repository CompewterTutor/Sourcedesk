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
    document.getElementById("modal-template-title").textContent =
        "New Template";
    document.getElementById("tmpl-name").value = "";
    document.getElementById("tmpl-content").value = "";
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
    document.getElementById("modal-template-title").textContent =
        "Edit Template";
    document.getElementById("tmpl-name").value = t.name;
    document.getElementById("tmpl-content").value = t.content;
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
