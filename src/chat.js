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

    const { context, sources, chunks } = await retrieveContext(text);

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
            const snippetsHtml =
                chunks && chunks.length
                    ? chunks
                          .map(
                              (c) =>
                                  '<div class="chunk-item">' +
                                  '<span class="chunk-item-source">' +
                                  c.source +
                                  "</span>" +
                                  '<span class="chunk-item-snippet">' +
                                  c.snippet +
                                  (c.snippet.length >= 120 ? "…" : "") +
                                  "</span>" +
                                  "</div>",
                          )
                          .join("")
                    : "";
            const src = document.createElement("div");
            src.className = "chunk-used";
            src.innerHTML =
                "<span class=\"chunk-toggle\" onclick=\"this.closest('.chunk-used').classList.toggle('expanded')\">" +
                "▸ " +
                sources.length +
                " source" +
                (sources.length === 1 ? "" : "s") +
                " referenced" +
                "</span>" +
                '<div class="chunk-details">' +
                snippetsHtml +
                "</div>";
            msgDiv.appendChild(src);
        }
        state.messages.push({
            role: "assistant",
            content: fullText,
            sources,
            chunks,
        });
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
