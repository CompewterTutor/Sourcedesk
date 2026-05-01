// ─── BOOT ─────────────────────────────────────────────────────────────────────
function _bootError(msg) {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:Inter,sans-serif;background:#0f0e0c;color:#e8e4dc">
        <div style="font-size:18px;color:#c9a84c;font-weight:600">SourceDesk — Startup Error</div>
        <div style="font-size:13px;color:#a8a49c;max-width:480px;text-align:center;line-height:1.6;white-space:pre-wrap">${String(msg).replace(/</g, "&lt;")}</div>
        <button onclick="location.reload()" style="background:#c9a84c;border:none;color:#0f0e0c;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Reload</button>
    </div>`;
}

async function boot() {
  try {
    await openDB();
  } catch (err) {
    _bootError(
      err.message ||
        "IndexedDB could not be opened. Close all other SourceDesk tabs and reload.",
    );
    return;
  }

  try {
    state.templates = await dbGetAll("templates");
    state.projects = await dbGetAll("projects");

    const provider = await dbGet("settings", "provider");
    const model = await dbGet("settings", "model");
    const globalContext = await dbGet("settings", "globalContext");
    const anthropicKey = await dbGet("settings", "apiKey_anthropic");
    const openaiKey = await dbGet("settings", "apiKey_openai");
    const openrouterKey = await dbGet("settings", "apiKey_openrouter");
    const githubKey = await dbGet("settings", "apiKey_github");
    const constants = await dbGet("settings", "constants");
    const driveToken = await dbGet("settings", "driveToken");
    // Legacy: old single apiKey → migrate to anthropicKey
    const legacyKey = await dbGet("settings", "apiKey");

    if (provider) state.settings.provider = provider.value;
    if (model) state.settings.model = model.value;
    if (globalContext) state.settings.globalContext = globalContext.value;
    if (anthropicKey) state.settings.anthropicKey = anthropicKey.value;
    else if (legacyKey) state.settings.anthropicKey = legacyKey.value; // migrate
    if (openaiKey) state.settings.openaiKey = openaiKey.value;
    if (openrouterKey) state.settings.openrouterKey = openrouterKey.value;
    if (githubKey) state.settings.githubKey = githubKey.value;
    if (constants) state.settings.constants = constants.value;
    if (driveToken) state.settings.driveToken = driveToken.value;
    const localLlmUrl = await dbGet("settings", "localLlmUrl");
    if (localLlmUrl) state.settings.localLlmUrl = localLlmUrl.value;
    const embeddingModel = await dbGet("settings", "embeddingModel");
    if (embeddingModel) state.settings.embeddingModel = embeddingModel.value;
    const braveApiKey = await dbGet("settings", "braveApiKey");
    if (braveApiKey) state.settings.braveApiKey = braveApiKey.value;
    const crawl4aiUrl = await dbGet("settings", "crawl4aiUrl");
    if (crawl4aiUrl) state.settings.crawl4aiUrl = crawl4aiUrl.value;
    const markitdownUrl = await dbGet("settings", "markitdownUrl");
    if (markitdownUrl) state.settings.markitdownUrl = markitdownUrl.value;
    const suggestionWebhook = await dbGet("settings", "suggestionWebhook");
    if (suggestionWebhook)
      state.settings.suggestionWebhook = suggestionWebhook.value;
    // Apply .env defaults injected by server.js (only if DB has no saved value)
    const _senv = window.__SOURCEDESK_ENV__ || {};
    if (!state.settings.localLlmUrl && _senv.localLlmUrl) {
      state.settings.localLlmUrl = _senv.localLlmUrl;
    }
    if (!state.settings.markitdownUrl && _senv.markitdownUrl) {
      state.settings.markitdownUrl = _senv.markitdownUrl;
    }
    if (
      _senv.localLlmDefaultModel &&
      state.settings.provider === "local" &&
      !state.settings.model
    ) {
      state.settings.model = _senv.localLlmDefaultModel;
    }

    // Show server backup button only when running via the local server
    if (window.location.protocol !== "file:") {
      const sbBtn = document.getElementById("server-backup-btn");
      if (sbBtn) sbBtn.style.display = "";
    }

    // Set version string in topbar
    const vEl = document.getElementById("app-version");
    if (vEl) vEl.textContent = `v${APP_VERSION}`;

    renderSidebar();
    checkApiKey();
    _initRichEditors();
  } catch (err) {
    _bootError(
      "Boot failed: " +
        (err.message || err) +
        "\n\nCheck the browser console for details.",
    );
    console.error("[SourceDesk boot error]", err);
  }
}

// Mount rich-text dual-mode editors on the main authoring surfaces.
// Safe to call once at boot — `mountRichEditor` is a no-op for already-mounted
// textareas.
function _initRichEditors() {
  if (typeof mountRichEditor !== "function") return;
  const surfaces = [
    "working-doc-editor",
    "note-editor",
    "tmpl-content",
    "sq-answer-editor",
  ];
  surfaces.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      try {
        mountRichEditor(el);
      } catch (e) {
        console.warn("[rte] mount failed for #" + id, e);
      }
    }
  });
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────
function showView(v) {
  if (v !== "notes") _autoSaveCurrentNote(); // fire-and-forget when leaving notes
  document.getElementById("templates-view").style.display =
    v === "templates" ? "flex" : "none";
  document.getElementById("chat-view").style.display =
    v === "chat" ? "flex" : "none";
  document.getElementById("notes-view").style.display =
    v === "notes" ? "flex" : "none";
  document.getElementById("working-doc-view").style.display =
    v === "working-doc" ? "flex" : "none";
  document.getElementById("sq-view").style.display =
    v === "sq" ? "flex" : "none";
  document.getElementById("tasks-view").style.display =
    v === "tasks" ? "flex" : "none";
  document.getElementById("contacts-view").style.display =
    v === "contacts" ? "flex" : "none";
  {
    const rv = document.getElementById("research-view");
    if (rv) rv.style.display = v === "research" ? "flex" : "none";
  }
  {
    const gv = document.getElementById("guidelines-view");
    if (gv) gv.style.display = v === "guidelines" ? "flex" : "none";
  }
  if (v === "templates") renderTemplatesGrid();
  if (v === "notes") loadNotes();
  if (v === "working-doc") _fillWorkingDocEditor();
  if (v === "sq") loadSupplierQuestions();
  if (v === "tasks") loadTasks();
  if (v === "contacts") loadContacts();
  if (v === "research" && typeof loadResearchBoard === "function")
    loadResearchBoard();
  if (v === "guidelines") loadGuidelines();
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById("projects-list");
  list.innerHTML = "";
  const icons = {
    RFP: "📋",
    RFI: "📄",
    "Vendor Q": "🏢",
    Contract: "📑",
    Research: "🔍",
    Other: "📁",
  };
  state.projects
    .slice()
    .reverse()
    .forEach((p) => {
      const item = document.createElement("div");
      item.className =
        "sidebar-item" + (state.activeProject?.id === p.id ? " active" : "");
      item.innerHTML = `<span class="item-icon">${icons[p.category] || "📁"}</span><span class="item-name">${p.name}</span><span class="sidebar-item-actions"><button class="sidebar-action-btn" title="Edit project" onclick="event.stopPropagation();openEditProject('${p.id}')">✏</button><button class="sidebar-action-btn sidebar-action-del" title="Delete project" onclick="event.stopPropagation();deleteProject('${p.id}')">✕</button></span>`;
      item.onclick = () => loadProject(p.id);
      list.appendChild(item);
    });
}

// ─── LOAD PROJECT ─────────────────────────────────────────────────────────────
async function loadProject(id) {
  const proj = state.projects.find((p) => p.id === id);
  if (!proj) return;
  state.activeProject = proj;
  state.messages = [];
  state.activeChatId = null;
  state.activeDocs = new Set();
  state.activeOtherProjects = new Set();
  state.currentNote = null;
  state.currentQuestion = null;

  // load chat history — find the most recently updated session
  const chats = await dbGetByIndex("chats", "projectId", id);
  if (chats.length) {
    const latest = chats.reduce((a, b) =>
      (b.updatedAt || b.createdAt || 0) > (a.updatedAt || a.createdAt || 0)
        ? b
        : a,
    );
    state.messages = latest.messages || [];
    state.activeChatId = latest.id;
  }

  // load docs for project — enable all by default (exclude guideline docs from context)
  const docs = await dbGetByIndex("docs", "projectId", id);
  docs.forEach((d) => {
    if (d.docType !== "guideline") state.activeDocs.add(d.id);
  });

  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("chat-messages").classList.remove("hidden");
  document.getElementById("chat-input-area").classList.remove("hidden");

  const badge = document.getElementById("project-type-badge");
  document.getElementById("project-title").textContent = proj.name;
  badge.textContent = proj.category;
  badge.classList.remove("hidden");

  const exportBtn = document.getElementById("export-project-btn");
  if (exportBtn) exportBtn.classList.remove("hidden");

  const wdBtn = document.getElementById("working-doc-btn");
  if (wdBtn) wdBtn.classList.remove("hidden");

  const clearChatBtn = document.getElementById("clear-chat-btn");
  if (clearChatBtn) clearChatBtn.classList.remove("hidden");

  const tasksBtn = document.getElementById("tasks-nav-btn");
  if (tasksBtn) tasksBtn.style.display = "";

  const contactsBtn = document.getElementById("contacts-nav-btn");
  if (contactsBtn) contactsBtn.style.display = "";

  const researchBtn = document.getElementById("research-nav-btn");
  if (researchBtn) researchBtn.style.display = "";

  const guidelinesBtn = document.getElementById("guidelines-nav-btn");
  if (guidelinesBtn) guidelinesBtn.style.display = "";

  renderSidebar();
  renderMessages();
  await renderRightPanel();
  renderChatSessionList();
  checkApiKey();
}
