// ─── MESSAGES ────────────────────────────────────────────────────────────────
function renderMessages() {
    const container = document.getElementById("chat-messages");
    container.innerHTML = "";
    state.messages.forEach((m) =>
        appendMessageEl(m.role, m.content, m.sources, m.chunks),
    );
    container.scrollTop = container.scrollHeight;
}

function appendMessageEl(role, content, sources, chunks) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const avatarLabel = role === "assistant" ? "SD" : "You";
    let sourcesHtml = "";
    if (sources && sources.length) {
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
        sourcesHtml =
            '<div class="chunk-used">' +
            "<span class=\"chunk-toggle\" onclick=\"this.closest('.chunk-used').classList.toggle('expanded')\">" +
            "▸ " +
            sources.length +
            " source" +
            (sources.length === 1 ? "" : "s") +
            " referenced" +
            "</span>" +
            '<div class="chunk-details">' +
            snippetsHtml +
            "</div>" +
            "</div>";
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
