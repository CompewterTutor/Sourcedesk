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

function checkMarkitdown(cb) {
  if (_markitdownAvailable !== null) {
    cb(_markitdownAvailable);
    return;
  }
  // Try direct `markitdown` command first
  execFile("markitdown", ["--help"], { timeout: 5000 }, (err) => {
    if (!err) {
      _markitdownAvailable = true;
      cb(true);
      return;
    }
    // Fall back to `python3 -m markitdown`
    execFile(
      "python3",
      ["-m", "markitdown", "--help"],
      { timeout: 5000 },
      (err2) => {
        _markitdownAvailable = !err2;
        cb(!err2);
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
    checkMarkitdown((available) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", markitdownAvailable: available }));
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
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("markitdown failed: " + err.message);
          return;
        }
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(markdown);
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
  checkMarkitdown((available) => {
    if (available) {
      console.log(
        "  ✓ markitdown available — .docx / .xlsx / .pptx / .pdf conversion enabled",
      );
    } else {
      console.log("  ⚠ markitdown not found on PATH");
      console.log("    Install with:  pip install markitdown");
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
