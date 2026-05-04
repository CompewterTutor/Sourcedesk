// ─── EMBEDDING PROGRESS TOAST ────────────────────────────────────────────────
function _showEmbedToast(msg) {
  const el = document.getElementById("embed-progress-toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

function _hideEmbedToast() {
  const el = document.getElementById("embed-progress-toast");
  if (!el) return;
  el.style.display = "none";
}

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

  // Project docs — exclude guideline docs (managed separately in Guidelines view)
  const allDocs = await dbGetByIndex(
    "docs",
    "projectId",
    state.activeProject.id,
  );
  const docs = allDocs.filter((d) => d.docType !== "guideline");
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
    const _cm = doc.conversionMethod;
    const _badgeMap = {
      markitdown: ["MarkItDown", "var(--success)"],
      drive: ["Drive", "#4a9eff"],
      text: ["Text", "var(--text-muted)"],
    };
    const _badge =
      _cm && _badgeMap[_cm]
        ? `<span style="font-size:9px;color:${_badgeMap[_cm][1]};font-family:'DM Mono',monospace;white-space:nowrap;flex-shrink:0;margin-left:4px">${_badgeMap[_cm][0]}</span>`
        : "";
    el.innerHTML = `<div class="context-doc-row1"><div class="doc-toggle">${active ? "\u2713" : ""}</div><div class="doc-name">${doc.name}</div>${_badge}</div><div class="context-doc-row2"><span class="tcard-btn" onclick="openDocEditor('${doc.id}')">Edit</span>${doc.originalData ? `<span class="tcard-btn" onclick="reconvertDoc('${doc.id}')" title="Re-convert with MarkItDown">\u27f3</span>` : ""}<span class="tcard-btn" onclick="openExtractVars('${doc.id}')" title="Extract date variables from this document" style="opacity:0.6;font-size:10px">Extract</span><span class="tcard-btn" onclick="createTemplateFromDoc('${doc.id}')" title="Create template from this document" style="opacity:0.6;font-size:10px">\u2192Tmpl</span><span class="tcard-btn del" onclick="deleteDoc('${doc.id}',event)" style="opacity:0.6">\u2715</span></div>`;
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
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result || "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : null);
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

async function handleDocUpload(event) {
  if (!state.activeProject) return;
  const files = Array.from(event.target.files);
  const statusEl = document.getElementById("doc-upload-status");

  function _setUploadStatus(msg, color) {
    if (!statusEl) return;
    statusEl.style.display = "block";
    statusEl.style.color = color || "var(--text-muted)";
    statusEl.textContent = msg;
  }

  for (const file of files) {
    const ext = file.name.split(".").pop().toLowerCase();
    const markitdownTypes = ["docx", "xlsx", "pptx", "pdf"];
    const driveTypes = ["docx", "xlsx", "pptx"];
    let text = null;
    let conversionMethod = "text";
    let originalData = null;
    const originalMimeType = file.type || "application/octet-stream";

    // Read the original file as base64 once — reused for storage + MarkItDown
    if (markitdownTypes.includes(ext)) {
      _setUploadStatus("Reading " + file.name + "\u2026");
      try {
        originalData = await readFileAsBase64(file);
      } catch (_) {}
    }

    // ── 1. Try MarkItDown (highest quality) ──────────────────────────
    if (markitdownTypes.includes(ext) && state.settings.markitdownUrl) {
      _setUploadStatus("Converting " + file.name + " with MarkItDown\u2026");
      try {
        text = await convertWithMarkitdown(file, originalData);
        conversionMethod = "markitdown";
        _setUploadStatus(
          "\u2713 " + file.name + " converted with MarkItDown",
          "var(--success)",
        );
      } catch (err) {
        _setUploadStatus(
          "MarkItDown failed for " +
            file.name +
            " (" +
            err.message +
            "), trying fallback\u2026",
          "var(--accent)",
        );
        log(
          "markitdown conversion failed:",
          err.message,
          "\u2014 falling back",
        );
        text = null;
      }
    }

    // ── 2. Fall back to Google Drive conversion ───────────────────────
    if (!text && driveTypes.includes(ext) && state.settings.driveToken) {
      const useDrive = confirm(
        'Convert "' +
          file.name +
          '" via Google Docs for better text extraction? (Requires Drive connection)\n\nClick OK to convert via Google, Cancel to use basic text extraction.',
      );
      if (useDrive) {
        _setUploadStatus("Converting " + file.name + " via Google Drive\u2026");
        try {
          text = await convertFileToDriveText(file, state.settings.driveToken);
          conversionMethod = "drive";
          _setUploadStatus(
            "\u2713 " + file.name + " converted via Google Drive",
            "var(--success)",
          );
        } catch (err) {
          alert(
            "Drive conversion failed: " +
              err.message +
              "\n\nFalling back to basic extraction.",
          );
          text = await readFileAsText(file);
          conversionMethod = "text";
          _setUploadStatus("\u2713 " + file.name + " loaded (text extraction)");
        }
      } else {
        text = await readFileAsText(file);
        _setUploadStatus("\u2713 " + file.name + " loaded (text extraction)");
      }
    }

    // ── 3. Basic text extraction (final fallback) ─────────────────────
    if (!text) {
      if (!statusEl || statusEl.style.display === "none") {
        _setUploadStatus("Loading " + file.name + "\u2026");
      }
      text = await readFileAsText(file);
      if (conversionMethod === "text") {
        _setUploadStatus("\u2713 " + file.name + " loaded (text extraction)");
      }
    }

    const doc = {
      id: uid(),
      projectId: state.activeProject.id,
      name: file.name,
      content: text,
      originalData,
      originalMimeType,
      conversionMethod,
      uploadedAt: Date.now(),
    };
    await dbPut("docs", doc);
    state.activeDocs.add(doc.id);

    // Index embeddings if embedding model is configured
    if (state.settings.embeddingModel && state.settings.localLlmUrl) {
      const chunks = chunkText(text, 400, 60);
      const docName = doc.name;
      indexDocEmbeddings(doc.id, chunks, function (done, total) {
        _showEmbedToast(
          'Indexing "' + docName + '": ' + done + "/" + total + " chunks\u2026",
        );
      })
        .then(function () {
          _showEmbedToast('\u2713 Indexed "' + docName + '"');
          setTimeout(_hideEmbedToast, 3000);
        })
        .catch(function () {
          _hideEmbedToast();
        });
    }
  }

  event.target.value = "";
  await renderRightPanel();

  // Auto-hide status after a short delay
  if (statusEl && statusEl.style.display !== "none") {
    setTimeout(function () {
      statusEl.style.display = "none";
    }, 4000);
  }
}

/**
 * Convert a binary document (docx, xlsx, pptx, pdf, …) to Markdown using the
 * SourceDesk server's /convert endpoint, which delegates to markitdown.
 * Throws if the server is unavailable or returns an error.
 * Returns the Markdown string on success.
 */
async function convertWithMarkitdown(file, b64preread) {
  const url = (state.settings.markitdownUrl || "").replace(/\/$/, "");
  if (!url) throw new Error("markitdownUrl not set");

  const b64 = b64preread || (await readFileAsBase64(file));
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

// ─── DOC EDITOR ───────────────────────────────────────────────────────────────
async function openDocEditor(docId) {
  const doc = await dbGet("docs", docId);
  if (!doc) return;
  const modal = document.getElementById("modal-doc-editor");
  if (!modal) return;
  modal.dataset.docId = docId;

  const nameEl = document.getElementById("doc-editor-filename");
  if (nameEl) nameEl.textContent = doc.name;

  const metaEl = document.getElementById("doc-editor-meta");
  if (metaEl) {
    const methodLabel =
      {
        markitdown: "MarkItDown",
        drive: "Google Drive",
        text: "Text extraction",
      }[doc.conversionMethod] || "\u2014";
    const size = doc.content
      ? Math.round(doc.content.length / 1024) + " KB"
      : "0 KB";
    metaEl.textContent = methodLabel + " \u00b7 " + size;
  }

  const contentEl = document.getElementById("doc-editor-content");
  if (contentEl) contentEl.value = doc.content || "";

  const dlOrigBtn = document.getElementById("doc-editor-dl-original");
  if (dlOrigBtn) dlOrigBtn.style.display = doc.originalData ? "" : "none";

  const reconvertBtn = document.getElementById("doc-editor-reconvert");
  if (reconvertBtn)
    reconvertBtn.style.display =
      doc.originalData && state.settings.markitdownUrl ? "" : "none";

  showModal("modal-doc-editor");
}

async function saveDocContent() {
  const modal = document.getElementById("modal-doc-editor");
  if (!modal) return;
  const docId = modal.dataset.docId;
  if (!docId) return;
  const doc = await dbGet("docs", docId);
  if (!doc) return;
  const contentEl = document.getElementById("doc-editor-content");
  if (contentEl) doc.content = contentEl.value;
  await dbPut("docs", doc);
  closeModal();
}

async function downloadDocOriginal() {
  const modal = document.getElementById("modal-doc-editor");
  if (!modal) return;
  const docId = modal.dataset.docId;
  if (!docId) return;
  const doc = await dbGet("docs", docId);
  if (!doc || !doc.originalData) {
    alert("No original file stored for this document.");
    return;
  }
  try {
    const byteChars = atob(doc.originalData);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++)
      bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: doc.originalMimeType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Download failed: " + err.message);
  }
}

async function downloadDocMarkdown() {
  const modal = document.getElementById("modal-doc-editor");
  if (!modal) return;
  const docId = modal.dataset.docId;
  if (!docId) return;
  const doc = await dbGet("docs", docId);
  if (!doc) return;
  const contentEl = document.getElementById("doc-editor-content");
  const content = contentEl ? contentEl.value : doc.content || "";
  const filename = doc.name.replace(/\.[^.]+$/, "") + ".md";
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function reconvertDoc(docId) {
  const id =
    docId || document.getElementById("modal-doc-editor")?.dataset.docId;
  if (!id) return;
  const doc = await dbGet("docs", id);
  if (!doc) return;

  if (!doc.originalData) {
    alert(
      "No original file stored \u2014 re-upload the document to enable re-conversion.",
    );
    return;
  }
  if (!state.settings.markitdownUrl) {
    alert("MarkItDown server URL not configured in Settings.");
    return;
  }

  const statusEl = document.getElementById("doc-upload-status");
  function _setStatus(msg, color) {
    if (!statusEl) return;
    statusEl.style.display = "block";
    statusEl.style.color = color || "var(--text-muted)";
    statusEl.textContent = msg;
  }

  _setStatus("Re-converting " + doc.name + " with MarkItDown\u2026");
  try {
    const byteChars = atob(doc.originalData);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++)
      bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: doc.originalMimeType || "application/octet-stream",
    });
    const file = new File([blob], doc.name, {
      type: doc.originalMimeType || "application/octet-stream",
    });

    const markdown = await convertWithMarkitdown(file, doc.originalData);
    doc.content = markdown;
    doc.conversionMethod = "markitdown";
    await dbPut("docs", doc);

    _setStatus("\u2713 Re-converted " + doc.name, "var(--success)");
    setTimeout(function () {
      if (statusEl) statusEl.style.display = "none";
    }, 4000);

    // If the editor modal is open for this exact doc, refresh its content
    const modal = document.getElementById("modal-doc-editor");
    if (
      modal &&
      modal.dataset.docId === id &&
      !modal.classList.contains("hidden")
    ) {
      const contentEl = document.getElementById("doc-editor-content");
      if (contentEl) contentEl.value = markdown;
      const metaEl = document.getElementById("doc-editor-meta");
      if (metaEl) {
        metaEl.textContent =
          "MarkItDown \u00b7 " + Math.round(markdown.length / 1024) + " KB";
      }
    }
    await renderRightPanel();
  } catch (err) {
    _setStatus("\u2717 Re-conversion failed: " + err.message, "var(--danger)");
    setTimeout(function () {
      if (statusEl) statusEl.style.display = "none";
    }, 5000);
  }
}
