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
  // LM Studio newer versions expose their own API at /api/v1 (used for model
  // listing) but the OpenAI-compatible chat/embeddings endpoints live at /v1.
  // Strip /api so both base URL styles work transparently.
  const _localChatBase = _localBase.replace(/\/api(\/v\d+)$/i, "$1");
  const urls = {
    openai: "https://api.openai.com/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    github: "https://models.inference.ai.azure.com/chat/completions",
    local: _localChatBase + "/chat/completions",
  };

  // Only include Authorization if a key is actually set (Ollama works without one)
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://sourcedesk.app";
    headers["X-Title"] = "SourceDesk";
  }

  const body = JSON.stringify({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...apiMessages],
    stream: true,
    max_tokens: 4096,
  });

  // When served via server.js, route local LLM calls through the built-in
  // /proxy endpoint. This avoids browser CORS restrictions: the Fetch spec
  // explicitly excludes Authorization from wildcard Access-Control-Allow-Headers,
  // which LM Studio and Ollama both use. The proxy makes the request server-side.
  if (provider === "local" && window.__SOURCEDESK_ENV__) {
    return {
      url: window.location.origin + "/proxy",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urls.local,
        method: "POST",
        headers,
        body,
      }),
    };
  }

  return {
    url: urls[provider] || urls.openai,
    headers,
    body,
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
