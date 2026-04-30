// ─── DIFF UTIL ───────────────────────────────────────────────────────────────
// Tiny line-level diff using the standard LCS dynamic programming algorithm.
// Produces an array of operations: { op: "eq"|"add"|"del", line: string }
// suitable for rendering side-by-side or inline.
//
// Pure, no DOM access — testable.

function diffLines(aText, bText) {
    const a = (aText || "").split("\n");
    const b = (bText || "").split("\n");
    const n = a.length;
    const m = b.length;

    // Build LCS length table.
    // For very large inputs (>2000 lines either side) bail out to a coarser
    // line-by-line equality diff to avoid O(n*m) memory blow-up.
    if (n * m > 2_000_000) {
        return _coarseDiff(a, b);
    }

    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
            else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const out = [];
    let i = 0,
        j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            out.push({ op: "eq", line: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            out.push({ op: "del", line: a[i] });
            i++;
        } else {
            out.push({ op: "add", line: b[j] });
            j++;
        }
    }
    while (i < n) {
        out.push({ op: "del", line: a[i++] });
    }
    while (j < m) {
        out.push({ op: "add", line: b[j++] });
    }
    return out;
}

function _coarseDiff(a, b) {
    const out = [];
    const max = Math.max(a.length, b.length);
    for (let k = 0; k < max; k++) {
        if (k < a.length && k < b.length && a[k] === b[k]) {
            out.push({ op: "eq", line: a[k] });
        } else {
            if (k < a.length) out.push({ op: "del", line: a[k] });
            if (k < b.length) out.push({ op: "add", line: b[k] });
        }
    }
    return out;
}

function diffStats(ops) {
    let add = 0,
        del = 0,
        eq = 0;
    for (const o of ops) {
        if (o.op === "add") add++;
        else if (o.op === "del") del++;
        else eq++;
    }
    return { add, del, eq };
}

function _diffEscape(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Render an inline (unified) diff as HTML. Each line is on its own row,
// additions in green, deletions red, equal lines muted.
function renderInlineDiffHtml(ops) {
    if (!ops || !ops.length)
        return '<div style="padding:18px;color:var(--text-muted);font-style:italic;text-align:center">No differences.</div>';
    const rowStyle =
        "font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5;padding:1px 8px;white-space:pre-wrap;word-break:break-word";
    return ops
        .map((o) => {
            const safe = _diffEscape(o.line) || "&nbsp;";
            if (o.op === "add") {
                return `<div style="${rowStyle};background:rgba(80,200,120,0.12);color:#7adb96;border-left:3px solid #2c8b4e">+ ${safe}</div>`;
            } else if (o.op === "del") {
                return `<div style="${rowStyle};background:rgba(229,92,92,0.12);color:#e88b8b;border-left:3px solid #c25656">- ${safe}</div>`;
            }
            return `<div style="${rowStyle};color:var(--text-muted);border-left:3px solid transparent">  ${safe}</div>`;
        })
        .join("");
}
