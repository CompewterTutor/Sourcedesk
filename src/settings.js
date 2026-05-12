// ─── SETTINGS ────────────────────────────────────────────────────────────────
async function fetchLocalModels() {
  const urlEl = document.getElementById("local-llm-url");
  const base = (
    urlEl ? urlEl.value.trim() : state.settings.localLlmUrl || ""
  ).replace(/\/$/, "");
  const sel = document.getElementById("settings-model");

  if (!base) {
    if (sel)
      sel.innerHTML = '<option value="">Enter a Base URL above first</option>';
    return;
  }

  if (sel) sel.innerHTML = '<option value="">Detecting models…</option>';

  try {
    const reqHeaders = {};
    const keyEl = document.getElementById("settings-apikey");
    if (keyEl && keyEl.value.trim()) {
      reqHeaders["Authorization"] = "Bearer " + keyEl.value.trim();
    }
    const res = await _localFetch(base + "/models", {
      method: "GET",
      headers: reqHeaders,
    });
    if (res.status === 401)
      throw new Error("HTTP 401 — enter the API key in the field above");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    log("fetchLocalModels raw response:", JSON.stringify(data).slice(0, 300));
    const list = data.data || data.models || [];
    const models = list
      .map((m) => ({
        id: m.id || m.key || m.name || m.model,
        label: m.display_name || m.id || m.key || m.name || m.model,
        contextLength:
          m.context_length ||
          m.context_window ||
          m.n_ctx ||
          m.max_context_length ||
          0,
      }))
      .filter((m) => m.id);

    if (!models.length) {
      const topKeys = Object.keys(data).join(", ") || "(empty)";
      const listLen = list.length;
      throw new Error(
        listLen
          ? `${listLen} model(s) found but none had a usable id/name field (first model keys: ${Object.keys(list[0] || {}).join(", ")})`
          : `Empty model list — load a model in LM Studio first (response keys: ${topKeys})`,
      );
    }

    PROVIDERS.local.models = models;
    PROVIDERS.local.defaultModel = models[0].id;

    // Store any context limits the server reported so the context meter
    // can self-calibrate without relying on the hardcoded CONTEXT_LIMITS map.
    if (typeof setModelContextLimit === "function") {
      models.forEach((m) => {
        if (m.contextLength) setModelContextLimit(m.id, m.contextLength);
      });
    }

    if (sel) {
      sel.innerHTML = "";
      models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        sel.appendChild(opt);
      });
      // Restore previously selected model if it's in the list
      if (
        state.settings.model &&
        models.some((m) => m.id === state.settings.model)
      ) {
        sel.value = state.settings.model;
      } else {
        sel.value = models[0].id;
      }
    }
    syncTopbarModelSelect();
  } catch (err) {
    const msg = err.message || "Detection failed";
    if (sel) sel.innerHTML = `<option value="">⚠ ${msg}</option>`;
    log("fetchLocalModels:", err.message);
  }
}

function openSettings() {
  const prov = state.settings.provider || "anthropic";
  selectPillByVal("provider-pills", prov);
  updateProviderUI(prov);
  document.getElementById("settings-apikey").value = getCurrentProviderKey();
  document.getElementById("settings-context").value =
    state.settings.globalContext || "";
  document.getElementById("settings-constants").value =
    state.settings.constants || "";
  const _localUrlEl = document.getElementById("local-llm-url");
  if (_localUrlEl) _localUrlEl.value = state.settings.localLlmUrl || "";
  const _embEl = document.getElementById("embedding-model-input");
  if (_embEl) _embEl.value = state.settings.embeddingModel || "";
  const _braveEl = document.getElementById("settings-brave-key");
  if (_braveEl) _braveEl.value = state.settings.braveApiKey || "";
  const _crawlEl = document.getElementById("settings-crawl4ai-url");
  if (_crawlEl)
    _crawlEl.value = state.settings.crawl4aiUrl || "http://localhost:11235";
  const _webhookEl = document.getElementById("settings-suggestion-webhook");
  if (_webhookEl) _webhookEl.value = state.settings.suggestionWebhook || "";
  const _mkdEl = document.getElementById("settings-markitdown-url");
  if (_mkdEl) _mkdEl.value = state.settings.markitdownUrl || "";
  const _serverUrlEl = document.getElementById("settings-server-url");
  if (_serverUrlEl) _serverUrlEl.value = state.settings.serverUrl || "";
  const _serverTokenEl = document.getElementById("settings-server-token");
  if (_serverTokenEl) _serverTokenEl.value = state.settings.serverToken || "";
  const _hindsightToggle = document.getElementById(
    "settings-hindsight-enabled",
  );
  if (_hindsightToggle)
    _hindsightToggle.checked = !!state.settings.hindsightEnabled;
  // Refresh token manager list if server URL is set
  if (state.settings.serverUrl && state.settings.serverToken) {
    openTokenManager();
  }
  updateApiKeyStatus(!!getCurrentProviderKey());
  // Refresh writing style status badge
  if (typeof _updateWritingStyleSettingsStatus === "function")
    _updateWritingStyleSettingsStatus();
  showModal("modal-settings");
  // Sync topbar model selector in case it's stale
  if ((state.settings.provider || "anthropic") === "local")
    syncTopbarModelSelect();
}

function updateProviderUI(provider) {
  const cfg = PROVIDERS[provider] || PROVIDERS.anthropic;
  document.getElementById("apikey-label").textContent = cfg.keyLabel;
  document.getElementById("settings-apikey").placeholder = cfg.keyPlaceholder;
  document.getElementById("apikey-hint").innerHTML = cfg.keyHint;

  const modelSel = document.getElementById("settings-model");
  modelSel.innerHTML = "";
  cfg.models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSel.appendChild(opt);
  });

  // Keep current model if it belongs to this provider, else use default
  if (cfg.models.some((m) => m.id === state.settings.model)) {
    modelSel.value = state.settings.model;
  } else {
    modelSel.value = cfg.defaultModel;
  }
  // Show/hide local LLM URL row
  const urlRow = document.getElementById("local-llm-url-row");
  if (urlRow) urlRow.classList.toggle("hidden", provider !== "local");
  const embRow = document.getElementById("embedding-model-row");
  if (embRow) embRow.classList.toggle("hidden", provider !== "local");
  if (provider === "local") {
    const urlEl = document.getElementById("local-llm-url");
    if (urlEl && !urlEl.value) urlEl.value = state.settings.localLlmUrl || "";
    // Warn if running from file:// (CORS will block localhost requests)
    const corsWarn = document.getElementById("local-cors-warning");
    if (corsWarn) {
      corsWarn.classList.toggle("hidden", window.location.protocol !== "file:");
    }
  }
  // Show/hide topbar local model selector
  const topbarLocal = document.getElementById("topbar-local-model");
  if (topbarLocal) topbarLocal.classList.toggle("hidden", provider !== "local");
}

function onProviderChange(provider) {
  // Snapshot the key the user typed for the old provider before switching UI
  // NOTE: getActivePill() already reflects the new provider at this point because
  // selectPill() runs before onProviderChange() in the onclick handler.
  // Use state.settings.provider instead, which still holds the previous provider.
  const oldProv = state.settings.provider || "anthropic";
  const typedKey = document.getElementById("settings-apikey").value;
  // Also snapshot the local LLM URL if we're leaving that provider
  if (oldProv === "local") {
    const urlEl = document.getElementById("local-llm-url");
    if (urlEl) state.settings.localLlmUrl = urlEl.value.trim();
  }
  setProviderKey(oldProv, typedKey);

  updateProviderUI(provider);
  document.getElementById("settings-apikey").value =
    state.settings[provider + "Key"] || "";
  updateApiKeyStatus(!!state.settings[provider + "Key"]);
  // Auto-detect models when switching to local provider
  if (provider === "local") fetchLocalModels();
}

async function saveSettings() {
  const provider = getActivePill("provider-pills") || "anthropic";
  const key = document.getElementById("settings-apikey").value.trim();
  const model = document.getElementById("settings-model").value;
  const ctx = document.getElementById("settings-context").value.trim();
  const constants = document.getElementById("settings-constants").value.trim();
  const localLlmUrl =
    document.getElementById("local-llm-url")?.value.trim() || "";
  state.settings.provider = provider;
  state.settings.model = model;
  state.settings.globalContext = ctx;
  state.settings.constants = constants;
  state.settings.localLlmUrl = localLlmUrl;

  setProviderKey(provider, key);
  await dbPut("settings", { key: "provider", value: provider });
  await dbPut("settings", { key: `apiKey_${provider}`, value: key });
  await dbPut("settings", { key: "model", value: model });
  await dbPut("settings", { key: "globalContext", value: ctx });
  await dbPut("settings", { key: "constants", value: constants });
  await dbPut("settings", { key: "localLlmUrl", value: localLlmUrl });

  const embeddingModel =
    document.getElementById("embedding-model-input")?.value.trim() || "";
  state.settings.embeddingModel = embeddingModel;
  await dbPut("settings", { key: "embeddingModel", value: embeddingModel });

  const braveApiKey =
    document.getElementById("settings-brave-key")?.value.trim() || "";
  state.settings.braveApiKey = braveApiKey;
  await dbPut("settings", { key: "braveApiKey", value: braveApiKey });

  const crawl4aiUrl =
    document.getElementById("settings-crawl4ai-url")?.value.trim() || "";
  state.settings.crawl4aiUrl = crawl4aiUrl;
  await dbPut("settings", { key: "crawl4aiUrl", value: crawl4aiUrl });

  const suggestionWebhook =
    document.getElementById("settings-suggestion-webhook")?.value.trim() || "";
  state.settings.suggestionWebhook = suggestionWebhook;
  await dbPut("settings", {
    key: "suggestionWebhook",
    value: suggestionWebhook,
  });

  const markitdownUrl =
    document.getElementById("settings-markitdown-url")?.value.trim() || "";
  state.settings.markitdownUrl = markitdownUrl;
  await dbPut("settings", { key: "markitdownUrl", value: markitdownUrl });

  const serverUrl =
    (document.getElementById("settings-server-url") || {}).value || "";
  if (serverUrl) {
    try {
      new URL(serverUrl);
    } catch {
      const el = document.getElementById("settings-server-url");
      if (el) {
        el.style.outline = "2px solid var(--danger)";
        el.title =
          "Invalid URL — check for typos (e.g. bad IP octet or missing http://)";
        el.focus();
      }
      alert(
        'Server URL is not a valid URL.\nCheck for typos — e.g. "192.168.1.2000" has an invalid IP octet.',
      );
      return;
    }
    const el = document.getElementById("settings-server-url");
    if (el) {
      el.style.outline = "";
      el.title = "";
    }
  }
  await dbPut("settings", { key: "serverUrl", value: serverUrl });
  state.settings.serverUrl = serverUrl;

  const serverToken =
    (document.getElementById("settings-server-token") || {}).value || "";
  await dbPut("settings", { key: "serverToken", value: serverToken });
  state.settings.serverToken = serverToken;

  const hindsightEnabled = !!(
    document.getElementById("settings-hindsight-enabled") || {}
  ).checked;
  state.settings.hindsightEnabled = hindsightEnabled;
  await dbPut("settings", { key: "hindsightEnabled", value: hindsightEnabled });

  const emailSummBtn = document.getElementById("email-summaries-nav-btn");
  if (emailSummBtn) emailSummBtn.style.display = serverUrl ? "" : "none";

  closeModal();
  checkApiKey();
}

function topbarModelChange(modelId) {
  if (!modelId) return;
  state.settings.model = modelId;
  dbPut("settings", { key: "model", value: modelId });
  // Sync to settings modal selector if open
  const settingsSel = document.getElementById("settings-model");
  if (settingsSel && settingsSel.value !== modelId) settingsSel.value = modelId;
}

async function refreshTopbarModels() {
  // Re-run fetchLocalModels and also sync result to topbar selector
  await fetchLocalModels();
  syncTopbarModelSelect();
}

// ─── UNLOAD LOCAL MODEL ───────────────────────────────────────────────────────
// Tries two unload approaches in sequence:
//   1. Ollama native API: POST {root}/api/generate  { model, keep_alive: 0 }
//   2. LM Studio v1 API:  POST {root}/api/v1/models/unload  { identifier: model }
// Both use the same root URL obtained by stripping the /v1 (or /api/v1) suffix
// from the configured base URL.  Falls through to LM Studio if Ollama 404s.
async function unloadLocalModel() {
  const base = (state.settings.localLlmUrl || "").replace(/\/$/, "");
  if (!base) {
    alert("No Local LLM Base URL configured. Set it in Settings first.");
    return;
  }
  const model = state.settings.model;
  if (!model) {
    alert("No model currently selected.");
    return;
  }
  // Build status element references (topbar and/or settings modal)
  const statusEls = [
    document.getElementById("unload-model-status-topbar"),
    document.getElementById("unload-model-status-settings"),
  ].filter(Boolean);

  function _setUnloadStatus(msg, color) {
    statusEls.forEach(function (el) {
      el.textContent = msg;
      el.style.color = color || "var(--text-muted)";
    });
  }

  _setUnloadStatus("Unloading\u2026", "var(--text-muted)");

  // Strip /v1 or /api/v1 suffix to get the server root
  const root = base.replace(/\/(api\/)?v\d+\/?$/i, "");

  try {
    // 1. Try LM Studio first: POST /api/v1/models/unload (deterministic endpoint, 0.4.0+)
    const lmsRes = await _localFetch(root + "/api/v1/models/unload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: model }),
    });
    if (lmsRes.ok) {
      _setUnloadStatus("\u2713 Unloaded (LM Studio)", "var(--success)");
      setTimeout(function () {
        _setUnloadStatus("");
      }, 4000);
      return;
    }
    if (lmsRes.status !== 404) {
      // LM Studio responded with a real error (not "endpoint not found") — surface it
      _setUnloadStatus(
        "\u26a0 LM Studio HTTP " + lmsRes.status,
        "var(--accent)",
      );
      setTimeout(function () {
        _setUnloadStatus("");
      }, 4000);
      return;
    }
    // LM Studio returned 404 — endpoint not present; this is probably Ollama, use keep_alive trick
    const ollamaRes = await _localFetch(root + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, keep_alive: 0 }),
    });
    if (ollamaRes.ok) {
      _setUnloadStatus("\u2713 Unloaded (Ollama)", "var(--success)");
    } else {
      _setUnloadStatus(
        "\u26a0 Ollama HTTP " + ollamaRes.status,
        "var(--accent)",
      );
    }
  } catch (e) {
    _setUnloadStatus("\u2717 " + (e.message || "Failed"), "var(--danger)");
  }
  setTimeout(function () {
    _setUnloadStatus("");
  }, 4000);
}

function syncTopbarModelSelect() {
  const topbarSel = document.getElementById("topbar-model-select");
  const settingsSel = document.getElementById("settings-model");
  if (!topbarSel || !settingsSel) return;
  // Copy options from settings selector to topbar selector
  topbarSel.innerHTML = settingsSel.innerHTML;
  topbarSel.value = settingsSel.value || state.settings.model || "";
}

function updateApiKeyStatus(hasKey) {
  document.getElementById("apikey-dot").classList.toggle("ok", hasKey);
  document.getElementById("apikey-status-text").textContent = hasKey
    ? "API key saved"
    : "No key saved";
}

function checkApiKey() {
  const banner = document.getElementById("no-key-banner");
  const isLocal = state.settings.provider === "local";
  banner.classList.toggle(
    "hidden",
    isLocal || !!getCurrentProviderKey() || !state.activeProject,
  );
}

async function clearAllData() {
  if (
    !confirm(
      "This will delete ALL projects, templates, documents, notes, and chat history. Are you sure?",
    )
  )
    return;
  const stores = [
    "templates",
    "projects",
    "docs",
    "chats",
    "settings",
    "notes",
    "embeddings",
    "contacts",
    "suggestions",
    "research",
    "evalCriteria",
    "evalCandidates",
    "evalScores",
    "guidelineAnalyses",
    "workingDocs",
  ];
  for (const s of stores) {
    const items = await dbGetAll(s);
    for (const item of items)
      await dbDelete(s, item[s === "settings" ? "key" : "id"]);
  }
  location.reload();
}

async function testEmbeddingModel() {
  const modelEl = document.getElementById("embedding-model-input");
  const statusEl = document.getElementById("embedding-test-status");
  const model = modelEl ? modelEl.value.trim() : "";
  if (!model) {
    if (statusEl) {
      statusEl.textContent = "Enter a model name first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }
  const base = (state.settings.localLlmUrl || "").replace(/\/$/, "");
  if (!base) {
    if (statusEl) {
      statusEl.textContent = "Set a Base URL first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }
  if (statusEl) {
    statusEl.textContent = "Testing…";
    statusEl.style.color = "var(--text-muted)";
  }
  const btn = document.getElementById("embedding-test-btn");
  if (btn) btn.disabled = true;
  try {
    const t0 = Date.now();
    const headers = { "Content-Type": "application/json" };
    const localKey = state.settings.localKey || "";
    if (localKey) headers["Authorization"] = "Bearer " + localKey;
    const res = await _localFetch(base + "/embeddings", {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: "test" }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error((e.error && e.error.message) || "HTTP " + res.status);
    }
    const data = await res.json();
    const vec = data.data && data.data[0] && data.data[0].embedding;
    if (!vec || !vec.length) throw new Error("No embedding vector in response");
    const ms = Date.now() - t0;
    if (statusEl) {
      statusEl.textContent = `✓ Works — ${vec.length}-dim vector in ${ms} ms`;
      statusEl.style.color = "var(--success)";
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = "✗ " + err.message;
      statusEl.style.color = "var(--danger)";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── BRAVE / CRAWL4AI TESTS ──────────────────────────────────────────────────
async function testBraveKey() {
  const keyEl = document.getElementById("settings-brave-key");
  const statusEl = document.getElementById("brave-test-status");
  const key = keyEl ? keyEl.value.trim() : "";
  if (!key) {
    if (statusEl) {
      statusEl.textContent = "Enter a Brave API key first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }
  if (statusEl) {
    statusEl.textContent = "Testing…";
    statusEl.style.color = "var(--text-muted)";
  }
  try {
    const res = await fetch(
      "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": key,
        },
      },
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const n =
      data && data.web && data.web.results ? data.web.results.length : 0;
    if (statusEl) {
      statusEl.textContent = `✓ OK — received ${n} result${n === 1 ? "" : "s"}`;
      statusEl.style.color = "var(--success)";
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = "✗ " + err.message;
      statusEl.style.color = "var(--danger)";
    }
  }
}

async function testCrawl4aiEndpoint() {
  const urlEl = document.getElementById("settings-crawl4ai-url");
  const statusEl = document.getElementById("crawl4ai-test-status");
  const base = urlEl ? urlEl.value.trim().replace(/\/$/, "") : "";
  if (!base) {
    if (statusEl) {
      statusEl.textContent = "Enter a crawl4ai endpoint first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }
  if (statusEl) {
    statusEl.textContent = "Testing…";
    statusEl.style.color = "var(--text-muted)";
  }
  try {
    const res = await fetch(base + "/health");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json().catch(() => ({}));
    const status =
      data && (data.status || data.state)
        ? " — " + (data.status || data.state)
        : "";
    if (statusEl) {
      statusEl.textContent = "✓ Reachable" + status;
      statusEl.style.color = "var(--success)";
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent =
        "✗ " + err.message + " (CORS / endpoint not running?)";
      statusEl.style.color = "var(--danger)";
    }
  }
}

// ─── WORKING DOCUMENT ────────────────────────────────────────────
async function _loadWorkingDocView() {
  if (!state.activeProject) return;
  // Render doc selector in header
  await _renderWorkingDocSelector();
  // Fill editor
  await _fillWorkingDocEditor();
}

async function _fillWorkingDocEditor() {
  const ta = document.getElementById("working-doc-editor");
  if (!ta) return;
  let content = "";
  if (state.activeWorkingDocId) {
    const wdoc = await dbGet("workingDocs", state.activeWorkingDocId);
    content = (wdoc && wdoc.content) || "";
  }
  ta.value = content;
  if (typeof refreshRichEditor === "function") refreshRichEditor(ta);
}

async function openWorkingDoc() {
  if (!state.activeProject) return;
  showView("working-doc");
}

async function saveWorkingDoc(silent, skipSnapshot) {
  if (!state.activeProject) return;
  const ta = document.getElementById("working-doc-editor");
  const content = ta
    ? ta._rteMode === "rendered" && typeof ta._rteGetMarkdown === "function"
      ? ta._rteGetMarkdown()
      : ta.value
    : "";

  if (!state.activeWorkingDocId) {
    // No working doc yet — create one
    const wdoc = {
      id: uid(),
      projectId: state.activeProject.id,
      name: "Working Document",
      content,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbPut("workingDocs", wdoc);
    state.activeWorkingDocId = wdoc.id;
    await _renderWorkingDocSelector();
  } else {
    const wdoc = await dbGet("workingDocs", state.activeWorkingDocId);
    if (!wdoc) return;
    wdoc.content = content;
    wdoc.updatedAt = Date.now();
    await dbPut("workingDocs", wdoc);
  }

  if (!skipSnapshot) await saveDocVersion(content);
  if (!silent) {
    const btn = document.getElementById("working-doc-save-btn");
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Saved";
      setTimeout(() => {
        btn.textContent = orig;
      }, 1200);
    }
  }
}

// Autosave for the Working Document. Snapshots are NOT created on every
// keystroke — autosave only persists content. Explicit Save (or
// History modal entries) still produce snapshots via saveDocVersion().
function scheduleWorkingDocAutosave() {
  scheduleAutosave("workingDoc", () => saveWorkingDoc(true, true));
}

async function _renderWorkingDocSelector() {
  if (!state.activeProject) return;
  const wdocs = await dbGetByIndex(
    "workingDocs",
    "projectId",
    state.activeProject.id,
  );
  wdocs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const sel = document.getElementById("working-doc-selector");
  if (!sel) return; // selector element must exist in HTML

  sel.innerHTML = "";
  if (wdocs.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Working Document";
    sel.appendChild(opt);
  } else {
    wdocs.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.name || "Untitled";
      if (w.id === state.activeWorkingDocId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // Show/hide delete button (only visible when >1 doc)
  const delBtn = document.getElementById("working-doc-delete-btn");
  if (delBtn) delBtn.style.display = wdocs.length > 1 ? "" : "none";
}

async function openNewWorkingDoc() {
  if (!state.activeProject) return;
  // Save current doc first
  await saveWorkingDoc(true, true);
  const name = prompt(
    "Name for new working document:",
    "Working Document " + Date.now().toString(36),
  );
  if (!name) return;
  const wdoc = {
    id: uid(),
    projectId: state.activeProject.id,
    name: name.trim() || "Untitled",
    content: "",
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await dbPut("workingDocs", wdoc);
  state.activeWorkingDocId = wdoc.id;
  await _renderWorkingDocSelector();
  await _fillWorkingDocEditor();
}

async function selectWorkingDoc(id) {
  if (!id || id === state.activeWorkingDocId) return;
  // Save current doc before switching
  await saveWorkingDoc(true, true);
  state.activeWorkingDocId = id;
  await _fillWorkingDocEditor();
}

async function deleteWorkingDoc() {
  if (!state.activeProject || !state.activeWorkingDocId) return;
  const wdocs = await dbGetByIndex(
    "workingDocs",
    "projectId",
    state.activeProject.id,
  );
  if (wdocs.length <= 1) {
    alert(
      "You cannot delete the only working document. Create a new one first.",
    );
    return;
  }
  const current = wdocs.find((w) => w.id === state.activeWorkingDocId);
  if (
    !confirm(
      'Delete "' +
        (current ? current.name : "this document") +
        '"? All version history for this document will also be deleted.',
    )
  )
    return;
  // Delete versions belonging to this working doc
  try {
    const versions = await dbGetByIndex(
      "docVersions",
      "projectId",
      state.activeProject.id,
    );
    for (const v of versions) {
      if (v.workingDocId === state.activeWorkingDocId)
        await dbDelete("docVersions", v.id);
    }
  } catch (_) {}
  await dbDelete("workingDocs", state.activeWorkingDocId);
  // Switch to another doc
  const remaining = wdocs.filter((w) => w.id !== state.activeWorkingDocId);
  state.activeWorkingDocId = (
    remaining.find((w) => w.isDefault) || remaining[0]
  ).id;
  await _renderWorkingDocSelector();
  await _fillWorkingDocEditor();
}

async function renameWorkingDoc() {
  if (!state.activeWorkingDocId) return;
  const wdoc = await dbGet("workingDocs", state.activeWorkingDocId);
  if (!wdoc) return;
  const newName = prompt("Rename working document:", wdoc.name || "");
  if (!newName || !newName.trim()) return;
  wdoc.name = newName.trim();
  wdoc.updatedAt = Date.now();
  await dbPut("workingDocs", wdoc);
  await _renderWorkingDocSelector();
}

// ─── CLEAR CHAT ───────────────────────────────────────────────────────────────
async function clearChatHistory() {
  if (!state.activeProject) return;
  if (!confirm("Clear all chat messages for this project?")) return;
  const chats = await dbGetByIndex(
    "chats",
    "projectId",
    state.activeProject.id,
  );
  for (const c of chats) await dbDelete("chats", c.id);
  state.messages = [];
  state.activeChatId = null;
  renderMessages();
  renderChatSessionList();
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
async function testMarkitdownServer() {
  const urlEl = document.getElementById("settings-markitdown-url");
  const statusEl = document.getElementById("markitdown-test-status");
  const url = (urlEl ? urlEl.value.trim() : "").replace(/\/$/, "");
  if (!url) {
    if (statusEl) statusEl.textContent = "Enter a server URL first";
    return;
  }
  if (statusEl) statusEl.textContent = "Testing\u2026";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url + "/health", { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();
    if (statusEl) {
      if (json.markitdownAvailable && json.docxAvailable) {
        statusEl.textContent =
          "\u2713 Server online \u00b7 markitdown ready \u2014 .docx, .xlsx, .pptx, .pdf conversion enabled";
        statusEl.style.color = "var(--success)";
      } else if (json.markitdownAvailable && !json.docxAvailable) {
        statusEl.textContent =
          '\u26a0 Server online \u00b7 markitdown installed but missing optional format support \u2014 run: pip install "markitdown[all]" then restart server';
        statusEl.style.color = "var(--accent)";
      } else {
        statusEl.textContent =
          '\u26a0 Server online but markitdown not found \u2014 run: pip install "markitdown[all]" then restart server';
        statusEl.style.color = "var(--accent)";
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent =
        "\u2717 " +
        (e.name === "AbortError"
          ? "Timeout \u2014 is the server running?"
          : e.message);
      statusEl.style.color = "var(--danger)";
    }
  }
}

async function exportDatabase() {
  const stores = [
    "templates",
    "projects",
    "docs",
    "chats",
    "settings",
    "notes",
    "embeddings",
    "contacts",
    "suggestions",
    "research",
    "evalCriteria",
    "evalCandidates",
    "evalScores",
    "guidelineAnalyses",
    "workingDocs",
  ];
  const data = {
    version: DB_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {},
  };
  for (const s of stores) data.stores[s] = await dbGetAll(s);
  const json = JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `sourcedesk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function backupToServer() {
  const isServed = window.location.protocol !== "file:";
  if (!isServed) {
    alert(
      "Backup to Server is only available when SourceDesk is served via node server.js.",
    );
    return;
  }
  const stores = [
    "templates",
    "projects",
    "docs",
    "chats",
    "settings",
    "notes",
    "embeddings",
    "contacts",
    "suggestions",
    "research",
    "workingDocs",
  ];
  const data = {
    version: DB_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {},
  };
  for (const s of stores) data.stores[s] = await dbGetAll(s);
  const json = JSON.stringify(data, null, 2);
  try {
    const resp = await fetch(window.location.origin + "/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
    if (!resp.ok) {
      const msg = await resp.text();
      alert("Backup failed: " + msg);
      return;
    }
    const result = await resp.json();
    alert("Backup saved to server: " + result.saved);
  } catch (e) {
    alert("Backup failed: " + (e.message || e));
  }
}

// ─── EMAIL SUMMARIES ──────────────────────────────────────────────────────────
// Cached summary for the current modal session
let _currentEmailSummary = null;
let _emailSummaryPollTimer = null;

async function openEmailSummaries() {
  if (!state.activeProject) {
    alert("No project selected. Open a project first.");
    return;
  }
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  if (!serverUrl) {
    alert(
      "Server URL not configured. Go to Settings and enter your SourceDesk server URL and API token.",
    );
    return;
  }
  _currentEmailSummary = null;
  if (_emailSummaryPollTimer) {
    clearInterval(_emailSummaryPollTimer);
    _emailSummaryPollTimer = null;
  }
  showModal("modal-email-summaries");
  const loadingEl = document.getElementById("email-summ-loading");
  const contentEl = document.getElementById("email-summ-content");
  const statusEl = document.getElementById("email-summ-status");
  const projNameEl = document.getElementById("email-summ-project-name");
  if (projNameEl) projNameEl.textContent = state.activeProject.name;
  if (loadingEl) loadingEl.style.display = "";
  if (contentEl) contentEl.style.display = "none";
  if (statusEl) statusEl.textContent = "";
  try {
    const url =
      serverUrl +
      "/api/email-summaries?token=" +
      encodeURIComponent(serverToken) +
      "&projectId=" +
      encodeURIComponent(state.activeProject.id);
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      if (loadingEl)
        loadingEl.textContent = "\u2717 " + (err.error || resp.statusText);
      return;
    }
    const data = await resp.json();
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "";
    _renderEmailSummary(data.summary);
  } catch (e) {
    if (loadingEl)
      loadingEl.textContent = "\u2717 " + (e.message || "Fetch failed");
  }
}

function _renderEmailSummary(summary) {
  _currentEmailSummary = summary;
  const overallEl = document.getElementById("email-summ-overall");
  const threadsEl = document.getElementById("email-summ-threads");
  if (!summary) {
    if (overallEl)
      overallEl.textContent = "No summary available yet for this project.";
    if (threadsEl) threadsEl.innerHTML = "";
    return;
  }
  if (overallEl)
    overallEl.textContent =
      summary.summary_text ||
      summary.overall_summary ||
      "No summary available.";
  // Per-thread breakdown
  let threads = {};
  try {
    threads =
      typeof summary.per_thread_json === "object"
        ? summary.per_thread_json
        : JSON.parse(summary.per_thread_json || "{}");
  } catch {}
  if (threadsEl) {
    const entries = Object.entries(threads);
    if (entries.length === 0) {
      threadsEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px">No per-thread breakdown available.</div>';
    } else {
      threadsEl.innerHTML = entries
        .map(
          ([subject, text]) =>
            `<details style="margin-bottom:8px;border:1px solid var(--border);border-radius:var(--radius);padding:0">
            <summary style="cursor:pointer;padding:8px 10px;font-size:12px;font-weight:600;color:var(--text-dim);background:var(--surface2);border-radius:var(--radius)">${_escHtml(subject)}</summary>
            <div style="padding:10px;font-size:12px;line-height:1.6;white-space:pre-wrap;color:var(--text)">${_escHtml(text || "")}</div>
          </details>`,
        )
        .join("");
    }
  }
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function importSummaryToNotes() {
  if (!state.activeProject) return;
  if (!_currentEmailSummary) {
    alert("No summary loaded. Open email summaries first.");
    return;
  }
  const summaryText =
    _currentEmailSummary.summary_text ||
    _currentEmailSummary.overall_summary ||
    "";
  const titleDate = (
    _currentEmailSummary.processed_at || new Date().toISOString()
  ).slice(0, 10);
  const note = {
    id: uid(),
    projectId: state.activeProject.id,
    title: "Email Summary \u2014 " + titleDate,
    content: summaryText,
    pinned: false,
    includeInContext: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await dbPut("notes", note);
  const statusEl = document.getElementById("email-summ-status");
  if (statusEl) {
    statusEl.textContent = "\u2713 Imported to Notes";
    statusEl.style.color = "var(--success)";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
  }
}

async function createTasksFromSummary() {
  if (!state.activeProject) return;
  if (!_currentEmailSummary) {
    alert("No summary loaded. Open email summaries first.");
    return;
  }
  const text =
    _currentEmailSummary.summary_text ||
    _currentEmailSummary.overall_summary ||
    "";
  // Parse action items: lines starting with -, *, •, or numbered lists,
  // under "Action Items" or "Next Steps" headings, or matching global patterns
  const lines = text.split("\n");
  let inActionSection = false;
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#+\s*(action items?|next steps?|follow.?up|to.?do)/i.test(trimmed)) {
      inActionSection = true;
      continue;
    }
    if (/^#+\s/.test(trimmed) && inActionSection) {
      inActionSection = false;
    }
    if (inActionSection && /^[-*\u2022]|\d+\./.test(trimmed)) {
      const item = trimmed.replace(/^[-*\u2022]\s*|\d+\.\s*/, "").trim();
      if (item) items.push(item);
    }
    // Also pick up any line that looks like an action item globally
    if (
      !inActionSection &&
      /^[-*\u2022]\s*(action|follow.?up|schedule|review|send|draft|contact|prepare|update|confirm)/i.test(
        trimmed,
      )
    ) {
      const item = trimmed.replace(/^[-*\u2022]\s*/, "").trim();
      if (item && !items.includes(item)) items.push(item);
    }
  }
  if (items.length === 0) {
    const statusEl = document.getElementById("email-summ-status");
    if (statusEl) {
      statusEl.textContent = "No action items found in summary.";
      statusEl.style.color = "var(--text-muted)";
    }
    return;
  }
  const now = new Date().toISOString();
  for (const item of items) {
    await dbPut("tasks", {
      id: uid(),
      projectId: state.activeProject.id,
      title: item.slice(0, 120),
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: "",
      includeInContext: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  const statusEl = document.getElementById("email-summ-status");
  if (statusEl) {
    statusEl.textContent =
      "\u2713 Created " +
      items.length +
      " task" +
      (items.length !== 1 ? "s" : "");
    statusEl.style.color = "var(--success)";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
  }
}

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────────────────────
async function openTokenManager() {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const adminToken = state.settings.serverToken || "";
  const listEl = document.getElementById("token-manager-list");
  const statusEl = document.getElementById("token-generate-status");
  if (!listEl) return;
  if (!serverUrl || !adminToken) {
    listEl.innerHTML =
      '<div style="color:var(--text-muted);font-size:12px">Enter Server URL and API Token above and save to manage tokens.</div>';
    return;
  }
  listEl.innerHTML =
    '<div style="color:var(--text-muted);font-size:12px">Loading\u2026</div>';
  try {
    const url =
      serverUrl +
      "/api/token-list?adminToken=" +
      encodeURIComponent(adminToken);
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      listEl.innerHTML =
        '<div style="color:var(--danger);font-size:12px">\u2717 ' +
        _escHtml(err.error || resp.statusText) +
        "</div>";
      return;
    }
    const data = await resp.json();
    const tokens = data.tokens || [];
    if (tokens.length === 0) {
      listEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px">No tokens found.</div>';
      return;
    }
    listEl.innerHTML = tokens
      .map((t) => {
        const labelStr = t.label
          ? _escHtml(t.label)
          : '<em style="color:var(--text-muted)">no label</em>';
        const tokenShort = t.token ? t.token.slice(0, 8) + "\u2026" : "?";
        const expiry = t.expiresAt
          ? " \u00b7 expires " + t.expiresAt.slice(0, 10)
          : "";
        const expiredBadge = t.expired
          ? ' <span style="color:var(--danger);font-size:10px">EXPIRED</span>'
          : "";
        const isCurrent = t.token === adminToken;
        return (
          `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">` +
          `<span style="flex:1;color:var(--text-dim)">${labelStr} <span style="color:var(--text-muted);font-family:var(--font-mono)">${tokenShort}</span>${expiry}${expiredBadge}</span>` +
          (isCurrent
            ? '<span style="color:var(--text-muted);font-size:10px">(current)</span>'
            : `<button class="btn-secondary" style="font-size:11px;padding:2px 8px" onclick="revokeApiToken('${_escHtml(t.token)}')">Revoke</button>`) +
          "</div>"
        );
      })
      .join("");
  } catch (e) {
    listEl.innerHTML =
      '<div style="color:var(--danger);font-size:12px">\u2717 ' +
      _escHtml(e.message || "Fetch failed") +
      "</div>";
  }
}

async function generateApiToken() {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const adminToken = state.settings.serverToken || "";
  const labelEl = document.getElementById("token-generate-label");
  const expiresEl = document.getElementById("token-generate-expires");
  const statusEl = document.getElementById("token-generate-status");
  if (!serverUrl || !adminToken) {
    if (statusEl) {
      statusEl.textContent = "Enter Server URL and API Token first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }
  const label = labelEl ? labelEl.value.trim() : "";
  const expiresIn = expiresEl ? expiresEl.value : "";
  if (statusEl) {
    statusEl.textContent = "Generating\u2026";
    statusEl.style.color = "var(--text-muted)";
  }
  try {
    const resp = await fetch(serverUrl + "/api/token-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminToken,
        label: label || null,
        expiresIn: expiresIn || null,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      if (statusEl) {
        statusEl.textContent = "\u2717 " + (data.error || resp.statusText);
        statusEl.style.color = "var(--danger)";
      }
      return;
    }
    const display = data.token ? data.token.slice(0, 16) + "\u2026" : "?";
    if (statusEl) {
      statusEl.textContent = "\u2713 Created: " + display;
      statusEl.style.color = "var(--success)";
    }
    if (labelEl) labelEl.value = "";
    await openTokenManager(); // refresh list
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = "\u2717 " + (e.message || "Fetch failed");
      statusEl.style.color = "var(--danger)";
    }
  }
}

async function revokeApiToken(tokenToRevoke) {
  if (!tokenToRevoke) return;
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const adminToken = state.settings.serverToken || "";
  if (!serverUrl || !adminToken) return;
  if (
    !confirm(
      "Revoke this token? Any service using it will lose access immediately.",
    )
  )
    return;
  try {
    const resp = await fetch(serverUrl + "/api/token-revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken, revokeToken: tokenToRevoke }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      alert("Revoke failed: " + (data.error || resp.statusText));
      return;
    }
    await openTokenManager(); // refresh
  } catch (e) {
    alert("Revoke failed: " + (e.message || e));
  }
}

async function testHindsightConnection() {
  const statusEl = document.getElementById("hindsight-status");
  if (!statusEl) return;
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  if (!serverUrl) {
    statusEl.textContent = "— Server URL not configured";
    statusEl.style.color = "var(--text-muted)";
    return;
  }
  if (!serverToken) {
    statusEl.textContent = "— API Token not configured";
    statusEl.style.color = "var(--text-muted)";
    return;
  }
  try {
    new URL(serverUrl);
  } catch {
    statusEl.textContent =
      "✗ Invalid server URL — check for typos (e.g. bad IP octet or missing http://)";
    statusEl.style.color = "var(--danger)";
    return;
  }
  statusEl.textContent = "Checking…";
  statusEl.style.color = "var(--text-muted)";
  try {
    const resp = await fetch(
      `${serverUrl}/api/hindsight/status?token=${encodeURIComponent(serverToken)}`,
    );
    const data = await resp.json();
    if (!data.configured) {
      statusEl.textContent =
        "— Not configured on server (set HINDSIGHT_API_URL)";
      statusEl.style.color = "var(--text-muted)";
    } else if (!data.available) {
      statusEl.textContent = "○ Not connected (service unreachable)";
      statusEl.style.color = "var(--accent)";
    } else if (!data.bankExists) {
      statusEl.textContent = "● Connected — no memories yet";
      statusEl.style.color = "var(--success)";
    } else {
      const countStr =
        data.memoryCount != null ? ` (${data.memoryCount} memories)` : "";
      statusEl.textContent = `● Connected${countStr}`;
      statusEl.style.color = "var(--success)";
    }
  } catch (e) {
    statusEl.textContent = `✗ Error: ${e.message}`;
    statusEl.style.color = "var(--danger)";
  }
}

// ─── MEMORY BROWSER ──────────────────────────────────────────────────────────
let _memBrowseOffset = 0;
let _memBrowseQuery = "";
const _MEM_BROWSE_PAGE = 20;

async function openMemoryBrowser() {
  const serverUrl = state.settings.serverUrl;
  const serverToken = state.settings.serverToken;
  if (!serverUrl || !serverToken) {
    alert("Configure Server URL and API Token in Settings first.");
    return;
  }
  _memBrowseOffset = 0;
  _memBrowseQuery = "";
  const searchEl = document.getElementById("mem-browse-search");
  if (searchEl) searchEl.value = "";
  showModal("modal-memory-browser");
  await _memBrowseLoad("", 0);
}

async function _memBrowseLoad(query, offset) {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  const statusEl = document.getElementById("mem-browse-status");
  const listEl = document.getElementById("mem-browse-list");
  const loadMoreBtn = document.getElementById("mem-browse-load-more");
  if (!statusEl || !listEl) return;

  statusEl.textContent = "Loading\u2026";
  if (offset === 0) {
    listEl.innerHTML =
      '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center">Loading\u2026</div>';
  }

  try {
    const params = new URLSearchParams({
      token: serverToken,
      limit: _MEM_BROWSE_PAGE,
      offset: offset,
    });
    if (query) params.set("q", query);
    const resp = await fetch(
      serverUrl + "/api/hindsight/memories?" + params.toString(),
    );
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    const memories = data.memories || [];
    const total =
      data.total != null ? data.total : data.count || memories.length;

    if (offset === 0) listEl.innerHTML = "";

    if (memories.length === 0 && offset === 0) {
      listEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center">' +
        "No memories yet. Use the app and they'll appear here.</div>";
      statusEl.textContent = "0 memories";
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      return;
    }

    memories.forEach(function (mem) {
      const el = document.createElement("div");
      el.className = "mem-browse-item";
      const rawText = (mem.text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const typeLabel = mem.type
        ? '<span class="mem-type-badge">' + mem.type + "</span>"
        : "";
      const docId = mem.documentId || "";
      const docLabel = docId
        ? '<span class="mem-doc-badge" title="' +
          docId +
          '">' +
          docId +
          "</span>"
        : "";
      el.innerHTML =
        '<div class="mem-browse-text">' +
        rawText +
        "</div>" +
        '<div class="mem-browse-meta">' +
        typeLabel +
        docLabel +
        "</div>";
      if (docId) {
        const delBtn = document.createElement("button");
        delBtn.className = "mem-browse-del";
        delBtn.title = "Remove memories for this document";
        delBtn.textContent = "\uD83D\uDDD1";
        delBtn.dataset.docId = docId;
        delBtn.addEventListener("click", function () {
          _memBrowseDeleteDoc(docId);
        });
        el.appendChild(delBtn);
      }
      listEl.appendChild(el);
    });

    const showing = offset + memories.length;
    statusEl.textContent =
      showing +
      (total > showing ? " of ~" + total : "") +
      " memor" +
      (total === 1 ? "y" : "ies");

    if (loadMoreBtn) {
      const hasMore = memories.length === _MEM_BROWSE_PAGE;
      loadMoreBtn.style.display = hasMore ? "inline-block" : "none";
      if (hasMore) {
        const nextOffset = offset + _MEM_BROWSE_PAGE;
        loadMoreBtn.onclick = function () {
          _memBrowseOffset = nextOffset;
          _memBrowseLoad(_memBrowseQuery, nextOffset);
        };
      }
    }
  } catch (e) {
    statusEl.textContent = "\u2717 Error: " + e.message;
    if (offset === 0) {
      listEl.innerHTML =
        '<div style="color:var(--danger);font-size:12px;padding:12px">' +
        "Failed to load memories. Check your server URL and token.</div>";
    }
  }
}

async function _memBrowseDeleteDoc(documentId) {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  if (
    !confirm(
      'Remove all memories associated with "' +
        documentId +
        '"? This cannot be undone.',
    )
  )
    return;
  try {
    const resp = await fetch(serverUrl + "/api/hindsight/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: serverToken, documentId: documentId }),
    });
    const data = await resp.json();
    if (data.ok) {
      const listEl = document.getElementById("mem-browse-list");
      if (listEl) {
        listEl
          .querySelectorAll('.mem-browse-del[data-doc-id="' + documentId + '"]')
          .forEach(function (btn) {
            btn.closest(".mem-browse-item").remove();
          });
      }
      const statusEl = document.getElementById("mem-browse-status");
      if (statusEl)
        statusEl.textContent = '\u2713 Deleted "' + documentId + '"';
    } else {
      alert("Delete failed: " + (data.error || "unknown error"));
    }
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

async function _memBrowseClear() {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  if (
    !confirm(
      "Clear ALL memories from your bank? This permanently erases every memory and cannot be undone.",
    )
  )
    return;
  const statusEl = document.getElementById("mem-browse-status");
  if (statusEl) statusEl.textContent = "Clearing\u2026";
  try {
    const resp = await fetch(serverUrl + "/api/hindsight/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: serverToken }),
    });
    const data = await resp.json();
    if (statusEl)
      statusEl.textContent =
        "\u2713 Cleared " + (data.deleted || 0) + " document(s)";
    const listEl = document.getElementById("mem-browse-list");
    if (listEl) {
      listEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px;padding:20px;text-align:center">Memory bank cleared.</div>';
    }
    const loadMoreBtn = document.getElementById("mem-browse-load-more");
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
  } catch (e) {
    if (statusEl) statusEl.textContent = "\u2717 Error: " + e.message;
  }
}

function _memBrowseExport() {
  const serverUrl = (state.settings.serverUrl || "").replace(/\/$/, "");
  const serverToken = state.settings.serverToken || "";
  if (!serverUrl || !serverToken) {
    alert("Configure Server URL and API Token first.");
    return;
  }
  const a = document.createElement("a");
  a.href =
    serverUrl +
    "/api/hindsight/export?token=" +
    encodeURIComponent(serverToken);
  a.download = "sourcedesk-memories.json";
  a.click();
}
