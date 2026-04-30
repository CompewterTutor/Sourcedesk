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

// ─── EMBEDDING HELPERS ───────────────────────────────────────────────────────
async function getEmbedding(text) {
    if (!state.settings.embeddingModel || !state.settings.localLlmUrl)
        return null;
    const base = state.settings.localLlmUrl.replace(/\/$/, "");
    try {
        const headers = { "Content-Type": "application/json" };
        if (state.settings.localKey)
            headers["Authorization"] = "Bearer " + state.settings.localKey;
        const res = await fetch(base + "/embeddings", {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: state.settings.embeddingModel,
                input: text,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.data && data.data[0] && data.data[0].embedding
            ? data.data[0].embedding
            : null;
    } catch {
        return null;
    }
}

function cosineSimilarity(a, b) {
    if (!a || !b || !a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0,
        magA = 0,
        magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

async function indexDocEmbeddings(docId, chunks) {
    if (!state.settings.embeddingModel || !state.settings.localLlmUrl) return;
    for (let i = 0; i < chunks.length; i++) {
        try {
            const embedding = await getEmbedding(chunks[i]);
            if (embedding) {
                await dbPut("embeddings", {
                    id: uid(),
                    docId,
                    chunkIndex: i,
                    vector: embedding,
                });
            }
        } catch {
            // silently skip failures per chunk
        }
    }
}

async function getDocEmbeddings(docId) {
    return dbGetByIndex("embeddings", "docId", docId);
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

    // Try semantic re-ranking if embedding model is configured.
    // NOTE: This calls getEmbedding for every chunk on every query, which is
    // acceptable for small-to-medium projects. Chunk vector pre-indexing at
    // upload time (using indexDocEmbeddings) is a future optimisation.
    const queryVec = await getEmbedding(query);
    if (queryVec) {
        const semScores = await Promise.all(
            allChunks.map(async (c, i) => {
                const vec = await getEmbedding(c.text);
                const sem = vec ? cosineSimilarity(queryVec, vec) : 0;
                const bm = bm25Score(query, idx, i);
                return { i, bm, sem };
            }),
        );
        const maxBm = Math.max(...semScores.map((s) => s.bm), 1);
        const combined = semScores.map((s) => ({
            i: s.i,
            score: 0.4 * (s.bm / maxBm) + 0.6 * s.sem,
        }));
        combined.sort((a, b) => b.score - a.score);
        const top = combined.slice(0, topK).filter((s) => s.score > 0);
        const sources = [...new Set(top.map((s) => allChunks[s.i].source))];
        const chunks = top.map((s) => ({
            source: allChunks[s.i].source,
            snippet: allChunks[s.i].text
                .slice(0, 120)
                .replace(/\s+/g, " ")
                .trim(),
        }));
        const context = top
            .map(
                (s) =>
                    `[from: ${allChunks[s.i].source}]\n${allChunks[s.i].text}`,
            )
            .join("\n\n---\n\n");
        return { context, sources, chunks };
    }
    // Fall through to BM25-only path below

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
