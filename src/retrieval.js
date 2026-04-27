// ─── BM25 SEARCH ──────────────────────────────────────────────────────────────
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function buildIndex(chunks) {
    const idf = {},
        N = chunks.length;
    const tfs = chunks.map((c) => {
        const tokens = tokenize(c.text),
            freq = {};
        tokens.forEach((t) => {
            freq[t] = (freq[t] || 0) + 1;
        });
        return { freq, len: tokens.length };
    });
    const df = {};
    tfs.forEach(({ freq }) => {
        Object.keys(freq).forEach((t) => {
            df[t] = (df[t] || 0) + 1;
        });
    });
    Object.keys(df).forEach((t) => {
        idf[t] = Math.log((N - df[t] + 0.5) / (df[t] + 0.5) + 1);
    });
    return { tfs, idf, avgLen: tfs.reduce((s, x) => s + x.len, 0) / (N || 1) };
}

function bm25Score(query, idx, i, k1 = 1.5, b = 0.75) {
    const { tfs, idf, avgLen } = idx;
    const { freq, len } = tfs[i];
    return tokenize(query).reduce((score, t) => {
        const tf = freq[t] || 0;
        const idfVal = idf[t] || 0;
        return (
            score +
            (idfVal * (tf * (k1 + 1))) /
                (tf + k1 * (1 - b + (b * len) / avgLen))
        );
    }, 0);
}

function chunkText(text, size = 400, overlap = 60) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += size - overlap) {
        chunks.push(words.slice(i, i + size).join(" "));
        if (i + size >= words.length) break;
    }
    return chunks;
}

async function retrieveContext(query, topK = 4) {
    if (!state.activeProject) return { context: "", sources: [] };

    // Gather all active doc IDs
    const docIds = [...state.activeDocs];
    // Add toggled-in other project docs
    for (const pid of state.activeOtherProjects) {
        const otherDocs = await dbGetByIndex("docs", "projectId", pid);
        otherDocs.forEach((d) => docIds.push(d.id));
    }
    // Add template content if project has one
    const templateChunks = [];
    if (state.activeProject.templateId) {
        const tmpl = state.templates.find(
            (t) => t.id === state.activeProject.templateId,
        );
        if (tmpl)
            templateChunks.push({
                text: tmpl.content,
                source: `Template: ${tmpl.name}`,
            });
    }

    if (!docIds.length && !templateChunks.length)
        return { context: "", sources: [] };

    const allChunks = [...templateChunks];
    for (const id of docIds) {
        const doc = await dbGet("docs", id);
        if (!doc) continue;
        const chunks = chunkText(doc.content);
        chunks.forEach((c) => allChunks.push({ text: c, source: doc.name }));
    }

    if (!allChunks.length) return { context: "", sources: [] };

    const idx = buildIndex(allChunks);
    const scores = allChunks.map((_, i) => ({
        i,
        score: bm25Score(query, idx, i),
    }));
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topK).filter((s) => s.score > 0);
    const sources = [...new Set(top.map((s) => allChunks[s.i].source))];
    const chunks = top.map((s) => ({
        source: allChunks[s.i].source,
        snippet: allChunks[s.i].text.slice(0, 120).replace(/\s+/g, " ").trim(),
    }));
    const context = top
        .map((s) => `[from: ${allChunks[s.i].source}]\n${allChunks[s.i].text}`)
        .join("\n\n---\n\n");
    return { context, sources, chunks };
}
