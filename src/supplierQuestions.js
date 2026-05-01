// ─── SUPPLIER QUESTIONS ───────────────────────────────────────────────────────

let _sqAutoSaveTimer = null;
let _sqBidNetPending = []; // pending items from BidNet import preview

// ─── BidNet HTML Parser ───────────────────────────────────────────────────────
/**
 * Parse a saved BidNet Q&A HTML page (or any table-based Q&A export)
 * and extract question data. Adapted from extract_qna_consolidated.py
 * and bidnet_export.js in the Supplier_Q_AND_A toolkit.
 * Returns array of { questionNo, vendor, contactName, topic, text }.
 */
function parseBidNetHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const results = [];
  for (const tr of table.querySelectorAll("tr")) {
    const titleEl = tr.querySelector(".questionAnswerTitle");
    // Question text container: prefer id^=questionContainer_, fall back to class
    let qcontEl = tr.querySelector('[id^="questionContainer_"]');
    if (!qcontEl) {
      const qc = tr.querySelector(".questionContainer");
      if (qc) {
        for (const child of qc.querySelectorAll("div")) {
          if (!child.classList.contains("questionAnswerTitle")) {
            qcontEl = child;
            break;
          }
        }
      }
    }
    if (!titleEl || !qcontEl) continue;

    const vendorEl = tr.querySelector(".vendorName");
    const qnoEl = tr.querySelector(".questionNo");
    const emEl = titleEl.querySelector("em");
    const contactName = emEl ? emEl.textContent.trim() : "";

    let titleText = titleEl.textContent
      .trim()
      .replace(/^(?:Next\s+)?Question:\s*/i, "")
      .trim();
    const topic = titleText.includes("(")
      ? titleText.split("(")[0].trim()
      : titleText.trim();

    const questionText = qcontEl.textContent.replace(/\s+/g, " ").trim();
    if (!questionText) continue;

    results.push({
      questionNo: qnoEl ? qnoEl.textContent.trim() : "",
      vendor: vendorEl ? vendorEl.textContent.trim() : "",
      contactName,
      topic,
      text: questionText,
    });
  }
  return results;
}

function openBidNetImportModal() {
  if (!state.activeProject) return;
  _sqBidNetPending = [];
  const input = document.getElementById("bidnet-import-file");
  if (input) {
    input.value = "";
    input.click();
  }
}

async function handleBidNetImportFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const html = await file.text();
    const results = parseBidNetHtml(html);
    if (!results.length) {
      alert(
        "No questions found in this file. Make sure it is a saved BidNet Q&A HTML page with a visible question table.",
      );
      return;
    }
    _sqBidNetPending = results;

    // Build preview table (first 20 rows)
    const preview = document.getElementById("bidnet-preview-table");
    if (preview) {
      preview.innerHTML = results
        .slice(0, 20)
        .map(
          (r, i) =>
            "<tr>" +
            '<td style="padding:4px 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">' +
            (r.questionNo || i + 1) +
            "</td>" +
            '<td style="padding:4px 8px;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' +
            r.vendor.replace(/"/g, "&quot;") +
            '">' +
            (r.vendor || "—") +
            "</td>" +
            '<td style="padding:4px 8px;font-size:11px;color:var(--accent);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            (r.topic || "—") +
            "</td>" +
            '<td style="padding:4px 8px;font-size:12px">' +
            r.text.slice(0, 80) +
            (r.text.length > 80 ? "…" : "") +
            "</td>" +
            "</tr>",
        )
        .join("");
    }
    const countEl = document.getElementById("bidnet-import-count");
    if (countEl)
      countEl.textContent =
        results.length +
        " question" +
        (results.length === 1 ? "" : "s") +
        " found" +
        (results.length > 20 ? " (showing first 20)" : "");
    showModal("modal-bidnet-import");
  } catch (e) {
    alert("Failed to parse file: " + e.message);
  }
}

async function executeBidNetImport() {
  if (!state.activeProject || !_sqBidNetPending.length) return;
  const btn = document.getElementById("bidnet-import-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Importing…";
  }

  const now = Date.now();
  for (let i = 0; i < _sqBidNetPending.length; i++) {
    const item = _sqBidNetPending[i];
    const q = {
      id: uid(),
      projectId: state.activeProject.id,
      text: item.text,
      topic: item.topic || "",
      vendor: item.vendor || "",
      contactName: item.contactName || "",
      questionNo: item.questionNo || "",
      draftAnswer: "",
      status: "unanswered",
      confidence: null,
      createdAt: now + i, // preserve order
      updatedAt: now + i,
    };
    await dbPut("supplierQuestions", q);
  }

  _sqBidNetPending = [];
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Import";
  }
  closeModal();
  await loadSupplierQuestions();
}

// ─── Load / Render ────────────────────────────────────────────────────────────

async function loadSupplierQuestions() {
  if (!state.activeProject) return;
  const questions = await dbGetByIndex(
    "supplierQuestions",
    "projectId",
    state.activeProject.id,
  );
  questions.sort((a, b) => a.createdAt - b.createdAt);
  renderSQList(questions);
  if (state.currentQuestion) {
    const fresh = questions.find((q) => q.id === state.currentQuestion.id);
    if (fresh) selectQuestion(fresh);
  }
}

/** Derive effective status for backward-compat with old records that have no .status field */
function _sqEffectiveStatus(q) {
  if (q.status) return q.status;
  return q.draftAnswer ? "answered" : "unanswered";
}

function renderSQList(questions) {
  const list = document.getElementById("sq-list");
  const countEl = document.getElementById("sq-count");
  if (!list) return;
  list.innerHTML = "";

  if (countEl) {
    const unanswered = questions.filter(
      (q) => _sqEffectiveStatus(q) === "unanswered",
    ).length;
    const needsReview = questions.filter(
      (q) => _sqEffectiveStatus(q) === "needs-review",
    ).length;
    const todo = questions.filter(
      (q) => _sqEffectiveStatus(q) === "todo",
    ).length;
    const total = questions.length;
    const parts = [total + " total"];
    if (unanswered) parts.push(unanswered + " open");
    if (needsReview) parts.push(needsReview + " ⚠");
    if (todo) parts.push(todo + " @todo");
    countEl.textContent = parts.join(" · ");
  }

  questions.forEach((q) => {
    const el = document.createElement("div");
    const status = _sqEffectiveStatus(q);
    el.className =
      "sq-item" +
      (state.currentQuestion && state.currentQuestion.id === q.id
        ? " active"
        : "");
    el.dataset.sqId = q.id;

    const icon =
      status === "answered"
        ? "✅"
        : status === "needs-review"
          ? "⚠"
          : status === "todo"
            ? "🔲"
            : "○";
    const iconColor =
      status === "answered"
        ? "var(--success)"
        : status === "needs-review"
          ? "var(--accent)"
          : "var(--text-muted)";

    const truncated = q.text.length > 75 ? q.text.slice(0, 75) + "…" : q.text;
    const vendorHtml = q.vendor
      ? '<span style="font-size:10px;color:var(--text-muted);display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        q.vendor.slice(0, 40) +
        "</span>"
      : "";
    const qnoHtml = q.questionNo
      ? '<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-right:4px">' +
        q.questionNo +
        " </span>"
      : "";

    el.innerHTML =
      '<input type="checkbox" class="sq-checkbox" data-id="' +
      q.id +
      '" style="flex-shrink:0;accent-color:var(--accent)" onclick="event.stopPropagation()" />' +
      '<span class="sq-item-icon" style="color:' +
      iconColor +
      ';flex-shrink:0">' +
      icon +
      "</span>" +
      '<span class="sq-item-text" style="min-width:0;flex:1" title="' +
      q.text.replace(/"/g, "&quot;") +
      '">' +
      qnoHtml +
      truncated +
      vendorHtml +
      "</span>" +
      '<button class="sq-item-del" title="Delete" onclick="event.stopPropagation();deleteQuestion(\'' +
      q.id +
      "')\">✕</button>";

    el.onclick = function (e) {
      if (
        e.target.classList.contains("sq-checkbox") ||
        e.target.classList.contains("sq-item-del")
      )
        return;
      selectQuestion(q);
    };
    list.appendChild(el);
  });
}

function selectQuestion(q) {
  state.currentQuestion = q;

  document.querySelectorAll(".sq-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.sqId === q.id);
  });

  const placeholder = document.getElementById("sq-detail-placeholder");
  const detailArea = document.getElementById("sq-detail-area");
  const questionText = document.getElementById("sq-question-text");
  const answerEditor = document.getElementById("sq-answer-editor");
  const streamingDiv = document.getElementById("sq-answer-streaming");

  if (placeholder) placeholder.style.display = "none";
  if (detailArea) detailArea.style.display = "flex";
  if (questionText) questionText.textContent = q.text;
  if (answerEditor) answerEditor.value = q.draftAnswer || "";
  if (typeof refreshRichEditor === "function" && answerEditor)
    refreshRichEditor(answerEditor);
  if (streamingDiv) streamingDiv.style.display = "none";
  if (answerEditor) answerEditor.style.display = "";

  _sqUpdateMeta(q);
  _sqUpdateStatusPills(q);
}

function _sqUpdateMeta(q) {
  const meta = document.getElementById("sq-meta");
  if (!meta) return;
  const hasAny = q.questionNo || q.topic || q.vendor || q.contactName;
  meta.style.display = hasAny ? "" : "none";

  const qno = document.getElementById("sq-meta-qno");
  const topic = document.getElementById("sq-meta-topic");
  const vendor = document.getElementById("sq-meta-vendor");
  const contact = document.getElementById("sq-meta-contact");

  if (qno) qno.textContent = q.questionNo || "";
  if (topic) topic.textContent = q.topic || "";
  if (vendor) vendor.textContent = q.vendor ? "🏢 " + q.vendor : "";
  if (contact) contact.textContent = q.contactName ? "👤 " + q.contactName : "";
}

function _sqUpdateStatusPills(q) {
  const status = _sqEffectiveStatus(q);

  ["unanswered", "answered", "needs-review", "todo"].forEach((s) => {
    const btn = document.getElementById("sq-status-" + s);
    if (btn) btn.classList.toggle("active", status === s);
  });

  // Show confidence pills only for answered / needs-review
  const confGroup = document.getElementById("sq-confidence-group");
  if (confGroup) {
    confGroup.style.display =
      status === "answered" || status === "needs-review" ? "" : "none";
  }

  ["high", "medium", "low"].forEach((c) => {
    const btn = document.getElementById("sq-conf-" + c);
    if (btn) btn.classList.toggle("active", q.confidence === c);
  });
}

async function setSQStatus(status) {
  if (!state.currentQuestion) return;
  state.currentQuestion.status = status;
  state.currentQuestion.updatedAt = Date.now();
  await dbPut("supplierQuestions", state.currentQuestion);
  _sqUpdateStatusPills(state.currentQuestion);
  await loadSupplierQuestions();
}

async function setSQConfidence(confidence) {
  if (!state.currentQuestion) return;
  // Toggle off if already selected
  if (state.currentQuestion.confidence === confidence) confidence = null;
  state.currentQuestion.confidence = confidence;
  state.currentQuestion.updatedAt = Date.now();
  await dbPut("supplierQuestions", state.currentQuestion);
  _sqUpdateStatusPills(state.currentQuestion);
}

// ─── Add Questions ────────────────────────────────────────────────────────────

function openAddQuestionsModal() {
  if (!state.activeProject) return;
  const ta = document.getElementById("sq-add-textarea");
  if (ta) ta.value = "";
  showModal("modal-add-sq");
}

async function saveAddedQuestions() {
  if (!state.activeProject) return;
  const ta = document.getElementById("sq-add-textarea");
  if (!ta) return;
  const raw = ta.value.trim();
  if (!raw) return;

  let chunks = [];
  const blankLineSplit = raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (blankLineSplit.length > 1) {
    chunks = blankLineSplit;
  } else {
    const lines = raw.split("\n");
    const numbered = [];
    let current = null;
    for (const line of lines) {
      const m = /^\s*\d+[.)]\s+(.*)/.exec(line);
      if (m) {
        if (current !== null) numbered.push(current);
        current = m[1].trim();
      } else if (current !== null) {
        current += " " + line.trim();
      }
    }
    if (current !== null) numbered.push(current);
    if (numbered.length > 1) {
      chunks = numbered.map((s) => s.trim()).filter(Boolean);
    } else {
      chunks = [raw];
    }
  }

  const now = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const q = {
      id: uid(),
      projectId: state.activeProject.id,
      text: chunks[i],
      draftAnswer: "",
      status: "unanswered",
      confidence: null,
      topic: "",
      vendor: "",
      contactName: "",
      questionNo: "",
      createdAt: now + i,
      updatedAt: now + i,
    };
    await dbPut("supplierQuestions", q);
  }

  closeModal();
  await loadSupplierQuestions();
}

// ─── Generate Answer ──────────────────────────────────────────────────────────

async function generateAnswerForQuestion(questionId) {
  if (!state.activeProject) return;
  const id = questionId || (state.currentQuestion && state.currentQuestion.id);
  if (!id) return;

  const q = await dbGet("supplierQuestions", id);
  if (!q) return;

  if (!state.currentQuestion || state.currentQuestion.id !== id)
    selectQuestion(q);

  const genBtn = document.getElementById("sq-gen-btn");
  const streamingDiv = document.getElementById("sq-answer-streaming");
  const answerEditor = document.getElementById("sq-answer-editor");

  if (genBtn) genBtn.disabled = true;
  if (streamingDiv) {
    streamingDiv.textContent = "";
    streamingDiv.style.display = "";
  }
  if (answerEditor) answerEditor.style.display = "none";

  const systemPrompt =
    "You are SourceDesk, an expert AI assistant for strategic sourcing and procurement.\n" +
    "You are helping draft official answers to supplier questions about an RFP/procurement document.\n" +
    "Be precise, professional, and thorough. Answer the question using only the provided document context.\n" +
    "If the answer cannot be determined from the context, write exactly: @TODO — [brief reason why]\n\n" +
    "After your complete answer, on a new line at the very end, rate your confidence with EXACTLY one of:\n" +
    "[CONFIDENCE: HIGH] - The RFP/context clearly and fully addresses this question\n" +
    "[CONFIDENCE: MEDIUM] - Partial context available; answer may need verification\n" +
    "[CONFIDENCE: LOW] - Cannot be determined from context; requires human input";

  let fullSystemPrompt = systemPrompt;
  if (state.activeProject) {
    fullSystemPrompt +=
      "\n\n## Current Project\nName: " +
      state.activeProject.name +
      "\nCategory: " +
      state.activeProject.category;
    if (state.activeProject.notes)
      fullSystemPrompt += "\nNotes: " + state.activeProject.notes;
    if (state.activeProject.instructions)
      fullSystemPrompt +=
        "\n\n## Project Instructions\n" + state.activeProject.instructions;
  }

  try {
    const { context } = await retrieveContext(q.text);
    if (context)
      fullSystemPrompt +=
        "\n\n## Retrieved Context (from project documents)\n" + context;
  } catch (e) {
    // non-fatal
  }

  const messages = [{ role: "user", content: q.text }];
  let fullText = "";

  try {
    const { url, headers, body } = buildApiCall(fullSystemPrompt, messages);
    const resp = await fetch(url, { method: "POST", headers, body });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(
        err.error?.message || err.message || "API error " + resp.status,
      );
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const delta = parseStreamDelta(line.slice(6).trim());
        if (delta) {
          fullText += delta;
          if (streamingDiv) streamingDiv.textContent = fullText;
        }
      }
    }
  } catch (e) {
    if (streamingDiv) streamingDiv.style.display = "none";
    if (answerEditor) {
      answerEditor.style.display = "";
      answerEditor.value = "⚠ Error: " + e.message;
    }
    if (genBtn) genBtn.disabled = false;
    return;
  }

  // Parse and strip confidence marker
  let confidence = null;
  let autoStatus = "answered";
  const confMatch = fullText.match(/\[CONFIDENCE:\s*(HIGH|MEDIUM|LOW)\]/i);
  if (confMatch) {
    confidence = confMatch[1].toLowerCase();
    autoStatus =
      confidence === "high"
        ? "answered"
        : confidence === "medium"
          ? "needs-review"
          : "todo";
    fullText = fullText
      .replace(/\n?\[CONFIDENCE:\s*(HIGH|MEDIUM|LOW)\]/i, "")
      .trimEnd();
  }

  q.draftAnswer = fullText;
  q.confidence = confidence;
  q.status = autoStatus;
  q.updatedAt = Date.now();
  await dbPut("supplierQuestions", q);

  if (state.currentQuestion && state.currentQuestion.id === id) {
    state.currentQuestion = q;
    _sqUpdateStatusPills(q);
    _sqUpdateMeta(q);
  }

  if (streamingDiv) streamingDiv.style.display = "none";
  if (answerEditor) {
    answerEditor.style.display = "";
    answerEditor.value = fullText;
  }
  if (typeof refreshRichEditor === "function" && answerEditor)
    refreshRichEditor(answerEditor);
  if (genBtn) genBtn.disabled = false;

  await loadSupplierQuestions();
}

async function generateSelectedAnswers() {
  if (!state.activeProject) return;
  const checkboxes = document.querySelectorAll(".sq-checkbox:checked");
  if (!checkboxes.length) {
    alert("No questions selected. Check one or more questions first.");
    return;
  }
  for (const cb of checkboxes) {
    await generateAnswerForQuestion(cb.dataset.id);
  }
}

// ─── Batch Generation ─────────────────────────────────────────────────────────

async function generateBatch() {
  if (!state.activeProject) return;
  const all = await dbGetByIndex(
    "supplierQuestions",
    "projectId",
    state.activeProject.id,
  );
  all.sort((a, b) => a.createdAt - b.createdAt);

  const unanswered = all.filter((q) => _sqEffectiveStatus(q) === "unanswered");
  if (!unanswered.length) {
    alert("No unanswered questions remaining!");
    return;
  }

  const BATCH_SIZE = 10;
  const batch = unanswered.slice(0, BATCH_SIZE);
  const batchBtn = document.getElementById("sq-batch-btn");
  const origLabel = batchBtn ? batchBtn.textContent : "⚡ Batch";

  for (let i = 0; i < batch.length; i++) {
    if (batchBtn)
      batchBtn.textContent = "Generating " + (i + 1) + "/" + batch.length + "…";
    await generateAnswerForQuestion(batch[i].id);
  }

  if (batchBtn) batchBtn.textContent = origLabel;

  const remaining =
    all.length - (all.length - unanswered.length) - batch.length;
  alert(
    "Batch complete! Generated answers for " +
      batch.length +
      " question" +
      (batch.length === 1 ? "" : "s") +
      ".\n" +
      (unanswered.length - batch.length > 0
        ? unanswered.length -
          batch.length +
          " unanswered questions remain. Run Batch again to continue."
        : "All questions have been processed!"),
  );
}

// ─── Save / Delete ────────────────────────────────────────────────────────────

async function saveCurrentSQAnswer() {
  if (!state.currentQuestion) return;
  const answerEditor = document.getElementById("sq-answer-editor");
  if (!answerEditor) return;
  const newText = answerEditor.value;
  state.currentQuestion.draftAnswer = newText;
  state.currentQuestion.updatedAt = Date.now();
  // Auto-promote unanswered → answered when text is manually entered
  if (
    newText.trim() &&
    _sqEffectiveStatus(state.currentQuestion) === "unanswered"
  ) {
    state.currentQuestion.status = "answered";
  }
  await dbPut("supplierQuestions", state.currentQuestion);
  _sqUpdateStatusPills(state.currentQuestion);
  await loadSupplierQuestions();
}

function scheduleSQAutoSave() {
  if (_sqAutoSaveTimer) clearTimeout(_sqAutoSaveTimer);
  _sqAutoSaveTimer = setTimeout(async function () {
    await saveCurrentSQAnswer();
  }, 1500);
}

async function deleteQuestion(id) {
  if (!confirm("Delete this question?")) return;
  await dbDelete("supplierQuestions", id);
  if (state.currentQuestion && state.currentQuestion.id === id) {
    state.currentQuestion = null;
    const placeholder = document.getElementById("sq-detail-placeholder");
    const detailArea = document.getElementById("sq-detail-area");
    if (placeholder) placeholder.style.display = "";
    if (detailArea) detailArea.style.display = "none";
  }
  await loadSupplierQuestions();
}

function copyQuestionToClipboard() {
  if (!state.currentQuestion) return;
  navigator.clipboard
    .writeText(state.currentQuestion.text)
    .catch(function () {});
}

function copyAnswerToClipboard() {
  if (!state.currentQuestion) return;
  const text =
    state.currentQuestion.draftAnswer ||
    document.getElementById("sq-answer-editor")?.value ||
    "";
  navigator.clipboard.writeText(text).catch(function () {});
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportSelectedQuestions() {
  if (!state.activeProject) return;
  const checkboxes = document.querySelectorAll(".sq-checkbox:checked");
  if (!checkboxes.length) {
    alert("No questions selected.");
    return;
  }
  const ids = Array.from(checkboxes).map((cb) => cb.dataset.id);
  const all = await dbGetByIndex(
    "supplierQuestions",
    "projectId",
    state.activeProject.id,
  );
  const selected = all.filter((q) => ids.includes(q.id));
  selected.sort((a, b) => a.createdAt - b.createdAt);
  _downloadSQMarkdown(selected);
}

async function exportAllQuestions() {
  if (!state.activeProject) return;
  const all = await dbGetByIndex(
    "supplierQuestions",
    "projectId",
    state.activeProject.id,
  );
  all.sort((a, b) => a.createdAt - b.createdAt);
  _downloadSQMarkdown(all);
}

function _downloadSQMarkdown(questions) {
  if (!questions.length) {
    alert("No questions to export.");
    return;
  }
  let md =
    "# Supplier Questions — " +
    (state.activeProject ? state.activeProject.name : "Export") +
    "\n\n";
  questions.forEach(function (q, i) {
    const statusLabel = _sqEffectiveStatus(q);
    const confLabel = q.confidence
      ? " [Confidence: " + q.confidence.toUpperCase() + "]"
      : "";
    md +=
      "## Question " +
      (i + 1) +
      (q.questionNo ? " (" + q.questionNo + ")" : "") +
      "\n\n";
    if (q.topic) md += "_Topic: " + q.topic + "_\n\n";
    if (q.vendor) md += "_Vendor: " + q.vendor + "_\n\n";
    md +=
      q.text +
      "\n\n### Answer " +
      confLabel +
      "\n\n" +
      (q.draftAnswer || "(no answer)") +
      "\n\n---\n\n";
  });
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "supplier-questions-" +
    (state.activeProject
      ? state.activeProject.name.replace(/\s+/g, "-")
      : "export") +
    ".md";
  a.click();
  URL.revokeObjectURL(url);
}

async function exportSQSummary() {
  if (!state.activeProject) return;
  const all = await dbGetByIndex(
    "supplierQuestions",
    "projectId",
    state.activeProject.id,
  );
  all.sort((a, b) => a.createdAt - b.createdAt);
  if (!all.length) {
    alert("No questions to export.");
    return;
  }

  const answered = all.filter((q) => _sqEffectiveStatus(q) === "answered");
  const needsReview = all.filter(
    (q) => _sqEffectiveStatus(q) === "needs-review",
  );
  const todo = all.filter((q) => _sqEffectiveStatus(q) === "todo");
  const unanswered = all.filter((q) => _sqEffectiveStatus(q) === "unanswered");

  // Vendor breakdown
  const vendors = {};
  for (const q of all) {
    if (q.vendor) {
      vendors[q.vendor] = vendors[q.vendor] || {
        total: 0,
        answered: 0,
        review: 0,
        todo: 0,
        unanswered: 0,
      };
      vendors[q.vendor].total++;
      const s = _sqEffectiveStatus(q);
      vendors[q.vendor][s === "needs-review" ? "review" : s]++;
    }
  }

  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let md =
    "# Q&A Summary Report — " +
    state.activeProject.name +
    "\n\n" +
    "> Generated " +
    now +
    "\n\n---\n\n";

  md += "## Summary Statistics\n\n";
  md += "| Metric | Count |\n|---|---|\n";
  md += "| Total questions | " + all.length + " |\n";
  md += "| Answered (high confidence) | " + answered.length + " |\n";
  md += "| Needs review | " + needsReview.length + " |\n";
  md += "| @TODO (human input needed) | " + todo.length + " |\n";
  md += "| Unanswered | " + unanswered.length + " |\n\n";

  if (Object.keys(vendors).length) {
    md += "## Vendor Breakdown\n\n";
    md +=
      "| Vendor | Total Q's | Answered | Review | @TODO | Open |\n|---|---|---|---|---|---|\n";
    const sorted = Object.entries(vendors).sort(
      (a, b) => b[1].total - a[1].total,
    );
    for (const [name, v] of sorted) {
      md +=
        "| " +
        name +
        " | " +
        v.total +
        " | " +
        v.answered +
        " | " +
        v.review +
        " | " +
        v.todo +
        " | " +
        v.unanswered +
        " |\n";
    }
    md += "\n";
  }

  if (todo.length) {
    md += "## @TODO Items (Require Human Input)\n\n";
    md += "| # | Topic | Question | Notes |\n|---|---|---|---|\n";
    todo.forEach((q, i) => {
      const notes =
        q.draftAnswer && q.draftAnswer.startsWith("@TODO")
          ? q.draftAnswer.slice(5, 125).trim()
          : "Not determined from context";
      md +=
        "| " +
        (i + 1) +
        " | " +
        (q.topic || "—") +
        " | " +
        q.text.slice(0, 80).replace(/\|/g, "\\|") +
        (q.text.length > 80 ? "…" : "") +
        " | " +
        notes.replace(/\|/g, "\\|") +
        " |\n";
    });
    md += "\n";
  }

  if (needsReview.length) {
    md += "## Needs Review (Verify Before Publishing)\n\n";
    needsReview.forEach((q, i) => {
      md +=
        "### " +
        (i + 1) +
        ". " +
        (q.topic ? "[" + q.topic + "] " : "") +
        q.text.slice(0, 100) +
        (q.text.length > 100 ? "…" : "") +
        "\n\n";
      if (q.vendor) md += "_Vendor: " + q.vendor + "_\n\n";
      md += "**Draft Answer:**\n\n" + (q.draftAnswer || "(none)") + "\n\n";
    });
  }

  md += "## Full Q&A Table\n\n";
  md +=
    "| # | Status | Conf | Topic | Vendor | Question | Answer |\n" +
    "|---|---|---|---|---|---|---|\n";
  all.forEach((q, i) => {
    const s = _sqEffectiveStatus(q);
    const icon =
      s === "answered"
        ? "✅"
        : s === "needs-review"
          ? "⚠"
          : s === "todo"
            ? "🔲"
            : "○";
    const conf = q.confidence ? q.confidence[0].toUpperCase() : "—";
    const qShort =
      q.text.slice(0, 60).replace(/\|/g, "\\|") +
      (q.text.length > 60 ? "…" : "");
    const aShort =
      (q.draftAnswer || "")
        .slice(0, 80)
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ") +
      (q.draftAnswer && q.draftAnswer.length > 80 ? "…" : "");
    md +=
      "| " +
      (i + 1) +
      " | " +
      icon +
      " | " +
      conf +
      " | " +
      (q.topic || "—") +
      " | " +
      (q.vendor || "—") +
      " | " +
      qShort +
      " | " +
      aShort +
      " |\n";
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "qa-summary-" +
    state.activeProject.name.replace(/\s+/g, "-") +
    "-" +
    Date.now() +
    ".md";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Filter / Toggle ──────────────────────────────────────────────────────────

function filterSQList(query) {
  const q = (query || "").toLowerCase().trim();
  document.querySelectorAll(".sq-item").forEach(function (el) {
    const text =
      el.querySelector(".sq-item-text")?.textContent?.toLowerCase() || "";
    el.style.display = !q || text.includes(q) ? "" : "none";
  });
}

function toggleAllSQCheckboxes(checked) {
  document.querySelectorAll(".sq-checkbox").forEach(function (cb) {
    const item = cb.closest(".sq-item");
    if (item && item.style.display !== "none") {
      cb.checked = checked;
    }
  });
}
