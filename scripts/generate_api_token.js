#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function usage() {
  console.log(
    'Usage: node scripts/generate_api_token.js --user user@example.com [--label "Label"]\n' +
      "\n" +
      "Options:\n" +
      "  --user, -u   <email>   (required) email address to associate with this token\n" +
      "  --label, -l  <label>   (optional) human-readable label for the token\n" +
      "\n" +
      "If DATABASE_URL is configured in .env, the token is also persisted to the DB.\n" +
      "The file .private-documents/api_tokens.json is always written regardless.",
  );
  process.exit(1);
}

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let user = null;
let label = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if ((a === "--user" || a === "-u") && args[i + 1]) {
    user = args[++i];
  } else if ((a === "--label" || a === "-l") && args[i + 1]) {
    label = args[++i];
  } else if (a === "--help" || a === "-h") {
    usage();
  }
}
if (!user) usage();

// ─── Inline .env loader ───────────────────────────────────────────────────────
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
    /* .env not found — use defaults */
  }
  return result;
}

const env = loadEnv(path.join(__dirname, "..", ".env"));
const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL || "";

// ─── Generate token ───────────────────────────────────────────────────────────
const token = crypto.randomBytes(24).toString("hex");
const now = new Date().toISOString();

// ─── File-based storage (always) ─────────────────────────────────────────────
const privateDir = path.join(__dirname, "..", ".private-documents");
fs.mkdirSync(privateDir, { recursive: true });
const tokensFile = path.join(privateDir, "api_tokens.json");

let tokens = {};
try {
  tokens = JSON.parse(fs.readFileSync(tokensFile, "utf8")) || {};
} catch {
  tokens = {};
}

tokens[token] = { user, label: label || null, createdAt: now };
fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2), "utf8");

console.log("API token generated: " + token);
console.log("Saved to file:       " + tokensFile);
console.log("Mapped to user:      " + user);
if (label) console.log("Label:               " + label);

// ─── DB-backed storage (optional — only if DATABASE_URL is configured) ────────
if (!DATABASE_URL) {
  console.log(
    "\nTip: set DATABASE_URL in .env to also persist tokens to your database.",
  );
  process.exit(0);
}

async function persistToDb() {
  const { createDb } = require("../server/db");
  const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

  let db;
  try {
    db = createDb(DATABASE_URL);
  } catch (e) {
    console.error("\nWarning: could not open database (" + e.message + ")");
    console.error("Token was saved to file only.");
    return;
  }

  // Run migrations to ensure tables exist
  try {
    await db.runMigrations(MIGRATIONS_DIR);
  } catch (e) {
    console.error("\nWarning: migration failed (" + e.message + ")");
  }

  // Find or create user
  let userId;
  try {
    const existing = await db.get("SELECT id FROM users WHERE email = ?", [
      user,
    ]);
    if (existing) {
      userId = existing.id;
    } else {
      userId =
        now.replace(/\D/g, "").slice(0, 14) +
        "_" +
        crypto.randomBytes(3).toString("hex");
      await db.run(
        "INSERT INTO users (id, email, label, created_at) VALUES (?, ?, ?, ?)",
        [userId, user, label || null, now],
      );
    }
  } catch (e) {
    console.error("\nWarning: could not create user in DB (" + e.message + ")");
    await db.close().catch(() => {});
    return;
  }

  // Insert token
  try {
    const tokenId =
      now.replace(/\D/g, "").slice(0, 14) +
      "_" +
      crypto.randomBytes(3).toString("hex");
    await db.run(
      "INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)",
      [tokenId, userId, token, label || null, now],
    );
    console.log(
      "Also saved to DB:    " + DATABASE_URL.replace(/:([^:@]+)@/, ":***@"),
    );
  } catch (e) {
    console.error(
      "\nWarning: could not insert token into DB (" + e.message + ")",
    );
  }

  await db.close().catch(() => {});
}

persistToDb().catch((e) => {
  console.error("DB error:", e.message);
});
