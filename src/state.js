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
    localKey: "",
    constants: "",
    driveToken: "",
    localLlmUrl: "",
    markitdownUrl: "",
    embeddingModel: "",
    braveApiKey: "",
    crawl4aiUrl: "http://localhost:11235",
    suggestionWebhook: "",
    serverUrl: "", // base URL of the SourceDesk server for email summaries + token mgmt
    serverToken: "", // API token for browser → server authenticated calls
    hindsightEnabled: true, // enable Hindsight memory recall in chat (no-op when server not configured)
    writingStyleProfile: "", // AI-generated writing style profile injected into system prompt
    writingStyleEnabled: false, // whether to inject the writing style profile
  },
  activeProject: null,
  activeDocs: new Set(),
  activeOtherProjects: new Set(),
  messages: [],
  activeChatId: null,
  activeWorkingDocId: null,
  streaming: false,
  rightPanelOpen: true,
  editingTemplateId: null,
  editingProjectId: null,
  currentNote: null,
  currentQuestion: null,
  currentTask: null,
  currentContact: null,
};

// ─── PROVIDER HELPERS ─────────────────────────────────────────────────────────
function getCurrentProviderKey() {
  const p = state.settings.provider || "anthropic";
  return state.settings[p + "Key"] || "";
}

function setProviderKey(provider, key) {
  state.settings[provider + "Key"] = key;
}
