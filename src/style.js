// ─── WRITING STYLE CAPTURE ───────────────────────────────────────────────────
// Lets users paste or upload old communication samples (emails, reports,
// messages) and run them through the active LLM to generate a compact
// Writing Style Profile.  When enabled, the profile is injected into every
// chat system prompt so AI responses sound more like the user.

// ─── Modal open ───────────────────────────────────────────────────────────────
function openWritingStyleModal() {
  const samplesEl = document.getElementById("writing-style-samples-input");
  const profileEl = document.getElementById("writing-style-profile-input");
  const applyEl   = document.getElementById("writing-style-apply");
  const statusEl  = document.getElementById("writing-style-status");

  if (samplesEl) samplesEl.value = ""; // samples are transient — not stored
  if (profileEl) profileEl.value = state.settings.writingStyleProfile || "";
  if (applyEl)   applyEl.checked  = !!state.settings.writingStyleEnabled;
  if (statusEl)  { statusEl.textContent = ""; }

  _updateWritingStyleCharCount();
  showModal("modal-writing-style");
}

// ─── Char / token counter ─────────────────────────────────────────────────────
function _updateWritingStyleCharCount() {
  const samplesEl = document.getElementById("writing-style-samples-input");
  const countEl   = document.getElementById("writing-style-char-count");
  if (!countEl || !samplesEl) return;
  const chars  = (samplesEl.value || "").length;
  const tokens = Math.round(chars / 4);
  countEl.textContent = chars > 0 ? "~" + tokens.toLocaleString() + " tokens" : "";
}

// ─── File upload ──────────────────────────────────────────────────────────────
function _addWritingStyleFiles() {
  const input = document.getElementById("writing-style-file-input");
  if (!input || !input.files || !input.files.length) return;
  const samplesEl = document.getElementById("writing-style-samples-input");
  if (!samplesEl) return;

  const files = Array.from(input.files);
  let pending = files.length;

  files.forEach(function (file) {
    const r = new FileReader();
    r.onload = function (e) {
      samplesEl.value +=
        (samplesEl.value ? "\n\n---\n\n" : "") +
        "[" + file.name + "]\n" + e.target.result;
      pending--;
      if (pending === 0) _updateWritingStyleCharCount();
    };
    r.onerror = function () {
      pending--;
      if (pending === 0) _updateWritingStyleCharCount();
    };
    r.readAsText(file);
  });
  input.value = "";
}

// ─── AI analysis ──────────────────────────────────────────────────────────────
async function analyzeWritingStyle() {
  const samplesEl  = document.getElementById("writing-style-samples-input");
  const statusEl   = document.getElementById("writing-style-status");
  const btn        = document.getElementById("writing-style-analyze-btn");

  const samples = (samplesEl ? samplesEl.value : "").trim();
  if (!samples) {
    if (statusEl) {
      statusEl.textContent = "Paste writing samples first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }

  const key = getCurrentProviderKey();
  if (!key && state.settings.provider !== "local") {
    if (statusEl) {
      statusEl.textContent = "Configure an API key in Settings first.";
      statusEl.style.color = "var(--danger)";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = "Analyzing writing style…";
    statusEl.style.color = "var(--text-muted)";
  }
  if (btn) btn.disabled = true;

  try {
    var systemPrompt =
      "You are an expert writing and communication analyst. " +
      "Analyze the provided writing samples accurately and objectively.";

    var userMessage =
      "Analyze the following writing samples and create a concise Writing Style Profile " +
      "(under 300 words). This profile will be used to guide an AI assistant to respond " +
      "in this person's voice and style.\n\n" +
      "Include these dimensions:\n" +
      "- **Tone & Register**: formal/casual, professional/friendly, direct/indirect\n" +
      "- **Structure**: how ideas are organized, paragraph style, use of lists vs prose\n" +
      "- **Vocabulary**: common phrases, technical terms, sentence length and complexity\n" +
      "- **Communication patterns**: level of detail, how opinions are expressed, " +
      "how questions are asked\n" +
      "- **Distinctive traits**: any recurring habits, idioms, or stylistic signatures\n\n" +
      "Be specific and actionable — avoid vague generalizations. " +
      "Use concrete examples from the samples where helpful.\n\n" +
      "Writing samples:\n---\n" +
      samples.slice(0, 8000);

    var apiCall = buildApiCall(systemPrompt, [{ role: "user", content: userMessage }]);

    // Non-streaming request — patch stream:false and cap max_tokens
    var bodyStr = apiCall.body;
    try {
      var outer = JSON.parse(bodyStr);
      if (outer && typeof outer.body === "string") {
        // Proxy envelope (local provider via server.js)
        var inner = JSON.parse(outer.body);
        inner.stream = false;
        inner.max_tokens = 1024;
        outer.body = JSON.stringify(inner);
        bodyStr = JSON.stringify(outer);
      } else {
        outer.stream = false;
        outer.max_tokens = 1024;
        bodyStr = JSON.stringify(outer);
      }
    } catch (_) {}

    var resp = await fetch(apiCall.url, {
      method: "POST",
      headers: apiCall.headers,
      body: bodyStr,
    });

    if (!resp.ok) {
      var errData = await resp.json().catch(function () {
        return { error: resp.statusText };
      });
      throw new Error(
        (errData.error && errData.error.message) ||
          errData.error ||
          resp.statusText,
      );
    }

    var data = await resp.json();

    // Parse response — Anthropic vs OpenAI-compat
    var profile = "";
    if (data.content && data.content[0] && data.content[0].text) {
      profile = data.content[0].text; // Anthropic
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      profile = data.choices[0].message.content; // OpenAI-compat
    }

    if (!profile) throw new Error("No profile returned — check API response.");

    var profileEl = document.getElementById("writing-style-profile-input");
    if (profileEl) profileEl.value = profile;

    if (statusEl) {
      statusEl.textContent = "✓ Profile generated — review, then Save.";
      statusEl.style.color = "var(--success)";
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = "✗ " + (e.message || String(e));
      statusEl.style.color = "var(--danger)";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function saveWritingStyle() {
  var profileEl = document.getElementById("writing-style-profile-input");
  var applyEl   = document.getElementById("writing-style-apply");

  var profile = profileEl ? profileEl.value.trim() : "";
  var enabled = applyEl  ? !!applyEl.checked        : false;

  state.settings.writingStyleProfile = profile;
  state.settings.writingStyleEnabled = enabled;

  await dbPut("settings", { key: "writingStyleProfile", value: profile });
  await dbPut("settings", { key: "writingStyleEnabled", value: enabled  });

  _updateWritingStyleSettingsStatus();
  closeModal();
}

// ─── Clear profile ────────────────────────────────────────────────────────────
function clearWritingStyleProfile() {
  var profileEl = document.getElementById("writing-style-profile-input");
  if (profileEl) profileEl.value = "";
  var statusEl = document.getElementById("writing-style-status");
  if (statusEl) {
    statusEl.textContent = "Profile cleared — click Save to confirm.";
    statusEl.style.color = "var(--text-muted)";
  }
}

// ─── Settings-modal status badge ─────────────────────────────────────────────
function _updateWritingStyleSettingsStatus() {
  var statusEl = document.getElementById("writing-style-settings-status");
  if (!statusEl) return;
  if (state.settings.writingStyleProfile && state.settings.writingStyleEnabled) {
    statusEl.textContent = "● Active";
    statusEl.style.color = "var(--success)";
  } else if (state.settings.writingStyleProfile) {
    statusEl.textContent = "○ Profile saved (disabled)";
    statusEl.style.color = "var(--text-muted)";
  } else {
    statusEl.textContent = "— Not configured";
    statusEl.style.color = "var(--text-muted)";
  }
}
