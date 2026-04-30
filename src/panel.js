// ─── RIGHT PANEL ──────────────────────────────────────────────────────────────
async function renderRightPanel() {
    if (!state.activeProject) return;

    // Template ref
    const tmplEl = document.getElementById("ctx-template");
    if (state.activeProject.templateId) {
        const tmpl = state.templates.find(
            (t) => t.id === state.activeProject.templateId,
        );
        if (tmpl) {
            tmplEl.innerHTML = `<div class="template-ref">
        <span style="flex:1">${tmpl.name}</span>
        <span class="tcard-btn" onclick="openFillTemplate('${tmpl.id}')">Fill</span>
        <span class="tcard-btn" onclick="viewTemplateContent('${tmpl.id}')">View</span>
      </div>`;
        }
    } else {
        tmplEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No template — <span style="color:var(--accent);cursor:pointer" onclick="promptAttachTemplate()">attach one</span></div>`;
    }

    // Project docs
    const docs = await dbGetByIndex(
        "docs",
        "projectId",
        state.activeProject.id,
    );
    const docsEl = document.getElementById("ctx-project-docs");
    docsEl.innerHTML = "";
    if (!docs.length) {
        docsEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">No docs yet — upload files to give Claude context.</div>`;
    }
    docs.forEach((doc) => {
        const active = state.activeDocs.has(doc.id);
        const el = document.createElement("div");
        el.className = `context-doc${active ? " active" : ""}`;
        el.innerHTML = `<div class="doc-toggle">${active ? "✓" : ""}</div><div class="doc-name">${doc.name}</div><span class="tcard-btn" onclick="openExtractVars('${doc.id}')" title="Extract date variables from this document" style="opacity:0.5;margin-left:4px;font-size:10px">Extract</span><span class="tcard-btn" onclick="createTemplateFromDoc('${doc.id}')" title="Create template from this document" style="opacity:0.5;margin-left:2px;font-size:10px">→Tmpl</span><span class="tcard-btn del" onclick="deleteDoc('${doc.id}',event)" style="opacity:0.5;margin-left:2px">✕</span>`;
        el.onclick = (e) => {
            if (e.target.classList.contains("tcard-btn")) return;
            toggleDoc(doc.id, el);
        };
        docsEl.appendChild(el);
    });

    // Other projects
    const otherEl = document.getElementById("ctx-other-projects");
    otherEl.innerHTML = "";
    const others = state.projects.filter(
        (p) => p.id !== state.activeProject.id,
    );
    if (!others.length) {
        otherEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No other projects yet.</div>`;
    }
    others.forEach((p) => {
        const checked = state.activeOtherProjects.has(p.id);
        const el = document.createElement("div");
        el.className = "other-project-item";
        el.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} onchange="toggleOtherProject('${p.id}', this.checked)"> <span>${p.name}</span> <span style="font-size:10px;color:var(--text-muted);font-family:DM Mono,monospace">${p.category}</span>`;
        otherEl.appendChild(el);
    });

    // Doc count
    document.getElementById("ctx-doc-count").textContent =
        `${docs.length} doc${docs.length !== 1 ? "s" : ""}`;
}

function toggleDoc(id, el) {
    if (state.activeDocs.has(id)) {
        state.activeDocs.delete(id);
        el.classList.remove("active");
        el.querySelector(".doc-toggle").textContent = "";
    } else {
        state.activeDocs.add(id);
        el.classList.add("active");
        el.querySelector(".doc-toggle").textContent = "✓";
    }
}

function toggleOtherProject(id, checked) {
    if (checked) state.activeOtherProjects.add(id);
    else state.activeOtherProjects.delete(id);
}

async function deleteDoc(id, e) {
    e.stopPropagation();
    if (!confirm("Remove this document?")) return;
    await dbDelete("docs", id);
    state.activeDocs.delete(id);
    await renderRightPanel();
}

function toggleRightPanel() {
    state.rightPanelOpen = !state.rightPanelOpen;
    document
        .getElementById("panel-right")
        .classList.toggle("collapsed", !state.rightPanelOpen);
}

// ─── DOC UPLOAD ───────────────────────────────────────────────────────────────
async function handleDocUpload(event) {
    if (!state.activeProject) return;
    const files = Array.from(event.target.files);
    for (const file of files) {
        const ext = file.name.split(".").pop().toLowerCase();
        const driveTypes = ["docx", "xlsx", "pptx"];
        let text;
        if (driveTypes.includes(ext) && state.settings.driveToken) {
            const useDrive = confirm(
                'Convert "' +
                    file.name +
                    '" via Google Docs for better text extraction? (Requires Drive connection)\n\nClick OK to convert via Google, Cancel to use basic text extraction.',
            );
            if (useDrive) {
                try {
                    text = await convertFileToDriveText(
                        file,
                        state.settings.driveToken,
                    );
                } catch (err) {
                    alert(
                        "Drive conversion failed: " +
                            err.message +
                            "\n\nFalling back to basic extraction.",
                    );
                    text = await readFileAsText(file);
                }
            } else {
                text = await readFileAsText(file);
            }
        } else {
            text = await readFileAsText(file);
        }
        const doc = {
            id: uid(),
            projectId: state.activeProject.id,
            name: file.name,
            content: text,
            uploadedAt: Date.now(),
        };
        await dbPut("docs", doc);
        state.activeDocs.add(doc.id);
    }
    event.target.value = "";
    await renderRightPanel();
}

function readFileAsText(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.onerror = () => res(`[Could not read file: ${file.name}]`);
        reader.readAsText(file);
    });
}
