// ─── SETTINGS ────────────────────────────────────────────────────────────────
async function fetchLocalModels() {
    const urlEl = document.getElementById("local-llm-url");
    const base = (
        urlEl ? urlEl.value.trim() : state.settings.localLlmUrl || ""
    ).replace(/\/$/, "");
    const sel = document.getElementById("settings-model");

    if (!base) {
        if (sel)
            sel.innerHTML =
                '<option value="">Enter a Base URL above first</option>';
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
            }))
            .filter((m) => m.id);

        if (!models.length) throw new Error("No models returned");

        PROVIDERS.local.models = models;
        PROVIDERS.local.defaultModel = models[0].id;

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
    updateApiKeyStatus(!!getCurrentProviderKey());
    showModal("modal-settings");
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
    if (provider === "local") {
        const urlEl = document.getElementById("local-llm-url");
        if (urlEl && !urlEl.value)
            urlEl.value = state.settings.localLlmUrl || "";
        // Warn if running from file:// (CORS will block localhost requests)
        const corsWarn = document.getElementById("local-cors-warning");
        if (corsWarn) {
            corsWarn.classList.toggle(
                "hidden",
                window.location.protocol !== "file:",
            );
        }
    }
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
    const constants = document
        .getElementById("settings-constants")
        .value.trim();
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

    closeModal();
    checkApiKey();
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
    ];
    for (const s of stores) {
        const items = await dbGetAll(s);
        for (const item of items)
            await dbDelete(s, item[s === "settings" ? "key" : "id"]);
    }
    location.reload();
}

// ─── WORKING DOCUMENT ────────────────────────────────────────────────────────
function _fillWorkingDocEditor() {
    const ta = document.getElementById("working-doc-editor");
    if (ta && state.activeProject)
        ta.value = state.activeProject.workingContent || "";
}

function openWorkingDoc() {
    if (!state.activeProject) return;
    showView("working-doc");
}

async function saveWorkingDoc() {
    if (!state.activeProject) return;
    const ta = document.getElementById("working-doc-editor");
    if (!ta) return;
    state.activeProject.workingContent = ta.value;
    await dbPut("projects", state.activeProject);
    // brief visual feedback
    const btn = document.getElementById("working-doc-save-btn");
    if (btn) {
        btn.textContent = "Saved ✓";
        setTimeout(() => {
            btn.textContent = "Save";
        }, 1500);
    }
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
    renderMessages();
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
async function exportDatabase() {
    const stores = [
        "templates",
        "projects",
        "docs",
        "chats",
        "settings",
        "notes",
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
