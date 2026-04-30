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
        embeddingModel: "",
    },
    activeProject: null,
    activeDocs: new Set(),
    activeOtherProjects: new Set(),
    messages: [],
    activeChatId: null,
    streaming: false,
    rightPanelOpen: true,
    editingTemplateId: null,
    editingProjectId: null,
    currentNote: null,
    currentQuestion: null,
    currentTask: null,
};

// ─── PROVIDER HELPERS ─────────────────────────────────────────────────────────
function getCurrentProviderKey() {
    const p = state.settings.provider || "anthropic";
    return state.settings[p + "Key"] || "";
}

function setProviderKey(provider, key) {
    state.settings[provider + "Key"] = key;
}
