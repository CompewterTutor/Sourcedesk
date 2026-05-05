// ─── PROJECTS ────────────────────────────────────────────────────────────────
function openNewProject() {
  state.editingProjectId = null;
  document.getElementById("modal-project-title").textContent = "New Project";
  document.getElementById("proj-save-btn").textContent = "Create Project";
  document.getElementById("proj-name").value = "";
  document.getElementById("proj-notes").value = "";
  document.getElementById("proj-instructions").value = "";
  // Hide project ID row — ID doesn't exist yet for new projects
  const idRow = document.getElementById("proj-id-row");
  if (idRow) idRow.style.display = "none";
  selectPillByVal("proj-category-pills", "RFP");
  const sel = document.getElementById("proj-template-select");
  sel.innerHTML = '<option value="">— Start blank —</option>';
  state.templates.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `[${t.category}] ${t.name}`;
    sel.appendChild(opt);
  });
  showModal("modal-project");
}

async function saveProject() {
  const name = document.getElementById("proj-name").value.trim();
  const notes = document.getElementById("proj-notes").value.trim();
  const category = getActivePill("proj-category-pills");
  const templateId =
    document.getElementById("proj-template-select").value || null;
  const instructions = document
    .getElementById("proj-instructions")
    .value.trim();
  if (!name) {
    alert("Please enter a project name.");
    return;
  }

  if (state.editingProjectId) {
    // ── update existing project ──────────────────────────────────────────
    const proj = state.projects.find((p) => p.id === state.editingProjectId);
    if (!proj) return;
    proj.name = name;
    proj.notes = notes;
    proj.category = category;
    proj.instructions = instructions;
    // only swap template/content if a different template was chosen
    if (templateId && templateId !== proj.templateId) {
      proj.templateId = templateId;
      const tmpl = state.templates.find((t) => t.id === templateId);
      if (tmpl) proj.workingContent = tmpl.content;
    }
    await dbPut("projects", proj);
    state.editingProjectId = null;
    closeModal();
    if (state.activeProject?.id === proj.id) {
      state.activeProject = proj;
      document.getElementById("project-title").textContent = proj.name;
      document.getElementById("project-type-badge").textContent = proj.category;
    }
    renderSidebar();
  } else {
    // ── create new project ───────────────────────────────────────────────
    let workingContent = "";
    if (templateId) {
      const tmpl = state.templates.find((t) => t.id === templateId);
      if (tmpl) workingContent = tmpl.content;
    }
    const proj = {
      id: uid(),
      name,
      category,
      templateId,
      notes,
      instructions,
      workingContent,
      createdAt: Date.now(),
    };
    await dbPut("projects", proj);
    state.projects.push(proj);
    closeModal();
    renderSidebar();
    await loadProject(proj.id);
  }
}

function openEditProject(id) {
  const proj = state.projects.find((p) => p.id === id);
  if (!proj) return;
  state.editingProjectId = id;
  document.getElementById("modal-project-title").textContent = "Edit Project";
  document.getElementById("proj-save-btn").textContent = "Save Changes";
  document.getElementById("proj-name").value = proj.name;
  document.getElementById("proj-notes").value = proj.notes || "";
  document.getElementById("proj-instructions").value = proj.instructions || "";
  // Show project ID for easy copying into API calls
  const idRow = document.getElementById("proj-id-row");
  const idDisplay = document.getElementById("proj-id-display");
  if (idRow && idDisplay) {
    idDisplay.value = proj.id;
    idRow.style.display = "";
  }
  selectPillByVal("proj-category-pills", proj.category);
  const sel = document.getElementById("proj-template-select");
  sel.innerHTML = '<option value="">— (keep current) —</option>';
  state.templates.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `[${t.category}] ${t.name}`;
    sel.appendChild(opt);
  });
  if (proj.templateId) sel.value = proj.templateId;
  showModal("modal-project");
}

function copyProjectId() {
  const idDisplay = document.getElementById("proj-id-display");
  if (!idDisplay || !idDisplay.value) return;
  navigator.clipboard
    .writeText(idDisplay.value)
    .then(() => {
      const btn = document.getElementById("proj-id-copy-btn");
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "✓ Copied!";
        btn.style.color = "var(--success)";
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.color = "";
        }, 1800);
      }
    })
    .catch(() => {
      // Fallback for non-HTTPS contexts (e.g. file://)
      idDisplay.select();
      document.execCommand("copy");
    });
}

async function deleteProject(id) {
  if (
    !confirm(
      "Delete this project and all its documents, chat history, and notes?",
    )
  )
    return;
  // cascade-delete docs, chats, notes
  const docs = await dbGetByIndex("docs", "projectId", id);
  for (const d of docs) await dbDelete("docs", d.id);
  const chats = await dbGetByIndex("chats", "projectId", id);
  for (const c of chats) await dbDelete("chats", c.id);
  const notes = await dbGetByIndex("notes", "projectId", id);
  for (const n of notes) await dbDelete("notes", n.id);
  const sqs = await dbGetByIndex("supplierQuestions", "projectId", id);
  for (const sq of sqs) await dbDelete("supplierQuestions", sq.id);
  try {
    const tasks = await dbGetByIndex("tasks", "projectId", id);
    for (const t of tasks) await dbDelete("tasks", t.id);
  } catch (e) {}
  try {
    const contacts = await dbGetByIndex("contacts", "projectId", id);
    for (const c of contacts) await dbDelete("contacts", c.id);
  } catch (e) {}
  try {
    const versions = await dbGetByIndex("docVersions", "projectId", id);
    for (const v of versions) await dbDelete("docVersions", v.id);
  } catch (e) {}
  try {
    const guidelineAnalyses = await dbGetByIndex(
      "guidelineAnalyses",
      "projectId",
      id,
    );
    for (const ga of guidelineAnalyses)
      await dbDelete("guidelineAnalyses", ga.id);
  } catch (e) {}
  await dbDelete("projects", id);
  state.projects = state.projects.filter((p) => p.id !== id);
  if (state.activeProject?.id === id) {
    state.activeProject = null;
    state.messages = [];
    state.activeDocs = new Set();
    state.activeOtherProjects = new Set();
    state.currentNote = null;
    document.getElementById("welcome-screen").classList.remove("hidden");
    document.getElementById("chat-messages").classList.add("hidden");
    document.getElementById("chat-input-area").classList.add("hidden");
    document.getElementById("project-title").textContent =
      "No project selected";
    document.getElementById("project-type-badge").classList.add("hidden");
    const exportBtn = document.getElementById("export-project-btn");
    if (exportBtn) exportBtn.classList.add("hidden");
    const wdBtn = document.getElementById("working-doc-btn");
    if (wdBtn) wdBtn.classList.add("hidden");
    const clearChatBtn = document.getElementById("clear-chat-btn");
    if (clearChatBtn) clearChatBtn.classList.add("hidden");
    showView("chat");
  }
  renderSidebar();
}
