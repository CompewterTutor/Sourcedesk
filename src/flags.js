// ─── FLAGS ──────────────────────────────────────────────────────────────────
const DEBUG = window.__SOURCEDESK_DEBUG__ || false;
const TEST = window.__SOURCEDESK_TEST__ || false;
const APP_VERSION = "0.9.2";
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

// ─── Local LLM proxy helper ───────────────────────────────────────────────────
// When served via server.js, routes local LLM requests through the /proxy
// endpoint instead of making cross-origin requests directly to LM Studio /
// Ollama. This bypasses the browser CORS restriction that prevents the
// Authorization header from being covered by a wildcard
// Access-Control-Allow-Headers: * response.
//
// Falls back to a normal fetch when running from file:// or any other origin
// that doesn't have the server proxy available.
function _localFetch(targetUrl, options) {
  if (typeof window !== "undefined" && window.__SOURCEDESK_ENV__) {
    return fetch(window.location.origin + "/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: targetUrl,
        method: options.method || "GET",
        headers: options.headers || {},
        body: options.body || "",
      }),
      signal: options.signal,
    });
  }
  return fetch(targetUrl, options);
}
