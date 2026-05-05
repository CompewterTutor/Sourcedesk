#!/usr/bin/env node
// ─── SourceDesk DB migration runner ──────────────────────────────────────────
// Usage:
//   node scripts/migrate.js          (reads DATABASE_URL from .env)
//   DATABASE_URL=sqlite:./data/sourcedesk.db  node scripts/migrate.js
//
// The server also runs migrations automatically on startup, so you only need
// this script if you want to apply migrations in a pipeline or CI without
// starting the full server.

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Inline .env loader (same logic as server.js) ────────────────────────────
function loadEnv(envPath) {
  const result = {};
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      result[key] = val;
    }
  } catch {
    // .env not found — fall through
  }
  return result;
}

const ENV_FILE = path.join(__dirname, '..', '.env');
const env      = loadEnv(ENV_FILE);

const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error(
    'Error: DATABASE_URL is not set.\n' +
    'Set it in .env (e.g. DATABASE_URL=sqlite:./data/sourcedesk.db) or pass it as an environment variable.'
  );
  process.exit(1);
}

const { createDb }     = require('../server/db');
const MIGRATIONS_DIR   = path.join(__dirname, '..', 'migrations');

async function main() {
  console.log('SourceDesk — running DB migrations');
  console.log('  DATABASE_URL: ' + DATABASE_URL.replace(/:([^:@]+)@/, ':***@')); // mask password

  let db;
  try {
    db = createDb(DATABASE_URL);
  } catch (e) {
    console.error('Failed to open database:', e.message);
    process.exit(1);
  }

  try {
    const applied = await db.runMigrations(MIGRATIONS_DIR);
    if (applied.length === 0) {
      console.log('  No new migrations to apply. Database is up to date.');
    } else {
      console.log('  Applied ' + applied.length + ' migration(s):');
      applied.forEach(function(f) { console.log('    + ' + f); });
    }
  } catch (e) {
    console.error('Migration failed:', e.message);
    await db.close().catch(function() {});
    process.exit(1);
  }

  await db.close();
  console.log('  Done.');
}

main();
