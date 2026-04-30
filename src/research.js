// ─── RESEARCH BOARD ───────────────────────────────────────────────────────────
// Per-project research items + Brave Search + crawl4ai integration.
//
// IndexedDB store: `research`
//   { id, projectId, url, title, summary, fullText, tags[], retrievedAt,
//     includeInContext, source: "manual"|"brave" }
//
// Public functions (HTML/onclick callable):
//   openResearchSearch()    open Brave Search modal
//   runResearchSearch()     execute the Brave query, render results
//   addResearchFromBrave()  add a single Brave result row to the board
//   openAddResearchManual() open "Add by URL" modal
//   submitResearchManual()  save the manual entry
//   loadResearchBoard()     load + render the board for the active project
//   crawlResearchItem(id)   POST to crawl4ai /crawl, store fit_markdown
//   summariseResearchItem(id) ask the active LLM to summarise the crawled text
//   deleteResearchItem(id)
//   toggleResearchInContext(id)
//
//   ─ Agent automation ─
//   openResearchAgent()        open the agent modal
//   runResearchAgent()         orchestrate sub-query → Brave → crawl → summarise → report
//   generateResearchReport()   collate existing summarised items into a Markdown report
//                              appended to the active project's working document
//   _researchExtractJsonArray(s)  exposed for tests

function _escResearch(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Strip Brave's <strong> highlight tags from result descriptions.
function _stripBraveTags(s) {
    return String(s || "").replace(/<\/?strong>/g, "");
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function openResearchSearch() {
    if (!state.activeProject) return;
    const q = document.getElementById("research-search-query");
    if (q) q.value = "";
    const status = document.getElementById("research-search-status");
    if (status) status.textContent = "";
    const results = document.getElementById("research-search-results");
    if (results) results.innerHTML = "";
    showModal("modal-research-search");
    setTimeout(() => q && q.focus(), 60);
}

function openAddResearchManual() {
    if (!state.activeProject) return;
    document.getElementById("research-add-url").value = "";
    document.getElementById("research-add-title").value = "";
    document.getElementById("research-add-tags").value = "";
    showModal("modal-research-add");
    setTimeout(() => {
        const u = document.getElementById("research-add-url");
        if (u) u.focus();
    }, 60);
}

// ─── Brave Search ────────────────────────────────────────────────────────────
async function runResearchSearch() {
    const q = (
        document.getElementById("research-search-query")?.value || ""
    ).trim();
    const statusEl = document.getElementById("research-search-status");
    const resultsEl = document.getElementById("research-search-results");
    if (!q) {
        if (statusEl) {
            statusEl.textContent = "Enter a query first.";
            statusEl.style.color = "var(--danger)";
        }
        return;
    }
    const key = state.settings.braveApiKey;
    if (!key) {
        if (statusEl) {
            statusEl.textContent =
                "Set a Brave API key in Settings → Brave Search API Key.";
            statusEl.style.color = "var(--danger)";
        }
        return;
    }
    if (statusEl) {
        statusEl.textContent = "Searching…";
        statusEl.style.color = "var(--text-muted)";
    }
    if (resultsEl) resultsEl.innerHTML = "";
    try {
        const url =
            "https://api.search.brave.com/res/v1/web/search?q=" +
            encodeURIComponent(q) +
            "&count=10";
        const res = await fetch(url, {
            headers: {
                Accept: "application/json",
                "X-Subscription-Token": key,
            },
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const items = (data && data.web && data.web.results) || [];
        if (statusEl) {
            statusEl.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;
            statusEl.style.color = "var(--success)";
        }
        if (!resultsEl) return;
        resultsEl.innerHTML = items
            .map(
                (r, i) =>
                    `<div class="research-result" style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;background:var(--surface)">
                        <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:600;color:var(--accent);font-size:13px;margin-bottom:2px">${_escResearch(r.title)}</div>
                                <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${_escResearch(r.url)}" target="_blank" rel="noopener" style="color:var(--text-muted)">${_escResearch(r.url)}</a></div>
                                <div style="font-size:12px;line-height:1.5;margin-top:6px;color:var(--text-dim)">${_escResearch(_stripBraveTags(r.description || ""))}</div>
                            </div>
                            <button class="btn-secondary" onclick="addResearchFromBrave(${i})" style="flex-shrink:0">+ Add</button>
                        </div>
                    </div>`,
            )
            .join("");
        // Stash latest results on window for the per-row Add buttons.
        window._lastBraveResults = items;
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = "✗ " + err.message;
            statusEl.style.color = "var(--danger)";
        }
    }
}

async function addResearchFromBrave(idx) {
    if (!state.activeProject) return;
    const r = (window._lastBraveResults || [])[idx];
    if (!r) return;
    const item = {
        id: uid(),
        projectId: state.activeProject.id,
        url: r.url,
        title: r.title || r.url,
        summary: _stripBraveTags(r.description || ""),
        fullText: "",
        tags: [],
        retrievedAt: Date.now(),
        includeInContext: false,
        source: "brave",
    };
    await dbPut("research", item);
    // Visual feedback in the search modal
    const btns = document.querySelectorAll(".research-result button");
    if (btns[idx]) {
        btns[idx].textContent = "Added ✓";
        btns[idx].disabled = true;
    }
    await loadResearchBoard();
}

// ─── Manual add ──────────────────────────────────────────────────────────────
async function submitResearchManual() {
    if (!state.activeProject) return;
    const url = (
        document.getElementById("research-add-url")?.value || ""
    ).trim();
    if (!url) {
        alert("Enter a URL.");
        return;
    }
    const title =
        (document.getElementById("research-add-title")?.value || "").trim() ||
        url;
    const tagsRaw = (
        document.getElementById("research-add-tags")?.value || ""
    ).trim();
    const tags = tagsRaw
        ? tagsRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
        : [];
    const item = {
        id: uid(),
        projectId: state.activeProject.id,
        url,
        title,
        summary: "",
        fullText: "",
        tags,
        retrievedAt: Date.now(),
        includeInContext: false,
        source: "manual",
    };
    await dbPut("research", item);
    closeModal();
    await loadResearchBoard();
}

// ─── Board rendering ─────────────────────────────────────────────────────────
async function loadResearchBoard() {
    if (!state.activeProject) return;
    const items = await dbGetByIndex(
        "research",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => b.retrievedAt - a.retrievedAt);
    const board = document.getElementById("research-board");
    const empty = document.getElementById("research-empty");
    if (!board) return;
    if (!items.length) {
        if (empty) empty.style.display = "";
        // Remove any prior cards but leave the empty placeholder.
        Array.from(board.children).forEach((c) => {
            if (c.id !== "research-empty") c.remove();
        });
        return;
    }
    if (empty) empty.style.display = "none";
    // Clear non-empty children.
    Array.from(board.children).forEach((c) => {
        if (c.id !== "research-empty") c.remove();
    });
    items.forEach((it) => {
        const card = document.createElement("div");
        card.className = "research-card";
        card.style.cssText =
            "border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;background:var(--surface);display:flex;flex-direction:column;gap:6px";
        const tags = (it.tags || [])
            .map(
                (t) =>
                    `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1px 8px;font-size:10px;color:var(--text-muted)">${_escResearch(t)}</span>`,
            )
            .join(" ");
        const hasCrawl = !!it.fullText;
        const hasSummary = !!(it.summary && it.summary.length);
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;color:var(--accent);font-size:13px"><a href="${_escResearch(it.url)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">${_escResearch(it.title)}</a></div>
                    <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escResearch(it.url)}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn-icon" title="Crawl with crawl4ai" onclick="crawlResearchItem('${it.id}')">${hasCrawl ? "↻ Re-crawl" : "⤓ Crawl"}</button>
                    <button class="btn-icon" title="Summarise with AI" onclick="summariseResearchItem('${it.id}')" ${hasCrawl ? "" : "disabled"}>✨ Summarise</button>
                    <button class="btn-icon" title="Delete" onclick="deleteResearchItem('${it.id}')">✕</button>
                </div>
            </div>
            ${hasSummary ? `<div style="font-size:12px;line-height:1.5;color:var(--text-dim)">${_escResearch(it.summary)}</div>` : ""}
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <div style="display:flex;gap:4px;flex-wrap:wrap">${tags}</div>
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);cursor:pointer">
                    <input type="checkbox" ${it.includeInContext ? "checked" : ""} onchange="toggleResearchInContext('${it.id}')" style="accent-color:var(--accent)" />
                    Include in context
                </label>
            </div>
            <div style="font-size:10px;color:var(--text-muted)">
                ${new Date(it.retrievedAt).toLocaleString()}
                ${hasCrawl ? " · crawled (" + Math.round(it.fullText.length / 1024) + " KB)" : ""}
            </div>
        `;
        board.appendChild(card);
    });
}

async function deleteResearchItem(id) {
    if (!confirm("Delete this research item?")) return;
    await dbDelete("research", id);
    await loadResearchBoard();
}

async function toggleResearchInContext(id) {
    const item = await dbGet("research", id);
    if (!item) return;
    item.includeInContext = !item.includeInContext;
    await dbPut("research", item);
}

// ─── crawl4ai integration ────────────────────────────────────────────────────
async function crawlResearchItem(id) {
    const item = await dbGet("research", id);
    if (!item) return;
    const base = (state.settings.crawl4aiUrl || "").replace(/\/$/, "");
    if (!base) {
        alert(
            "Set the crawl4ai endpoint in Settings → crawl4ai Endpoint.\n(Default: http://localhost:11235)",
        );
        return;
    }
    const card = document.querySelector(
        `.research-card button[onclick="crawlResearchItem('${id}')"]`,
    );
    if (card) {
        card.disabled = true;
        card.textContent = "Crawling…";
    }
    try {
        const res = await fetch(base + "/crawl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                urls: [item.url],
                priority: 10,
                browser_config: {
                    type: "BrowserConfig",
                    params: { headless: true },
                },
                crawler_config: {
                    type: "CrawlerRunConfig",
                    params: { cache_mode: "bypass" },
                },
            }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const first = (data && (data.results || data.result || data)) || {};
        // crawl4ai shape: { results: [{ fit_markdown, markdown, html, ... }] }
        const r = Array.isArray(first)
            ? first[0]
            : (first.results && first.results[0]) || first;
        const text =
            (r && (r.fit_markdown || r.markdown || r.html || "")) || "";
        if (!text) throw new Error("Empty response from crawl4ai");
        item.fullText = text;
        item.retrievedAt = Date.now();
        // If we don't have a summary yet, drop in a snippet so the card is useful immediately.
        if (!item.summary) {
            item.summary = text.slice(0, 280).replace(/\s+/g, " ").trim();
        }
        await dbPut("research", item);
    } catch (err) {
        alert("Crawl failed: " + err.message);
    } finally {
        await loadResearchBoard();
    }
}

// ─── AI summarisation ────────────────────────────────────────────────────────
async function summariseResearchItem(id) {
    const item = await dbGet("research", id);
    if (!item || !item.fullText) {
        alert("Crawl this item first to fetch full text.");
        return;
    }
    if (
        typeof buildApiCall !== "function" ||
        typeof parseStreamDelta !== "function"
    ) {
        alert("LLM provider not initialised.");
        return;
    }
    const sysPrompt =
        "You summarise web content for a procurement / strategic-sourcing analyst. " +
        "Produce a concise summary (≤180 words) of the page content. " +
        "Lead with the single most useful fact for procurement (vendors, contract values, dates, regulations). " +
        "End with a bulleted list of 3–6 key takeaways.";
    const userPrompt =
        "URL: " +
        item.url +
        "\n\n" +
        "Title: " +
        item.title +
        "\n\n" +
        "Content:\n" +
        item.fullText.slice(0, 12000);
    const messages = [{ role: "user", content: userPrompt }];
    let call;
    try {
        call = buildApiCall(sysPrompt, messages);
    } catch (e) {
        alert("LLM error: " + e.message);
        return;
    }
    const card = document.querySelector(
        `.research-card button[onclick="summariseResearchItem('${id}')"]`,
    );
    if (card) {
        card.disabled = true;
        card.textContent = "Summarising…";
    }
    try {
        const res = await fetch(call.url, {
            method: "POST",
            headers: call.headers,
            body: call.body,
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error("HTTP " + res.status + ": " + t.slice(0, 200));
        }
        // Stream — reuse parseStreamDelta.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let summary = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const delta = parseStreamDelta(line.slice(5).trim());
                if (delta) summary += delta;
            }
        }
        item.summary = summary.trim() || item.summary;
        await dbPut("research", item);
    } catch (err) {
        alert("Summarise failed: " + err.message);
    } finally {
        await loadResearchBoard();
    }
}

// ─── Research Agent: orchestrator ────────────────────────────────────────────
//
// The agent expands a topic into N sub-queries via the active LLM, runs each
// against Brave, picks the top hits, crawls them via crawl4ai, summarises
// each crawled page, and finally collates everything into a Markdown report
// that's appended to the working document.
//
// All the heavy work is async + sequential so we can stream progress into
// the modal's status panel without overwhelming the rate limits.

function openResearchAgent() {
    if (!state.activeProject) return;
    const t = document.getElementById("research-agent-topic");
    if (t) t.value = "";
    const n = document.getElementById("research-agent-num-queries");
    if (n) n.value = "4";
    const k = document.getElementById("research-agent-num-results");
    if (k) k.value = "3";
    const auto = document.getElementById("research-agent-auto-crawl");
    if (auto) auto.checked = true;
    const log = document.getElementById("research-agent-log");
    if (log) log.innerHTML = "";
    const runBtn = document.getElementById("research-agent-run-btn");
    if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = "▶ Run Agent";
    }
    showModal("modal-research-agent");
    setTimeout(() => t && t.focus(), 60);
}

function _agentLog(msg, kind) {
    const log = document.getElementById("research-agent-log");
    if (!log) return;
    const color =
        kind === "err"
            ? "var(--danger)"
            : kind === "ok"
              ? "var(--success)"
              : kind === "step"
                ? "var(--accent)"
                : "var(--text-dim)";
    const row = document.createElement("div");
    row.style.cssText =
        "font-size:11px;color:" +
        color +
        ";line-height:1.4;font-family:'JetBrains Mono',monospace";
    row.textContent = msg;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
}

// Parse a JSON array out of an LLM response that may include prose / fences.
function _researchExtractJsonArray(text) {
    if (!text) return [];
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1] : text;
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start < 0 || end <= start) return [];
    try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        return Array.isArray(parsed)
            ? parsed.map((s) => String(s || "").trim()).filter(Boolean)
            : [];
    } catch {
        return [];
    }
}

// Non-streaming convenience wrapper around the active provider — collects the
// entire stream into a single string. Returns "" on failure (callers handle).
async function _agentLlmCollect(systemPrompt, userPrompt) {
    if (
        typeof buildApiCall !== "function" ||
        typeof parseStreamDelta !== "function"
    ) {
        throw new Error("LLM provider not initialised.");
    }
    const call = buildApiCall(systemPrompt, [
        { role: "user", content: userPrompt },
    ]);
    const res = await fetch(call.url, {
        method: "POST",
        headers: call.headers,
        body: call.body,
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error("HTTP " + res.status + ": " + t.slice(0, 200));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let out = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const delta = parseStreamDelta(trimmed.slice(5).trim());
            if (delta) out += delta;
        }
    }
    return out.trim();
}

async function _agentBraveSearch(query, count) {
    const key = state.settings.braveApiKey;
    if (!key) throw new Error("Brave API key not set in Settings.");
    const url =
        "https://api.search.brave.com/res/v1/web/search?q=" +
        encodeURIComponent(query) +
        "&count=" +
        Math.max(1, Math.min(20, count || 3));
    const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
    });
    if (!res.ok) throw new Error("Brave HTTP " + res.status);
    const data = await res.json();
    return (data && data.web && data.web.results) || [];
}

async function _agentCrawl(url) {
    const base = (state.settings.crawl4aiUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("crawl4ai endpoint not set.");
    const res = await fetch(base + "/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            urls: [url],
            priority: 10,
            browser_config: {
                type: "BrowserConfig",
                params: { headless: true },
            },
            crawler_config: {
                type: "CrawlerRunConfig",
                params: { cache_mode: "bypass" },
            },
        }),
    });
    if (!res.ok) throw new Error("crawl4ai HTTP " + res.status);
    const data = await res.json();
    const first = (data && (data.results || data.result || data)) || {};
    const r = Array.isArray(first)
        ? first[0]
        : (first.results && first.results[0]) || first;
    return (r && (r.fit_markdown || r.markdown || r.html || "")) || "";
}

async function runResearchAgent() {
    if (!state.activeProject) return;
    const topic = (
        document.getElementById("research-agent-topic")?.value || ""
    ).trim();
    if (!topic) {
        alert("Enter a research topic first.");
        return;
    }
    const numQueries = Math.max(
        1,
        Math.min(
            10,
            parseInt(
                document.getElementById("research-agent-num-queries")?.value ||
                    "4",
                10,
            ) || 4,
        ),
    );
    const numResults = Math.max(
        1,
        Math.min(
            10,
            parseInt(
                document.getElementById("research-agent-num-results")?.value ||
                    "3",
                10,
            ) || 3,
        ),
    );
    const autoCrawl = !!document.getElementById("research-agent-auto-crawl")
        ?.checked;
    if (!state.settings.braveApiKey) {
        alert("Set a Brave API key in Settings → Brave Search API Key.");
        return;
    }
    if (autoCrawl && !state.settings.crawl4aiUrl) {
        alert(
            "Set a crawl4ai endpoint in Settings, or uncheck Auto-crawl & Summarise.",
        );
        return;
    }
    if (!getCurrentProviderKey() && state.settings.provider !== "local") {
        alert("Set an LLM API key in Settings first.");
        return;
    }

    const runBtn = document.getElementById("research-agent-run-btn");
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = "Running…";
    }
    const log = document.getElementById("research-agent-log");
    if (log) log.innerHTML = "";

    const startedAt = Date.now();
    const projectId = state.activeProject.id;
    const newItems = [];

    try {
        // Step 1 — expand topic into sub-queries.
        _agentLog(
            "▶ Expanding topic into " + numQueries + " sub-queries…",
            "step",
        );
        const sysExpand =
            "You are a procurement research planner. Given a research topic, " +
            "produce diverse, specific web-search queries that, taken together, " +
            "cover the topic from multiple angles (vendors, regulations, pricing, " +
            "case studies, recent news). Reply with ONLY a JSON array of strings.";
        const userExpand =
            "Topic: " +
            topic +
            "\n\nProject: " +
            (state.activeProject.name || "") +
            " (" +
            (state.activeProject.category || "") +
            ")\n\nReturn exactly " +
            numQueries +
            " web-search queries as a JSON array of strings. No prose, no fences.";
        let queries = [];
        try {
            const raw = await _agentLlmCollect(sysExpand, userExpand);
            queries = _researchExtractJsonArray(raw).slice(0, numQueries);
        } catch (e) {
            _agentLog("  ✗ LLM error: " + e.message, "err");
        }
        if (!queries.length) {
            _agentLog(
                "  · LLM returned no parseable queries — falling back to topic itself.",
                "err",
            );
            queries = [topic];
        }
        queries.forEach((q, i) => _agentLog("  " + (i + 1) + ". " + q));

        // Step 2 — for each sub-query: Brave → save items → optional crawl+summarise.
        const seenUrls = new Set();
        // Pre-seed with existing items so we don't dupe.
        const existing = await dbGetByIndex("research", "projectId", projectId);
        existing.forEach((it) => seenUrls.add(it.url));

        for (let qi = 0; qi < queries.length; qi++) {
            const q = queries[qi];
            _agentLog(
                "\n▶ [" + (qi + 1) + "/" + queries.length + "] Brave: " + q,
                "step",
            );
            let results = [];
            try {
                results = await _agentBraveSearch(q, numResults);
            } catch (e) {
                _agentLog("  ✗ " + e.message, "err");
                continue;
            }
            _agentLog(
                "  · " +
                    results.length +
                    " hit" +
                    (results.length === 1 ? "" : "s"),
            );
            const picked = results.slice(0, numResults);
            for (const r of picked) {
                if (!r.url || seenUrls.has(r.url)) {
                    if (r.url) _agentLog("  · skip (dupe): " + r.url);
                    continue;
                }
                seenUrls.add(r.url);
                const item = {
                    id: uid(),
                    projectId,
                    url: r.url,
                    title: r.title || r.url,
                    summary: _stripBraveTags(r.description || ""),
                    fullText: "",
                    tags: ["agent", topic.slice(0, 24)],
                    retrievedAt: Date.now(),
                    includeInContext: false,
                    source: "agent",
                    agentTopic: topic,
                    agentQuery: q,
                };
                await dbPut("research", item);
                newItems.push(item);
                _agentLog("  + saved: " + item.title);

                if (autoCrawl) {
                    try {
                        _agentLog("    ⤓ crawling…");
                        const text = await _agentCrawl(item.url);
                        if (!text) {
                            _agentLog("    · empty crawl", "err");
                        } else {
                            item.fullText = text;
                            item.retrievedAt = Date.now();
                            // Snippet fallback summary.
                            if (!item.summary)
                                item.summary = text
                                    .slice(0, 280)
                                    .replace(/\s+/g, " ")
                                    .trim();
                            await dbPut("research", item);
                            _agentLog(
                                "    ✓ crawled " +
                                    Math.round(text.length / 1024) +
                                    " KB",
                                "ok",
                            );

                            // Summarise.
                            try {
                                _agentLog("    ✨ summarising…");
                                const sysSum =
                                    "You summarise web content for a procurement / strategic-sourcing analyst. " +
                                    "Produce a concise summary (≤140 words) of the page content. Lead with the " +
                                    "single most useful fact for procurement (vendors, contract values, dates, " +
                                    "regulations). End with 3–5 bulleted key takeaways.";
                                const userSum =
                                    "URL: " +
                                    item.url +
                                    "\nTitle: " +
                                    item.title +
                                    "\nTopic: " +
                                    topic +
                                    "\n\nContent:\n" +
                                    item.fullText.slice(0, 12000);
                                const summary = await _agentLlmCollect(
                                    sysSum,
                                    userSum,
                                );
                                if (summary) {
                                    item.summary = summary;
                                    await dbPut("research", item);
                                    _agentLog("    ✓ summarised", "ok");
                                }
                            } catch (e) {
                                _agentLog(
                                    "    ✗ summarise: " + e.message,
                                    "err",
                                );
                            }
                        }
                    } catch (e) {
                        _agentLog("    ✗ crawl: " + e.message, "err");
                    }
                }
            }
            // Refresh board mid-run so user sees progress without closing the modal.
            try {
                await loadResearchBoard();
            } catch {}
        }

        // Step 3 — collate report.
        _agentLog("\n▶ Collating report…", "step");
        try {
            const reportBody = await _buildAgentReport(
                topic,
                queries,
                newItems,
            );
            await _appendToWorkingDoc(reportBody);
            _agentLog("  ✓ Report appended to Working Document.", "ok");
        } catch (e) {
            _agentLog("  ✗ report: " + e.message, "err");
        }

        const secs = Math.round((Date.now() - startedAt) / 1000);
        _agentLog(
            "\n✓ Done in " +
                secs +
                "s — " +
                newItems.length +
                " item" +
                (newItems.length === 1 ? "" : "s") +
                " added.",
            "ok",
        );
    } catch (err) {
        _agentLog("✗ Agent failed: " + err.message, "err");
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = "▶ Run Again";
        }
        try {
            await loadResearchBoard();
        } catch {}
    }
}

async function _buildAgentReport(topic, queries, items) {
    // Try LLM-driven synthesis first; fall back to a simple stitched report.
    const summarisedItems = items.filter((it) => it.summary);
    let llmReport = "";
    if (
        summarisedItems.length &&
        (getCurrentProviderKey() || state.settings.provider === "local")
    ) {
        try {
            const sys =
                "You are a senior strategic-sourcing analyst writing an internal research " +
                "briefing. Given a topic and a set of source summaries, produce a polished " +
                "Markdown report with: a 2–3 sentence Executive Summary, 3–6 thematic " +
                "sections (## headings) that synthesise insights across sources, a " +
                "## Key Risks & Considerations section, and a ## Recommended Next Steps " +
                "section. Cite sources inline as [n] referring to a numbered Sources list " +
                "the caller will append.";
            const sourcesBlock = summarisedItems
                .map(
                    (it, i) =>
                        "[" +
                        (i + 1) +
                        "] " +
                        (it.title || it.url) +
                        " — " +
                        it.url +
                        "\n" +
                        (it.summary || ""),
                )
                .join("\n\n");
            const usr =
                "Topic: " +
                topic +
                "\n\nSearch queries used:\n- " +
                queries.join("\n- ") +
                "\n\nSources:\n" +
                sourcesBlock +
                "\n\nReturn ONLY the Markdown report body (no fences).";
            llmReport = await _agentLlmCollect(sys, usr);
        } catch (e) {
            llmReport = "";
        }
    }

    const stamp = new Date().toLocaleString();
    let out = "\n\n---\n\n# Research Briefing — " + topic + "\n";
    out += "_Generated by SourceDesk Research Agent · " + stamp + "_\n\n";
    if (llmReport) {
        out += llmReport.trim() + "\n\n";
    } else {
        out += "## Search Queries\n";
        queries.forEach((q, i) => (out += "- " + (i + 1) + ". " + q + "\n"));
        out += "\n## Findings\n";
        if (!summarisedItems.length) {
            out += "_No summarised sources available._\n";
        } else {
            summarisedItems.forEach((it, i) => {
                out += "\n### " + (i + 1) + ". " + (it.title || it.url) + "\n";
                out += it.url + "\n\n" + (it.summary || "") + "\n";
            });
        }
    }
    if (summarisedItems.length) {
        out += "\n## Sources\n";
        summarisedItems.forEach((it, i) => {
            out +=
                "[" +
                (i + 1) +
                "] " +
                (it.title || it.url) +
                " — " +
                it.url +
                "\n";
        });
    }
    return out;
}

async function _appendToWorkingDoc(markdown) {
    if (!state.activeProject) return;
    const prev = state.activeProject.workingContent || "";
    state.activeProject.workingContent = prev + markdown;
    await dbPut("projects", state.activeProject);
    // If the working doc editor is open, sync the textarea + rich editor.
    const ed = document.getElementById("working-doc-editor");
    if (ed) {
        ed.value = state.activeProject.workingContent;
        if (typeof refreshRichEditor === "function") refreshRichEditor(ed);
    }
    // Save a version snapshot so the append is recoverable.
    if (typeof saveDocVersion === "function") {
        try {
            await saveDocVersion(state.activeProject.workingContent);
        } catch {}
    }
}

// ─── Standalone report generator (works on existing summarised items) ────────
async function generateResearchReport() {
    if (!state.activeProject) return;
    const items = await dbGetByIndex(
        "research",
        "projectId",
        state.activeProject.id,
    );
    const summarised = items.filter((it) => it.summary);
    if (!summarised.length) {
        alert(
            "No summarised research items yet — crawl & summarise some first, or use the Research Agent.",
        );
        return;
    }
    if (
        !confirm(
            "Generate a Markdown research report from " +
                summarised.length +
                " summarised item" +
                (summarised.length === 1 ? "" : "s") +
                " and append it to this project's Working Document?",
        )
    )
        return;
    const topic =
        (state.activeProject.name || "Research") +
        " — " +
        (state.activeProject.category || "");
    const queries = [
        ...new Set(summarised.map((it) => it.agentQuery).filter(Boolean)),
    ];
    try {
        const body = await _buildAgentReport(
            topic,
            queries.length ? queries : ["(manual collation)"],
            summarised,
        );
        await _appendToWorkingDoc(body);
        alert(
            "Research report appended to Working Document. Open the Working Doc view to review.",
        );
    } catch (e) {
        alert("Report generation failed: " + e.message);
    }
}
