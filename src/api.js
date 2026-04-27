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
