// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}
function closeModalOnOverlay(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
}

function selectPill(el, groupId) {
  document
    .querySelectorAll(`#${groupId} .type-pill`)
    .forEach((p) => p.classList.remove("active"));
  el.classList.add("active");
}
function selectPillByVal(groupId, val) {
  document.querySelectorAll(`#${groupId} .type-pill`).forEach((p) => {
    p.classList.toggle("active", p.dataset.val === val);
  });
}
function getActivePill(groupId) {
  return (
    document.querySelector(`#${groupId} .type-pill.active`)?.dataset.val || ""
  );
}

// ─── INPUT RESIZE ────────────────────────────────────────────────────────────
if (!TEST) {
  document.addEventListener("DOMContentLoaded", () => {
    const ta = document.getElementById("chat-input");
    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      if (typeof updateContextMeter === "function") updateContextMeter();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    // Ctrl+S / Cmd+S to save current note
    ["note-editor", "note-title-input"].forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.addEventListener("keydown", (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            saveCurrentNote();
          }
        });
    });
    // Ctrl+S / Cmd+S to save working document
    const wdEditor = document.getElementById("working-doc-editor");
    if (wdEditor)
      wdEditor.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          saveWorkingDoc();
        }
      });
    // Global keyboard shortcuts
    document.addEventListener("keydown", function (e) {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Enter — send message
      if (ctrl && e.key === "Enter") {
        const chatView = document.getElementById("chat-view");
        if (chatView && chatView.style.display !== "none") {
          e.preventDefault();
          sendMessage();
          return;
        }
      }

      // Escape — close topmost modal
      if (e.key === "Escape") {
        const overlay = document.getElementById("modal-overlay");
        if (overlay && !overlay.classList.contains("hidden")) {
          e.preventDefault();
          closeModal();
          return;
        }
      }

      // Ctrl+N — new note (only in notes view)
      if (ctrl && e.key === "n") {
        const notesView = document.getElementById("notes-view");
        if (notesView && notesView.style.display !== "none") {
          e.preventDefault();
          openNewNote();
          return;
        }
      }

      // Ctrl+Shift+F — focus notes search
      if (ctrl && e.shiftKey && e.key === "F") {
        const notesView = document.getElementById("notes-view");
        if (notesView && notesView.style.display !== "none") {
          e.preventDefault();
          const filterEl = document.getElementById("notes-filter");
          if (filterEl) filterEl.focus();
          return;
        }
      }

      // Ctrl+Shift+K — cross-project session search
      if (ctrl && e.shiftKey && e.key === "K") {
        e.preventDefault();
        if (typeof openCrossSearch === "function") openCrossSearch();
        return;
      }
    });

    showView("chat");
    boot();
  });
}
