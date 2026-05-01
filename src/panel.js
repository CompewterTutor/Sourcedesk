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
  const docs = await dbGetByIndex("docs", "projectId", state.activeProject.id);
  const docsEl = document.getElementById("ctx-project-docs");
  docsEl.innerHTML = "";
  if (!docs.length) {
    docsEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">No docs yet — upload files to give Claude context.</div>`;
  }
  docs.forEach((doc) => {
    const active = state.activeDocs.has(doc.id);
    const el = document.createElement("div");
    el.className = `context-doc${active ? " active" : ""}`;
    el.title = doc.name;
    el.innerHTML = `<div class="context-doc-row1"><div class="doc-toggle">${active ? "\u2713" : ""}</div><div class="doc-name">${doc.name}</div></div><div class="context-doc-row2"><span class="tcard-btn" onclick="openExtractVars('${doc.id}')" title="Extract date variables from this document" style="opacity:0.6;font-size:10px">Extract</span><span class="tcard-btn" onclick="createTemplateFromDoc('${doc.id}')" title="Create template from this document" style="opacity:0.6;font-size:10px">→Tmpl</span><span class="tcard-btn del" onclick="deleteDoc('${doc.id}',event)" style="opacity:0.6">✕</span></div>`;
    el.onclick = (e) => {
      if (e.target.classList.contains("tcard-btn")) return;
      toggleDoc(doc.id, el);
    };
    docsEl.appendChild(el);
  });

  // Other projects
  const otherEl = document.getElementById("ctx-other-projects");
  otherEl.innerHTML = "";
  const others = state.projects.filter((p) => p.id !== state.activeProject.id);
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
    // File types markitdown handles well
    const markitdownTypes = ["docx", "xlsx", "pptx", "pdf"];
    // File types Google Drive can convert
    const driveTypes = ["docx", "xlsx", "pptx"];
    let text = null;

    // ── 1. Try markitdown (highest quality, no external account needed) ──
    if (markitdownTypes.includes(ext) && state.settings.markitdownUrl) {
      try {
        text = await convertWithMarkitdown(file);
      } catch (err) {
        log("markitdown conversion failed:", err.message, "— falling back");
        text = null;
      }
    }

    // ── 2. Fall back to Google Drive conversion ──────────────────────────
    if (!text && driveTypes.includes(ext) && state.settings.driveToken) {
      const useDrive = confirm(
        'Convert "' +
          file.name +
          '" via Google Docs for better text extraction? (Requires Drive connection)\n\nClick OK to convert via Google, Cancel to use basic text extraction.',
      );
      if (useDrive) {
        try {
          text = await convertFileToDriveText(file, state.settings.driveToken);
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
    }

    // ── 3. Basic text extraction (final fallback) ────────────────────────
    if (!text) text = await readFileAsText(file);

    const doc = {
      id: uid(),
      projectId: state.activeProject.id,
      name: file.name,
      content: text,
      uploadedAt: Date.now(),
    };
    await dbPut("docs", doc);
    state.activeDocs.add(doc.id);
    // Index embeddings if embedding model is configured
    if (state.settings.embeddingModel && state.settings.localLlmUrl) {
      const chunks = chunkText(text, 400, 60);
      indexDocEmbeddings(doc.id, chunks).catch(() => {});
    }
  }
  event.target.value = "";
  await renderRightPanel();
}

/**
 * Convert a binary document (docx, xlsx, pptx, pdf, …) to Markdown using the
 * SourceDesk server's /convert endpoint, which delegates to markitdown.
 * Throws if the server is unavailable or returns an error.
 * Returns the Markdown string on success.
 */
async function convertWithMarkitdown(file) {
  const url = (state.settings.markitdownUrl || "").replace(/\/$/, "");
  if (!url) throw new Error("markitdownUrl not set");

  // Read the file as base64 via FileReader
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // result = "data:<mime>;base64,<data>"
      const parts = (e.target.result || "").split(",");
      resolve(parts[1] || null);
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
  if (!b64) throw new Error("Could not read file as base64");

  const resp = await fetch(url + "/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, data: b64 }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => "HTTP " + resp.status);
    throw new Error(msg);
  }
  const markdown = await resp.text();
  if (!markdown.trim()) throw new Error("Empty conversion result");
  return markdown;
}

function readFileAsText(file) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = () => res(`[Could not read file: ${file.name}]`);
    reader.readAsText(file);
  });
}
