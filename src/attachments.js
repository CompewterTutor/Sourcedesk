// ─── TEMPORARY ATTACHMENTS ────────────────────────────────────────────────────
// Per-message file attachments that are NOT saved to the project docs store.
// Text files are extracted and injected into the system prompt for this message.
// Images are base64-encoded and sent as vision content (OpenAI-compat + Anthropic).

let _pendingAttachments = []; // { name, type, content (text or dataUrl) }

function openAttachMenu() {
    document.getElementById("attach-file-input").click();
}

async function handleAttachFiles(files) {
    if (!files || !files.length) return;
    for (const file of files) {
        const isImage = file.type.startsWith("image/");
        if (isImage) {
            const dataUrl = await _readAsDataURL(file);
            _pendingAttachments.push({
                name: file.name,
                type: "image",
                content: dataUrl,
            });
        } else {
            // Extract text
            const text = await _readAsText(file);
            _pendingAttachments.push({
                name: file.name,
                type: "text",
                content: text,
            });
        }
    }
    // Reset input so same file can be re-attached if needed
    document.getElementById("attach-file-input").value = "";
    renderAttachBar();
    updateContextMeter();
}

function removeAttachment(index) {
    _pendingAttachments.splice(index, 1);
    renderAttachBar();
    updateContextMeter();
}

function clearPendingAttachments() {
    _pendingAttachments = [];
    renderAttachBar();
}

function renderAttachBar() {
    const bar = document.getElementById("chat-attachments-bar");
    if (!bar) return;
    if (!_pendingAttachments.length) {
        bar.classList.add("hidden");
        bar.innerHTML = "";
        return;
    }
    bar.classList.remove("hidden");
    bar.innerHTML = "";
    _pendingAttachments.forEach((a, i) => {
        const chip = document.createElement("div");
        chip.className = "attach-chip";
        const icon = a.type === "image" ? "🖼" : "📄";
        chip.innerHTML = `${icon} <span>${a.name}</span><button class="attach-chip-remove" onclick="removeAttachment(${i})" title="Remove">✕</button>`;
        bar.appendChild(chip);
    });
}

function getPendingAttachments() {
    return _pendingAttachments;
}

// ─── CONTEXT METER ────────────────────────────────────────────────────────────
// Rough token estimate: 1 token ≈ 4 chars. Context windows vary by model/provider.
// We show a best-effort bar — not a guarantee.

const CONTEXT_LIMITS = {
    "claude-sonnet-4-6": 200000,
    "claude-opus-4-6": 200000,
    "claude-haiku-4-5-20251001": 200000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-5.4": 128000,
    "gpt-5.4-mini": 128000,
    "gpt-5.4-nano": 128000,
    "o4-mini": 128000,
    _default: 100000,
};

// Runtime map populated by fetchLocalModels() from the /models response.
// Keys are model IDs; values are context window sizes in tokens.
// Takes priority over CONTEXT_LIMITS so local servers self-report correctly.
const _runtimeContextLimits = {};

function setModelContextLimit(modelId, tokens) {
    if (modelId && tokens > 0) _runtimeContextLimits[modelId] = tokens;
}

function getContextLimit(modelId) {
    return (
        _runtimeContextLimits[modelId] ||
        CONTEXT_LIMITS[modelId] ||
        CONTEXT_LIMITS._default
    );
}

function estimateTokens(text) {
    return Math.ceil((text || "").length / 4);
}

function updateContextMeter() {
    const bar = document.getElementById("context-meter-bar");
    const label = document.getElementById("context-meter-label");
    if (!bar || !label) return;

    // Tally messages
    let totalChars = 0;
    if (state && state.messages) {
        state.messages.forEach((m) => {
            totalChars += (m.content || "").length;
        });
    }
    // Add pending attachment text sizes
    _pendingAttachments.forEach((a) => {
        if (a.type === "text") totalChars += a.content.length;
        else totalChars += 500; // rough estimate for image tokens
    });
    // Add current input
    const inputEl = document.getElementById("chat-input");
    if (inputEl) totalChars += inputEl.value.length;

    // totalChars is already char count, tokens = totalChars / 4
    const tokenCount = Math.ceil(totalChars / 4);

    const model = (state && state.settings && state.settings.model) || "";
    const limit = getContextLimit(model);
    const pct = Math.min((tokenCount / limit) * 100, 100);

    bar.style.width = pct + "%";
    // Color: green → yellow → red
    if (pct < 60) bar.style.background = "var(--accent)";
    else if (pct < 85) bar.style.background = "#e0a43a";
    else bar.style.background = "var(--danger)";

    const fmtTokens =
        tokenCount >= 1000 ? (tokenCount / 1000).toFixed(1) + "k" : tokenCount;
    const fmtLimit = limit >= 1000 ? (limit / 1000).toFixed(0) + "k" : limit;
    label.textContent = `~${fmtTokens} / ${fmtLimit}`;
}

// ─── STREAMING INDICATOR ──────────────────────────────────────────────────────
function showStreamingIndicator() {
    const el = document.getElementById("streaming-indicator");
    if (el) el.classList.remove("hidden");
}

function hideStreamingIndicator() {
    const el = document.getElementById("streaming-indicator");
    if (el) el.classList.add("hidden");
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────
function _readAsDataURL(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
    });
}

function _readAsText(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsText(file);
    });
}
