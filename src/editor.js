// ─── RICH-TEXT EDITOR (Markdown ⇄ Rendered) ──────────────────────────────────
// Lightweight, dependency-free dual-mode editor used by Working Document,
// Notes, Templates, and the Supplier-Q answer field.
//
// Public API:
//   mountRichEditor(textarea, opts)
//     textarea — existing <textarea> element holding the raw markdown source
//     opts:
//       toolbar    : array of toolbar button ids (default: full set)
//       onChange   : optional callback fired after every edit (raw markdown);
//                    by default, mountRichEditor will dispatch an "input"
//                    event on the textarea to keep existing autosave wiring.
//       initialMode: "raw" | "rendered" (default "raw")
//
//   destroyRichEditor(textarea)
//     Removes the toolbar/wrapper; the underlying textarea is preserved.
//
// Markdown subset supported (round-trip safe):
//   # / ## / ### headings, **bold**, *italic*, <u>underline</u>, `code`,
//   > blockquote, - bullet list, 1. numbered list, --- horizontal rule /
//   page-break (rendered as a styled <hr class="page-break">), tables (read
//   only — author tables in raw mode for now).

(function () {
    "use strict";

    // Track per-textarea state via a WeakMap to avoid polluting DOM nodes.
    const editors = new WeakMap();

    const DEFAULT_TOOLBAR = [
        "h1",
        "h2",
        "h3",
        "sep",
        "bold",
        "italic",
        "underline",
        "code",
        "sep",
        "ul",
        "ol",
        "quote",
        "sep",
        "table",
        "pagebreak",
        "sep",
        "toggleMode",
    ];

    const TOOLBAR_BUTTONS = {
        h1: {
            label: "H1",
            title: "Heading 1",
            action: applyHeading.bind(null, 1),
        },
        h2: {
            label: "H2",
            title: "Heading 2",
            action: applyHeading.bind(null, 2),
        },
        h3: {
            label: "H3",
            title: "Heading 3",
            action: applyHeading.bind(null, 3),
        },
        bold: {
            label: "B",
            title: "Bold (Ctrl+B)",
            action: () => exec("bold"),
            style: "font-weight:700",
        },
        italic: {
            label: "I",
            title: "Italic (Ctrl+I)",
            action: () => exec("italic"),
            style: "font-style:italic",
        },
        underline: {
            label: "U",
            title: "Underline (Ctrl+U)",
            action: () => exec("underline"),
            style: "text-decoration:underline",
        },
        code: { label: "</>", title: "Inline code", action: applyInlineCode },
        ul: {
            label: "• List",
            title: "Bullet list",
            action: () => exec("insertUnorderedList"),
        },
        ol: {
            label: "1. List",
            title: "Numbered list",
            action: () => exec("insertOrderedList"),
        },
        quote: { label: "❝", title: "Block quote", action: applyBlockquote },
        table: {
            label: "Table",
            title: "Insert 2x2 table",
            action: insertTable,
        },
        pagebreak: {
            label: "⤓ PB",
            title: "Insert page break",
            action: insertPageBreak,
        },
    };

    // ─── Public mount/unmount ────────────────────────────────────────────────
    function mountRichEditor(textarea, opts) {
        if (!textarea || textarea.tagName !== "TEXTAREA") return null;
        if (editors.has(textarea)) return editors.get(textarea);

        opts = opts || {};
        const buttons = opts.toolbar || DEFAULT_TOOLBAR;
        const initialMode = opts.initialMode || "raw";

        // Wrap the textarea so the toolbar/rendered surface live alongside it.
        const wrapper = document.createElement("div");
        wrapper.className = "rte-wrapper";
        wrapper.style.cssText =
            "display:flex;flex-direction:column;gap:0;flex:1;min-height:0";

        const toolbar = buildToolbar(textarea, buttons);
        wrapper.appendChild(toolbar);

        // Insert wrapper before the textarea, then move the textarea into it.
        const parent = textarea.parentNode;
        parent.insertBefore(wrapper, textarea);
        wrapper.appendChild(textarea);

        // Create the contenteditable rendered surface (hidden by default).
        const rendered = document.createElement("div");
        rendered.className = "rte-rendered";
        rendered.contentEditable = "true";
        rendered.spellcheck = true;
        rendered.style.cssText =
            "flex:1;min-height:120px;padding:12px 14px;background:var(--surface);" +
            "border:1px solid var(--border);border-radius:var(--radius);" +
            "font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.6;" +
            "color:var(--text);overflow-y:auto;outline:none;display:none";
        wrapper.appendChild(rendered);

        const ctx = {
            textarea,
            wrapper,
            toolbar,
            rendered,
            mode: "raw",
            onChange: opts.onChange,
            _syncing: false,
        };
        editors.set(textarea, ctx);

        // Wire rendered → textarea sync.
        rendered.addEventListener("input", () => {
            if (ctx._syncing) return;
            const md = htmlToMarkdown(rendered.innerHTML);
            ctx._syncing = true;
            textarea.value = md;
            ctx._syncing = false;
            // Fire input event so existing autosave logic picks it up.
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            if (typeof ctx.onChange === "function") ctx.onChange(md);
        });

        // Keep rendered in sync if external code mutates the textarea (e.g.
        // selectNote() setting value).  Use a tiny polling guard via input
        // events; ad-hoc setValue path is also exposed on ctx.
        textarea.addEventListener("input", () => {
            if (ctx._syncing) return;
            if (ctx.mode === "rendered") {
                ctx._syncing = true;
                rendered.innerHTML = markdownToHtml(textarea.value);
                ctx._syncing = false;
            }
        });

        if (initialMode === "rendered") setMode(textarea, "rendered");

        return ctx;
    }

    // Re-sync the rendered surface after external code mutates textarea.value
    // (e.g. selectNote(), openEditTemplate(), _fillWorkingDocEditor()).
    // No-op if the editor isn't mounted or is in raw mode.
    function refreshRichEditor(textarea) {
        const ctx = editors.get(textarea);
        if (!ctx) return;
        if (ctx.mode === "rendered") {
            ctx._syncing = true;
            ctx.rendered.innerHTML = markdownToHtml(textarea.value);
            ctx._syncing = false;
        }
    }

    function destroyRichEditor(textarea) {
        const ctx = editors.get(textarea);
        if (!ctx) return;
        const { wrapper } = ctx;
        const parent = wrapper.parentNode;
        parent.insertBefore(textarea, wrapper);
        wrapper.remove();
        editors.delete(textarea);
    }

    function setMode(textarea, mode) {
        const ctx = editors.get(textarea);
        if (!ctx) return;
        if (mode === ctx.mode) return;
        if (mode === "rendered") {
            ctx.rendered.innerHTML = markdownToHtml(textarea.value);
            textarea.style.display = "none";
            ctx.rendered.style.display = "block";
        } else {
            // Sync any pending edits back from rendered → textarea.
            const md = htmlToMarkdown(ctx.rendered.innerHTML);
            ctx._syncing = true;
            textarea.value = md;
            ctx._syncing = false;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            ctx.rendered.style.display = "none";
            textarea.style.display = "";
        }
        ctx.mode = mode;
        // Update the toggleMode button label, if present.
        const toggleBtn = ctx.toolbar.querySelector(
            '[data-rte-btn="toggleMode"]',
        );
        if (toggleBtn) {
            // Show current mode so the user knows where they are;
            // clicking switches to the other mode.
            toggleBtn.textContent =
                mode === "rendered" ? "✏ Raw" : "👁 Preview";
            toggleBtn.title =
                mode === "rendered"
                    ? "Switch to Raw (markdown) mode"
                    : "Switch to Preview (rendered) mode";
        }
    }

    // ─── Toolbar building ────────────────────────────────────────────────────
    function buildToolbar(textarea, buttons) {
        const bar = document.createElement("div");
        bar.className = "rte-toolbar";
        bar.style.cssText =
            "display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;" +
            "background:var(--surface2);border:1px solid var(--border);" +
            "border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;" +
            "margin-bottom:-1px";

        buttons.forEach((id) => {
            if (id === "sep") {
                const sep = document.createElement("span");
                sep.style.cssText =
                    "width:1px;background:var(--border);margin:2px 4px";
                bar.appendChild(sep);
                return;
            }
            if (id === "toggleMode") {
                const btn = makeBtn(
                    "👁 Preview",
                    "Switch to Preview (rendered) mode",
                );
                btn.dataset.rteBtn = "toggleMode";
                btn.style.marginLeft = "auto";
                btn.addEventListener("mousedown", (e) => e.preventDefault());
                btn.addEventListener("click", () => {
                    const ctx = editors.get(textarea);
                    setMode(textarea, ctx.mode === "raw" ? "rendered" : "raw");
                });
                bar.appendChild(btn);
                return;
            }
            const def = TOOLBAR_BUTTONS[id];
            if (!def) return;
            const btn = makeBtn(def.label, def.title);
            if (def.style) btn.style.cssText += ";" + def.style;
            // mousedown.preventDefault keeps focus inside the contenteditable.
            btn.addEventListener("mousedown", (e) => e.preventDefault());
            btn.addEventListener("click", () => {
                const ctx = editors.get(textarea);
                if (!ctx || ctx.mode !== "rendered") {
                    // In raw mode, surface a hint and switch to rendered first.
                    setMode(textarea, "rendered");
                }
                ctx.rendered.focus();
                def.action(ctx);
                // execCommand-style edits don't always fire input; force a sync.
                ctx.rendered.dispatchEvent(
                    new Event("input", { bubbles: true }),
                );
            });
            bar.appendChild(btn);
        });

        return bar;
    }

    function makeBtn(label, title) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rte-btn";
        b.textContent = label;
        b.title = title || label;
        b.style.cssText =
            "padding:4px 8px;font-size:12px;background:var(--surface);" +
            "border:1px solid var(--border);border-radius:4px;color:var(--text);" +
            "cursor:pointer;line-height:1.2";
        return b;
    }

    // ─── Toolbar action helpers ──────────────────────────────────────────────
    function exec(cmd, val) {
        try {
            document.execCommand(cmd, false, val);
        } catch (_) {
            /* noop */
        }
    }

    function applyHeading(level) {
        // execCommand("formatBlock") with H1/H2/H3
        exec("formatBlock", "H" + level);
    }

    function applyBlockquote() {
        exec("formatBlock", "BLOCKQUOTE");
    }

    function applyInlineCode() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const text = sel.toString();
        if (!text) return;
        const code = document.createElement("code");
        code.textContent = text;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(code);
        // Move cursor after the inserted node
        range.setStartAfter(code);
        range.setEndAfter(code);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function insertPageBreak() {
        const hr =
            '<hr class="page-break" style="border:none;border-top:2px dashed var(--border);margin:18px 0" />';
        exec("insertHTML", hr);
    }

    function insertTable() {
        const html =
            '<table style="border-collapse:collapse;margin:8px 0">' +
            "<thead><tr>" +
            '<th style="border:1px solid var(--border);padding:6px 10px">Col 1</th>' +
            '<th style="border:1px solid var(--border);padding:6px 10px">Col 2</th>' +
            "</tr></thead>" +
            "<tbody><tr>" +
            '<td style="border:1px solid var(--border);padding:6px 10px">&nbsp;</td>' +
            '<td style="border:1px solid var(--border);padding:6px 10px">&nbsp;</td>' +
            "</tr></tbody></table>";
        exec("insertHTML", html);
    }

    // ─── Markdown ⇄ HTML conversion ──────────────────────────────────────────
    // Intentionally minimal — handles the toolbar's output round-trip and the
    // common procurement-doc markdown subset.
    function markdownToHtml(md) {
        if (!md) return "";
        // Escape HTML, then re-introduce inline tags we generate.
        let s = md
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code fences first so we don't process markdown inside them.
        const fences = [];
        s = s.replace(/```([\s\S]*?)```/g, (_m, code) => {
            fences.push(code);
            return "\u0000FENCE" + (fences.length - 1) + "\u0000";
        });

        // Headings
        s = s.replace(/^### (.*)$/gm, "<h3>$1</h3>");
        s = s.replace(/^## (.*)$/gm, "<h2>$1</h2>");
        s = s.replace(/^# (.*)$/gm, "<h1>$1</h1>");

        // Horizontal rule / page break
        s = s.replace(/^---+\s*$/gm, '<hr class="page-break" />');

        // Blockquote (single-line)
        s = s.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");

        // Lists — group consecutive list items
        s = s.replace(/(?:^- .*(?:\n|$))+/gm, (block) => {
            const items = block
                .trim()
                .split(/\n/)
                .map((l) => "<li>" + l.replace(/^- /, "") + "</li>")
                .join("");
            return "<ul>" + items + "</ul>";
        });
        s = s.replace(/(?:^\d+\. .*(?:\n|$))+/gm, (block) => {
            const items = block
                .trim()
                .split(/\n/)
                .map((l) => "<li>" + l.replace(/^\d+\. /, "") + "</li>")
                .join("");
            return "<ol>" + items + "</ol>";
        });

        // Inline: bold, italic, code, underline, links
        s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
        s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
        s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");
        s = s.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener">$1</a>',
        );

        // Paragraphs: split on blank lines, wrap any line that isn't already
        // a block-level element.
        const blockTagRe =
            /^\s*<(h[1-6]|ul|ol|blockquote|hr|pre|table|p|div)\b/i;
        s = s
            .split(/\n{2,}/)
            .map((block) => {
                if (!block.trim()) return "";
                if (blockTagRe.test(block)) return block;
                return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
            })
            .join("\n");

        // Restore code fences.
        s = s.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i) => {
            return "<pre><code>" + fences[+i] + "</code></pre>";
        });

        return s;
    }

    function htmlToMarkdown(html) {
        if (!html) return "";
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        return (
            walk(tmp)
                .replace(/\n{3,}/g, "\n\n")
                .trim() + "\n"
        );
    }

    function walk(node) {
        let out = "";
        node.childNodes.forEach((n) => {
            out += nodeToMd(n);
        });
        return out;
    }

    function nodeToMd(node) {
        if (node.nodeType === 3) {
            return node.textContent;
        }
        if (node.nodeType !== 1) return "";
        const tag = node.tagName.toLowerCase();
        const inner = walk(node);
        switch (tag) {
            case "h1":
                return "\n# " + inner.trim() + "\n\n";
            case "h2":
                return "\n## " + inner.trim() + "\n\n";
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                return "\n### " + inner.trim() + "\n\n";
            case "strong":
            case "b":
                return "**" + inner + "**";
            case "em":
            case "i":
                return "*" + inner + "*";
            case "u":
                return "<u>" + inner + "</u>";
            case "code":
                if (node.parentNode && node.parentNode.tagName === "PRE")
                    return inner;
                return "`" + inner + "`";
            case "pre":
                return "\n```\n" + inner.replace(/\n$/, "") + "\n```\n\n";
            case "blockquote":
                return (
                    "\n" +
                    inner
                        .trim()
                        .split(/\n/)
                        .map((l) => "> " + l)
                        .join("\n") +
                    "\n\n"
                );
            case "ul": {
                let s = "\n";
                node.childNodes.forEach((c) => {
                    if (c.nodeType === 1 && c.tagName.toLowerCase() === "li") {
                        s += "- " + walk(c).trim() + "\n";
                    }
                });
                return s + "\n";
            }
            case "ol": {
                let s = "\n";
                let i = 1;
                node.childNodes.forEach((c) => {
                    if (c.nodeType === 1 && c.tagName.toLowerCase() === "li") {
                        s += i + ". " + walk(c).trim() + "\n";
                        i++;
                    }
                });
                return s + "\n";
            }
            case "li":
                return inner;
            case "br":
                return "\n";
            case "p":
            case "div":
                return inner + "\n\n";
            case "hr":
                return "\n---\n\n";
            case "a": {
                const href = node.getAttribute("href") || "";
                return "[" + inner + "](" + href + ")";
            }
            case "table": {
                // Best-effort: emit pipe-table; if first row has <th>, treat as header.
                const rows = Array.from(node.querySelectorAll("tr"));
                if (!rows.length) return "";
                const cells = (tr) =>
                    Array.from(tr.children).map((c) =>
                        walk(c).trim().replace(/\|/g, "\\|"),
                    );
                const header = cells(rows[0]);
                let s = "\n| " + header.join(" | ") + " |\n";
                s += "| " + header.map(() => "---").join(" | ") + " |\n";
                for (let r = 1; r < rows.length; r++) {
                    s += "| " + cells(rows[r]).join(" | ") + " |\n";
                }
                return s + "\n";
            }
            default:
                return inner;
        }
    }

    // ─── Expose globals (build inlines this; HTML calls `mountRichEditor`) ──
    window.mountRichEditor = mountRichEditor;
    window.destroyRichEditor = destroyRichEditor;
    window.setRichEditorMode = setMode;
    window.refreshRichEditor = refreshRichEditor;
    // Expose the converters for tests.
    window._rteMarkdownToHtml = markdownToHtml;
    window._rteHtmlToMarkdown = htmlToMarkdown;
})();
