// ─── POSITION GUIDELINES & RESPONSIBILITIES PARSER ───────────────────────────
// Per-project guideline documents (job descriptions, SOPs, org charts).
// Stored in the `docs` store with `docType: 'guideline'`.
// Excluded from default chat context and not shown in the right-side panel.

let _currentGuideline = null;

// ─── LOAD & RENDER LIST ───────────────────────────────────────────────────────

async function loadGuidelines() {
  if (!state.activeProject) return;
  _currentGuideline = null;

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

  const placeholder = document.getElementById("guidelines-detail-placeholder");
  const panel = document.getElementById("guidelines-detail-panel");
  if (placeholder) placeholder.style.display = "flex";
  if (panel) panel.style.display = "none";
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

  const placeholder = document.getElementById("guidelines-detail-placeholder");
  const panel = document.getElementById("guidelines-detail-panel");
  if (placeholder) placeholder.style.display = "none";
  if (panel) panel.style.display = "flex";

  const nameEl = document.getElementById("guidelines-selected-name");
  if (nameEl) nameEl.textContent = doc.name || "Untitled";

  const recsEl = document.getElementById("guidelines-recommendations");
  if (recsEl) {
    const preview = (doc.content || "").slice(0, 300).replace(/</g, "&lt;");
    recsEl.innerHTML =
      '<div style="color:var(--text-muted);font-size:12px;white-space:pre-wrap;line-height:1.5">' +
      preview +
      (doc.content && doc.content.length > 300 ? "…" : "") +
      "</div>" +
      '<div style="margin-top:12px;font-size:12px;color:var(--text-muted)">Click <b>🤖 Analyze All</b> to extract responsibilities, tasks, and templates from all uploaded guideline documents.</div>';
  }
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
    const placeholder = document.getElementById(
      "guidelines-detail-placeholder",
    );
    const panel = document.getElementById("guidelines-detail-panel");
    if (placeholder) placeholder.style.display = "flex";
    if (panel) panel.style.display = "none";
  }
  await loadGuidelines();
}

// ─── ANALYZE ─────────────────────────────────────────────────────────────────

async function analyzeGuidelines() {
  if (!state.activeProject) return;

  const allDocs = await dbGetByIndex(
    "docs",
    "projectId",
    state.activeProject.id,
  );
  const guidelines = allDocs.filter(function (d) {
    return d.docType === "guideline";
  });
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

  const systemPrompt =
    "You are a procurement and operations analyst. Extract structured information from the provided position/guideline documents. Respond ONLY with a JSON object wrapped in a ```json code fence.";

  const userPrompt =
    "Here are the guideline/position documents for this project:\n" +
    combined +
    "\n\nExtract and return a JSON object with this exact shape:\n" +
    "```json\n" +
    "{\n" +
    '  "responsibilities": ["string", ...],\n' +
    '  "recommended_tasks": [{"title": "string", "description": "string", "priority": "low|medium|high"}, ...],\n' +
    '  "recommended_templates": [{"name": "string", "description": "string"}, ...],\n' +
    '  "procurement_categories": ["string", ...],\n' +
    '  "reminders": [{"title": "string", "offset_days": 0, "description": "string"}, ...]\n' +
    "}\n" +
    "```\n" +
    "Return only the JSON object. Do not include any other text outside the code fence.";

  const apiCall = buildApiCall(systemPrompt, [
    { role: "user", content: userPrompt },
  ]);

  // Build a non-streaming body
  const bodyObj = JSON.parse(apiCall.body);
  bodyObj.stream = false;
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

  _renderGuidelineRecommendations(recs);
}

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

// ─── OPEN ANALYZE (entry point from HTML onclick) ─────────────────────────────

function openGuidelinesAnalyze() {
  const recsEl = document.getElementById("guidelines-recommendations");
  if (recsEl) {
    recsEl.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">🤖 Analyzing… this may take a moment.</div>';
  }
  const panel = document.getElementById("guidelines-detail-panel");
  if (panel) panel.style.display = "flex";
  const placeholder = document.getElementById("guidelines-detail-placeholder");
  if (placeholder) placeholder.style.display = "none";

  analyzeGuidelines().catch(function (err) {
    if (recsEl) {
      recsEl.innerHTML =
        '<div style="padding:16px;color:var(--danger);font-size:12px">❌ Analysis failed: ' +
        (err.message || String(err)).replace(/</g, "&lt;") +
        "</div>";
    }
  });
}

// ─── RENDER RECOMMENDATIONS ───────────────────────────────────────────────────

function _renderGuidelineRecommendations(recs) {
  const el = document.getElementById("guidelines-recommendations");
  if (!el) return;
  let html = "";

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
    btn.textContent = "✓ Added";
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = orig;
      btn.disabled = false;
    }, 2000);
  }
}
