// ─── SUPPLIER QUESTIONS ───────────────────────────────────────────────────────

let _sqAutoSaveTimer = null;

async function loadSupplierQuestions() {
    if (!state.activeProject) return;
    const questions = await dbGetByIndex(
        "supplierQuestions",
        "projectId",
        state.activeProject.id,
    );
    questions.sort((a, b) => a.createdAt - b.createdAt);
    renderSQList(questions);
    // If there's a currently selected question, re-select it
    if (state.currentQuestion) {
        const fresh = questions.find((q) => q.id === state.currentQuestion.id);
        if (fresh) selectQuestion(fresh);
    }
}

function renderSQList(questions) {
    const list = document.getElementById("sq-list");
    const countEl = document.getElementById("sq-count");
    if (!list) return;
    list.innerHTML = "";
    if (countEl)
        countEl.textContent =
            questions.length +
            " question" +
            (questions.length === 1 ? "" : "s");

    questions.forEach((q, i) => {
        const el = document.createElement("div");
        el.className =
            "sq-item" +
            (state.currentQuestion && state.currentQuestion.id === q.id
                ? " active"
                : "");
        el.dataset.sqId = q.id;

        const icon = q.draftAnswer ? "✅" : "○";
        const truncated =
            q.text.length > 80 ? q.text.slice(0, 80) + "…" : q.text;

        el.innerHTML =
            '<input type="checkbox" class="sq-checkbox" data-id="' +
            q.id +
            '" style="flex-shrink:0;accent-color:var(--accent)" onclick="event.stopPropagation()" />' +
            '<span class="sq-item-icon">' +
            icon +
            "</span>" +
            '<span class="sq-item-text" title="' +
            q.text.replace(/"/g, "&quot;") +
            '">' +
            truncated +
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

    // Update active class
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
}

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

    // Try splitting by blank lines first
    const blankLineSplit = raw
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (blankLineSplit.length > 1) {
        chunks = blankLineSplit;
    } else {
        // Try parsing as a numbered list (lines starting with digit+period/paren)
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
            // Fall back: treat entire input as one question
            chunks = [raw];
        }
    }

    for (const text of chunks) {
        const q = {
            id: uid(),
            projectId: state.activeProject.id,
            text: text,
            draftAnswer: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await dbPut("supplierQuestions", q);
    }

    closeModal();
    await loadSupplierQuestions();
}

async function generateAnswerForQuestion(questionId) {
    if (!state.activeProject) return;
    const id =
        questionId || (state.currentQuestion && state.currentQuestion.id);
    if (!id) return;

    const q = await dbGet("supplierQuestions", id);
    if (!q) return;

    // If this question is not the currently selected one, select it
    if (!state.currentQuestion || state.currentQuestion.id !== id) {
        selectQuestion(q);
    }

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
        "You are helping answer supplier questions about an RFP/procurement document.\n" +
        "Be precise, professional, and thorough. Answer the question based on the provided document context.\n" +
        "If the answer cannot be determined from the context, say so clearly and provide guidance.";

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
                "\n\n## Project Instructions\n" +
                state.activeProject.instructions;
    }

    try {
        const { context } = await retrieveContext(q.text);
        if (context)
            fullSystemPrompt +=
                "\n\n## Retrieved Context (from project documents)\n" + context;
    } catch (e) {
        // retrieveContext failure is non-fatal
    }

    const messages = [{ role: "user", content: q.text }];

    let fullText = "";
    try {
        const { url, headers, body } = buildApiCall(fullSystemPrompt, messages);
        const resp = await fetch(url, { method: "POST", headers, body });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg =
                err.error?.message || err.message || "API error " + resp.status;
            throw new Error(msg);
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
            answerEditor.value = "⚠ Error generating answer: " + e.message;
        }
        if (genBtn) genBtn.disabled = false;
        return;
    }

    // Done streaming — save to DB
    q.draftAnswer = fullText;
    q.updatedAt = Date.now();
    await dbPut("supplierQuestions", q);

    if (state.currentQuestion && state.currentQuestion.id === id) {
        state.currentQuestion = q;
    }

    if (streamingDiv) streamingDiv.style.display = "none";
    if (answerEditor) {
        answerEditor.style.display = "";
        answerEditor.value = fullText;
    }
    if (typeof refreshRichEditor === "function" && answerEditor)
        refreshRichEditor(answerEditor);
    if (genBtn) genBtn.disabled = false;

    // Re-render list to update icons
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

async function saveCurrentSQAnswer() {
    if (!state.currentQuestion) return;
    const answerEditor = document.getElementById("sq-answer-editor");
    if (!answerEditor) return;
    state.currentQuestion.draftAnswer = answerEditor.value;
    state.currentQuestion.updatedAt = Date.now();
    await dbPut("supplierQuestions", state.currentQuestion);
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
        md +=
            "## Question " +
            (i + 1) +
            "\n\n" +
            q.text +
            "\n\n### Answer\n\n" +
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
        // Only toggle visible items
        const item = cb.closest(".sq-item");
        if (item && item.style.display !== "none") {
            cb.checked = checked;
        }
    });
}
