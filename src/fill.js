// ─── FILL TEMPLATE ────────────────────────────────────────────────────────────
function openFillTemplate(templateId) {
    const tmpl = state.templates.find((t) => t.id === templateId);
    if (!tmpl || tmpl.type !== "skeleton") {
        viewTemplateContent(templateId);
        return;
    }

    // Auto-resolve project vars and global constants first
    const resolved = resolveTemplateVars(tmpl.content);

    // Find which placeholders were in original but are now gone (auto-resolved)
    const origPH = [
        ...new Set(
            [...tmpl.content.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]),
        ),
    ];
    const remainPH = [
        ...new Set([...resolved.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1])),
    ];
    const autoPH = origPH.filter((p) => !remainPH.includes(p));

    // If nothing left to fill (and nothing was auto-resolved either), fall back
    if (!remainPH.length && !autoPH.length) {
        viewTemplateContent(templateId);
        return;
    }

    // If all placeholders were auto-resolved, insert directly
    if (!remainPH.length) {
        document.getElementById("chat-input").value =
            "Please help me review and complete this document:\n\n" + resolved;
        closeModal();
        document.getElementById("chat-input").focus();
        return;
    }

    document.getElementById("modal-fill-subtitle").textContent =
        'Fill in the blanks for "' + tmpl.name + '"';

    const autoEl = document.getElementById("fill-auto-resolved");
    if (autoPH.length) {
        autoEl.style.display = "block";
        autoEl.textContent =
            "Auto-filled: " + autoPH.map((p) => "{{" + p + "}}").join(", ");
    } else {
        autoEl.style.display = "none";
    }

    const fields = document.getElementById("fill-fields");
    fields.innerHTML = "";
    remainPH.forEach((ph) => {
        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML =
            '<label class="form-label">' +
            ph +
            '</label><input class="form-input" data-placeholder="' +
            ph +
            '" placeholder="Enter ' +
            ph +
            '…">';
        fields.appendChild(row);
    });
    fields.dataset.templateId = templateId;
    showModal("modal-fill");
}

function applyFill() {
    const fields = document.getElementById("fill-fields");
    const tmpl = state.templates.find(
        (t) => t.id === fields.dataset.templateId,
    );
    if (!tmpl) return;
    // Auto-resolve first, then apply manual fills
    let filled = resolveTemplateVars(tmpl.content);
    fields.querySelectorAll("[data-placeholder]").forEach((inp) => {
        const val = inp.value.trim() || "[" + inp.dataset.placeholder + "]";
        filled = filled.split("{{" + inp.dataset.placeholder + "}}").join(val);
    });
    document.getElementById("chat-input").value =
        "Please help me review and complete this document:\n\n" + filled;
    closeModal();
    document.getElementById("chat-input").focus();
}

function viewTemplateContent(templateId) {
    const tmpl = state.templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const content = resolveTemplateVars(tmpl.content);
    document.getElementById("chat-input").value =
        "I'd like to work on the \"" +
        tmpl.name +
        "\" template. Here's the content:\n\n" +
        content;
    closeModal();
    document.getElementById("chat-input").focus();
}

async function createTemplateFromDoc(docId) {
    const doc = await dbGet("docs", docId);
    if (!doc) return;
    state.editingTemplateId = null;
    document.getElementById("modal-template-title").textContent =
        "New Template from Document";
    // Strip file extension from name for template name default
    document.getElementById("tmpl-name").value = doc.name.replace(
        /\.[^.]+$/,
        "",
    );
    document.getElementById("tmpl-content").value = doc.content;
    selectPillByVal(
        "tmpl-category-pills",
        state.activeProject ? state.activeProject.category : "Other",
    );
    selectPillByVal("tmpl-type-pills", "skeleton");
    showModal("modal-template");
}

async function openExtractVars(docId) {
    const doc = await dbGet("docs", docId);
    if (!doc) return;
    const items = extractVarsFromText(doc.content);
    document.getElementById("modal-extract-title").textContent =
        'Variables detected in "' + doc.name + '"';
    const listEl = document.getElementById("extract-vars-list");
    listEl.innerHTML = "";
    if (!items.length) {
        listEl.innerHTML =
            '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">No variables detected in this document.</div>';
    } else {
        items.forEach(function (item) {
            const row = document.createElement("div");
            row.style.cssText =
                "display:flex;align-items:center;gap:8px;margin-bottom:6px";
            const badge =
                '<span style="background:var(--accent-dim,#2a2925);color:var(--text-dim);font-size:10px;padding:2px 5px;border-radius:3px">' +
                item.type +
                "</span>";
            row.innerHTML =
                '<input type="checkbox" checked style="flex-shrink:0;accent-color:var(--accent)">' +
                '<input class="form-input" style="width:140px;font-family:DM Mono,monospace;font-size:12px" value="' +
                item.suggestedKey.replace(/"/g, "&quot;") +
                '" data-value="' +
                item.value.replace(/"/g, "&quot;") +
                '">' +
                badge +
                '<span style="font-size:12px;color:var(--text-dim);font-family:DM Mono,monospace;flex:1">' +
                item.value +
                "</span>";
            listEl.appendChild(row);
        });
    }
    showModal("modal-extract-vars");
}

async function saveExtractedVars() {
    const listEl = document.getElementById("extract-vars-list");
    const newPairs = [];
    listEl.querySelectorAll("div").forEach(function (row) {
        const cb = row.querySelector('input[type="checkbox"]');
        const keyInput = row.querySelector("input.form-input");
        if (cb && cb.checked && keyInput) {
            const k = keyInput.value.trim().toUpperCase().replace(/\s+/g, "_");
            const v = keyInput.dataset.value || "";
            if (k && v) newPairs.push(k + "=" + v);
        }
    });
    if (!newPairs.length) {
        closeModal();
        return;
    }
    const existing = (state.settings.constants || "").trim();
    const merged = existing
        ? existing + "\n" + newPairs.join("\n")
        : newPairs.join("\n");
    state.settings.constants = merged;
    await dbPut("settings", { key: "constants", value: merged });
    const ta = document.getElementById("settings-constants");
    if (ta) ta.value = merged;
    closeModal();
}

function previewTemplateVars() {
    const content = document.getElementById("tmpl-content").value;
    if (!content.trim()) {
        alert("Enter some template content to preview.");
        return;
    }
    const resolved = resolveTemplateVars(content);
    document.getElementById("tmpl-preview-content").value = resolved;
    document.getElementById("tmpl-preview-panel").style.display = "block";
}
function togglePreviewPanel() {
    document.getElementById("tmpl-preview-panel").style.display = "none";
}

function promptAttachTemplate() {
    openNewProject();
}
