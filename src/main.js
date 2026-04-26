// ─── FLAGS ──────────────────────────────────────────────────────────────────
const DEBUG = window.__SOURCEDESK_DEBUG__ || false;
const TEST = window.__SOURCEDESK_TEST__ || false;
const APP_VERSION = "0.4.4";
function log(...args) {
    if (DEBUG) console.log("[SD]", ...args);
}

// ─── PROVIDERS ────────────────────────────────────────────────────────────────
const PROVIDERS = {
    anthropic: {
        label: "Anthropic",
        keyLabel: "Anthropic API Key",
        keyPlaceholder: "sk-ant-...",
        keyHint:
            'Get your key at <a href="https://console.anthropic.com" target="_blank" style="color:var(--accent)">console.anthropic.com</a>',
        models: [
            {
                id: "claude-sonnet-4-6",
                label: "Claude Sonnet 4.6 (recommended)",
            },
            { id: "claude-opus-4-6", label: "Claude Opus 4.6 (most capable)" },
            {
                id: "claude-haiku-4-5-20251001",
                label: "Claude Haiku 4.5 (fastest/cheapest)",
            },
        ],
        defaultModel: "claude-sonnet-4-6",
    },
    openai: {
        label: "OpenAI",
        keyLabel: "OpenAI API Key",
        keyPlaceholder: "sk-...",
        keyHint:
            'Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--accent)">platform.openai.com/api-keys</a>',
        models: [
            { id: "gpt-5.4", label: "GPT-5.4 (flagship)" },
            { id: "gpt-5.4-mini", label: "GPT-5.4 mini (fast)" },
            { id: "gpt-5.4-nano", label: "GPT-5.4 nano (cheapest)" },
            { id: "gpt-4o", label: "GPT-4o" },
            { id: "gpt-4o-mini", label: "GPT-4o mini" },
            { id: "o4-mini", label: "o4-mini (reasoning)" },
        ],
        defaultModel: "gpt-4o",
    },
    openrouter: {
        label: "OpenRouter",
        keyLabel: "OpenRouter API Key",
        keyPlaceholder: "sk-or-...",
        keyHint:
            'Get your key at <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--accent)">openrouter.ai/keys</a> — access 300+ models from one key',
        models: [
            {
                id: "google/gemma-4-26b-a4b-it:free",
                label: "Google Gemma-4-26B-A4B - Free (via OR)",
            },
            {
                id: "google/gemma-4-31b-it:free",
                label: "Google Gemma-4-31B - Free (via OR)",
            },
            {
                id: "nvidia/nemotron-3-super-120b-a12b:free",
                label: "Nvidia Nemotron 3 Super 120B - Free via OR",
            },
            {
                id: "minimax/minimax-m2.5:free",
                label: "Minimax m2.5 Free via OR",
            },
            {
                id: "openai/gpt-oss-120b:free",
                label: "OpenAI: GPT-OSS 120b free via OR",
            },
            { id: "openai/gpt-4o", label: "GPT-4o (via OR)" },
            { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
            {
                id: "google/gemini-2.5-flash-preview",
                label: "Gemini 2.5 Flash",
            },
            { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
            { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
            { id: "x-ai/grok-3-beta", label: "Grok 3" },
            { id: "mistralai/mistral-large", label: "Mistral Large" },
        ],
        defaultModel: "anthropic/claude-sonnet-4-5",
    },
    github: {
        label: "GitHub Models",
        keyLabel: "GitHub Personal Access Token",
        keyPlaceholder: "ghp_... or github_pat_...",
        keyHint:
            'Create a PAT with <code>models:read</code> at <a href="https://github.com/settings/tokens" target="_blank" style="color:var(--accent)">github.com/settings/tokens</a> — free tier available',
        models: [
            { id: "gpt-4o", label: "GPT-4o" },
            { id: "gpt-4o-mini", label: "GPT-4o mini" },
            { id: "Meta-Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" },
            { id: "Phi-4", label: "Phi-4" },
            { id: "DeepSeek-V3-0324", label: "DeepSeek V3" },
            { id: "Mistral-Large-2411", label: "Mistral Large" },
        ],
        defaultModel: "gpt-4o",
    },
    local: {
        label: "Local LLM",
        keyLabel: "API Key (optional)",
        keyPlaceholder: "Leave blank for Ollama / LM Studio",
        keyHint:
            'No data leaves your machine. Works with <a href="https://ollama.com" target="_blank" style="color:var(--accent)">Ollama</a> and <a href="https://lmstudio.ai" target="_blank" style="color:var(--accent)">LM Studio</a>. Best results when served via <code>npm run serve</code>.',
        models: [{ id: "", label: "— click Detect Models —" }],
        defaultModel: "",
    },
};

// ─── IndexedDB ────────────────────────────────────────────────────────────────
const DB_NAME = "sourcedesk",
    DB_VERSION = 2;
let db;

function openDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains("templates"))
                d.createObjectStore("templates", { keyPath: "id" });
            if (!d.objectStoreNames.contains("projects"))
                d.createObjectStore("projects", { keyPath: "id" });
            if (!d.objectStoreNames.contains("docs")) {
                const s = d.createObjectStore("docs", { keyPath: "id" });
                s.createIndex("projectId", "projectId", { unique: false });
            }
            if (!d.objectStoreNames.contains("chats")) {
                const s = d.createObjectStore("chats", { keyPath: "id" });
                s.createIndex("projectId", "projectId", { unique: false });
            }
            if (!d.objectStoreNames.contains("settings"))
                d.createObjectStore("settings", { keyPath: "key" });
            if (!d.objectStoreNames.contains("notes")) {
                const sn = d.createObjectStore("notes", { keyPath: "id" });
                sn.createIndex("projectId", "projectId", { unique: false });
            }
        };
        req.onsuccess = (e) => {
            db = e.target.result;
            res(db);
        };
        req.onerror = () => rej(req.error);
    });
}

function dbGet(store, key) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

function dbPut(store, val) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(val);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

function dbDelete(store, key) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}

function dbGetAll(store) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

function dbGetByIndex(store, index, val) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).index(index).getAll(val);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseConstants(text) {
    const obj = {};
    (text || "").split("\n").forEach((line) => {
        const eq = line.indexOf("=");
        if (eq > 0) {
            const k = line.slice(0, eq).trim().toUpperCase();
            const v = line.slice(eq + 1).trim();
            if (k) obj[k] = v;
        }
    });
    return obj;
}

function resolveTemplateVars(content) {
    const proj = state.activeProject;
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const builtIn = {
        PROJECT_NAME: proj ? proj.name : "",
        PROJECT_CATEGORY: proj ? proj.category : "",
        PROJECT_NOTES: proj ? proj.notes || "" : "",
        PROJECT_INSTRUCTIONS: proj ? proj.instructions || "" : "",
        TODAY: today,
        TIMESTAMP: now.toLocaleString(),
    };
    const constants = parseConstants(state.settings.constants || "");
    // builtIn takes priority over user-defined constants
    const vars = Object.assign({}, constants, builtIn);
    let out = content;
    for (const k in vars) {
        out = out.split("{{" + k + "}}").join(vars[k]);
    }
    // Date arithmetic: {{TODAY+N}}, {{TODAY-N}}, {{TODAY+Nw}}, {{TODAY+Nm}}, {{TODAY+Nd}}
    // d = days (default), w = weeks, m = months
    out = out.replace(
        /\{\{TODAY([+-])(\d+)([dwmDWM]?)\}\}/g,
        function (_, sign, num, unit) {
            const n = parseInt(num, 10);
            const d = new Date(now);
            const u = (unit || "d").toLowerCase();
            if (u === "m") {
                d.setMonth(d.getMonth() + (sign === "+" ? n : -n));
            } else if (u === "w") {
                d.setDate(d.getDate() + (sign === "+" ? n * 7 : -n * 7));
            } else {
                d.setDate(d.getDate() + (sign === "+" ? n : -n));
            }
            return d.toISOString().slice(0, 10);
        },
    );
    return out;
}

function extractVarsFromText(text) {
    // Returns array of { value, type, suggestedKey } sorted by type order: date, money, percent, kv
    const seenValues = new Set();
    const results = [];

    // ── Dates ────────────────────────────────────────────────────────────────
    const datePatterns = [
        /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
        /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4}\b/g,
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    ];
    var dateItems = [];
    datePatterns.forEach(function (re) {
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(text)) !== null) {
            var v = m[0].trim();
            if (!seenValues.has(v)) {
                seenValues.add(v);
                dateItems.push(v);
            }
        }
    });
    dateItems.forEach(function (v, i) {
        results.push({
            value: v,
            type: "date",
            suggestedKey: "DATE_" + (i + 1),
        });
    });

    // ── Money ────────────────────────────────────────────────────────────────
    var moneyRe = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\d+(?:\.\d{2})?/g;
    var moneyItems = [];
    moneyRe.lastIndex = 0;
    var m;
    while ((m = moneyRe.exec(text)) !== null) {
        var v = m[0].trim();
        if (!seenValues.has(v)) {
            seenValues.add(v);
            moneyItems.push(v);
        }
    }
    moneyItems.forEach(function (v, i) {
        results.push({
            value: v,
            type: "money",
            suggestedKey: "AMOUNT_" + (i + 1),
        });
    });

    // ── Percent ──────────────────────────────────────────────────────────────
    var pctRe = /\b\d+(?:\.\d+)?%/g;
    var pctItems = [];
    pctRe.lastIndex = 0;
    while ((m = pctRe.exec(text)) !== null) {
        var v = m[0].trim();
        if (!seenValues.has(v)) {
            seenValues.add(v);
            pctItems.push(v);
        }
    }
    pctItems.forEach(function (v, i) {
        results.push({
            value: v,
            type: "percent",
            suggestedKey: "PCT_" + (i + 1),
        });
    });

    // ── Key-Value pairs ──────────────────────────────────────────────────────
    var lines = text.split("\n");
    var kvItems = [];
    lines.forEach(function (line) {
        var kvMatch = /^([A-Z][A-Za-z\s]{1,30}):\s*(.{1,80})$/.exec(
            line.trim(),
        );
        if (!kvMatch) return;
        var label = kvMatch[1].trim();
        var val = kvMatch[2].trim();
        // Skip if value looks like a plain sentence (has mid-value period not at end)
        if (/\.\s+\S/.test(val)) return;
        if (val.length > 80) return;
        if (seenValues.has(val)) return;
        seenValues.add(val);
        var key = label.toUpperCase().replace(/\s+/g, "_");
        kvItems.push({ value: val, suggestedKey: key });
    });
    kvItems.forEach(function (item) {
        results.push({
            value: item.value,
            type: "kv",
            suggestedKey: item.suggestedKey,
        });
    });

    return results;
}

function extractDatesFromText(text) {
    return extractVarsFromText(text)
        .filter(function (i) {
            return i.type === "date";
        })
        .map(function (i) {
            return i.value;
        });
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
    projects: [],
    templates: [],
    settings: {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        globalContext: "",
        anthropicKey: "",
        openaiKey: "",
        openrouterKey: "",
        githubKey: "",
        constants: "",
        driveToken: "",
        localLlmUrl: "",
    },
    activeProject: null,
    activeDocs: new Set(),
    activeOtherProjects: new Set(),
    messages: [],
    streaming: false,
    rightPanelOpen: true,
    editingTemplateId: null,
    editingProjectId: null,
    currentNote: null,
};

// ─── PROVIDER HELPERS ─────────────────────────────────────────────────────────
function getCurrentProviderKey() {
    const p = state.settings.provider || "anthropic";
    return state.settings[p + "Key"] || "";
}

function setProviderKey(provider, key) {
    state.settings[provider + "Key"] = key;
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
async function boot() {
    await openDB();
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
    // Apply .env defaults injected by server.js (only if DB has no saved value)
    const _senv = window.__SOURCEDESK_ENV__ || {};
    if (!state.settings.localLlmUrl && _senv.localLlmUrl) {
        state.settings.localLlmUrl = _senv.localLlmUrl;
    }
    if (
        _senv.localLlmDefaultModel &&
        state.settings.provider === "local" &&
        !state.settings.model
    ) {
        state.settings.model = _senv.localLlmDefaultModel;
    }

    // Set version string in topbar
    const vEl = document.getElementById("app-version");
    if (vEl) vEl.textContent = `v${APP_VERSION}`;

    renderSidebar();
    checkApiKey();
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
    if (v === "templates") renderTemplatesGrid();
    if (v === "notes") loadNotes();
    if (v === "working-doc") _fillWorkingDocEditor();
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
        Other: "📁",
    };
    state.projects
        .slice()
        .reverse()
        .forEach((p) => {
            const item = document.createElement("div");
            item.className =
                "sidebar-item" +
                (state.activeProject?.id === p.id ? " active" : "");
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
    state.activeDocs = new Set();
    state.activeOtherProjects = new Set();
    state.currentNote = null;

    // load chat history
    const chats = await dbGetByIndex("chats", "projectId", id);
    if (chats.length) state.messages = chats[0].messages || [];

    // load docs for project — enable all by default
    const docs = await dbGetByIndex("docs", "projectId", id);
    docs.forEach((d) => state.activeDocs.add(d.id));

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

    renderSidebar();
    renderMessages();
    await renderRightPanel();
    checkApiKey();
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
function renderMessages() {
    const container = document.getElementById("chat-messages");
    container.innerHTML = "";
    state.messages.forEach((m) =>
        appendMessageEl(m.role, m.content, m.sources),
    );
    container.scrollTop = container.scrollHeight;
}

function appendMessageEl(role, content, sources) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const avatarLabel = role === "assistant" ? "SD" : "You";
    let sourcesHtml = "";
    if (sources && sources.length) {
        sourcesHtml = `<div class="chunk-used">Referenced: ${sources.map((s) => `<span class="chunk-source">${s}</span>`).join(", ")}</div>`;
    }
    div.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div>
      <div class="msg-bubble">${formatMarkdown(content)}</div>
      ${sourcesHtml}
    </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

function formatMarkdown(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
            /^### (.*$)/gm,
            '<h4 style="margin:10px 0 4px;font-family:DM Serif Display,serif;color:var(--accent)">$1</h4>',
        )
        .replace(
            /^## (.*$)/gm,
            '<h3 style="margin:10px 0 4px;font-family:DM Serif Display,serif">$1</h3>',
        )
        .replace(/^- (.*$)/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/^(?!<[hup])(.+)$/gm, "<p>$1</p>");
}

// ─── BM25 SEARCH ──────────────────────────────────────────────────────────────
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function buildIndex(chunks) {
    const idf = {},
        N = chunks.length;
    const tfs = chunks.map((c) => {
        const tokens = tokenize(c.text),
            freq = {};
        tokens.forEach((t) => {
            freq[t] = (freq[t] || 0) + 1;
        });
        return { freq, len: tokens.length };
    });
    const df = {};
    tfs.forEach(({ freq }) => {
        Object.keys(freq).forEach((t) => {
            df[t] = (df[t] || 0) + 1;
        });
    });
    Object.keys(df).forEach((t) => {
        idf[t] = Math.log((N - df[t] + 0.5) / (df[t] + 0.5) + 1);
    });
    return { tfs, idf, avgLen: tfs.reduce((s, x) => s + x.len, 0) / (N || 1) };
}

function bm25Score(query, idx, i, k1 = 1.5, b = 0.75) {
    const { tfs, idf, avgLen } = idx;
    const { freq, len } = tfs[i];
    return tokenize(query).reduce((score, t) => {
        const tf = freq[t] || 0;
        const idfVal = idf[t] || 0;
        return (
            score +
            (idfVal * (tf * (k1 + 1))) /
                (tf + k1 * (1 - b + (b * len) / avgLen))
        );
    }, 0);
}

function chunkText(text, size = 400, overlap = 60) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += size - overlap) {
        chunks.push(words.slice(i, i + size).join(" "));
        if (i + size >= words.length) break;
    }
    return chunks;
}

async function retrieveContext(query, topK = 4) {
    if (!state.activeProject) return { context: "", sources: [] };

    // Gather all active doc IDs
    const docIds = [...state.activeDocs];
    // Add toggled-in other project docs
    for (const pid of state.activeOtherProjects) {
        const otherDocs = await dbGetByIndex("docs", "projectId", pid);
        otherDocs.forEach((d) => docIds.push(d.id));
    }
    // Add template content if project has one
    const templateChunks = [];
    if (state.activeProject.templateId) {
        const tmpl = state.templates.find(
            (t) => t.id === state.activeProject.templateId,
        );
        if (tmpl)
            templateChunks.push({
                text: tmpl.content,
                source: `Template: ${tmpl.name}`,
            });
    }

    if (!docIds.length && !templateChunks.length)
        return { context: "", sources: [] };

    const allChunks = [...templateChunks];
    for (const id of docIds) {
        const doc = await dbGet("docs", id);
        if (!doc) continue;
        const chunks = chunkText(doc.content);
        chunks.forEach((c) => allChunks.push({ text: c, source: doc.name }));
    }

    if (!allChunks.length) return { context: "", sources: [] };

    const idx = buildIndex(allChunks);
    const scores = allChunks.map((_, i) => ({
        i,
        score: bm25Score(query, idx, i),
    }));
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topK).filter((s) => s.score > 0);
    const sources = [...new Set(top.map((s) => allChunks[s.i].source))];
    const context = top
        .map((s) => `[from: ${allChunks[s.i].source}]\n${allChunks[s.i].text}`)
        .join("\n\n---\n\n");
    return { context, sources };
}

// ─── API CALL BUILDER ─────────────────────────────────────────────────────────
function buildApiCall(systemPrompt, apiMessages) {
    const provider = state.settings.provider || "anthropic";
    const key = getCurrentProviderKey();
    const model = state.settings.model;

    if (provider === "anthropic") {
        return {
            url: "https://api.anthropic.com/v1/messages",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: apiMessages,
                stream: true,
            }),
        };
    }

    // OpenAI-compatible: openai, openrouter, github, local
    const _localBase = (
        state.settings.localLlmUrl || "http://localhost:11434/v1"
    ).replace(/\/$/, "");
    const urls = {
        openai: "https://api.openai.com/v1/chat/completions",
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        github: "https://models.inference.ai.azure.com/chat/completions",
        local: _localBase + "/chat/completions",
    };

    // Only include Authorization if a key is actually set (Ollama works without one)
    const headers = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = `Bearer ${key}`;
    if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://sourcedesk.app";
        headers["X-Title"] = "SourceDesk";
    }

    return {
        url: urls[provider] || urls.openai,
        headers,
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                ...apiMessages,
            ],
            stream: true,
            max_tokens: 4096,
        }),
    };
}

function parseStreamDelta(data) {
    if (data === "[DONE]") return null;
    try {
        const parsed = JSON.parse(data);
        const provider = state.settings.provider || "anthropic";
        if (provider === "anthropic") {
            if (parsed.type === "content_block_delta" && parsed.delta?.text)
                return parsed.delta.text;
        } else {
            // OpenAI-compatible
            const content = parsed.choices?.[0]?.delta?.content;
            return content ?? null;
        }
    } catch {}
    return null;
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendMessage() {
    if (state.streaming || !state.activeProject) return;
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    const key = getCurrentProviderKey();
    if (!key && state.settings.provider !== "local") {
        alert("Please add an API key in Settings.");
        return;
    }

    input.value = "";
    input.style.height = "auto";

    state.messages.push({ role: "user", content: text });
    appendMessageEl("user", text);

    const { context, sources } = await retrieveContext(text);

    let systemPrompt = `You are SourceDesk, an expert AI assistant for strategic sourcing and procurement at a university. You help with RFPs, RFIs, vendor questionnaires, contract review, and supplier analysis.

Be precise, professional, and concise. Use procurement terminology correctly. When filling in templates, follow the structure exactly. Flag any compliance concerns relevant to higher-education procurement.`;

    if (state.settings.globalContext)
        systemPrompt += `\n\n## Global Instructions\n${state.settings.globalContext}`;

    if (state.activeProject) {
        systemPrompt += `\n\n## Current Project\nName: ${state.activeProject.name}\nCategory: ${state.activeProject.category}`;
        if (state.activeProject.notes)
            systemPrompt += `\nNotes: ${state.activeProject.notes}`;
        if (state.activeProject.instructions)
            systemPrompt += `\n\n## Project Instructions\n${state.activeProject.instructions}`;
        if (state.activeProject.workingContent)
            systemPrompt += `\n\n## Working Document (current draft)\n${state.activeProject.workingContent}`;
    }
    if (
        state.currentNote &&
        state.currentNote.includeInContext &&
        state.currentNote.content
    )
        systemPrompt += `\n\n## Active Note: ${state.currentNote.title || "Untitled"}\n${state.currentNote.content}`;
    if (context)
        systemPrompt += `\n\n## Retrieved Context (from project documents)\n${context}`;

    const apiMessages = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
    }));

    const typingDiv = document.createElement("div");
    typingDiv.className = "msg assistant";
    typingDiv.innerHTML = `<div class="msg-avatar">SD</div><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    document.getElementById("chat-messages").appendChild(typingDiv);
    document.getElementById("chat-messages").scrollTop = 99999;
    document.getElementById("send-btn").disabled = true;
    state.streaming = true;

    try {
        const { url, headers, body } = buildApiCall(systemPrompt, apiMessages);
        const resp = await fetch(url, { method: "POST", headers, body });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg =
                err.error?.message || err.message || `API error ${resp.status}`;
            throw new Error(msg);
        }

        typingDiv.remove();
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg assistant";
        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        msgDiv.innerHTML = `<div class="msg-avatar">SD</div>`;
        msgDiv.appendChild(bubble);
        document.getElementById("chat-messages").appendChild(msgDiv);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const delta = parseStreamDelta(line.slice(6).trim());
                if (delta) {
                    fullText += delta;
                    bubble.innerHTML = formatMarkdown(fullText);
                    document.getElementById("chat-messages").scrollTop = 99999;
                }
            }
        }

        if (sources.length) {
            const src = document.createElement("div");
            src.className = "chunk-used";
            src.innerHTML = `Referenced: ${sources.map((s) => `<span class="chunk-source">${s}</span>`).join(", ")}`;
            msgDiv.appendChild(src);
        }

        state.messages.push({ role: "assistant", content: fullText, sources });
        await saveChat();
    } catch (e) {
        typingDiv.remove();
        appendMessageEl("assistant", `⚠ Error: ${e.message}`);
    }

    state.streaming = false;
    document.getElementById("send-btn").disabled = false;
}

async function saveChat() {
    if (!state.activeProject) return;
    await dbPut("chats", {
        id: state.activeProject.id,
        projectId: state.activeProject.id,
        messages: state.messages,
    });
}

// ─── RIGHT PANEL ──────────────────────────────────────────────────────────────
async function renderRightPanel() {
    if (!state.activeProject) return;

    // Template ref
    const tmplEl = document.getElementById("ctx-template");
    if (state.activeProject.templateId) {
        const tmpl = state.templates.find(
            (t) => t.id === state.activeProject.templateId,
        );
        if (tmpl) {
            tmplEl.innerHTML = `<div class="template-ref">
        <span style="flex:1">${tmpl.name}</span>
        <span class="tcard-btn" onclick="openFillTemplate('${tmpl.id}')">Fill</span>
        <span class="tcard-btn" onclick="viewTemplateContent('${tmpl.id}')">View</span>
      </div>`;
        }
    } else {
        tmplEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No template — <span style="color:var(--accent);cursor:pointer" onclick="promptAttachTemplate()">attach one</span></div>`;
    }

    // Project docs
    const docs = await dbGetByIndex(
        "docs",
        "projectId",
        state.activeProject.id,
    );
    const docsEl = document.getElementById("ctx-project-docs");
    docsEl.innerHTML = "";
    if (!docs.length) {
        docsEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">No docs yet — upload files to give Claude context.</div>`;
    }
    docs.forEach((doc) => {
        const active = state.activeDocs.has(doc.id);
        const el = document.createElement("div");
        el.className = `context-doc${active ? " active" : ""}`;
        el.innerHTML = `<div class="doc-toggle">${active ? "✓" : ""}</div><div class="doc-name">${doc.name}</div><span class="tcard-btn" onclick="openExtractVars('${doc.id}')" title="Extract date variables from this document" style="opacity:0.5;margin-left:4px;font-size:10px">Extract</span><span class="tcard-btn" onclick="createTemplateFromDoc('${doc.id}')" title="Create template from this document" style="opacity:0.5;margin-left:2px;font-size:10px">→Tmpl</span><span class="tcard-btn del" onclick="deleteDoc('${doc.id}',event)" style="opacity:0.5;margin-left:2px">✕</span>`;
        el.onclick = (e) => {
            if (e.target.classList.contains("tcard-btn")) return;
            toggleDoc(doc.id, el);
        };
        docsEl.appendChild(el);
    });

    // Other projects
    const otherEl = document.getElementById("ctx-other-projects");
    otherEl.innerHTML = "";
    const others = state.projects.filter(
        (p) => p.id !== state.activeProject.id,
    );
    if (!others.length) {
        otherEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No other projects yet.</div>`;
    }
    others.forEach((p) => {
        const checked = state.activeOtherProjects.has(p.id);
        const el = document.createElement("div");
        el.className = "other-project-item";
        el.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} onchange="toggleOtherProject('${p.id}', this.checked)"> <span>${p.name}</span> <span style="font-size:10px;color:var(--text-muted);font-family:DM Mono,monospace">${p.category}</span>`;
        otherEl.appendChild(el);
    });

    // Doc count
    document.getElementById("ctx-doc-count").textContent =
        `${docs.length} doc${docs.length !== 1 ? "s" : ""}`;
}

function toggleDoc(id, el) {
    if (state.activeDocs.has(id)) {
        state.activeDocs.delete(id);
        el.classList.remove("active");
        el.querySelector(".doc-toggle").textContent = "";
    } else {
        state.activeDocs.add(id);
        el.classList.add("active");
        el.querySelector(".doc-toggle").textContent = "✓";
    }
}

function toggleOtherProject(id, checked) {
    if (checked) state.activeOtherProjects.add(id);
    else state.activeOtherProjects.delete(id);
}

async function deleteDoc(id, e) {
    e.stopPropagation();
    if (!confirm("Remove this document?")) return;
    await dbDelete("docs", id);
    state.activeDocs.delete(id);
    await renderRightPanel();
}

function toggleRightPanel() {
    state.rightPanelOpen = !state.rightPanelOpen;
    document
        .getElementById("panel-right")
        .classList.toggle("collapsed", !state.rightPanelOpen);
}

// ─── DOC UPLOAD ───────────────────────────────────────────────────────────────
async function handleDocUpload(event) {
    if (!state.activeProject) return;
    const files = Array.from(event.target.files);
    for (const file of files) {
        const text = await readFileAsText(file);
        const doc = {
            id: uid(),
            projectId: state.activeProject.id,
            name: file.name,
            content: text,
            uploadedAt: Date.now(),
        };
        await dbPut("docs", doc);
        state.activeDocs.add(doc.id);
    }
    event.target.value = "";
    await renderRightPanel();
}

function readFileAsText(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.onerror = () => res(`[Could not read file: ${file.name}]`);
        reader.readAsText(file);
    });
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function renderTemplatesGrid() {
    const grid = document.getElementById("templates-grid");
    grid.innerHTML = "";
    if (!state.templates.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="30" height="30" rx="3"/><line x1="12" y1="14" x2="28" y2="14"/><line x1="12" y1="20" x2="28" y2="20"/><line x1="12" y1="26" x2="20" y2="26"/></svg><span>No templates yet — create your first one.</span></div>`;
        return;
    }
    state.templates.forEach((t) => {
        const card = document.createElement("div");
        card.className = "template-card";
        card.innerHTML = `
      <div class="template-card-actions">
        <span class="tcard-btn" onclick="openEditTemplate('${t.id}')">Edit</span>
        <span class="tcard-btn" onclick="duplicateTemplate('${t.id}')">Dup</span>
        <span class="tcard-btn del" onclick="deleteTemplate('${t.id}')">Delete</span>
      </div>
      <div class="template-card-type ${t.type === "skeleton" ? "type-skeleton" : "type-example"}">${t.type}</div>
      <div class="template-card-name">${t.name}</div>
      <div class="template-card-category">${t.category}</div>`;
        grid.appendChild(card);
    });
}

function openNewTemplate() {
    state.editingTemplateId = null;
    document.getElementById("modal-template-title").textContent =
        "New Template";
    document.getElementById("tmpl-name").value = "";
    document.getElementById("tmpl-content").value = "";
    selectPillByVal("tmpl-category-pills", "RFP");
    selectPillByVal("tmpl-type-pills", "skeleton");
    const pp = document.getElementById("tmpl-preview-panel");
    if (pp) pp.style.display = "none";
    showModal("modal-template");
}

function openEditTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    state.editingTemplateId = id;
    document.getElementById("modal-template-title").textContent =
        "Edit Template";
    document.getElementById("tmpl-name").value = t.name;
    document.getElementById("tmpl-content").value = t.content;
    selectPillByVal("tmpl-category-pills", t.category);
    selectPillByVal("tmpl-type-pills", t.type);
    const pp = document.getElementById("tmpl-preview-panel");
    if (pp) pp.style.display = "none";
    showModal("modal-template");
}

async function saveTemplate() {
    const name = document.getElementById("tmpl-name").value.trim();
    const content = document.getElementById("tmpl-content").value.trim();
    const category = getActivePill("tmpl-category-pills");
    const type = getActivePill("tmpl-type-pills");
    if (!name || !content) {
        alert("Please fill in the name and content.");
        return;
    }
    const id = state.editingTemplateId || uid();
    const tmpl = { id, name, category, type, content, updatedAt: Date.now() };
    await dbPut("templates", tmpl);
    if (state.editingTemplateId) {
        state.templates = state.templates.map((t) => (t.id === id ? tmpl : t));
    } else {
        state.templates.push(tmpl);
    }
    closeModal();
    renderTemplatesGrid();
}

async function duplicateTemplate(id) {
    const tmpl = state.templates.find((t) => t.id === id);
    if (!tmpl) return;
    const copy = {
        id: uid(),
        name: `${tmpl.name} (copy)`,
        category: tmpl.category,
        type: tmpl.type,
        content: tmpl.content,
        updatedAt: Date.now(),
    };
    await dbPut("templates", copy);
    state.templates.push(copy);
    renderTemplatesGrid();
}

async function deleteTemplate(id) {
    if (!confirm("Delete this template?")) return;
    await dbDelete("templates", id);
    state.templates = state.templates.filter((t) => t.id !== id);
    renderTemplatesGrid();
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────
function openNewProject() {
    state.editingProjectId = null;
    document.getElementById("modal-project-title").textContent = "New Project";
    document.getElementById("proj-save-btn").textContent = "Create Project";
    document.getElementById("proj-name").value = "";
    document.getElementById("proj-notes").value = "";
    document.getElementById("proj-instructions").value = "";
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
        const proj = state.projects.find(
            (p) => p.id === state.editingProjectId,
        );
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
            document.getElementById("project-type-badge").textContent =
                proj.category;
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
    document.getElementById("proj-instructions").value =
        proj.instructions || "";
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

// ─── FILL TEMPLATE ────────────────────────────────────────────────────────────
function openFillTemplate(templateId) {
    const tmpl = state.templates.find((t) => t.id === templateId);
    if (!tmpl || tmpl.type !== "skeleton") {
        viewTemplateContent(templateId);
        return;
    }

    // Auto-resolve project vars and global constants first
    const resolved = resolveTemplateVars(tmpl.content);

    // Find which placeholders were in original but are now gone (auto-resolved)
    const origPH = [
        ...new Set(
            [...tmpl.content.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]),
        ),
    ];
    const remainPH = [
        ...new Set([...resolved.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1])),
    ];
    const autoPH = origPH.filter((p) => !remainPH.includes(p));

    // If nothing left to fill (and nothing was auto-resolved either), fall back
    if (!remainPH.length && !autoPH.length) {
        viewTemplateContent(templateId);
        return;
    }

    // If all placeholders were auto-resolved, insert directly
    if (!remainPH.length) {
        document.getElementById("chat-input").value =
            "Please help me review and complete this document:\n\n" + resolved;
        closeModal();
        document.getElementById("chat-input").focus();
        return;
    }

    document.getElementById("modal-fill-subtitle").textContent =
        'Fill in the blanks for "' + tmpl.name + '"';

    const autoEl = document.getElementById("fill-auto-resolved");
    if (autoPH.length) {
        autoEl.style.display = "block";
        autoEl.textContent =
            "Auto-filled: " + autoPH.map((p) => "{{" + p + "}}").join(", ");
    } else {
        autoEl.style.display = "none";
    }

    const fields = document.getElementById("fill-fields");
    fields.innerHTML = "";
    remainPH.forEach((ph) => {
        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML =
            '<label class="form-label">' +
            ph +
            '</label><input class="form-input" data-placeholder="' +
            ph +
            '" placeholder="Enter ' +
            ph +
            '…">';
        fields.appendChild(row);
    });
    fields.dataset.templateId = templateId;
    showModal("modal-fill");
}

function applyFill() {
    const fields = document.getElementById("fill-fields");
    const tmpl = state.templates.find(
        (t) => t.id === fields.dataset.templateId,
    );
    if (!tmpl) return;
    // Auto-resolve first, then apply manual fills
    let filled = resolveTemplateVars(tmpl.content);
    fields.querySelectorAll("[data-placeholder]").forEach((inp) => {
        const val = inp.value.trim() || "[" + inp.dataset.placeholder + "]";
        filled = filled.split("{{" + inp.dataset.placeholder + "}}").join(val);
    });
    document.getElementById("chat-input").value =
        "Please help me review and complete this document:\n\n" + filled;
    closeModal();
    document.getElementById("chat-input").focus();
}

function viewTemplateContent(templateId) {
    const tmpl = state.templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const content = resolveTemplateVars(tmpl.content);
    document.getElementById("chat-input").value =
        "I'd like to work on the \"" +
        tmpl.name +
        "\" template. Here's the content:\n\n" +
        content;
    closeModal();
    document.getElementById("chat-input").focus();
}

async function createTemplateFromDoc(docId) {
    const doc = await dbGet("docs", docId);
    if (!doc) return;
    state.editingTemplateId = null;
    document.getElementById("modal-template-title").textContent =
        "New Template from Document";
    // Strip file extension from name for template name default
    document.getElementById("tmpl-name").value = doc.name.replace(
        /\.[^.]+$/,
        "",
    );
    document.getElementById("tmpl-content").value = doc.content;
    selectPillByVal(
        "tmpl-category-pills",
        state.activeProject ? state.activeProject.category : "Other",
    );
    selectPillByVal("tmpl-type-pills", "skeleton");
    showModal("modal-template");
}

async function openExtractVars(docId) {
    const doc = await dbGet("docs", docId);
    if (!doc) return;
    const items = extractVarsFromText(doc.content);
    document.getElementById("modal-extract-title").textContent =
        'Variables detected in "' + doc.name + '"';
    const listEl = document.getElementById("extract-vars-list");
    listEl.innerHTML = "";
    if (!items.length) {
        listEl.innerHTML =
            '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">No variables detected in this document.</div>';
    } else {
        items.forEach(function (item) {
            const row = document.createElement("div");
            row.style.cssText =
                "display:flex;align-items:center;gap:8px;margin-bottom:6px";
            const badge =
                '<span style="background:var(--accent-dim,#2a2925);color:var(--text-dim);font-size:10px;padding:2px 5px;border-radius:3px">' +
                item.type +
                "</span>";
            row.innerHTML =
                '<input type="checkbox" checked style="flex-shrink:0;accent-color:var(--accent)">' +
                '<input class="form-input" style="width:140px;font-family:DM Mono,monospace;font-size:12px" value="' +
                item.suggestedKey.replace(/"/g, "&quot;") +
                '" data-value="' +
                item.value.replace(/"/g, "&quot;") +
                '">' +
                badge +
                '<span style="font-size:12px;color:var(--text-dim);font-family:DM Mono,monospace;flex:1">' +
                item.value +
                "</span>";
            listEl.appendChild(row);
        });
    }
    showModal("modal-extract-vars");
}

async function saveExtractedVars() {
    const listEl = document.getElementById("extract-vars-list");
    const newPairs = [];
    listEl.querySelectorAll("div").forEach(function (row) {
        const cb = row.querySelector('input[type="checkbox"]');
        const keyInput = row.querySelector("input.form-input");
        if (cb && cb.checked && keyInput) {
            const k = keyInput.value.trim().toUpperCase().replace(/\s+/g, "_");
            const v = keyInput.dataset.value || "";
            if (k && v) newPairs.push(k + "=" + v);
        }
    });
    if (!newPairs.length) {
        closeModal();
        return;
    }
    const existing = (state.settings.constants || "").trim();
    const merged = existing
        ? existing + "\n" + newPairs.join("\n")
        : newPairs.join("\n");
    state.settings.constants = merged;
    await dbPut("settings", { key: "constants", value: merged });
    const ta = document.getElementById("settings-constants");
    if (ta) ta.value = merged;
    closeModal();
}

function previewTemplateVars() {
    const content = document.getElementById("tmpl-content").value;
    if (!content.trim()) {
        alert("Enter some template content to preview.");
        return;
    }
    const resolved = resolveTemplateVars(content);
    document.getElementById("tmpl-preview-content").value = resolved;
    document.getElementById("tmpl-preview-panel").style.display = "block";
}
function togglePreviewPanel() {
    document.getElementById("tmpl-preview-panel").style.display = "none";
}

function promptAttachTemplate() {
    openNewProject();
}

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
    const oldProv = getActivePill("provider-pills") || state.settings.provider;
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

// ─── GOOGLE DRIVE CONNECTOR ──────────────────────────────────────────────────

function openDriveModal() {
    const tokenEl = document.getElementById("drive-token-input");
    if (tokenEl) tokenEl.value = state.settings.driveToken || "";
    updateDriveStatus();
    showModal("modal-drive");
    if (state.settings.driveToken) {
        listDriveFiles();
    }
}

function updateDriveStatus() {
    const hasToken = !!state.settings.driveToken;
    const browserEl = document.getElementById("drive-browser");
    const backupEl = document.getElementById("drive-backup-section");
    const statusEl = document.getElementById("drive-connect-status");
    if (hasToken) {
        if (browserEl) browserEl.classList.remove("hidden");
        if (backupEl) backupEl.classList.remove("hidden");
        if (statusEl) {
            statusEl.textContent =
                "Token saved — click Connect / Verify to confirm it's still valid.";
            statusEl.style.color = "var(--text-muted)";
        }
    } else {
        if (browserEl) browserEl.classList.add("hidden");
        if (backupEl) backupEl.classList.add("hidden");
        if (statusEl) {
            statusEl.textContent = "Not connected";
            statusEl.style.color = "var(--text-muted)";
        }
    }
}

async function verifyDriveToken() {
    const tokenEl = document.getElementById("drive-token-input");
    const token = tokenEl ? tokenEl.value.trim() : "";
    const statusEl = document.getElementById("drive-connect-status");
    if (!token) {
        if (statusEl) {
            statusEl.textContent = "Paste an access token first.";
            statusEl.style.color = "var(--danger)";
        }
        return;
    }
    if (statusEl) {
        statusEl.textContent = "Verifying…";
        statusEl.style.color = "var(--text-muted)";
    }
    try {
        const res = await fetch(
            "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" +
                encodeURIComponent(token),
        );
        const info = await res.json();
        if (info.error) {
            throw new Error(info.error_description || info.error);
        }
        // Save token to state + DB
        state.settings.driveToken = token;
        await dbPut("settings", { key: "driveToken", value: token });

        const email = info.email ? " as " + info.email : "";
        const mins = info.expires_in
            ? " · expires in " + Math.round(info.expires_in / 60) + " min"
            : "";
        if (statusEl) {
            statusEl.textContent = "Connected" + email + mins;
            statusEl.style.color = "var(--success)";
        }
        const browserEl = document.getElementById("drive-browser");
        const backupEl = document.getElementById("drive-backup-section");
        if (browserEl) browserEl.classList.remove("hidden");
        if (backupEl) backupEl.classList.remove("hidden");
        await listDriveFiles();
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = "Invalid or expired token: " + err.message;
            statusEl.style.color = "var(--danger)";
        }
    }
}

async function disconnectDrive() {
    state.settings.driveToken = "";
    await dbPut("settings", { key: "driveToken", value: "" });
    const tokenEl = document.getElementById("drive-token-input");
    if (tokenEl) tokenEl.value = "";
    const browserEl = document.getElementById("drive-browser");
    const backupEl = document.getElementById("drive-backup-section");
    const statusEl = document.getElementById("drive-connect-status");
    const listEl = document.getElementById("drive-file-list");
    if (browserEl) browserEl.classList.add("hidden");
    if (backupEl) backupEl.classList.add("hidden");
    if (statusEl) {
        statusEl.textContent = "Disconnected";
        statusEl.style.color = "var(--text-muted)";
    }
    if (listEl) listEl.innerHTML = "";
}

async function listDriveFiles() {
    const token = state.settings.driveToken;
    if (!token) return;
    const searchEl = document.getElementById("drive-search");
    const q = searchEl ? searchEl.value.trim() : "";
    const listEl = document.getElementById("drive-file-list");
    if (listEl) {
        listEl.innerHTML =
            '<div style="color:var(--text-muted);padding:12px;text-align:center;font-size:12px">Loading…</div>';
    }

    // Only list file types we can import as text
    let gq =
        "trashed=false and (" +
        "mimeType='text/plain' or " +
        "mimeType='text/markdown' or " +
        "mimeType='text/csv' or " +
        "mimeType='application/json' or " +
        "mimeType='application/vnd.google-apps.document'" +
        ")";
    if (q) {
        gq += " and name contains '" + q.replace(/'/g, "\\'") + "'";
    }
    const url =
        "https://www.googleapis.com/drive/v3/files?" +
        "q=" +
        encodeURIComponent(gq) +
        "&fields=files(id,name,mimeType,modifiedTime,size)" +
        "&pageSize=50" +
        "&orderBy=modifiedTime+desc";

    try {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const data = await res.json();
        renderDriveFileList(data.files || []);
    } catch (err) {
        if (listEl) {
            listEl.innerHTML =
                '<div style="color:var(--danger);padding:12px;font-size:12px">Error: ' +
                err.message +
                "</div>";
        }
    }
}

function renderDriveFileList(files) {
    const listEl = document.getElementById("drive-file-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!files.length) {
        const empty = document.createElement("div");
        empty.style.cssText =
            "color:var(--text-muted);padding:12px;text-align:center;font-size:12px";
        empty.textContent = "No supported files found";
        listEl.appendChild(empty);
        return;
    }
    for (const f of files) {
        const item = document.createElement("div");
        item.className = "drive-file-item";

        const info = document.createElement("div");
        info.className = "drive-file-info";

        const nameEl = document.createElement("span");
        nameEl.className = "drive-file-name";
        nameEl.textContent = f.name;

        const metaEl = document.createElement("span");
        metaEl.className = "drive-file-meta";
        const typeLabel =
            f.mimeType === "application/vnd.google-apps.document"
                ? "Google Doc"
                : f.mimeType.split("/").pop().toUpperCase();
        const dateLabel = f.modifiedTime
            ? new Date(f.modifiedTime).toLocaleDateString()
            : "";
        metaEl.textContent = typeLabel + (dateLabel ? " · " + dateLabel : "");

        info.appendChild(nameEl);
        info.appendChild(metaEl);

        const btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.style.cssText = "font-size:12px;padding:4px 10px;flex-shrink:0";
        btn.textContent = "Import";
        // Capture loop variables in closure
        (function (fileId, fileName, mimeType) {
            btn.onclick = function () {
                importFromDrive(fileId, fileName, mimeType);
            };
        })(f.id, f.name, f.mimeType);

        item.appendChild(info);
        item.appendChild(btn);
        listEl.appendChild(item);
    }
}

async function importFromDrive(fileId, fileName, mimeType) {
    if (!state.activeProject) {
        alert(
            "Open a project first — imported files are added as project documents.",
        );
        return;
    }
    const token = state.settings.driveToken;
    if (!token) return;

    let url;
    if (mimeType === "application/vnd.google-apps.document") {
        url =
            "https://www.googleapis.com/drive/v3/files/" +
            fileId +
            "/export?mimeType=text%2Fplain";
    } else {
        url =
            "https://www.googleapis.com/drive/v3/files/" +
            fileId +
            "?alt=media";
    }

    try {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const content = await res.text();
        const doc = {
            id: uid(),
            projectId: state.activeProject.id,
            name: fileName,
            content: content,
            uploadedAt: Date.now(),
        };
        await dbPut("docs", doc);
        await renderRightPanel();
        closeModal();
        alert('"' + fileName + '" imported as a document in this project.');
    } catch (err) {
        alert("Import failed: " + err.message);
    }
}

async function backupToDrive() {
    const token = state.settings.driveToken;
    if (!token) return;
    const btn = document.getElementById("drive-backup-btn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Uploading…";
    }
    try {
        const stores = [
            "templates",
            "projects",
            "docs",
            "chats",
            "notes",
            "settings",
        ];
        const data = {
            version: DB_VERSION,
            appVersion: APP_VERSION,
            exportedAt: new Date().toISOString(),
            stores: {},
        };
        for (const s of stores) data.stores[s] = await dbGetAll(s);
        const json = JSON.stringify(data, null, 2);
        const filename =
            "sourcedesk-backup-" +
            new Date().toISOString().slice(0, 10) +
            ".json";
        const metadata = { name: filename, mimeType: "application/json" };

        const form = new FormData();
        form.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], { type: "application/json" }),
        );
        form.append("file", new Blob([json], { type: "application/json" }));

        const res = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: form,
            },
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const file = await res.json();
        alert("Backup saved to Google Drive: " + (file.name || filename));
    } catch (err) {
        alert("Backup failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Backup Database to Drive";
        }
    }
}

function validateImportShape(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (typeof obj.version !== "number") return false;
    if (typeof obj.exportedAt !== "string") return false;
    if (!obj.stores || typeof obj.stores !== "object") return false;
    if (
        !["templates", "projects", "docs", "chats", "settings"].every((k) =>
            Array.isArray(obj.stores[k]),
        )
    )
        return false;
    // notes store is optional — older backups won't have it
    return true;
}

function triggerImportDialog() {
    document.getElementById("import-file-input").click();
}

async function importDatabase(file) {
    if (!file) return;
    const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.onerror = rej;
        r.readAsText(file);
    });
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        alert("Invalid JSON file.");
        return;
    }
    if (!validateImportShape(data)) {
        alert("File does not appear to be a valid SourceDesk backup.");
        return;
    }
    if (
        !confirm(
            `Import backup from ${data.exportedAt}?\n\nThis will REPLACE all current data.`,
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
    for (const s of stores) {
        // notes may be absent in older backups — skip gracefully
        if (!data.stores[s]) continue;
        for (const item of data.stores[s]) await dbPut(s, item);
    }
    location.reload();
}

async function exportProject() {
    if (!state.activeProject) return;
    const docs = await dbGetByIndex(
        "docs",
        "projectId",
        state.activeProject.id,
    );

    // Ask the user whether to include full document bodies (may be large)
    const includeBodies = confirm(
        "Include full document bodies in the export? The file may be large. Click OK to include, Cancel to exclude.",
    );

    const payload = {
        project: state.activeProject,
        messages: state.messages,
        docs: docs.map((d) => {
            const base = {
                id: d.id,
                name: d.name,
                uploadedAt: d.uploadedAt,
            };
            if (includeBodies) base.content = d.content;
            return base;
        }),
        exportedAt: new Date().toISOString(),
        includeFullDocs: !!includeBodies,
    };

    const json = JSON.stringify(payload, null, 2);
    const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    const safeName = state.activeProject.name
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
    a.download = `${safeName}-export${includeBodies ? "-full" : ""}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
    notes.forEach((n) => {
        const el = document.createElement("div");
        el.className =
            "note-item" +
            (state.currentNote && state.currentNote.id === n.id
                ? " active"
                : "");
        el.dataset.noteId = n.id;
        el.innerHTML = `<div class="note-item-title">${n.title || "Untitled"}</div><div class="note-item-date">${new Date(n.updatedAt).toLocaleDateString()}</div>`;
        el.onclick = () => selectNote(n);
        list.appendChild(el);
    });
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
            '<div class="note-item-title">' +
            (n.title || "Untitled") +
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
        el.onclick = async () => {
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

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function showModal(id) {
    document.getElementById("modal-overlay").classList.remove("hidden");
    document
        .querySelectorAll(".modal")
        .forEach((m) => m.classList.add("hidden"));
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
        document.querySelector(`#${groupId} .type-pill.active`)?.dataset.val ||
        ""
    );
}

// ─── INPUT RESIZE ────────────────────────────────────────────────────────────
if (!TEST) {
    document.addEventListener("DOMContentLoaded", () => {
        const ta = document.getElementById("chat-input");
        ta.addEventListener("input", () => {
            ta.style.height = "auto";
            ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
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
        showView("chat");
        boot();
    });
}
