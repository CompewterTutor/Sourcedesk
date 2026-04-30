// ─── NOTES ────────────────────────────────────────────────────────────────────
async function _autoSaveCurrentNote() {
    if (!state.currentNote) return;
    const titleEl = document.getElementById("note-title-input");
    const editorEl = document.getElementById("note-editor");
    if (!titleEl || !editorEl) return; // not in notes view
    const newTitle = titleEl.value.trim() || "Untitled";
    const newContent = editorEl.value;
    // skip DB write if nothing changed
    if (
        newTitle === state.currentNote.title &&
        newContent === state.currentNote.content
    )
        return;
    state.currentNote.title = newTitle;
    state.currentNote.content = newContent;
    state.currentNote.updatedAt = Date.now();
    await dbPut("notes", state.currentNote);
}

// Debounced public hook — wired from oninput on the note title and editor.
function scheduleNoteAutosave() {
    if (!state.currentNote) return;
    scheduleAutosave("note", async function () {
        await _autoSaveCurrentNote();
        // Refresh list (without re-selecting/clobbering the editor) so the
        // sidebar title matches what the user just typed.
        const notes = await dbGetByIndex(
            "notes",
            "projectId",
            state.activeProject.id,
        );
        renderNotesList(notes);
    });
}

async function loadNotes() {
    if (!state.activeProject) return;

    // Reset global search state
    const globalToggle = document.getElementById("notes-global-toggle");
    if (globalToggle) globalToggle.checked = false;
    const scopeEl = document.getElementById("notes-scope-label");
    if (scopeEl) scopeEl.style.display = "none";

    const notes = await dbGetByIndex(
        "notes",
        "projectId",
        state.activeProject.id,
    );
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    renderNotesList(notes);
    // re-apply filter if one is active
    const filterEl = document.getElementById("notes-filter");
    if (filterEl && filterEl.value) filterNotes(filterEl.value);
    if (notes.length && !state.currentNote) {
        selectNote(notes[0]);
    } else if (!notes.length) {
        state.currentNote = null;
        const editorArea = document.getElementById("note-editor-area");
        const placeholder = document.getElementById("note-editor-placeholder");
        if (editorArea) editorArea.style.display = "none";
        if (placeholder) placeholder.style.display = "flex";
    } else if (state.currentNote) {
        selectNote(state.currentNote);
    }
}

function renderNotesList(notes) {
    const list = document.getElementById("notes-list");
    if (!list) return;
    list.innerHTML = "";
    // Sort: pinned first, then by updatedAt desc
    const sorted = [...notes].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
    });
    sorted.forEach((n) => {
        const el = document.createElement("div");
        el.className =
            "note-item" +
            (state.currentNote && state.currentNote.id === n.id
                ? " active"
                : "");
        el.dataset.noteId = n.id;
        el.innerHTML =
            '<div style="display:flex;align-items:center;gap:4px">' +
            '<span class="note-pin-btn' +
            (n.pinned ? " pinned" : "") +
            '" data-id="' +
            n.id +
            '" title="' +
            (n.pinned ? "Unpin" : "Pin to top") +
            '">' +
            (n.pinned ? "★" : "☆") +
            "</span>" +
            '<div class="note-item-title">' +
            (n.title || "Untitled") +
            "</div>" +
            "</div>" +
            '<div class="note-item-date">' +
            new Date(n.updatedAt).toLocaleDateString() +
            "</div>";
        el.onclick = (e) => {
            if (e.target.classList.contains("note-pin-btn")) return;
            selectNote(n);
        };
        el.querySelector(".note-pin-btn").addEventListener(
            "click",
            async (e) => {
                e.stopPropagation();
                await toggleNotePin(n.id);
            },
        );
        list.appendChild(el);
    });
}

async function toggleNotePin(noteId) {
    const note = await dbGet("notes", noteId);
    if (!note) return;
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    await dbPut("notes", note);
    if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.pinned = note.pinned;
    }
    await loadNotes();
    // Re-select the currently open note so the editor doesn't lose state
    if (state.currentNote) selectNote(state.currentNote);
}

async function selectNote(note) {
    // auto-save the currently open note before switching to a different one
    if (state.currentNote && state.currentNote.id !== note.id) {
        await _autoSaveCurrentNote();
    }
    state.currentNote = note;
    const titleEl = document.getElementById("note-title-input");
    const editorEl = document.getElementById("note-editor");
    const editorArea = document.getElementById("note-editor-area");
    const placeholder = document.getElementById("note-editor-placeholder");
    const includeToggle = document.getElementById("note-include-toggle");
    if (titleEl) titleEl.value = note.title || "";
    if (editorEl) editorEl.value = note.content || "";
    if (editorArea) editorArea.style.display = "flex";
    if (placeholder) placeholder.style.display = "none";
    if (includeToggle) includeToggle.checked = note.includeInContext || false;
    document.querySelectorAll(".note-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.noteId === note.id);
    });
}

function filterNotes(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll(".note-item").forEach((el) => {
        const title =
            el.querySelector(".note-item-title")?.textContent?.toLowerCase() ||
            "";
        el.style.display = !q || title.includes(q) ? "" : "none";
    });
}

function searchNotes(query) {
    const globalToggle = document.getElementById("notes-global-toggle");
    const isGlobal = globalToggle && globalToggle.checked;
    if (isGlobal) {
        searchAllNotes(query);
    } else {
        // reset scope label
        const scopeEl = document.getElementById("notes-scope-label");
        if (scopeEl) scopeEl.style.display = "none";
        filterNotes(query);
    }
}

async function searchAllNotes(query) {
    const q = (query || "").toLowerCase().trim();
    const scopeEl = document.getElementById("notes-scope-label");
    const list = document.getElementById("notes-list");
    if (!list) return;

    // Build a project id→name map from state
    const projMap = {};
    (state.projects || []).forEach((p) => {
        projMap[p.id] = p.name;
    });

    // Fetch all notes across all projects
    const allNotes = await dbGetAll("notes");

    // Filter by query (title + content), then sort by updatedAt desc
    const matched = allNotes.filter((n) => {
        if (!q) return true;
        const inTitle = (n.title || "").toLowerCase().includes(q);
        const inContent = (n.content || "").toLowerCase().includes(q);
        return inTitle || inContent;
    });
    matched.sort((a, b) => b.updatedAt - a.updatedAt);

    // Update scope label
    if (scopeEl) {
        scopeEl.textContent = matched.length
            ? matched.length +
              " note" +
              (matched.length === 1 ? "" : "s") +
              " across all projects"
            : "No notes found";
        scopeEl.style.display = "block";
    }

    // Render results
    list.innerHTML = "";
    matched.forEach((n) => {
        const projName = projMap[n.projectId] || "Unknown project";
        const el = document.createElement("div");
        el.className =
            "note-item" +
            (state.currentNote && state.currentNote.id === n.id
                ? " active"
                : "");
        el.dataset.noteId = n.id;
        el.innerHTML =
            '<div style="display:flex;align-items:center;gap:4px">' +
            '<span class="note-pin-btn' +
            (n.pinned ? " pinned" : "") +
            '" data-id="' +
            n.id +
            '" title="' +
            (n.pinned ? "Unpin" : "Pin to top") +
            '">' +
            (n.pinned ? "★" : "☆") +
            "</span>" +
            '<div class="note-item-title">' +
            (n.title || "Untitled") +
            "</div>" +
            "</div>" +
            '<div class="note-item-date" style="display:flex;justify-content:space-between;gap:4px">' +
            '<span style="color:var(--accent);opacity:0.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px" title="' +
            projName +
            '">' +
            projName +
            "</span>" +
            "<span>" +
            new Date(n.updatedAt).toLocaleDateString() +
            "</span>" +
            "</div>";
        el.onclick = async (e) => {
            if (e.target.classList.contains("note-pin-btn")) return;
            // Switch project if needed, then open the note
            if (
                !state.activeProject ||
                state.activeProject.id !== n.projectId
            ) {
                await loadProject(n.projectId);
                // Re-show notes view after project load (loadProject switches to chat)
                showView("notes");
            }
            selectNote(n);
        };
        el.querySelector(".note-pin-btn").addEventListener(
            "click",
            async (e) => {
                e.stopPropagation();
                await toggleNotePin(n.id);
            },
        );
        list.appendChild(el);
    });
}

async function toggleNoteInContext() {
    if (!state.currentNote) return;
    const el = document.getElementById("note-include-toggle");
    if (!el) return;
    state.currentNote.includeInContext = el.checked;
    state.currentNote.updatedAt = Date.now();
    await dbPut("notes", state.currentNote);
}

async function openNewNote() {
    if (!state.activeProject) return;
    const note = {
        id: uid(),
        projectId: state.activeProject.id,
        title: "",
        content: "",
        includeInContext: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    await dbPut("notes", note);
    state.currentNote = note;
    await loadNotes();
    selectNote(note);
    const titleEl = document.getElementById("note-title-input");
    if (titleEl) titleEl.focus();
}

async function saveCurrentNote() {
    if (!state.currentNote) return;
    const titleEl = document.getElementById("note-title-input");
    const editorEl = document.getElementById("note-editor");
    state.currentNote.title =
        (titleEl ? titleEl.value.trim() : "") || "Untitled";
    state.currentNote.content = editorEl ? editorEl.value : "";
    state.currentNote.updatedAt = Date.now();
    await dbPut("notes", state.currentNote);
    await loadNotes();
    selectNote(state.currentNote);
}

async function deleteCurrentNote() {
    if (!state.currentNote) return;
    if (!confirm("Delete this note?")) return;
    await dbDelete("notes", state.currentNote.id);
    state.currentNote = null;
    await loadNotes();
}
