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

"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

// Base64-encoded minimal .docx for capability testing
const TINY_TEST_DOCX_B64 =
  "UEsDBBQAAAAAAO2+o1x5bjPXrQEAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48VHlwZXMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvY29udGVudC10eXBlcyI+PERlZmF1bHQgRXh0ZW5zaW9uPSJyZWxzIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiLz48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQUAAAAAADtvqNcm/036ikBAAApAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAAAO2+o1wS4lEtsQEAALEBAAARAAAAd29yZC9kb2N1bWVudC54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+PHc6ZG9jdW1lbnQgeG1sbnM6d3BjPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS93b3JkLzIwMTAvd29yZHByb2Nlc3NpbmdDYW52YXMiIHhtbG5zOnc9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy93b3JkcHJvY2Vzc2luZ21sLzIwMDYvbWFpbiI+PHc6Ym9keT48dzpwPjx3OnI+PHc6dD5UaGlzIGlzIGEgdGVzdCBkb2N1bWVudC4gSGVsbG8gV29ybGQuIFByb2N1cmVtZW50IGRldGFpbHMgaGVyZS48L3c6dD48L3c6cj48L3c6cD48dzpwPjx3OnI+PHc6dD5TZWNvbmQgcGFyYWdyYXBoIHdpdGggbW9yZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgcHJvamVjdC48L3c6dD48L3c6cj48L3c6cD48L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsDBBQAAAAAAO2+o1zp+cGTmwAAAJsAAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj48L1JlbGF0aW9uc2hpcHM+UEsBAhQDFAAAAAAA7b6jXHluM9etAQAArQEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAAAADtvqNcm/036ikBAAApAQAACwAAAAAAAAAAAAAAgAHeAQAAX3JlbHMvLnJlbHNQSwECFAMUAAAAAADtvqNcEuJRLbEBAACxAQAAEQAAAAAAAAAAAAAAgAEwAwAAd29yZC9kb2N1bWVudC54bWxQSwECFAMUAAAAAADtvqNc6fnBk5sAAACbAAAAHAAAAAAAAAAAAAAAgAEQBQAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc1BLBQYAAAAABAAEAAMBAADlBQAAAAA=";

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

// ─── CORS headers ────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Env injection ────────────────────────────────────────────────────────────
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
  res.end(`Not found: ${url}\nAvailable endpoints: / /health /convert /backup`);
}

// ─── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer(handler);

server.listen(PORT, "0.0.0.0", () => {
  const envLabel = env.ENVIRONMENT || "hosted";
  const llmUrl = env.LOCAL_LLM_URL || "http://localhost:11434/v1";
  const model = env.LOCAL_LLM_DEFAULT_MODEL || "(not set)";

  console.log("");
  console.log("  SourceDesk");
  console.log("  ──────────────────────────────────────────");
  console.log(`  URL:           http://localhost:${PORT}`);
  console.log(`  Environment:   ${envLabel}`);
  console.log(`  Local LLM:     ${llmUrl}`);
  console.log(`  Default model: ${model}`);
  console.log(
    `  Convert API:   http://localhost:${PORT}/convert  (markitdown)`,
  );
  console.log(
    `  Proxy:         http://localhost:${PORT}/proxy  (local LLM CORS bypass)`,
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
