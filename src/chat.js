// ─── STOP STREAMING ─────────────────────────────────────────────────────────
let _streamAbortController = null;

function stopStreaming() {
  if (_streamAbortController) {
    _streamAbortController.abort();
    _streamAbortController = null;
  }
}

function _setStreamingUI(streaming) {
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (sendBtn) sendBtn.classList.toggle("hidden", streaming);
  if (stopBtn) stopBtn.classList.toggle("hidden", !streaming);
  if (sendBtn) sendBtn.disabled = streaming;
}

// ─── Hindsight helpers ───────────────────────────────────────────────────────────────────────────
// Fire-and-forget: send chat messages to the Hindsight retain endpoint.
// Called after saveChat() writes to IndexedDB; never awaited.
function _hindsightRetain(chatId, messages) {
  const serverUrl = state.settings.serverUrl;
  const serverToken = state.settings.serverToken;
  if (!serverUrl || !serverToken || !state.settings.hindsightEnabled) return;
  const projectId = state.activeProject && state.activeProject.id;
  if (!projectId) return;
  const projectCategory =
    (state.activeProject && state.activeProject.category) || "unknown";
  const content = JSON.stringify(
    messages.map((m) => ({
      role: m.role,
      content: (m.content || "").slice(0, 2000),
    })),
  );
  const tags = ["project:" + projectId, "type:chat"];
  const context = "project:" + projectId + " category:" + projectCategory;
  fetch(serverUrl.replace(/\/$/, "") + "/api/hindsight/retain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: serverToken,
      documentId: "chat:" + chatId,
      content,
      context,
      tags,
    }),
  }).catch(() => {});
}

// Returns an array of recalled memory strings (or null on no-op / error).
// Never throws. Times out after 2 s to never block chat.
async function _hindsightRecall(query) {
  const serverUrl = state.settings.serverUrl;
  const serverToken = state.settings.serverToken;
  if (!serverUrl || !serverToken || !state.settings.hindsightEnabled)
    return null;
  const projectId = state.activeProject && state.activeProject.id;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(
      serverUrl.replace(/\/$/, "") + "/api/hindsight/recall",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: serverToken,
          query: query.slice(0, 500),
          projectId: projectId || undefined,
          budget: 2000,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.memories && data.memories.length ? data.memories : null;
  } catch (_) {
    return null;
  }
}

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

  // Snapshot and clear pending attachments before async work
  const attachments =
    typeof getPendingAttachments === "function"
      ? getPendingAttachments().slice()
      : [];
  if (typeof clearPendingAttachments === "function") clearPendingAttachments();

  // Build user message content — show attachment names inline
  let userDisplayText = text;
  if (attachments.length) {
    const names = attachments
      .map((a) => `[${a.type === "image" ? "🖼" : "📄"} ${a.name}]`)
      .join(" ");
    userDisplayText = text + (text ? "\n" : "") + names;
  }

  state.messages.push({ role: "user", content: userDisplayText });
  appendMessageEl("user", userDisplayText);

  const [{ context, sources, chunks }, _memories] = await Promise.all([
    retrieveContext(text),
    _hindsightRecall(text),
  ]);

  let systemPrompt = `You are SourceDesk, an expert AI assistant for strategic sourcing and procurement at a university. You help with RFPs, RFIs, vendor questionnaires, contract review, and supplier analysis.

Be precise, professional, and concise. Use procurement terminology correctly. When filling in templates, follow the structure exactly. Flag any compliance concerns relevant to higher-education procurement.`;

  if (state.settings.globalContext)
    systemPrompt += `\n\n## Global Instructions\n${state.settings.globalContext}`;

  if (_memories && _memories.length)
    systemPrompt += `\n\n## Relevant Memories\n${_memories.join("\n")}`;

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

  // Inject tasks marked includeInContext
  if (state.activeProject) {
    const activeTasks = await dbGetByIndex(
      "tasks",
      "projectId",
      state.activeProject.id,
    );
    const ctxTasks = activeTasks.filter(
      (t) => t.includeInContext && t.status !== "done",
    );
    if (ctxTasks.length) {
      systemPrompt +=
        "\n\n## Active Tasks\n" +
        ctxTasks
          .map(
            (t) =>
              `- [${t.status}] ${t.title}${t.dueDate ? " (due " + t.dueDate + ")" : ""}${t.description ? ": " + t.description : ""}`,
          )
          .join("\n");
    }

    // Inject contacts/resources marked includeInContext
    try {
      const allContacts = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
      );
      const ctxContacts = allContacts.filter((c) => c.includeInContext);
      if (
        ctxContacts.length &&
        typeof _buildContactsContextBlock === "function"
      ) {
        systemPrompt += _buildContactsContextBlock(ctxContacts);
      }
    } catch (e) {
      // contacts store may not exist on older DBs — ignore silently
    }

    // Inject research items marked includeInContext
    try {
      const allResearch = await dbGetByIndex(
        "research",
        "projectId",
        state.activeProject.id,
      );
      const ctxResearch = allResearch.filter((r) => r.includeInContext);
      if (ctxResearch.length) {
        systemPrompt += "\n\n## Research";
        ctxResearch.forEach((r) => {
          systemPrompt +=
            "\n\n### " +
            (r.title || r.url) +
            "\nURL: " +
            r.url +
            (r.summary ? "\nSummary: " + r.summary : "") +
            (r.fullText ? "\n\n" + r.fullText.slice(0, 4000) : "");
        });
      }
    } catch (e) {
      // research store may not exist on older DBs — ignore
    }
  }

  if (context)
    systemPrompt += `\n\n## Retrieved Context (from project documents)\n${context}`;

  // Inject temporary text attachments into system prompt
  const textAttachments = attachments.filter((a) => a.type === "text");
  if (textAttachments.length) {
    systemPrompt +=
      "\n\n## Attached Files (this message only — not saved to project)";
    textAttachments.forEach((a) => {
      systemPrompt += `\n\n### ${a.name}\n${a.content}`;
    });
  }

  // Build API messages — for images, use vision content arrays where supported
  const imageAttachments = attachments.filter((a) => a.type === "image");
  const provider = state.settings.provider || "anthropic";
  let apiMessages;
  if (imageAttachments.length) {
    // Replace last user message with a vision-capable content array
    const baseMessages = state.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));
    let visionContent;
    if (provider === "anthropic") {
      visionContent = [
        { type: "text", text: userDisplayText },
        ...imageAttachments.map((a) => {
          const [meta, b64] = a.content.split(",");
          const mediaType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: b64,
            },
          };
        }),
      ];
    } else {
      // OpenAI-compat vision
      visionContent = [
        { type: "text", text: userDisplayText },
        ...imageAttachments.map((a) => ({
          type: "image_url",
          image_url: { url: a.content },
        })),
      ];
    }
    apiMessages = [...baseMessages, { role: "user", content: visionContent }];
  } else {
    apiMessages = state.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  const typingDiv = document.createElement("div");
  typingDiv.className = "msg assistant";
  typingDiv.innerHTML = `<div class="msg-avatar">SD</div><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  document.getElementById("chat-messages").appendChild(typingDiv);
  document.getElementById("chat-messages").scrollTop = 99999;
  _setStreamingUI(true);
  if (typeof showStreamingIndicator === "function") showStreamingIndicator();
  state.streaming = true;

  _streamAbortController = new AbortController();
  let fullText = "";
  let _activeBubble = null;

  try {
    const { url, headers, body } = buildApiCall(systemPrompt, apiMessages);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: _streamAbortController.signal,
    });

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
    _activeBubble = bubble;
    msgDiv.innerHTML = `<div class="msg-avatar">SD</div>`;
    msgDiv.appendChild(bubble);
    document.getElementById("chat-messages").appendChild(msgDiv);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

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
    if (typingDiv.parentNode) typingDiv.remove();
    if (e.name === "AbortError") {
      // User stopped — render what we got and append a stopped marker
      if (fullText) {
        if (_activeBubble) {
          _activeBubble.innerHTML =
            formatMarkdown(fullText) +
            '<em class="stopped-marker"> [stopped]</em>';
        }
        state.messages.push({
          role: "assistant",
          content: fullText + " _(stopped)_",
        });
        await saveChat();
      }
    } else {
      appendMessageEl("assistant", `⚠ Error: ${e.message}`);
    }
  }

  _streamAbortController = null;
  state.streaming = false;
  _setStreamingUI(false);
  if (typeof hideStreamingIndicator === "function") hideStreamingIndicator();
  if (typeof updateContextMeter === "function") updateContextMeter();
}

async function saveChat() {
  if (!state.activeProject) return;
  const now = Date.now();
  if (state.activeChatId) {
    // Update existing session — preserve existing title
    const existing = await dbGet("chats", state.activeChatId);
    const titleToKeep =
      existing?.title ||
      (() => {
        const words = (state.messages[0]?.content || "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 8)
          .join(" ");
        return words
          ? words.replace(/\b\w/g, (c) => c.toUpperCase())
          : undefined;
      })();
    const record = {
      id: state.activeChatId,
      projectId: state.activeProject.id,
      sessionId: state.activeChatId,
      messages: state.messages,
      updatedAt: now,
    };
    if (titleToKeep) record.title = titleToKeep;
    await dbPut("chats", record);
    _hindsightRetain(state.activeChatId, state.messages);
  } else {
    // First message in a new session — create a record
    const id = uid();
    state.activeChatId = id;
    const firstContent = state.messages[0]?.content || "";
    const words = firstContent
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(" ");
    const title = words
      ? words.replace(/\b\w/g, (c) => c.toUpperCase())
      : undefined;
    const record = {
      id,
      projectId: state.activeProject.id,
      sessionId: id,
      messages: state.messages,
      createdAt: now,
      updatedAt: now,
    };
    if (title) record.title = title;
    await dbPut("chats", record);
    _hindsightRetain(id, state.messages);
    // Async LLM title generation — fire and forget
    if (firstContent)
      setTimeout(() => _generateChatTitle(id, firstContent), 800);
  }
  renderChatSessionList();
}

// Fire-and-forget: ask the LLM to generate a short title for the session,
// then silently update the record and refresh the sidebar list.
async function _generateChatTitle(sessionId, firstUserMessage) {
  const key = getCurrentProviderKey();
  if (!key && state.settings.provider !== "local") return;
  try {
    const call = buildApiCall(
      "You are a title generator. Respond with ONLY a short 4-6 word title for the conversation — no punctuation, no quotes, no extra text.",
      [
        {
          role: "user",
          content:
            "Generate a title for this conversation. First message: " +
            firstUserMessage.slice(0, 300),
        },
      ],
    );
    // Override to non-streaming, small token budget
    const body = JSON.parse(call.body);
    body.stream = false;
    body.max_tokens = 24;
    call.body = JSON.stringify(body);
    const resp = await fetch(call.url, {
      method: "POST",
      headers: call.headers,
      body: call.body,
    });
    if (!resp.ok) return;
    const data = await resp.json();
    let title = "";
    if (state.settings.provider === "anthropic") {
      title =
        data.content && data.content[0] && data.content[0].text
          ? data.content[0].text.trim()
          : "";
    } else {
      title =
        data.choices && data.choices[0] && data.choices[0].message
          ? (data.choices[0].message.content || "").trim()
          : "";
    }
    title = title
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "")
      .trim();
    if (!title || title.length > 80) return;
    const record = await dbGet("chats", sessionId);
    if (record) {
      record.title = title;
      await dbPut("chats", record);
      renderChatSessionList();
    }
  } catch {
    /* silently ignore — this is cosmetic */
  }
}

function newChat() {
  if (!state.activeProject) return;
  if (
    state.messages.length &&
    !confirm(
      "Start a new chat? The current conversation will be saved and accessible from the chat history list.",
    )
  )
    return;
  state.messages = [];
  state.activeChatId = null;
  renderMessages();
}

function _renderChatSessionItems(container, chats, filterQuery) {
  container.innerHTML = "";
  const q = (filterQuery || "").toLowerCase().trim();
  const filtered = q
    ? chats.filter((c) => {
        const titleMatch = (c.title || "").toLowerCase().includes(q);
        const contentMatch = (c.messages || []).some((m) =>
          (m.content || "").toLowerCase().includes(q),
        );
        return titleMatch || contentMatch;
      })
    : chats;
  if (!filtered.length) {
    container.innerHTML =
      '<div style="font-size:11px;color:var(--text-muted);padding:4px 8px;">' +
      (q ? "No matching sessions" : "No saved sessions yet") +
      "</div>";
    return;
  }
  filtered.forEach((c) => {
    const isActive = c.id === state.activeChatId;
    const date = new Date(c.updatedAt || c.createdAt || 0);
    const dateStr =
      date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }) +
      " " +
      date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    const displayText = c.title
      ? c.title
      : (() => {
          const preview =
            c.messages?.[0]?.content?.slice(0, 60) || "Empty chat";
          return preview + (preview.length >= 60 ? "…" : "");
        })();
    const item = document.createElement("div");
    item.className = "chat-session-item" + (isActive ? " active" : "");
    item.title = displayText;
    item.innerHTML = `<span class="chat-session-date">${dateStr}</span><span class="chat-session-preview">${displayText}</span>`;
    item.onclick = () => loadChatSession(c.id);
    container.appendChild(item);
  });
}

async function renderChatSessionList() {
  const container = document.getElementById("chat-session-list");
  if (!container || !state.activeProject) return;
  const chats = await dbGetByIndex(
    "chats",
    "projectId",
    state.activeProject.id,
  );
  // Sort newest first
  chats.sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
  const searchInput = document.getElementById("chat-session-search");
  const currentQuery = searchInput ? searchInput.value : "";
  _renderChatSessionItems(container, chats, currentQuery);
}

// ─── CROSS-PROJECT SESSION SEARCH ────────────────────────────────────────────

function openCrossSearch() {
  const input = document.getElementById("cross-search-input");
  const results = document.getElementById("cross-search-results");
  if (input) input.value = "";
  if (results)
    results.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Type to search all chat sessions across projects…</div>';
  showModal("modal-cross-search");
  setTimeout(() => input && input.focus(), 60);
}

async function runCrossSearch(query) {
  const resultsEl = document.getElementById("cross-search-results");
  if (!resultsEl) return;
  const q = (query || "").toLowerCase().trim();
  if (!q) {
    resultsEl.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Type to search all chat sessions across projects…</div>';
    return;
  }
  resultsEl.innerHTML =
    '<div style="padding:12px;color:var(--text-muted);font-size:12px">Searching…</div>';
  const [allChats, allProjects] = await Promise.all([
    dbGetAll("chats"),
    dbGetAll("projects"),
  ]);
  const projMap = {};
  allProjects.forEach((p) => {
    projMap[p.id] = p;
  });
  const matches = [];
  for (const c of allChats) {
    const titleHit = (c.title || "").toLowerCase().includes(q);
    let snippet = "";
    let msgHit = false;
    for (const m of c.messages || []) {
      if ((m.content || "").toLowerCase().includes(q)) {
        msgHit = true;
        const idx = m.content.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 40);
        snippet =
          (start > 0 ? "…" : "") +
          m.content.slice(start, idx + q.length + 60).replace(/\s+/g, " ");
        if (snippet.length > 120) snippet = snippet.slice(0, 120) + "…";
        break;
      }
    }
    if (titleHit || msgHit)
      matches.push({ chat: c, snippet, proj: projMap[c.projectId] });
  }
  if (!matches.length) {
    resultsEl.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">No sessions matched "' +
      q.replace(/</g, "&lt;") +
      '"</div>';
    return;
  }
  matches.sort((a, b) => (b.chat.updatedAt || 0) - (a.chat.updatedAt || 0));
  resultsEl.innerHTML = "";
  matches.forEach(({ chat, snippet, proj }) => {
    const projName = proj ? proj.name : "(unknown project)";
    const date = new Date(
      chat.updatedAt || chat.createdAt || 0,
    ).toLocaleDateString();
    const title =
      chat.title ||
      (chat.messages && chat.messages[0]
        ? chat.messages[0].content.slice(0, 60)
        : "Empty chat");
    const el = document.createElement("div");
    el.style.cssText =
      "padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer";
    el.innerHTML =
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">' +
      projName.replace(/</g, "&lt;") +
      " · " +
      date +
      "</div>" +
      '<div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:2px">' +
      title.replace(/</g, "&lt;") +
      "</div>" +
      (snippet
        ? '<div style="font-size:11px;color:var(--text-dim);line-height:1.4">' +
          snippet.replace(/</g, "&lt;") +
          "</div>"
        : "");
    el.onmouseover = () => {
      el.style.background = "var(--surface2)";
    };
    el.onmouseout = () => {
      el.style.background = "";
    };
    el.onclick = async () => {
      closeModal();
      if (proj && proj.id !== (state.activeProject && state.activeProject.id)) {
        await loadProject(proj.id);
      }
      await loadChatSession(chat.id);
    };
    resultsEl.appendChild(el);
  });
}

async function filterChatSessions(query) {
  const container = document.getElementById("chat-session-list");
  if (!container || !state.activeProject) return;
  const chats = await dbGetByIndex(
    "chats",
    "projectId",
    state.activeProject.id,
  );
  chats.sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
  _renderChatSessionItems(container, chats, query);
}

async function loadChatSession(chatId) {
  const allChats = await dbGetByIndex(
    "chats",
    "projectId",
    state.activeProject.id,
  );
  const record = allChats.find((c) => c.id === chatId);
  if (!record) return;
  state.messages = record.messages || [];
  state.activeChatId = chatId;
  renderMessages();
  renderChatSessionList();
}
