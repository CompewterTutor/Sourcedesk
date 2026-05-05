#!/usr/bin/env node
// ─── SourceDesk homelab server ────────────────────────────────────────────────
// Usage:  node server.js          (reads .env for config)
//         npm run serve           (same thing via package.json script)
//
// Reads .env, injects window.__SOURCEDESK_ENV__ into SourceDesk.html,
// and serves it at http://0.0.0.0:PORT.  No external dependencies.
//
// Optional: install markitdown for high-quality document conversion:
//   pip install markitdown
//
// Endpoints:
//   GET  /              → serves SourceDesk.html with env injection
//   GET  /health        → {"status":"ok","markitdownAvailable":bool}
//   POST /convert       → converts a document to Markdown via markitdown
//                          Body: JSON { filename: string, data: string (base64) }
//                          Response: text/plain Markdown
//   POST /proxy        → proxies requests to local LLM servers (avoids browser CORS)
//   GET  /api/email-summaries → LLM-generated email summaries (token-authenticated)
//   GET  /api/hindsight/status → Hindsight memory service status (token-authenticated)
//   POST /api/email-ingest → ingest a batch of email threads (token-authenticated)

"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

// Base64-encoded minimal .docx for capability testing
const TINY_TEST_DOCX_B64 =
  "UEsDBBQAAAAAAO2+o1x5bjPXrQEAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48VHlwZXMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvY29udGVudC10eXBlcyI+PERlZmF1bHQgRXh0ZW5zaW9uPSJyZWxzIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiLz48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQUAAAAAADtvqNcm/036ikBAAApAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAAAO2+o1wS4lEtsQEAALEBAAARAAAAd29yZC9kb2N1bWVudC54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+PHc6ZG9jdW1lbnQgeG1sbnM6d3BjPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS93b3JkLzIwMTAvd29yZHByb2Nlc3NpbmdDYW52YXMiIHhtbG5zOnc9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy93b3JkcHJvY2Vzc2luZ21sLzIwMDYvbWFpbiI+PHc6Ym9keT48dzpwPjx3OnI+PHc6dD5UaGlzIGlzIGEgdGVzdCBkb2N1bWVudC4gSGVsbG8gV29ybGQuIFByb2N1cmVtZW50IGRldGFpbHMgaGVyZS48L3c6dD48L3c6cj48L3c6cD48dzpwPjx3OnI+PHc6dD5TZWNvbmQgcGFyYWdyYXBoIHdpdGggbW9yZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgcHJvamVjdC48L3c6dD48L3c6cj48L3c6cD48L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsBAhQDFAAAAAAA7b6jXHluM9etAQAArQEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAAAADtvqNcm/036ikBAAApAQAACwAAAAAAAAAAAAAAgAHeAQAAX3JlbHMvLnJlbHNQSwECFAMUAAAAAADtvqNcEuJRLbEBAACxAQAAEQAAAAAAAAAAAAAAgAEwAwAAd29yZC9kb2N1bWVudC54bWxQSwECFAMUAAAAAADtvqNc6fnBk5sAAACbAAAAHAAAAAAAAAAAAAAAgAEQBQAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc1BLBQYAAAAABAAEAAMBAADlBQAAAAA=";

// ─── .env parser ──────────────────────────────────────────────────────────────
function loadEnv(envPath) {
  const result = {};
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      result[key] = val;
    }
  } catch {
    // .env not found — use defaults
  }
  return result;
}

const ENV_FILE = path.join(__dirname, ".env");
const env = loadEnv(ENV_FILE);

const PORT = parseInt(env.PORT || process.env.PORT || "3000", 10);
const HTML_SRC = path.join(__dirname, "SourceDesk.html");

// ─── API token storage (simple file-backed mapping for homelab use) ───────────
// Tokens are stored in `.private-documents/api_tokens.json` as a simple mapping
// { "<token>": { user: "alice@example.com", label: "Alice", createdAt: "..." }, ... }
// This is intentionally lightweight. For production / multi-user deployments
// you'll want a proper database table, migrations, and an admin UI.
const TOKENS_FILE = path.join(
  __dirname,
  ".private-documents",
  "api_tokens.json",
);

// ─── Ensure required directories exist at startup ─────────────────────────────
// Creates them silently if missing; no-op if they already exist.
[
  path.join(__dirname, ".private-documents"),
  path.join(__dirname, ".private-documents", "email_ingests"),
  path.join(__dirname, "backups"),
  path.join(__dirname, "data"),
].forEach((dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
});

function loadTokens() {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    const obj = JSON.parse(raw) || {};
    const now = new Date();
    const filtered = {};
    for (const [tok, meta] of Object.entries(obj)) {
      if (meta.expiresAt && new Date(meta.expiresAt) < now) continue;
      filtered[tok] = meta;
    }
    return filtered;
  } catch (e) {
    return {};
  }
}

// ─── Hindsight rate limiter ─────────────────────────────────────────────────
// Simple in-memory per-token sliding-window rate limiter for Hindsight endpoints.
// Tracks request counts per token per 60-second window.
// Conservative limits since Hindsight is a paid/self-hosted service.
var _rl_windows = {}; // { token: { windowStart: ms, counts: { endpoint: N } } }
var RL_RETAIN_MAX = 60; // max retain requests per token per minute
var RL_RECALL_MAX = 120; // max recall requests per token per minute
var RL_WINDOW_MS = 60000;

function _hindsightRateCheck(token, endpoint) {
  var now = Date.now();
  if (!_rl_windows[token]) {
    _rl_windows[token] = { windowStart: now, counts: {} };
  }
  var w = _rl_windows[token];
  if (now - w.windowStart > RL_WINDOW_MS) {
    w.windowStart = now;
    w.counts = {};
  }
  w.counts[endpoint] = (w.counts[endpoint] || 0) + 1;
  var max = endpoint === "retain" ? RL_RETAIN_MAX : RL_RECALL_MAX;
  return w.counts[endpoint] <= max; // true = request allowed
}

// ─── DB + LLM (optional — graceful no-op if DATABASE_URL not set) ─────────────
let _db = null;
let _dbInitError = null;

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL || "";
if (DATABASE_URL) {
  try {
    const { createDb } = require("./server/db");
    _db = createDb(DATABASE_URL);
    // Run any pending migrations asynchronously (don't block server startup)
    const migrationsDir = path.join(__dirname, "migrations");
    _db
      .runMigrations(migrationsDir)
      .then(function (applied) {
        if (applied.length > 0)
          console.log("  Migrations applied: " + applied.join(", "));
      })
      .catch(function (e) {
        console.error("  Migration error:", e.message);
      });
  } catch (e) {
    _dbInitError = e.message;
    console.error("  DB init failed:", e.message);
  }
}

// Short unique ID helper (same pattern as client-side uid())
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Hindsight (optional — no-op if HINDSIGHT_API_URL not set) ───────────────────────
const _hindsight = (() => {
  try {
    return require("./server/hindsight");
  } catch (e) {
    return null;
  }
})();

// Async LLM summarization — fire-and-forget after the HTTP response is sent.
// Groups emails by thread, calls the configured LLM per-thread then overall,
// and persists the result to the email_summaries table.
async function _summarizeIngest(db, ingestId, projectId, userId, threadsMap) {
  const provider = env.LLM_PROVIDER || process.env.LLM_PROVIDER || "";
  const hasKey =
    env.ANTHROPIC_API_KEY ||
    env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    env.LOCAL_LLM_URL;
  if (!provider || !hasKey) return; // LLM not configured — skip silently

  try {
    const { callLlm } = require("./server/llm");
    const projKey = projectId || "__global__";

    // Existing summary for incremental updates
    const existing = await db.get(
      "SELECT * FROM email_summaries WHERE project_id = ? AND user_id = ?",
      [projKey, userId],
    );
    const prevThreadData = existing
      ? JSON.parse(existing.per_thread_json || "{}")
      : {};

    const perThreadResults = Object.assign({}, prevThreadData);

    for (const [threadKey, messages] of Object.entries(threadsMap)) {
      const msgText = messages
        .map(function (m) {
          return (
            "From: " +
            (m.from || "unknown") +
            "\nDate: " +
            (m.date || "unknown") +
            "\nSubject: " +
            (m.subject || "(no subject)") +
            "\n\n" +
            (m.body || "")
          );
        })
        .join("\n\n---\n\n");

      const systemPrompt =
        "You are an expert assistant summarizing procurement-related email threads. " +
        "Be concise and factual. Focus on: key decisions, action items, deadlines, vendor info, and open questions. " +
        "Format your response as: ## Summary\n(2-4 sentences)\n\n## Action Items\n- item\n\n## Key Details\n- detail";

      const isUpdate = !!prevThreadData[threadKey];
      const userMsg = isUpdate
        ? "UPDATE: New messages have arrived for this thread since the last summary below. " +
          "Analyze only what is NEW and update the summary.\n" +
          "Previous summary:\n" +
          (prevThreadData[threadKey].summary || "") +
          "\n\nNew messages:\n" +
          msgText
        : "Summarize this email thread.\n\nThread: " +
          (messages[0] ? messages[0].subject || threadKey : threadKey) +
          "\n\n" +
          msgText;

      const summary = await callLlm(systemPrompt, userMsg, { env });
      perThreadResults[threadKey] = {
        summary,
        subject:
          messages[0] && messages[0].subject ? messages[0].subject : threadKey,
        processedAt: new Date().toISOString(),
        messageCount: messages.length,
      };
    }

    // Overall project summary
    const threadSummariesText = Object.values(perThreadResults)
      .map(function (t) {
        return "Thread: " + (t.subject || "?") + "\n" + (t.summary || "");
      })
      .join("\n\n---\n\n");

    const overallSystem =
      "You are an expert procurement assistant. Create a consolidated project summary from email thread summaries. " +
      "Include: executive summary (2-3 sentences), key vendors/contacts, open action items, upcoming deadlines, recommended next steps.";

    const overallSummary = await callLlm(
      overallSystem,
      "Create a project-level summary from these thread summaries:\n\n" +
        threadSummariesText,
      { env },
    );

    const now = new Date().toISOString();
    const provider2 = env.LLM_PROVIDER || "unknown";
    const model = env.LLM_MODEL || "unknown";

    if (existing) {
      await db.run(
        "UPDATE email_summaries SET summary_text=?, per_thread_json=?, last_processed_at=?, version=version+1, model=?, provider=?, updated_at=? WHERE id=?",
        [
          overallSummary,
          JSON.stringify(perThreadResults),
          now,
          model,
          provider2,
          now,
          existing.id,
        ],
      );
    } else {
      await db.run(
        "INSERT INTO email_summaries (id, project_id, user_id, summary_text, per_thread_json, last_processed_at, model, provider, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          _uid(),
          projKey,
          userId,
          overallSummary,
          JSON.stringify(perThreadResults),
          now,
          model,
          provider2,
          now,
          now,
        ],
      );
    }

    console.log(
      "  Email summary updated for project " +
        projKey +
        " (" +
        Object.keys(perThreadResults).length +
        " threads, provider: " +
        provider2 +
        ")",
    );

    // Retain the overall summary in Hindsight (fire-and-forget)
    if (_hindsight) {
      _hindsight
        .ensureBank(userId)
        .then(() =>
          _hindsight.retainContent(userId, {
            documentId: "email-summary:" + projKey,
            content:
              "# Email Summary for Project " +
              projKey +
              "\n\n" +
              overallSummary,
            context: "project:" + projKey,
            tags: ["project:" + projKey, "type:email-summary"],
          }),
        )
        .catch(() => {});
    }
  } catch (e) {
    console.error("  LLM summarization failed:", e.message);
  }
}

// ─── markitdown availability & execution ─────────────────────────────────────
// Cached availability: null = unchecked, true/false = result
let _markitdownAvailable = null;
let _markitdownDocxAvailable = null;

// Verify that markitdown can actually convert .docx files by running a tiny test conversion.
function _testDocxConversion(cb) {
  const tmpFile = path.join(
    os.tmpdir(),
    "sd-mkd-docx-test-" + Date.now() + ".docx",
  );
  try {
    fs.writeFileSync(tmpFile, Buffer.from(TINY_TEST_DOCX_B64, "base64"));
  } catch (e) {
    cb(false);
    return;
  }
  runMarkitdown(tmpFile, (err, output) => {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_) {}
    // The test docx contains "Hello World" in its text content
    cb(
      !err &&
        typeof output === "string" &&
        output.toLowerCase().includes("hello world"),
    );
  });
}

function checkMarkitdown(cb) {
  if (_markitdownAvailable !== null && _markitdownDocxAvailable !== null) {
    cb(_markitdownAvailable, _markitdownDocxAvailable);
    return;
  }
  // Step 1: verify markitdown is on PATH
  execFile("markitdown", ["--help"], { timeout: 5000 }, (err) => {
    if (!err) {
      _markitdownAvailable = true;
      // Step 2: test actual docx conversion to catch missing optional deps
      _testDocxConversion((docxOk) => {
        _markitdownDocxAvailable = docxOk;
        cb(true, docxOk);
      });
      return;
    }
    // Try python3 -m markitdown fallback
    execFile(
      "python3",
      ["-m", "markitdown", "--help"],
      { timeout: 5000 },
      (err2) => {
        const ok = !err2;
        _markitdownAvailable = ok;
        if (!ok) {
          _markitdownDocxAvailable = false;
          cb(false, false);
          return;
        }
        _testDocxConversion((docxOk) => {
          _markitdownDocxAvailable = docxOk;
          cb(true, docxOk);
        });
      },
    );
  });
}

function runMarkitdown(file, cb) {
  const opts = { maxBuffer: 10 * 1024 * 1024, timeout: 30000 };
  execFile("markitdown", [file], opts, (err, stdout, stderr) => {
    if (!err) {
      cb(null, stdout);
      return;
    }
    // Fall back to python3 -m markitdown
    execFile(
      "python3",
      ["-m", "markitdown", file],
      opts,
      (err2, stdout2, stderr2) => {
        if (!err2) {
          cb(null, stdout2);
          return;
        }
        cb(
          new Error(
            stderr2 ||
              stderr ||
              (err2 && err2.message) ||
              (err && err.message) ||
              "markitdown failed",
          ),
        );
      },
    );
  });
}

// ─── Markdown post-processing ───────────────────────────────────────────────
/**
 * Clean up markitdown output to improve RAG quality:
 *  1. Strip Word-generated TOC hyperlinks  — e.g. "[Section Name 6](#_Toc123456)"
 *     These are navigation artifacts with dead anchors and page numbers that
 *     add noise without useful content for retrieval.
 *  2. Strip empty data-URI image placeholders — e.g. "![](data:image/jpeg;base64...)"
 *     No alt text, no useful information.
 *  3. Collapse 3+ consecutive blank lines to 2 (tidy up gaps left by removals).
 */
function _cleanMarkdown(markdown) {
  const kept = [];
  for (const line of markdown.split("\n")) {
    const t = line.trim();
    // Drop Word TOC hyperlink lines: [Any text with trailing page number](#_TocNNNNN)
    if (/^\[.+\]\(#_Toc\d+\)$/.test(t)) continue;
    // Drop lines that are *only* an empty data-URI image (whole-line case)
    if (/^!\[\]\(data:[^)]+\)$/.test(t)) continue;
    kept.push(line);
  }
  return (
    kept
      .join("\n")
      // Also strip inline data-URI image placeholders that appear mid-line
      .replace(/!\[\]\(data:[^)]+\)/g, "")
      // Collapse 3+ consecutive blank lines to 2
      .replace(/\n{3,}/g, "\n\n")
  );
}

// ─── CORS headers ───────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Env injection ──────────────────────────────────────────────────────────
// Builds the <script> block injected at the top of <head>.
function buildEnvScript() {
  const obj = {
    environment: env.ENVIRONMENT || "hosted",
    localLlmUrl: env.LOCAL_LLM_URL || "http://localhost:11434/v1",
    localLlmDefaultModel: env.LOCAL_LLM_DEFAULT_MODEL || "",
    // Auto-expose the convert endpoint so the app can use it without
    // the user needing to manually set the MarkItDown URL in Settings.
    markitdownUrl: env.MARKITDOWN_URL || `http://localhost:${PORT}`,
  };
  return `<script>window.__SOURCEDESK_ENV__ = ${JSON.stringify(obj)};</script>`;
}

// ─── Request handler ──────────────────────────────────────────────────────────
function handler(req, res) {
  const url = req.url.split("?")[0]; // strip query string

  // Apply CORS to every response (needed for file:// origin and cross-origin access)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── Health check ──────────────────────────────────────────────────────
  if (url === "/health" && req.method === "GET") {
    checkMarkitdown((available, docxAvailable) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          markitdownAvailable: available,
          docxAvailable: !!docxAvailable,
          db: _db ? _db.type : null,
          dbError: _dbInitError || undefined,
        }),
      );
    });
    return;
  }

  // ─── Document conversion ───────────────────────────────────────────────
  if (url === "/convert" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (_) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid JSON body");
        return;
      }

      const { filename, data } = payload || {};
      if (!filename || !data) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing filename or data");
        return;
      }

      // Sanitise filename — strip any path components and dangerous characters
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const tmpFile = path.join(
        os.tmpdir(),
        `sd-convert-${Date.now()}-${safeName}`,
      );

      try {
        fs.writeFileSync(tmpFile, Buffer.from(data, "base64"));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Failed to write temp file: " + e.message);
        return;
      }

      runMarkitdown(tmpFile, (err, markdown) => {
        // Always clean up the temp file
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}

        if (err) {
          // Truncate long Python tracebacks to a useful one-liner for the browser
          const full = String(err.message || err);
          const brief =
            full
              .split("\n")
              .filter(
                (l) =>
                  l.trim() &&
                  !l.startsWith("  ") &&
                  !l.startsWith("File ") &&
                  !l.startsWith("Traceback"),
              )
              .join(" | ")
              .slice(0, 400) || full.slice(0, 400);
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("markitdown failed: " + brief);
          return;
        }
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(_cleanMarkdown(markdown));
      });
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Request error");
      } catch (_) {}
    });
    return;
  }

  // ─── Database backup ────────────────────────────────────────────────────
  if (url === "/backup" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const backupsDir = path.join(__dirname, "backups");
        fs.mkdirSync(backupsDir, { recursive: true });
        const now = new Date()
          .toISOString()
          .replace(/:/g, "-")
          .replace(/\..+$/, "");
        const filename = `sourcedesk-backup-${now}.json`;
        const fullPath = path.join(backupsDir, filename);
        fs.writeFileSync(fullPath, body, "utf8");
        console.log("  Backup saved:", fullPath);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ saved: filename, path: fullPath }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Backup failed: " + e.message);
      }
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Request error");
      } catch (_) {}
    });
    return;
  }

  // ─── Hindsight status (GET) ────────────────────────────────────────────
  // Query params: token=<api_token>
  // Returns: { available, configured, bankExists, memoryCount }
  if (url === "/api/hindsight/status" && req.method === "GET") {
    const qs = new URLSearchParams(req.url.split("?")[1] || "");
    const qToken = qs.get("token") || "";
    if (!qToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing token query parameter" }));
      return;
    }
    const tokens = loadTokens();
    if (!tokens[qToken]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid API token" }));
      return;
    }
    if (!_hindsight) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          available: false,
          configured: false,
          bankExists: false,
          memoryCount: null,
        }),
      );
      return;
    }
    (async function () {
      try {
        const owner = tokens[qToken].user || tokens[qToken].label || "unknown";
        const status = await _hindsight.getStatus(owner);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  // ─── Hindsight retain (POST) ─────────────────────────────────────────────
  // Body: { token, documentId?, content, context?, tags? }
  // Returns: { ok: true } immediately; retain fires async in the background.
  if (url === "/api/hindsight/retain" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => {
      body += d;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (_) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { token: reqToken, documentId, content, context, tags } = payload;
      if (!reqToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing token" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[reqToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API token" }));
        return;
      }
      if (!_hindsightRateCheck(reqToken, "retain")) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              "Rate limit exceeded. Max " +
              RL_RETAIN_MAX +
              " retain requests per minute.",
          }),
        );
        return;
      }
      if (!_hindsight) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "Hindsight not configured",
          }),
        );
        return;
      }
      // Fire-and-forget: return immediately; retain happens in background
      const owner =
        tokens[reqToken].user || tokens[reqToken].label || "unknown";
      _hindsight
        .ensureBank(owner)
        .then(() =>
          _hindsight.retainContent(owner, {
            content: content || "",
            documentId: documentId || undefined,
            context: context || undefined,
            tags: Array.isArray(tags) ? tags : undefined,
          }),
        )
        .catch((_e) => {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // ─── Hindsight recall (POST) ──────────────────────────────────────────────
  // Body: { token, query, projectId?, budget? }
  // Returns: { memories: string[], count: number }
  if (url === "/api/hindsight/recall" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => {
      body += d;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (_) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { token: reqToken, query, projectId, budget } = payload;
      if (!reqToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing token" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[reqToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API token" }));
        return;
      }
      if (!_hindsightRateCheck(reqToken, "recall")) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              "Rate limit exceeded. Max " +
              RL_RECALL_MAX +
              " recall requests per minute.",
            memories: [],
            count: 0,
          }),
        );
        return;
      }
      if (!_hindsight) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ memories: [], count: 0 }));
        return;
      }
      (async function () {
        try {
          const owner =
            tokens[reqToken].user || tokens[reqToken].label || "unknown";
          const result = await _hindsight.recallForQuery(owner, {
            query: query || "",
            projectId: projectId || undefined,
            budget: budget || 2000,
          });
          const memories = (result && result.memories) || [];
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ memories, count: memories.length }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message, memories: [], count: 0 }));
        }
      })();
    });
    return;
  }

  // ─── Hindsight list memories (GET) ─────────────────────────────────────────
  // Query params: token=X, q=Y (optional), limit=N (default 20), offset=M (default 0)
  // Returns: { memories: [{id,text,type,tags,documentId,context,createdAt}], count, total }
  if (url.startsWith("/api/hindsight/memories") && req.method === "GET") {
    const qs = new URLSearchParams(req.url.split("?")[1] || "");
    const qToken = qs.get("token") || "";
    const qQuery = qs.get("q") || "";
    const qLimit = parseInt(qs.get("limit") || "20", 10);
    const qOffset = parseInt(qs.get("offset") || "0", 10);
    if (!qToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing token" }));
      return;
    }
    const tokens = loadTokens();
    if (!tokens[qToken]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid API token" }));
      return;
    }
    if (!_hindsight) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ memories: [], count: 0, total: 0 }));
      return;
    }
    (async function () {
      try {
        const owner = tokens[qToken].user || tokens[qToken].label || "unknown";
        const result = await _hindsight.listMemories(owner, {
          q: qQuery || undefined,
          limit: qLimit,
          offset: qOffset,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e.message,
            memories: [],
            count: 0,
            total: 0,
          }),
        );
      }
    })();
    return;
  }

  // ─── Hindsight export memories (GET) ───────────────────────────────────────
  // Query params: token=X
  // Returns: JSON attachment with full memory list (all pages)
  if (url.startsWith("/api/hindsight/export") && req.method === "GET") {
    const qs = new URLSearchParams(req.url.split("?")[1] || "");
    const qToken = qs.get("token") || "";
    if (!qToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing token" }));
      return;
    }
    const tokens = loadTokens();
    if (!tokens[qToken]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid API token" }));
      return;
    }
    if (!_hindsight) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="memory-export.json"',
      });
      res.end(
        JSON.stringify({ memories: [], exportedAt: new Date().toISOString() }),
      );
      return;
    }
    (async function () {
      try {
        const owner = tokens[qToken].user || tokens[qToken].label || "unknown";
        const allMemories = [];
        let offset = 0;
        const limit = 100;
        while (true) {
          const batch = await _hindsight.listMemories(owner, { limit, offset });
          allMemories.push(...(batch.memories || []));
          if ((batch.memories || []).length < limit) break;
          offset += limit;
        }
        const payload = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            count: allMemories.length,
            memories: allMemories,
          },
          null,
          2,
        );
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="sourcedesk-memories.json"',
        });
        res.end(payload);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  // ─── Hindsight delete document (DELETE) ────────────────────────────────────
  // Body: { token, documentId }
  // Returns: { ok: true }
  if (url === "/api/hindsight/memory" && req.method === "DELETE") {
    let body = "";
    req.on("data", (d) => {
      body += d;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (_) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { token: reqToken, documentId } = payload;
      if (!reqToken || !documentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing token or documentId" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[reqToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API token" }));
        return;
      }
      if (!_hindsight) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, skipped: true }));
        return;
      }
      (async function () {
        try {
          const owner =
            tokens[reqToken].user || tokens[reqToken].label || "unknown";
          await _hindsight.deleteDocument(owner, documentId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      })();
    });
    return;
  }

  // ─── Hindsight clear all (DELETE) ──────────────────────────────────────────
  // Body: { token }
  // Returns: { ok: true, deleted: N }
  if (url === "/api/hindsight/memories" && req.method === "DELETE") {
    let body = "";
    req.on("data", (d) => {
      body += d;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (_) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { token: reqToken } = payload;
      if (!reqToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing token" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[reqToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API token" }));
        return;
      }
      if (!_hindsight) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, deleted: 0, skipped: true }));
        return;
      }
      (async function () {
        try {
          const owner =
            tokens[reqToken].user || tokens[reqToken].label || "unknown";
          const deleted = await _hindsight.clearAll(owner);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, deleted }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      })();
    });
    return;
  }

  // ─── Email summaries (GET) ──────────────────────────────────────────────────
  // Returns LLM-generated summaries for a project.
  // Query params: token=<api_token>&projectId=<id>
  if (url.startsWith("/api/email-summaries") && req.method === "GET") {
    const qs = new URLSearchParams(req.url.split("?")[1] || "");
    const qToken = qs.get("token") || "";
    const qProjectId = qs.get("projectId") || "";

    if (!qToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing token query parameter" }));
      return;
    }

    const tokens = loadTokens();
    if (!tokens[qToken]) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid API token" }));
      return;
    }

    if (!_db) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "Database not configured. Set DATABASE_URL in .env to enable summaries.",
        }),
      );
      return;
    }

    (async function () {
      try {
        const owner = tokens[qToken].user || tokens[qToken].label || "unknown";
        const projKey = qProjectId || "__global__";
        const summary = await _db.get(
          "SELECT * FROM email_summaries WHERE project_id = ? AND user_id = ?",
          [projKey, owner],
        );
        if (!summary) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "No summaries found for this project" }),
          );
          return;
        }
        // Parse stored JSON fields
        const out = Object.assign({}, summary);
        try {
          out.per_thread_json = JSON.parse(out.per_thread_json || "{}");
        } catch (_) {}
        try {
          out.draft_documents = JSON.parse(out.draft_documents || "[]");
        } catch (_) {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", summary: out }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "DB error", message: e.message }));
      }
    })();
    return;
  }

  // ─── Token revoke (POST) ──────────────────────────────────────────────────
  // Body: { adminToken: string, revokeToken: string }
  // The adminToken must be a valid token (any valid token can revoke others).
  if (url === "/api/token-revoke" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
      const { adminToken, revokeToken } = payload || {};
      if (!adminToken || !revokeToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing adminToken or revokeToken" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[adminToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid adminToken" }));
        return;
      }
      // Remove from file-based store
      let revokedFromFile = false;
      if (tokens[revokeToken]) {
        delete tokens[revokeToken];
        fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
        revokedFromFile = true;
      }
      // Mark revoked in DB if available
      let revokedFromDb = false;
      if (_db) {
        try {
          const r = await _db.run(
            "UPDATE api_tokens SET revoked = 1 WHERE token = ?",
            [revokeToken],
          );
          if (r.changes > 0) revokedFromDb = true;
        } catch (e) {
          console.error("  Token revoke DB error:", e.message);
        }
      }
      if (!revokedFromFile && !revokedFromDb) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Token not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", revokedFromFile, revokedFromDb }));
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request error" }));
      } catch (_) {}
    });
    return;
  }

  // ─── Token list (GET) ────────────────────────────────────────────────────
  // Query params: adminToken
  // Returns all tokens from file (including expired, marked with expired:true).
  if (url.startsWith("/api/token-list") && req.method === "GET") {
    try {
      const sp = new URL("http://x" + url).searchParams;
      const adminToken = sp.get("adminToken");
      if (!adminToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing adminToken" }));
        return;
      }
      const tokens = loadTokens();
      if (!tokens[adminToken]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid adminToken" }));
        return;
      }
      // Read raw file so expired tokens still appear (just flagged)
      const allRaw = (() => {
        try {
          return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")) || {};
        } catch {
          return {};
        }
      })();
      const arr = Object.entries(allRaw).map(([tok, meta]) => ({
        token: tok,
        label: meta.label || null,
        user: meta.user || null,
        createdAt: meta.createdAt || null,
        expiresAt: meta.expiresAt || null,
        expired: meta.expiresAt ? new Date(meta.expiresAt) < new Date() : false,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tokens: arr }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  // ─── Token generate (POST) ───────────────────────────────────────────────
  // Body: { adminToken: string, label?: string, expiresIn?: string }
  // expiresIn examples: "30d", "7d", "24h", "1y" — omit for no expiry.
  if (url === "/api/token-generate" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
          return;
        }
        const { adminToken, label, expiresIn } = payload || {};
        if (!adminToken) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing adminToken" }));
          return;
        }
        const tokens = loadTokens();
        if (!tokens[adminToken]) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid adminToken" }));
          return;
        }
        function _parseExpiresIn(s) {
          if (!s) return null;
          const num = parseInt(s, 10);
          if (isNaN(num)) return null;
          const unit = s.slice(String(num).length).toLowerCase();
          const ms =
            unit === "h"
              ? num * 3600000
              : unit === "d"
                ? num * 86400000
                : unit === "w"
                  ? num * 604800000
                  : unit === "y"
                    ? num * 365 * 86400000
                    : null;
          if (!ms) return null;
          return new Date(Date.now() + ms);
        }
        const expiresAt = _parseExpiresIn(expiresIn);
        const newToken = require("crypto").randomBytes(24).toString("hex");
        const now = new Date().toISOString();
        const meta = {
          user: tokens[adminToken].user || null,
          label: label || null,
          createdAt: now,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        };
        let rawTokens = {};
        try {
          rawTokens = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")) || {};
        } catch {}
        rawTokens[newToken] = meta;
        fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
        fs.writeFileSync(
          TOKENS_FILE,
          JSON.stringify(rawTokens, null, 2),
          "utf8",
        );
        // Also insert into DB if available
        if (_db) {
          try {
            let userId = null;
            if (meta.user) {
              const u = await _db.get("SELECT id FROM users WHERE email = ?", [
                meta.user,
              ]);
              if (u) userId = u.id;
            }
            const tokenId = _uid();
            await _db.run(
              "INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)",
              [tokenId, userId, newToken, meta.label, meta.createdAt],
            );
          } catch (e) {
            console.error("  token-generate DB insert error:", e.message);
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            token: newToken,
            label: meta.label,
            createdAt: meta.createdAt,
            expiresAt: meta.expiresAt,
          }),
        );
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request error" }));
      } catch (_) {}
    });
    return;
  }

  // ─── Email ingest API (homelab token-based) ─────────────────────────────
  // Accepts JSON: { token: string, projectId?: string, emails: [ { subject, from, to, date, body, threadId? } ] }
  // Stores the raw payload to .private-documents/email_ingests/ and returns a lightweight summary.
  if (url === "/api/email-ingest" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const { token, projectId, emails } = payload || {};
      if (!token || !emails || !Array.isArray(emails)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing token or emails array" }));
        return;
      }

      const tokens = loadTokens();
      if (!tokens[token]) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid API token" }));
        return;
      }

      const owner = tokens[token].user || tokens[token].label || "unknown";

      try {
        const ingestsDir = path.join(
          __dirname,
          ".private-documents",
          "email_ingests",
        );
        fs.mkdirSync(ingestsDir, { recursive: true });
        const nowTs = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `ingest-${nowTs}-${Math.random().toString(36).slice(2, 8)}.json`;
        const fullPath = path.join(ingestsDir, filename);
        const record = {
          token,
          owner,
          projectId: projectId || null,
          receivedAt: new Date().toISOString(),
          emails,
        };
        fs.writeFileSync(fullPath, JSON.stringify(record, null, 2), "utf8");

        // Lightweight summary (placeholder for a proper LLM-based analysis pipeline)
        const emailCount = emails.length;
        const threadsMap = new Map();
        for (const e of emails) {
          const key = (e.threadId || e.subject || "")
            .toString()
            .trim()
            .toLowerCase();
          const k = key || `__no-subject-${Math.floor(Math.random() * 100000)}`;
          if (!threadsMap.has(k)) threadsMap.set(k, []);
          threadsMap.get(k).push(e);
        }

        const threadSummaries = [];
        for (const [k, arr] of threadsMap.entries()) {
          const senders = Array.from(
            new Set(arr.map((x) => x.from || "").filter(Boolean)),
          );
          const dates = arr
            .map((a) => a.date)
            .filter(Boolean)
            .sort();
          threadSummaries.push({
            subject: arr[0] && arr[0].subject ? arr[0].subject : k,
            emails: arr.length,
            senders,
            earliest: dates[0] || null,
            latest: dates[dates.length - 1] || null,
          });
        }

        // Determine if previous ingests exist for this owner + projectId
        const existingFiles = fs
          .readdirSync(ingestsDir)
          .filter((n) => n.startsWith("ingest-"));
        let previousCount = 0;
        for (const f of existingFiles) {
          try {
            const p = path.join(ingestsDir, f);
            const r = JSON.parse(fs.readFileSync(p, "utf8"));
            if (
              r &&
              r.owner === owner &&
              String(r.projectId || "") === String(projectId || "")
            )
              previousCount++;
          } catch (_) {}
        }

        const summary = {
          firstTime: previousCount === 0,
          previousIngests: previousCount,
          emailCount,
          threadCount: threadSummaries.length,
          threads: threadSummaries,
        };

        const processedDir = path.join(ingestsDir, "processed");
        fs.mkdirSync(processedDir, { recursive: true });
        const processedPath = path.join(processedDir, `summary-${filename}`);
        fs.writeFileSync(
          processedPath,
          JSON.stringify(
            {
              stored: filename,
              summary,
              processedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          "utf8",
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            stored: filename,
            summary,
            llmSummarizing: !!(
              _db &&
              (env.LLM_PROVIDER || process.env.LLM_PROVIDER)
            ),
          }),
        );

        // ── DB persistence + async LLM — fire-and-forget (response already sent) ──
        if (_db) {
          const nowTs2 = new Date().toISOString();
          const projKey = projectId || "__global__";
          const ingestId = _uid();

          (async function () {
            try {
              // Persist ingest record
              await _db.run(
                "INSERT INTO email_ingests (id, user_id, project_id, received_at, email_count, filename) VALUES (?,?,?,?,?,?)",
                [
                  ingestId,
                  owner,
                  projectId || null,
                  nowTs2,
                  emails.length,
                  filename,
                ],
              );

              // Upsert threads and persist messages
              for (const [k, arr] of threadsMap.entries()) {
                const sndrs = Array.from(
                  new Set(arr.map((x) => x.from || "").filter(Boolean)),
                );
                const dts = arr
                  .map((a) => a.date)
                  .filter(Boolean)
                  .sort();

                // Upsert thread (find-or-create)
                let threadRow = await _db.get(
                  "SELECT id FROM email_threads WHERE project_id = ? AND user_id = ? AND thread_key = ?",
                  [projKey, owner, k],
                );
                if (!threadRow) {
                  const threadId = _uid();
                  await _db.run(
                    "INSERT INTO email_threads (id, project_id, user_id, thread_key, subject, email_count, senders, earliest, latest, last_ingest_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    [
                      threadId,
                      projKey,
                      owner,
                      k,
                      arr[0] && arr[0].subject ? arr[0].subject : k,
                      arr.length,
                      JSON.stringify(sndrs),
                      dts[0] || null,
                      dts[dts.length - 1] || null,
                      ingestId,
                      nowTs2,
                      nowTs2,
                    ],
                  );
                  threadRow = { id: threadId };
                } else {
                  await _db.run(
                    "UPDATE email_threads SET email_count=email_count+?, senders=?, latest=?, last_ingest_id=?, updated_at=? WHERE id=?",
                    [
                      arr.length,
                      JSON.stringify(sndrs),
                      dts[dts.length - 1] || null,
                      ingestId,
                      nowTs2,
                      threadRow.id,
                    ],
                  );
                }

                // Persist messages (skip duplicates)
                for (const msg of arr) {
                  const msgKey =
                    k +
                    "|" +
                    (msg.from || "") +
                    "|" +
                    (msg.date || "") +
                    "|" +
                    (msg.messageId || msg.subject || "").slice(0, 50);
                  const exists = await _db.get(
                    "SELECT id FROM email_messages WHERE thread_id = ? AND message_key = ?",
                    [threadRow.id, msgKey],
                  );
                  if (!exists) {
                    await _db.run(
                      "INSERT INTO email_messages (id, thread_id, ingest_id, subject, from_addr, to_addr, date, body, message_key) VALUES (?,?,?,?,?,?,?,?,?)",
                      [
                        _uid(),
                        threadRow.id,
                        ingestId,
                        msg.subject || null,
                        msg.from || null,
                        msg.to || null,
                        msg.date || null,
                        msg.body || null,
                        msgKey,
                      ],
                    );
                  }
                }
              }
            } catch (dbErr) {
              console.error("  Email ingest DB error:", dbErr.message);
            }

            // Build plain-object version of threadsMap for _summarizeIngest
            const threadsObj = {};
            for (const [k, arr] of threadsMap.entries()) {
              threadsObj[k] = arr;
            }
            await _summarizeIngest(_db, ingestId, projectId, owner, threadsObj);
          })();
        }

        return;
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Ingest failed", message: e.message }));
        return;
      }
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request error" }));
      } catch (_) {}
    });
    return;
  }

  // ─── Local LLM proxy ──────────────────────────────────────────────────────────
  // Forwards requests to local LLM servers (LM Studio, Ollama, etc.) server-side
  // to bypass CORS restrictions. Browsers forbid the Authorization header from
  // being covered by a wildcard Access-Control-Allow-Headers: * — this proxy
  // avoids the browser making the cross-origin request at all.
  if (url === "/proxy" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (_) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid JSON body");
        return;
      }

      const {
        url: targetUrl,
        method: fwdMethod = "POST",
        headers: fwdHeaders = {},
        body: fwdBody = "",
      } = payload;

      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing url");
        return;
      }

      let parsedTarget;
      try {
        parsedTarget = new URL(targetUrl);
      } catch (_) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid target URL");
        return;
      }

      const isHttps = parsedTarget.protocol === "https:";
      const lib = isHttps ? https : http;

      const bodyBuf = Buffer.from(
        typeof fwdBody === "string" ? fwdBody : JSON.stringify(fwdBody),
        "utf8",
      );

      // Strip hop-by-hop headers, then set correct content-length
      const outHeaders = Object.assign({}, fwdHeaders);
      delete outHeaders["host"];
      delete outHeaders["Host"];
      delete outHeaders["content-length"];
      delete outHeaders["Content-Length"];
      if (bodyBuf.length > 0) outHeaders["content-length"] = bodyBuf.length;

      const reqOptions = {
        hostname: parsedTarget.hostname,
        port: parsedTarget.port || (isHttps ? 443 : 80),
        path: parsedTarget.pathname + (parsedTarget.search || ""),
        method: fwdMethod,
        headers: outHeaders,
      };

      // CORS headers so browser accepts our proxy response
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

      console.log(`  [proxy] → ${fwdMethod} ${targetUrl}`);

      const proxyReq = lib.request(reqOptions, (proxyRes) => {
        const respHeaders = {};
        if (proxyRes.headers["content-type"]) {
          respHeaders["Content-Type"] = proxyRes.headers["content-type"];
        }
        Object.entries(CORS_HEADERS).forEach(([k, v]) => {
          respHeaders[k] = v;
        });
        res.writeHead(proxyRes.statusCode, respHeaders);
        proxyRes.pipe(res);
        // Abort upstream if the browser disconnects
        req.on("close", () => {
          try {
            proxyReq.destroy();
          } catch (_) {}
        });
      });

      proxyReq.on("error", (err) => {
        console.error(
          `  [proxy] error proxying to ${targetUrl}:`,
          err.code,
          err.message,
        );
        try {
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/plain" });
          }
          res.end("Proxy error: " + err.message);
        } catch (_) {}
      });

      if (bodyBuf.length > 0) proxyReq.write(bodyBuf);
      proxyReq.end();
    });
    req.on("error", () => {
      try {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Request error");
      } catch (_) {}
    });
    return;
  }

  // ─── Main app ──────────────────────────────────────────────────────────
  if (url === "/" || url === "/SourceDesk.html" || url === "/index.html") {
    let html;
    try {
      html = fs.readFileSync(HTML_SRC, "utf8");
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        "SourceDesk.html not found.\n" +
          "Run `npm run build` (or `npm run dev`) first to generate it.",
      );
      return;
    }

    // Inject env vars right after the opening <head> tag
    const envScript = buildEnvScript();
    html = html.replace(/(<head[^>]*>)/, "$1\n    " + envScript);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      // Prevent caching so a new build is always served fresh
      "Cache-Control": "no-store",
    });
    res.end(html);
    return;
  }

  // Anything else → 404
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(
    `Not found: ${url}\nAvailable endpoints: / /health /convert /backup /proxy /api/email-ingest /api/email-summaries /api/token-revoke /api/hindsight/status /api/hindsight/retain /api/hindsight/recall /api/hindsight/memories /api/hindsight/memory /api/hindsight/export`,
  );
}

// ─── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer(handler);

server.listen(PORT, "0.0.0.0", () => {
  const envLabel = env.ENVIRONMENT || "hosted";
  const llmUrl = env.LOCAL_LLM_URL || "http://localhost:11434/v1";
  const model = env.LOCAL_LLM_DEFAULT_MODEL || "(not set)";
  const dbStatus = _db
    ? _db.type + ": " + DATABASE_URL.replace(/:([^:@]+)@/, ":***@")
    : _dbInitError
      ? "error: " + _dbInitError
      : "(not configured — set DATABASE_URL in .env)";
  const llmStatus = env.LLM_PROVIDER
    ? env.LLM_PROVIDER + " / " + (env.LLM_MODEL || "(no model set)")
    : "(not configured)";

  console.log("");
  console.log("  SourceDesk");
  console.log("  ──────────────────────────────────────────");
  console.log(`  URL:           http://localhost:${PORT}`);
  console.log(`  Environment:   ${envLabel}`);
  console.log(`  Local LLM:     ${llmUrl}`);
  console.log(`  Default model: ${model}`);
  console.log(`  DB:            ${dbStatus}`);
  console.log(`  Server LLM:    ${llmStatus}`);
  console.log(
    `  Convert API:   http://localhost:${PORT}/convert  (markitdown)`,
  );
  console.log(
    `  Proxy:         http://localhost:${PORT}/proxy  (local LLM CORS bypass)`,
  );
  console.log(`  Email ingest:  http://localhost:${PORT}/api/email-ingest`);
  const hindsightUrl =
    env.HINDSIGHT_API_URL || process.env.HINDSIGHT_API_URL || "";
  console.log(
    `  Memory:        ${hindsightUrl ? "http://localhost:" + PORT + "/api/hindsight/status  (Hindsight at " + hindsightUrl + ")" : "(not configured — set HINDSIGHT_API_URL in .env)"}`,
  );
  console.log("  ──────────────────────────────────────────");
  console.log("  Ctrl+C to stop");
  console.log("");

  // Check markitdown and log result asynchronously
  checkMarkitdown((available, docxAvailable) => {
    if (available && docxAvailable) {
      console.log(
        "  ✓ markitdown available — .docx / .xlsx / .pptx / .pdf conversion enabled",
      );
    } else if (available && !docxAvailable) {
      console.log(
        "  ⚠ markitdown found but missing optional document format dependencies",
      );
      console.log('    Run:  pip install "markitdown[all]"');
      console.log("    Then restart the server.");
    } else {
      console.log("  ⚠ markitdown not found on PATH");
      console.log('    Install with:  pip install "markitdown[all]"');
      console.log("    Then restart the server.");
    }
    console.log("");
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Set a different PORT in your .env file.\n`);
  } else {
    console.error("\n  Server error:", err.message, "\n");
  }
  process.exit(1);
});
