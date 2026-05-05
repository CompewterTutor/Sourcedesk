// ─── MESSAGES ────────────────────────────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById("chat-messages");
  container.innerHTML = "";
  state.messages.forEach((m, i) =>
    appendMessageEl(m.role, m.content, m.sources, m.chunks, i, m.memories),
  );
  container.scrollTop = container.scrollHeight;
}

function appendMessageEl(role, content, sources, chunks, msgIndex, memories) {
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
  let memoriesHtml = "";
  if (memories && memories.length) {
    const memItemsHtml = memories
      .map((m) => {
        const snippet = (m || "").slice(0, 140);
        return (
          '<div class="chunk-item">' +
          '<span class="chunk-item-snippet">' +
          snippet +
          (snippet.length >= 140 ? "\u2026" : "") +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    memoriesHtml =
      '<div class="chunk-used mem-used">' +
      "<span class=\"chunk-toggle\" onclick=\"this.closest('.chunk-used').classList.toggle('expanded')\">" +
      "\uD83E\uDDE0 " +
      memories.length +
      " memor" +
      (memories.length === 1 ? "y" : "ies") +
      " recalled" +
      "</span>" +
      '<div class="chunk-details">' +
      memItemsHtml +
      "</div>" +
      "</div>";
  }
  div.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div>
      <div class="msg-bubble">${formatMarkdown(content)}</div>
      ${sourcesHtml}
      ${memoriesHtml}
    </div>`;
  if (role === "user") {
    const savePromptBtn = document.createElement("button");
    savePromptBtn.className = "msg-save-prompt-btn";
    savePromptBtn.setAttribute("data-prompt-content", "");
    savePromptBtn.title = "Save to prompt library";
    savePromptBtn.textContent = "📚";
    savePromptBtn.addEventListener("click", () => openSavePromptModal(content));
    div.appendChild(savePromptBtn);

    const editBtn = document.createElement("button");
    editBtn.className = "msg-action-btn msg-edit-btn";
    editBtn.title = "Edit & resend";
    editBtn.textContent = "✏";
    const innerDiv = div.querySelector("div:not(.msg-avatar)");
    if (innerDiv) innerDiv.appendChild(editBtn);
    editBtn.addEventListener("click", () =>
      editMessageInline(
        div,
        msgIndex != null ? msgIndex : state.messages.length - 1,
      ),
    );
  }
  if (role === "assistant") {
    const regenBtn = document.createElement("button");
    regenBtn.className = "msg-action-btn msg-regen-btn";
    regenBtn.title = "Regenerate";
    regenBtn.textContent = "↺";
    const innerDiv = div.querySelector("div:not(.msg-avatar)");
    if (innerDiv) innerDiv.appendChild(regenBtn);
    regenBtn.addEventListener("click", () => regenLastAssistant(div));
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function editMessageInline(msgDiv, index) {
  const original = state.messages[index]?.content || "";
  const bubble = msgDiv.querySelector(".msg-bubble");
  if (!bubble) return;
  bubble.innerHTML = "";
  const ta = document.createElement("textarea");
  ta.className = "msg-edit-textarea";
  ta.value = original;
  const actions = document.createElement("div");
  actions.className = "msg-edit-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-primary";
  saveBtn.style.fontSize = "11px";
  saveBtn.textContent = "✓ Resend";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-ghost";
  cancelBtn.style.fontSize = "11px";
  cancelBtn.textContent = "✗ Cancel";
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  bubble.appendChild(ta);
  bubble.appendChild(actions);
  ta.focus();
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";

  cancelBtn.addEventListener("click", () => {
    bubble.innerHTML = formatMarkdown(original);
  });
  saveBtn.addEventListener("click", () => {
    const newText = ta.value.trim();
    if (!newText) return;
    state.messages = state.messages.slice(0, index);
    const allMsgs = document
      .getElementById("chat-messages")
      .querySelectorAll(".msg");
    for (let i = index; i < allMsgs.length; i++) allMsgs[i].remove();
    const input = document.getElementById("chat-input");
    input.value = newText;
    sendMessage();
  });
}

function regenLastAssistant(assistantDiv) {
  if (state.streaming) return;
  const lastAsstIdx = state.messages
    .map((m) => m.role)
    .lastIndexOf("assistant");
  if (lastAsstIdx < 0) return;
  const lastUserMsg = state.messages[lastAsstIdx - 1];
  if (!lastUserMsg) return;
  state.messages = state.messages.slice(0, lastAsstIdx);
  assistantDiv.remove();
  const input = document.getElementById("chat-input");
  input.value = lastUserMsg.content;
  sendMessage();
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
