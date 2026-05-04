// ─── POSITION GUIDELINES & RESPONSIBILITIES PARSER ───────────────────────────
// Per-project guideline documents (job descriptions, SOPs, org charts).
// Stored in the `docs` store with `docType: 'guideline'`.
// Excluded from default chat context and not shown in the right-side panel.

let _currentGuideline = null;
let _currentAnalysisId = null; // ID of currently viewed analysis
let _projectAnalyses = []; // in-memory cache of analyses for active project

// ─── LOAD & RENDER LIST ───────────────────────────────────────────────────────

async function loadGuidelines() {
  if (!state.activeProject) return;
  _currentGuideline = null;
  _currentAnalysisId = null;

  const allDocs = await dbGetByIndex(
    "docs",
    "projectId",
    state.activeProject.id,
  );
  const docs = allDocs.filter(function (d) {
    return d.docType === "guideline";
  });
  docs.sort(function (a, b) {
    return (b.uploadedAt || 0) - (a.uploadedAt || 0);
  });
  renderGuidelinesList(docs);

  // Load saved analyses
  try {
    _projectAnalyses = await dbGetByIndex(
      "guidelineAnalyses",
      "projectId",
      state.activeProject.id,
    );
  } catch (e) {
    _projectAnalyses = [];
  }
  _renderAnalysisBar();

  // Reset action bar
  const nameEl = document.getElementById("guidelines-selected-name");
  if (nameEl) {
    nameEl.textContent = "Upload a guideline doc, then click Analyze.";
    nameEl.style.fontWeight = "";
    nameEl.style.color = "var(--text-muted)";
  }
  const thisBtn = document.getElementById("guidelines-analyze-this-btn");
  if (thisBtn) thisBtn.style.display = "none";

  // Content area: auto-select most recent analysis, or show empty state
  const contentEl = document.getElementById("guidelines-content-area");
  if (_projectAnalyses.length) {
    const sorted = _projectAnalyses.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    selectGuidelineAnalysis(sorted[0].id);
  } else if (contentEl) {
    contentEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;text-align:center;line-height:1.6">' +
      "Upload a position description or SOP,<br>then click <b>\uD83E\uDD16 Analyze All</b>.</div>";
  }
}

function renderGuidelinesList(docs) {
  const list = document.getElementById("guidelines-list");
  if (!list) return;
  list.innerHTML = "";
  if (!docs || docs.length === 0) {
    list.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic">No guideline documents yet.<br>Upload a job description or SOP.</div>';
    return;
  }
  docs.forEach(function (doc) {
    const el = document.createElement("div");
    el.className =
      "sq-item" +
      (_currentGuideline && _currentGuideline.id === doc.id ? " active" : "");
    el.dataset.guidelineId = doc.id;

    const date = doc.uploadedAt
      ? new Date(doc.uploadedAt).toLocaleDateString()
      : "";
    const sizeKb = doc.content ? Math.round(doc.content.length / 1024) : 0;

    const _cm = doc.conversionMethod;
    const _badgeMap = {
      markitdown: ["MarkItDown", "var(--success)"],
      drive: ["Drive", "#4a9eff"],
      text: ["Text", "var(--text-muted)"],
    };
    const _badge =
      _cm && _badgeMap[_cm]
        ? ' <span style="font-size:9px;color:' +
          _badgeMap[_cm][1] +
          ";font-family:'DM Mono',monospace\">" +
          _badgeMap[_cm][0] +
          "</span>"
        : "";
    el.innerHTML =
      '<span class="sq-item-icon" style="font-size:14px">\uD83D\uDCC4</span>' +
      '<div class="sq-item-text" style="flex:1;min-width:0">' +
      '<div style="font-size:12px;color:var(--text);font-weight:500;word-break:break-word">' +
      (doc.name || "Untitled").replace(/</g, "&lt;") +
      _badge +
      "</div>" +
      '<div style="font-size:11px;color:var(--text-muted)">' +
      date +
      (sizeKb ? " \u00b7 " + sizeKb + " KB" : "") +
      "</div>" +
      "</div>" +
      '<button class="btn-ghost" style="font-size:11px;padding:2px 6px;flex-shrink:0" onclick="event.stopPropagation();openDocEditor(\'' +
      doc.id +
      '\')" title="Edit / view markdown">\u270E</button>' +
      '<button class="btn-ghost" style="font-size:11px;padding:2px 6px;flex-shrink:0" onclick="event.stopPropagation();deleteGuideline(\'' +
      doc.id +
      '\')" title="Remove">\u2715</button>';

    el.onclick = function () {
      selectGuideline(doc.id);
    };
    list.appendChild(el);
  });
}

// ─── SELECT & DETAIL ─────────────────────────────────────────────────────────

async function selectGuideline(id) {
  const doc = await dbGet("docs", id);
  if (!doc) return;
  _currentGuideline = doc;

  document.querySelectorAll("#guidelines-list .sq-item").forEach(function (el) {
    el.classList.toggle("active", el.dataset.guidelineId === id);
  });

  // Update action bar
  const nameEl = document.getElementById("guidelines-selected-name");
  if (nameEl) {
    nameEl.textContent = doc.name || "Untitled";
    nameEl.style.fontWeight = "600";
    nameEl.style.color = "var(--text)";
  }
  const thisBtn = document.getElementById("guidelines-analyze-this-btn");
  if (thisBtn) thisBtn.style.display = "";

  // Only show doc preview if no analysis is currently being viewed
  if (!_currentAnalysisId) {
    _showDocPreview(doc);
  }
}

function _showDocPreview(doc) {
  const contentEl = document.getElementById("guidelines-content-area");
  if (!contentEl) return;
  const PREVIEW_LEN = 2000;
  const raw = doc.content || "";
  const preview = raw.slice(0, PREVIEW_LEN).replace(/</g, "&lt;");
  const remaining = raw.length - PREVIEW_LEN;
  contentEl.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
    '<span style="font-size:11px;color:var(--text-muted)">Document preview</span>' +
    '<button class="btn-ghost" style="font-size:11px;padding:2px 8px" onclick="openDocEditor(\'' +
    doc.id +
    '\')" title="View and edit full markdown">\u270e View / Edit</button>' +
    "</div>" +
    '<div style="color:var(--text-dim);font-size:12px;white-space:pre-wrap;line-height:1.6;max-height:340px;overflow-y:auto;padding:10px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--surface2)">' +
    preview +
    (remaining > 0
      ? '\n\n<span style="color:var(--text-muted)">\u2026 ' +
        remaining +
        " more characters \u2014 click \u270e View / Edit to see all</span>"
      : "") +
    "</div>" +
    '<div style="margin-top:12px;font-size:12px;color:var(--text-muted)">Click <b>\uD83E\uDD16 Analyze All</b> to analyze all uploaded guideline documents.</div>';
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────

async function handleGuidelineUpload(event) {
  if (!state.activeProject) return;
  const files = Array.from(event.target.files);
  const statusEl = document.getElementById("guidelines-upload-status");

  function _setStatus(msg, color) {
    if (!statusEl) return;
    statusEl.style.display = "block";
    statusEl.style.color = color || "var(--text-muted)";
    statusEl.textContent = msg;
  }

  for (const file of files) {
    const ext = file.name.split(".").pop().toLowerCase();
    const markitdownTypes = ["docx", "xlsx", "pptx", "pdf"];
    let text = null;
    let conversionMethod = "text";
    let originalData = null;
    const originalMimeType = file.type || "application/octet-stream";

    // Read original as base64 once — reused for storage and MarkItDown
    if (markitdownTypes.includes(ext)) {
      _setStatus("Reading " + file.name + "\u2026");
      try {
        originalData = await readFileAsBase64(file);
      } catch (_) {}
    }

    // Try MarkItDown
    if (markitdownTypes.includes(ext) && state.settings.markitdownUrl) {
      _setStatus("Converting " + file.name + " with MarkItDown\u2026");
      try {
        text = await convertWithMarkitdown(file, originalData);
        conversionMethod = "markitdown";
        _setStatus(
          "\u2713 " + file.name + " converted with MarkItDown",
          "var(--success)",
        );
      } catch (err) {
        _setStatus(
          "MarkItDown failed (" +
            err.message +
            "), using text extraction\u2026",
          "var(--accent)",
        );
        log("guideline markitdown failed:", err.message);
        text = null;
      }
    }

    // Fallback — basic text extraction
    if (!text) {
      if (conversionMethod === "text")
        _setStatus("Loading " + file.name + "\u2026");
      text = await readFileAsText(file);
      if (conversionMethod === "text")
        _setStatus("\u2713 " + file.name + " loaded (text extraction)");
    }
    if (!text) text = "[Could not read file: " + file.name + "]";

    const doc = {
      id: uid(),
      projectId: state.activeProject.id,
      name: file.name,
      content: text,
      originalData,
      originalMimeType,
      conversionMethod,
      docType: "guideline",
      uploadedAt: Date.now(),
    };
    await dbPut("docs", doc);
    // Deliberately NOT adding to state.activeDocs — guidelines are excluded from chat context
  }

  event.target.value = "";
  await loadGuidelines();

  if (statusEl && statusEl.style.display !== "none") {
    setTimeout(function () {
      statusEl.style.display = "none";
    }, 4000);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function deleteGuideline(id) {
  if (!confirm("Remove this guideline document?")) return;
  await dbDelete("docs", id);
  if (_currentGuideline && _currentGuideline.id === id) {
    _currentGuideline = null;
    _currentAnalysisId = null;
    const nameEl = document.getElementById("guidelines-selected-name");
    if (nameEl) {
      nameEl.textContent = "Upload a guideline doc, then click Analyze.";
      nameEl.style.fontWeight = "";
      nameEl.style.color = "var(--text-muted)";
    }
    const thisBtn = document.getElementById("guidelines-analyze-this-btn");
    if (thisBtn) thisBtn.style.display = "none";
    const contentEl = document.getElementById("guidelines-content-area");
    if (contentEl)
      contentEl.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;text-align:center;line-height:1.6">' +
        "Upload a position description or SOP,<br>then click <b>\uD83E\uDD16 Analyze All</b>.</div>";
  }
  await loadGuidelines();
}

// ─── ANALYZE ─────────────────────────────────────────────────────────────────

function openGuidelinesAnalyze() {
  const contentEl = document.getElementById("guidelines-content-area");
  if (contentEl)
    contentEl.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">\uD83E\uDD16 Analyzing\u2026 this may take a moment.</div>';

  _runAnalyze(null).catch(function (err) {
    if (contentEl)
      contentEl.innerHTML =
        '<div style="padding:16px;color:var(--danger);font-size:12px">\u274c Analysis failed: ' +
        (err.message || String(err)).replace(/</g, "&lt;") +
        "</div>";
  });
}

async function _runAnalyze(docIdsFilter) {
  if (!state.activeProject) return;

  const allDocs = await dbGetByIndex(
    "docs",
    "projectId",
    state.activeProject.id,
  );
  let guidelines = allDocs.filter(function (d) {
    return d.docType === "guideline";
  });

  if (docIdsFilter) {
    guidelines = guidelines.filter(function (d) {
      return docIdsFilter.indexOf(d.id) !== -1;
    });
  }

  if (!guidelines.length) {
    alert("Upload at least one guideline document first.");
    return;
  }

  // Build combined text, capped at 8000 chars
  let combined = "";
  for (const g of guidelines) {
    const header = "\n\n### " + (g.name || "Document") + "\n";
    const remaining = 8000 - combined.length - header.length;
    if (remaining <= 0) break;
    combined += header + (g.content || "").slice(0, remaining);
  }

  const docIds = guidelines.map(function (g) {
    return g.id;
  });
  const docNames = guidelines.map(function (g) {
    return g.name || "";
  });

  const systemPrompt =
    "You are a procurement and operations analyst. Extract structured information from the provided position/guideline documents. Respond ONLY with a JSON object wrapped in a ```json code fence.";

  const userPrompt =
    "Here are the guideline/position documents for this project:\n" +
    combined +
    "\n\nExtract and return a JSON object with this exact shape:\n" +
    "```json\n{\n" +
    '  "responsibilities": ["string", ...],\n' +
    '  "recommended_tasks": [{"title": "string", "description": "string", "priority": "low|medium|high"}, ...],\n' +
    '  "recommended_templates": [{"name": "string", "description": "string"}, ...],\n' +
    '  "procurement_categories": ["string", ...],\n' +
    '  "reminders": [{"title": "string", "offset_days": 0, "description": "string"}, ...]\n' +
    "}\n```\nReturn only the JSON object. Do not include any other text outside the code fence.";

  const apiCall = buildApiCall(systemPrompt, [
    { role: "user", content: userPrompt },
  ]);

  // Non-streaming — handle both direct and proxy-envelope bodies
  const bodyObj = JSON.parse(apiCall.body);
  if (typeof bodyObj.body === "string") {
    const innerBody = JSON.parse(bodyObj.body);
    innerBody.stream = false;
    bodyObj.body = JSON.stringify(innerBody);
  } else {
    bodyObj.stream = false;
  }
  const nonStreamBody = JSON.stringify(bodyObj);

  const resp = await fetch(apiCall.url, {
    method: "POST",
    headers: apiCall.headers,
    body: nonStreamBody,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(function () {
      return "HTTP " + resp.status;
    });
    throw new Error("API error: " + errText);
  }

  const data = await resp.json();
  const provider = state.settings.provider || "anthropic";
  const rawText =
    provider === "anthropic"
      ? (data.content && data.content[0] && data.content[0].text) || ""
      : (data.choices &&
          data.choices[0] &&
          data.choices[0].message &&
          data.choices[0].message.content) ||
        "";

  const recs = _extractGuidelinesJson(rawText);
  if (!recs)
    throw new Error(
      "Could not parse JSON from model response.\n\nRaw response:\n" +
        rawText.slice(0, 400),
    );

  // Auto-save the analysis result
  const saved = await _saveGuidelineAnalysis(recs, docIds, docNames, false, []);
  _currentAnalysisId = saved.id;
  _renderGuidelineRecommendations(recs, saved);
}

// ─── OPEN ANALYZE (entry point from HTML onclick) ─────────────────────────────

function _extractGuidelinesJson(text) {
  // Try ```json ... ``` fence first
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {}
  }
  // Fall back to first { ... last }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch (e) {}
  }
  return null;
}

// ─── RENDER RECOMMENDATIONS ─────────────────────────────────────────────────────────────────

function _renderGuidelineRecommendations(recs, meta) {
  const el = document.getElementById("guidelines-content-area");
  if (!el) return;
  let html = "";

  // Meta header — shown when viewing a saved analysis
  if (meta) {
    const modelLabel = meta.isMaster
      ? "\u2B50 Master Analysis"
      : "\uD83E\uDD16 " + _gaModelShort(meta.model || "");
    const dateStr = meta.createdAt
      ? new Date(meta.createdAt).toLocaleString()
      : "";
    const docsStr = (meta.docNames || []).join(", ") || "All documents";
    html +=
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);flex-wrap:wrap;margin-bottom:4px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--text)">' +
      modelLabel.replace(/</g, "&lt;") +
      "</span>" +
      '<span style="font-size:11px;color:var(--text-muted)">' +
      dateStr +
      "</span>" +
      '<span style="font-size:11px;color:var(--text-muted);flex:1;min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' +
      docsStr.replace(/"/g, "&quot;") +
      '">' +
      docsStr.replace(/</g, "&lt;") +
      "</span>" +
      '<span id="ga-rec-label" style="font-size:11px;color:var(--accent-dim);cursor:pointer;padding:1px 5px;border-radius:3px;border:1px solid var(--border)" onclick="this.style.display=\'none\';var i=document.getElementById(\'ga-rec-label-input\');i.style.display=\'\';i.focus()" title="Click to edit label">' +
      (meta.label
        ? meta.label.replace(/</g, "&lt;")
        : '<span style="opacity:0.4">+ label</span>') +
      "</span>" +
      '<input id="ga-rec-label-input" type="text" class="form-input" style="display:none;font-size:11px;padding:1px 6px;width:130px" value="' +
      (meta.label || "").replace(/"/g, "&quot;") +
      '" placeholder="Add label\u2026" onblur="_gaSaveAnalysisLabel(\'' +
      meta.id +
      "')\" onkeydown=\"if(event.key==='Enter')_gaSaveAnalysisLabel('" +
      meta.id +
      "');if(event.key==='Escape'){this.style.display='none';document.getElementById('ga-rec-label').style.display='';}}\">" +
      (meta.isMaster
        ? '<button class="btn-ghost" style="font-size:11px;padding:2px 8px" onclick="openGAVersionHistory(\'' +
          meta.id +
          "')\">" +
          "\uD83D\uDCCB History</button>"
        : "") +
      '<button class="btn-ghost" style="font-size:11px;padding:2px 8px" onclick="_openGACompareModal(\'' +
      meta.id +
      "')\">" +
      "\uD83D\uDCCA Compare</button>" +
      "</div>";
  }

  if (recs.responsibilities && recs.responsibilities.length) {
    html +=
      '<div class="guidelines-section">' +
      '<div class="guidelines-section-title">📋 Key Responsibilities</div>' +
      '<ul style="margin:6px 0 0 18px;padding:0;display:flex;flex-direction:column;gap:4px">' +
      recs.responsibilities
        .map(function (r) {
          return (
            '<li style="font-size:12px;color:var(--text-dim);line-height:1.5">' +
            String(r).replace(/</g, "&lt;") +
            "</li>"
          );
        })
        .join("") +
      "</ul></div>";
  }

  if (recs.recommended_tasks && recs.recommended_tasks.length) {
    html +=
      '<div class="guidelines-section">' +
      '<div class="guidelines-section-title">✅ Recommended Tasks</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">' +
      recs.recommended_tasks
        .map(function (t, i) {
          const pColor =
            t.priority === "high"
              ? "var(--danger)"
              : t.priority === "low"
                ? "var(--text-muted)"
                : "var(--accent)";
          return (
            '<div class="guidelines-card" data-task-index="' +
            i +
            '">' +
            '<div style="display:flex;align-items:flex-start;gap:8px">' +
            '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text)">' +
            String(t.title || "").replace(/</g, "&lt;") +
            "</div>" +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
            String(t.description || "").replace(/</g, "&lt;") +
            "</div>" +
            "</div>" +
            '<span style="font-size:10px;background:var(--surface2);color:' +
            pColor +
            ';padding:2px 8px;border-radius:8px;white-space:nowrap;flex-shrink:0">' +
            (t.priority || "medium") +
            "</span>" +
            "</div>" +
            '<button class="btn-secondary" style="margin-top:6px;font-size:11px;padding:3px 10px" onclick="_guidelineCreateTask(' +
            _guidelineJsonAttr(t) +
            ', this)">+ Create Task</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div></div>";
  }

  if (recs.recommended_templates && recs.recommended_templates.length) {
    html +=
      '<div class="guidelines-section">' +
      '<div class="guidelines-section-title">📄 Recommended Templates</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">' +
      recs.recommended_templates
        .map(function (t) {
          return (
            '<div class="guidelines-card">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text)">' +
            String(t.name || "").replace(/</g, "&lt;") +
            "</div>" +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
            String(t.description || "").replace(/</g, "&lt;") +
            "</div>" +
            '<button class="btn-secondary" style="margin-top:6px;font-size:11px;padding:3px 10px" onclick="_guidelineCreateTemplate(' +
            _guidelineJsonAttr(t) +
            ', this)">+ Create Template</button>' +
            "</div>"
          );
        })
        .join("") +
      "</div></div>";
  }

  if (recs.procurement_categories && recs.procurement_categories.length) {
    html +=
      '<div class="guidelines-section">' +
      '<div class="guidelines-section-title">🏷 Procurement Categories</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' +
      recs.procurement_categories
        .map(function (c) {
          return (
            '<span style="font-size:11px;background:var(--surface2);color:var(--text-dim);padding:3px 10px;border-radius:12px;border:1px solid var(--border)">' +
            String(c).replace(/</g, "&lt;") +
            "</span>"
          );
        })
        .join("") +
      "</div></div>";
  }

  if (recs.reminders && recs.reminders.length) {
    html +=
      '<div class="guidelines-section">' +
      '<div class="guidelines-section-title">⏰ Reminders</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">' +
      recs.reminders
        .map(function (r) {
          const days =
            r.offset_days != null
              ? " (in " +
                r.offset_days +
                " day" +
                (r.offset_days === 1 ? "" : "s") +
                ")"
              : "";
          return (
            '<div style="font-size:12px;color:var(--text-dim);padding:6px 10px;background:var(--surface2);border-radius:var(--radius);line-height:1.5">' +
            '<span style="font-weight:600">' +
            String(r.title || "").replace(/</g, "&lt;") +
            "</span>" +
            '<span style="color:var(--text-muted)">' +
            days +
            "</span>" +
            (r.description
              ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
                String(r.description).replace(/</g, "&lt;") +
                "</div>"
              : "") +
            "</div>"
          );
        })
        .join("") +
      "</div></div>";
  }

  if (!html) {
    html =
      '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">No recommendations extracted. Try uploading a more detailed position description.</div>';
  }

  el.innerHTML = html;
}

// Safely encode a small object for inline onclick attribute usage.
// Serializes to JSON and base64-encodes to avoid quote escaping issues.
// The onclick calls _guidelineCreateTask(decoded, btn) using the index approach instead.
// Actually: just JSON-encode and HTML-escape the attribute value.
function _guidelineJsonAttr(obj) {
  return (
    "JSON.parse(atob('" +
    btoa(unescape(encodeURIComponent(JSON.stringify(obj)))) +
    "'))"
  );
}

// ─── CREATE TASK ─────────────────────────────────────────────────────────────

async function _guidelineCreateTask(task, btn) {
  if (!state.activeProject) return;
  const record = {
    id: uid(),
    projectId: state.activeProject.id,
    title: task.title || "New Task",
    description: task.description || "",
    status: "todo",
    priority: task.priority || "medium",
    dueDate: "",
    includeInContext: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await dbPut("tasks", record);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "✓ Added";
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = orig;
      btn.disabled = false;
    }, 2000);
  }
}

// ─── CREATE TEMPLATE ─────────────────────────────────────────────────────────

async function _guidelineCreateTemplate(tmpl, btn) {
  const record = {
    id: uid(),
    name: tmpl.name || "New Template",
    category: "Other",
    type: "skeleton",
    content:
      "# " +
      (tmpl.name || "New Template") +
      "\n\n" +
      (tmpl.description || "") +
      "\n\n{{PLACEHOLDER}}",
    updatedAt: Date.now(),
  };
  await dbPut("templates", record);
  state.templates.push(record);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "\u2713 Added";
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = orig;
      btn.disabled = false;
    }, 2000);
  }
}

// ─── ANALYSIS PERSISTENCE & VERSIONING ─────────────────────────────────────────────────

function analyzeThisGuideline() {
  if (!_currentGuideline) {
    alert("Select a guideline document first.");
    return;
  }
  const contentEl = document.getElementById("guidelines-content-area");
  if (contentEl)
    contentEl.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">\uD83E\uDD16 Analyzing\u2026 this may take a moment.</div>';
  _runAnalyze([_currentGuideline.id]).catch(function (err) {
    if (contentEl)
      contentEl.innerHTML =
        '<div style="padding:16px;color:var(--danger);font-size:12px">\u274c Analysis failed: ' +
        (err.message || String(err)).replace(/</g, "&lt;") +
        "</div>";
  });
}

async function _saveGuidelineAnalysis(
  results,
  docIds,
  docNames,
  isMaster,
  sourceIds,
) {
  if (!state.activeProject) return null;
  const now = Date.now();
  const prefix = isMaster ? "Master" : "Analysis";
  const countOfType = (_projectAnalyses || []).filter(function (a) {
    return !!a.isMaster === !!isMaster;
  }).length;
  const label = prefix + " " + (countOfType + 1);
  const rec = {
    id: uid(),
    projectId: state.activeProject.id,
    label: label,
    provider: state.settings.provider || "anthropic",
    model: state.settings.model || "",
    docIds: docIds || [],
    docNames: docNames || [],
    results: results,
    isMaster: isMaster || false,
    sourceIds: sourceIds || [],
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
  await dbPut("guidelineAnalyses", rec);
  _projectAnalyses = (_projectAnalyses || []).filter(function (a) {
    return a.id !== rec.id;
  });
  _projectAnalyses.push(rec);
  _renderAnalysisBar();
  return rec;
}

function _renderAnalysisBar() {
  const bar = document.getElementById("guidelines-analysis-bar");
  const chips = document.getElementById("guidelines-analysis-chips");
  if (!bar || !chips) return;
  if (!_projectAnalyses || !_projectAnalyses.length) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
  chips.innerHTML = "";
  const sorted = _projectAnalyses.slice().sort(function (a, b) {
    if (a.isMaster && !b.isMaster) return -1;
    if (!a.isMaster && b.isMaster) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  sorted.forEach(function (a) {
    const chip = document.createElement("div");
    chip.className = "ga-chip" + (_currentAnalysisId === a.id ? " active" : "");
    chip.dataset.analysisId = a.id;
    const modelName = a.isMaster
      ? "\u2B50 Master"
      : _gaModelShort(a.model || "");
    chip.innerHTML =
      '<span style="font-weight:600">' +
      modelName.replace(/</g, "&lt;") +
      "</span>" +
      '<span style="color:var(--text-muted);font-size:10px">' +
      _gaRelTime(a.createdAt) +
      "</span>" +
      ((a.docIds || []).length > 1
        ? '<span style="color:var(--text-muted);font-size:10px">' +
          (a.docIds || []).length +
          " docs</span>"
        : "") +
      (a.label
        ? '<span style="color:var(--accent-dim);font-size:10px;max-width:80px;overflow:hidden;text-overflow:ellipsis">' +
          a.label.replace(/</g, "&lt;") +
          "</span>"
        : "") +
      '<span class="ga-chip-del" onclick="event.stopPropagation();deleteGuidelineAnalysis(\'' +
      a.id +
      '\')" title="Delete">\u2715</span>';
    chip.onclick = function () {
      selectGuidelineAnalysis(a.id);
    };
    chips.appendChild(chip);
  });
}

function selectGuidelineAnalysis(id) {
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === id;
  });
  if (!analysis) return;
  _currentAnalysisId = id;
  _renderAnalysisBar();
  _renderGuidelineRecommendations(analysis.results, analysis);
}

async function deleteGuidelineAnalysis(id) {
  if (!confirm("Delete this saved analysis?")) return;
  await dbDelete("guidelineAnalyses", id);
  _projectAnalyses = (_projectAnalyses || []).filter(function (a) {
    return a.id !== id;
  });
  if (_currentAnalysisId === id) {
    _currentAnalysisId = null;
    if (_currentGuideline) {
      _showDocPreview(_currentGuideline);
    } else {
      const contentEl = document.getElementById("guidelines-content-area");
      if (contentEl)
        contentEl.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;text-align:center;line-height:1.6">Upload a position description or SOP,<br>then click <b>\uD83E\uDD16 Analyze All</b>.</div>';
    }
  }
  _renderAnalysisBar();
}

function openCreateMasterAnalysis() {
  const listEl = document.getElementById("ga-master-analysis-list");
  const statusEl = document.getElementById("ga-master-status");
  const runBtn = document.getElementById("ga-master-run-btn");
  if (listEl) {
    const nonMaster = (_projectAnalyses || []).filter(function (a) {
      return !a.isMaster;
    });
    if (!nonMaster.length) {
      listEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px;padding:12px;text-align:center">No saved analyses yet. Run an analysis first.</div>';
    } else {
      listEl.innerHTML = "";
      nonMaster
        .slice()
        .sort(function (a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        })
        .forEach(function (a) {
          const row = document.createElement("label");
          row.style.cssText =
            "display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:6px 8px;border-radius:var(--radius);background:var(--surface2);font-size:12px;color:var(--text)";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = true;
          cb.dataset.analysisId = a.id;
          cb.style.flexShrink = "0";
          cb.style.marginTop = "2px";
          const info = document.createElement("div");
          info.innerHTML =
            '<span style="font-weight:600">' +
            _gaModelShort(a.model || "").replace(/</g, "&lt;") +
            "</span> \u00b7 " +
            '<span style="color:var(--text-muted)">' +
            _gaRelTime(a.createdAt) +
            "</span>" +
            (a.label
              ? " \u00b7 <span style=\"color:var(--accent-dim)\">' + a.label.replace(/</g, '&lt;') + '</span>"
              : "") +
            '<br><span style="font-size:11px;color:var(--text-muted)">' +
            (a.docNames || []).join(", ").replace(/</g, "&lt;") +
            "</span>";
          row.appendChild(cb);
          row.appendChild(info);
          listEl.appendChild(row);
        });
    }
  }
  if (statusEl) statusEl.style.display = "none";
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.textContent = "\u2B50 Synthesize";
  }
  showModal("modal-ga-master");
}

async function runCreateMaster() {
  const listEl = document.getElementById("ga-master-analysis-list");
  const statusEl = document.getElementById("ga-master-status");
  const runBtn = document.getElementById("ga-master-run-btn");
  const selected = [];
  if (listEl) {
    listEl
      .querySelectorAll("input[type=checkbox]:checked")
      .forEach(function (cb) {
        const a = (_projectAnalyses || []).find(function (x) {
          return x.id === cb.dataset.analysisId;
        });
        if (a) selected.push(a);
      });
  }
  if (!selected.length) {
    alert("Select at least one analysis to synthesize.");
    return;
  }
  if (statusEl) {
    statusEl.style.display = "";
    statusEl.textContent =
      "\u2B50 Synthesizing master analysis\u2026 this may take a moment.";
  }
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = "Synthesizing\u2026";
  }
  try {
    let combined = "";
    selected.forEach(function (a, i) {
      combined +=
        "\n\n=== Analysis " +
        (i + 1) +
        " (Model: " +
        _gaModelShort(a.model || "?") +
        ", Docs: " +
        (a.docNames || []).join(", ") +
        ") ===\n";
      combined += _gaResultsToText(a.results);
    });
    const systemPrompt =
      "You are a procurement and operations analyst. You have received multiple AI analyses of position/guideline documents from different models. Synthesize the best comprehensive master analysis from all of them. Combine, deduplicate, and keep the best phrasing. Respond ONLY with a JSON object wrapped in a ```json code fence.";
    const userPrompt =
      "Here are " +
      selected.length +
      " analyses from different models:\n" +
      combined +
      "\n\nCreate a comprehensive master analysis by:\n- Taking all unique responsibilities (deduplicate)\n" +
      "- Combining recommended tasks (remove duplicates, keep best)\n- Combining recommended templates (deduplicate)\n" +
      "- Merging procurement categories\n- Combining reminders\n\nReturn ONLY this JSON:\n```json\n{\n" +
      '  "responsibilities": ["string", ...],\n  "recommended_tasks": [{"title": "string", "description": "string", "priority": "low|medium|high"}, ...],\n' +
      '  "recommended_templates": [{"name": "string", "description": "string"}, ...],\n' +
      '  "procurement_categories": ["string", ...],\n  "reminders": [{"title": "string", "offset_days": 0, "description": "string"}, ...]\n}\n```';
    const apiCall = buildApiCall(systemPrompt, [
      { role: "user", content: userPrompt },
    ]);
    const bodyObj = JSON.parse(apiCall.body);
    if (typeof bodyObj.body === "string") {
      const ib = JSON.parse(bodyObj.body);
      ib.stream = false;
      bodyObj.body = JSON.stringify(ib);
    } else bodyObj.stream = false;
    const resp = await fetch(apiCall.url, {
      method: "POST",
      headers: apiCall.headers,
      body: JSON.stringify(bodyObj),
    });
    if (!resp.ok) {
      const e = await resp.text().catch(function () {
        return "HTTP " + resp.status;
      });
      throw new Error("API error: " + e);
    }
    const data = await resp.json();
    const provider = state.settings.provider || "anthropic";
    const rawText =
      provider === "anthropic"
        ? (data.content && data.content[0] && data.content[0].text) || ""
        : (data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content) ||
          "";
    const recs = _extractGuidelinesJson(rawText);
    if (!recs)
      throw new Error(
        "Could not parse JSON from model response.\n\nRaw:\n" +
          rawText.slice(0, 400),
      );
    const existingMaster = (_projectAnalyses || []).find(function (a) {
      return a.isMaster;
    });
    if (existingMaster) {
      await _saveGAVersion(existingMaster);
      existingMaster.results = recs;
      existingMaster.sourceIds = selected.map(function (a) {
        return a.id;
      });
      existingMaster.model = state.settings.model || "";
      existingMaster.provider = state.settings.provider || "anthropic";
      existingMaster.updatedAt = Date.now();
      await dbPut("guidelineAnalyses", existingMaster);
      _projectAnalyses = _projectAnalyses.map(function (a) {
        return a.id === existingMaster.id ? existingMaster : a;
      });
      _renderAnalysisBar();
      closeModal();
      selectGuidelineAnalysis(existingMaster.id);
    } else {
      const allIds = [],
        allNames = [];
      selected.forEach(function (a) {
        (a.docIds || []).forEach(function (id, i) {
          if (allIds.indexOf(id) === -1) {
            allIds.push(id);
            allNames.push((a.docNames || [])[i] || "");
          }
        });
      });
      const masterRec = await _saveGuidelineAnalysis(
        recs,
        allIds,
        allNames,
        true,
        selected.map(function (a) {
          return a.id;
        }),
      );
      closeModal();
      selectGuidelineAnalysis(masterRec.id);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = "";
      statusEl.textContent =
        "\u274c Synthesis failed: " +
        (err.message || String(err)).slice(0, 200);
    }
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = "\u2B50 Synthesize";
    }
  }
}

async function _saveGAVersion(analysis) {
  if (!analysis) return;
  const versions = analysis.versions || [];
  versions.push({
    id: uid(),
    results: JSON.parse(JSON.stringify(analysis.results)),
    savedAt: Date.now(),
    label: "",
  });
  analysis.versions = versions;
  await dbPut("guidelineAnalyses", analysis);
}

function openGAVersionHistory(masterId) {
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === masterId;
  });
  if (!analysis) return;
  const versions = (analysis.versions || []).slice().reverse();
  const contentEl = document.getElementById("guidelines-content-area");
  if (!contentEl) return;
  const existing = document.getElementById("ga-version-history");
  if (existing) existing.remove();
  const section = document.createElement("div");
  section.id = "ga-version-history";
  section.style.cssText =
    "border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 16px;background:var(--surface2);margin-bottom:12px;flex-shrink:0";
  if (!versions.length) {
    section.innerHTML =
      '<div style="font-size:11px;font-family:\'DM Mono\',monospace;font-weight:600;color:var(--text-muted);margin-bottom:8px">VERSION HISTORY</div><div style="font-size:12px;color:var(--text-muted)">No saved versions yet. The master is versioned automatically each time it is updated via Synthesize.</div>';
  } else {
    let rows =
      "<div style=\"font-size:11px;font-family:'DM Mono',monospace;font-weight:600;color:var(--text-muted);margin-bottom:8px\">VERSION HISTORY (" +
      versions.length +
      ")</div>";
    versions.forEach(function (v, i) {
      const autoLabel = "Version " + (versions.length - i);
      const dateStr = v.savedAt ? new Date(v.savedAt).toLocaleString() : "";
      rows +=
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border)">' +
        '<div style="flex:1;min-width:0">' +
        '<span id="ga-vl-' +
        v.id +
        '" style="font-size:12px;cursor:pointer" onclick="_gaStartLabelEdit(\'' +
        masterId +
        "','" +
        v.id +
        '\')" title="Click to edit label">' +
        (v.label
          ? "<b>" + v.label.replace(/</g, "&lt;") + "</b>"
          : '<i style="color:var(--text-muted)">' + autoLabel + "</i>") +
        '</span><span style="font-size:11px;color:var(--text-muted);margin-left:8px">' +
        dateStr +
        "</span></div>" +
        '<button class="btn-ghost" style="font-size:11px;padding:2px 8px;flex-shrink:0" onclick="openGADiff(\'' +
        masterId +
        "','" +
        v.id +
        "')\" >Diff</button>" +
        '<button class="btn-ghost" style="font-size:11px;padding:2px 8px;flex-shrink:0" onclick="restoreGAVersion(\'' +
        masterId +
        "','" +
        v.id +
        "')\" >Restore</button>" +
        '<button style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text-muted);padding:2px 4px;flex-shrink:0" onclick="deleteGAVersion(\'' +
        masterId +
        "','" +
        v.id +
        '\')" onmouseover="this.style.color=\'var(--danger)\'" onmouseout="this.style.color=\'var(--text-muted)\'" title="Delete version">\u2715</button>' +
        "</div>";
    });
    section.innerHTML = rows;
  }
  contentEl.insertBefore(section, contentEl.firstChild);
}

async function restoreGAVersion(masterId, versionId) {
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === masterId;
  });
  if (!analysis) return;
  const version = (analysis.versions || []).find(function (v) {
    return v.id === versionId;
  });
  if (
    !version ||
    !confirm(
      "Restore this version? The current master will be saved as a new version first.",
    )
  )
    return;
  await _saveGAVersion(analysis);
  analysis.results = JSON.parse(JSON.stringify(version.results));
  analysis.updatedAt = Date.now();
  await dbPut("guidelineAnalyses", analysis);
  _projectAnalyses = _projectAnalyses.map(function (a) {
    return a.id === masterId ? analysis : a;
  });
  selectGuidelineAnalysis(masterId);
}

async function deleteGAVersion(masterId, versionId) {
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === masterId;
  });
  if (!analysis || !confirm("Delete this version snapshot?")) return;
  analysis.versions = (analysis.versions || []).filter(function (v) {
    return v.id !== versionId;
  });
  await dbPut("guidelineAnalyses", analysis);
  _projectAnalyses = _projectAnalyses.map(function (a) {
    return a.id === masterId ? analysis : a;
  });
  openGAVersionHistory(masterId);
}

async function openGADiff(id1, id2) {
  const all = _projectAnalyses || [];
  const a1 = all.find(function (a) {
    return a.id === id1;
  });
  if (!a1) return;
  const label1 = a1.isMaster
    ? "\u2B50 Master (current)"
    : _gaModelShort(a1.model || "") + " \u2013 " + _gaRelTime(a1.createdAt);
  const text1 = _gaResultsToText(a1.results);
  let label2, text2;
  const ver = (a1.versions || []).find(function (v) {
    return v.id === id2;
  });
  if (ver) {
    label2 =
      ver.label ||
      "Version \u2013 " +
        (ver.savedAt ? new Date(ver.savedAt).toLocaleString() : "");
    text2 = _gaResultsToText(ver.results);
  } else {
    const a2 = all.find(function (a) {
      return a.id === id2;
    });
    if (!a2) return;
    label2 = a2.isMaster
      ? "\u2B50 Master"
      : _gaModelShort(a2.model || "") + " \u2013 " + _gaRelTime(a2.createdAt);
    text2 = _gaResultsToText(a2.results);
  }
  const hunks = diffLines(text1.split("\n"), text2.split("\n"));
  const stats = diffStats(hunks);
  const titleEl = document.getElementById("ga-diff-title");
  const statsEl = document.getElementById("ga-diff-stats");
  const diffContentEl = document.getElementById("ga-diff-content");
  if (titleEl) titleEl.textContent = "Compare: " + label1 + " \u2194 " + label2;
  if (statsEl)
    statsEl.innerHTML =
      '<span style="color:var(--success)">+' +
      stats.added +
      ' lines</span> &nbsp; <span style="color:var(--danger)">\u2212' +
      stats.removed +
      " lines</span>";
  if (diffContentEl) diffContentEl.innerHTML = renderInlineDiffHtml(hunks);
  showModal("modal-ga-diff");
}

function _openGACompareModal(id) {
  const others = (_projectAnalyses || []).filter(function (a) {
    return a.id !== id;
  });
  if (!others.length) {
    alert("No other saved analyses to compare with.");
    return;
  }
  const opts = others
    .slice()
    .sort(function (a, b) {
      if (a.isMaster) return -1;
      if (b.isMaster) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    })
    .map(function (a) {
      const label = a.isMaster ? "\u2B50 Master" : _gaModelShort(a.model || "");
      return (
        '<option value="' +
        a.id +
        '">' +
        label.replace(/</g, "&lt;") +
        " \u2013 " +
        _gaRelTime(a.createdAt) +
        (a.label ? " (" + a.label.replace(/</g, "&lt;") + ")" : "") +
        "</option>"
      );
    })
    .join("");
  const existing = document.getElementById("ga-compare-picker");
  if (existing) existing.remove();
  const picker = document.createElement("div");
  picker.id = "ga-compare-picker";
  picker.style.cssText =
    "position:fixed;bottom:60px;right:20px;z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.5)";
  picker.innerHTML =
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Compare with:</div>' +
    '<select id="ga-compare-select" class="form-input" style="font-size:12px;padding:4px 8px;width:240px">' +
    opts +
    "</select>" +
    '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">' +
    '<button class="btn-ghost" style="font-size:11px" onclick="document.getElementById(\'ga-compare-picker\').remove()">Cancel</button>' +
    '<button class="btn-primary" style="font-size:11px" onclick="openGADiff(\'' +
    id +
    "',document.getElementById('ga-compare-select').value);document.getElementById('ga-compare-picker').remove()\">Compare \u2192</button>" +
    "</div>";
  document.body.appendChild(picker);
}

async function _gaSaveAnalysisLabel(analysisId) {
  const input = document.getElementById("ga-rec-label-input");
  const span = document.getElementById("ga-rec-label");
  if (!input) return;
  const newLabel = input.value.trim();
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === analysisId;
  });
  if (analysis) {
    analysis.label = newLabel;
    await dbPut("guidelineAnalyses", analysis);
    _projectAnalyses = _projectAnalyses.map(function (a) {
      return a.id === analysisId ? analysis : a;
    });
    _renderAnalysisBar();
  }
  if (input) input.style.display = "none";
  if (span) {
    span.innerHTML = newLabel
      ? "<b>" + newLabel.replace(/</g, "&lt;") + "</b>"
      : '<span style="opacity:0.4">+ label</span>';
    span.style.display = "";
  }
}

function _gaStartLabelEdit(masterId, versionId) {
  const span = document.getElementById("ga-vl-" + versionId);
  if (!span) return;
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === masterId;
  });
  const ver =
    analysis &&
    (analysis.versions || []).find(function (v) {
      return v.id === versionId;
    });
  const currentLabel = (ver && ver.label) || "";
  span.outerHTML =
    '<input id="ga-vl-input-' +
    versionId +
    '" type="text" class="form-input" style="font-size:12px;padding:2px 6px;width:160px" value="' +
    currentLabel.replace(/"/g, "&quot;") +
    '" placeholder="Version label\u2026" onblur="_gaSaveLabel(\'' +
    masterId +
    "','" +
    versionId +
    "')\" onkeydown=\"if(event.key==='Enter')_gaSaveLabel('" +
    masterId +
    "','" +
    versionId +
    "');if(event.key==='Escape')openGAVersionHistory('" +
    masterId +
    "')\">";
  const input = document.getElementById("ga-vl-input-" + versionId);
  if (input) {
    input.focus();
    input.select();
  }
}

async function _gaSaveLabel(masterId, versionId) {
  const input = document.getElementById("ga-vl-input-" + versionId);
  if (!input) return;
  const newLabel = input.value.trim();
  const analysis = (_projectAnalyses || []).find(function (a) {
    return a.id === masterId;
  });
  if (analysis) {
    const ver = (analysis.versions || []).find(function (v) {
      return v.id === versionId;
    });
    if (ver) {
      ver.label = newLabel;
      await dbPut("guidelineAnalyses", analysis);
      _projectAnalyses = _projectAnalyses.map(function (a) {
        return a.id === masterId ? analysis : a;
      });
    }
  }
  openGAVersionHistory(masterId);
}

function _gaResultsToText(results) {
  if (!results) return "";
  let text = "";
  if (results.responsibilities && results.responsibilities.length) {
    text += "## Responsibilities\n";
    results.responsibilities.forEach(function (r) {
      text += "- " + r + "\n";
    });
    text += "\n";
  }
  if (results.recommended_tasks && results.recommended_tasks.length) {
    text += "## Recommended Tasks\n";
    results.recommended_tasks.forEach(function (t) {
      text +=
        "- " +
        (t.title || "") +
        " (priority: " +
        (t.priority || "medium") +
        ")\n";
      if (t.description) text += "  " + t.description + "\n";
    });
    text += "\n";
  }
  if (results.recommended_templates && results.recommended_templates.length) {
    text += "## Recommended Templates\n";
    results.recommended_templates.forEach(function (t) {
      text += "- " + (t.name || "") + "\n";
      if (t.description) text += "  " + t.description + "\n";
    });
    text += "\n";
  }
  if (results.procurement_categories && results.procurement_categories.length) {
    text += "## Procurement Categories\n";
    results.procurement_categories.forEach(function (c) {
      text += "- " + c + "\n";
    });
    text += "\n";
  }
  if (results.reminders && results.reminders.length) {
    text += "## Reminders\n";
    results.reminders.forEach(function (r) {
      text +=
        "- " +
        (r.title || "") +
        (r.offset_days != null
          ? " (in " +
            r.offset_days +
            " day" +
            (r.offset_days === 1 ? "" : "s") +
            ")"
          : "") +
        "\n";
      if (r.description) text += "  " + r.description + "\n";
    });
  }
  return text;
}

function _gaModelShort(model) {
  if (!model) return "?";
  if (model.includes("claude-opus")) return "Claude Opus";
  if (model.includes("claude-sonnet")) return "Claude Sonnet";
  if (model.includes("claude-haiku")) return "Claude Haiku";
  if (model.includes("gpt-5.4-mini")) return "GPT-5.4 mini";
  if (model.includes("gpt-5.4-nano")) return "GPT-5.4 nano";
  if (model.includes("gpt-5.4")) return "GPT-5.4";
  if (model.includes("gpt-4o-mini")) return "GPT-4o mini";
  if (model.includes("gpt-4o")) return "GPT-4o";
  if (model.includes("gemini-2.5-pro")) return "Gemini 2.5 Pro";
  if (model.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
  if (model.includes("llama")) return "Llama";
  if (model.includes("deepseek")) return "DeepSeek";
  if (model.includes("grok")) return "Grok";
  if (model.includes("mistral")) return "Mistral";
  const parts = model.split("/");
  const last = parts[parts.length - 1];
  return last.length > 16 ? last.slice(0, 14) + "\u2026" : last;
}

function _gaRelTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return new Date(ts).toLocaleDateString();
}
