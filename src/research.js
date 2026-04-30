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
