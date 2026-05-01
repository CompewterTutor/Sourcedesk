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
    const res = await fetch(base + "/models", { headers: reqHeaders });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    // Ollama returns { models: [...] }, OpenAI-compat returns { data: [...] }
    const list = data.data || data.models || [];
    const models = list
      .map((m) => ({
        id: m.id || m.name || m.model,
        label: m.id || m.name || m.model,
        contextLength:
          m.context_length ||
          m.context_window ||
          m.n_ctx ||
          m.max_context_length ||
          0,
      }))
      .filter((m) => m.id);

    if (!models.length) throw new Error("No models returned");

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
    if (sel)
      sel.innerHTML =
        '<option value="">⚠ Detection failed — check URL &amp; CORS</option>';
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
  updateApiKeyStatus(!!getCurrentProviderKey());
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
    const res = await fetch(base + "/embeddings", {
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
function _fillWorkingDocEditor() {
  const ta = document.getElementById("working-doc-editor");
  if (ta && state.activeProject)
    ta.value = state.activeProject.workingContent || "";
  if (typeof refreshRichEditor === "function" && ta) refreshRichEditor(ta);
}

function openWorkingDoc() {
  if (!state.activeProject) return;
  showView("working-doc");
}

async function saveWorkingDoc(opts) {
  if (!state.activeProject) return;
  const ta = document.getElementById("working-doc-editor");
  if (!ta) return;
  const silent = !!(opts && opts.silent);
  const skipSnapshot = !!(opts && opts.skipSnapshot);
  state.activeProject.workingContent = ta.value;
  await dbPut("projects", state.activeProject);
  if (!skipSnapshot) await saveDocVersion(ta.value);
  if (silent) return;
  // brief visual feedback
  const btn = document.getElementById("working-doc-save-btn");
  if (btn) {
    btn.textContent = "Saved ✓";
    setTimeout(() => {
      btn.textContent = "Save";
    }, 1500);
  }
}

// Autosave for the Working Document. Snapshots are NOT created on every
// keystroke — autosave only persists `workingContent`. Explicit Save (or
// History modal entries) still produce snapshots via saveDocVersion().
function scheduleWorkingDocAutosave() {
  scheduleAutosave("workingDoc", async function () {
    await saveWorkingDoc({ silent: true, skipSnapshot: true });
  });
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
      statusEl.textContent = json.markitdownAvailable
        ? "\u2713 Server online \u00b7 markitdown ready \u2014 .docx, .xlsx, .pptx, .pdf conversion enabled"
        : "\u26a0 Server online but markitdown not found \u2014 run: pip install markitdown, then restart server";
      statusEl.style.color = json.markitdownAvailable
        ? "var(--success)"
        : "var(--accent)";
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
