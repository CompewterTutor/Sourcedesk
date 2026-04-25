#!/usr/bin/env node
// ─── SourceDesk homelab server ────────────────────────────────────────────────
// Usage:  node server.js          (reads .env for config)
//         npm run serve           (same thing via package.json script)
//
// Reads .env, injects window.__SOURCEDESK_ENV__ into SourceDesk.html,
// and serves it at http://0.0.0.0:PORT.  No external dependencies.

"use strict";

const http = require("http");
const fs   = require("fs");
const path = require("path");

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
            // Strip optional surrounding quotes from value
            const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
            result[key] = val;
        }
    } catch {
        // .env not found — use defaults
    }
    return result;
}

const ENV_FILE = path.join(__dirname, ".env");
const env = loadEnv(ENV_FILE);

const PORT     = parseInt(env.PORT || process.env.PORT || "3000", 10);
const HTML_SRC = path.join(__dirname, "SourceDesk.html");

// ─── Env injection ────────────────────────────────────────────────────────────
// Builds the <script> block injected at the top of <head>.
function buildEnvScript() {
    const obj = {
        environment:          env.ENVIRONMENT          || "hosted",
        localLlmUrl:          env.LOCAL_LLM_URL        || "http://localhost:11434/v1",
        localLlmDefaultModel: env.LOCAL_LLM_DEFAULT_MODEL || "",
    };
    return `<script>window.__SOURCEDESK_ENV__ = ${JSON.stringify(obj)};</script>`;
}

// ─── Request handler ──────────────────────────────────────────────────────────
function handler(req, res) {
    const url = req.url.split("?")[0]; // strip query string

    if (url === "/" || url === "/SourceDesk.html" || url === "/index.html") {
        let html;
        try {
            html = fs.readFileSync(HTML_SRC, "utf8");
        } catch {
            res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(
                "SourceDesk.html not found.\n" +
                "Run `npm run build` (or `npm run dev`) first to generate it."
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
    res.end(`Not found: ${url}\nOnly SourceDesk.html is served at this path.`);
}

// ─── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer(handler);

server.listen(PORT, "0.0.0.0", () => {
    const envLabel = env.ENVIRONMENT || "hosted";
    const llmUrl   = env.LOCAL_LLM_URL || "http://localhost:11434/v1";
    const model    = env.LOCAL_LLM_DEFAULT_MODEL || "(not set)";

    console.log("");
    console.log("  SourceDesk");
    console.log("  ──────────────────────────────────────────");
    console.log(`  URL:         http://localhost:${PORT}`);
    console.log(`  Environment: ${envLabel}`);
    console.log(`  Local LLM:   ${llmUrl}`);
    console.log(`  Default model: ${model}`);
    console.log("  ──────────────────────────────────────────");
    console.log("  Ctrl+C to stop");
    console.log("");
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
