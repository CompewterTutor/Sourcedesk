#!/usr/bin/env node
// ─── SourceDesk DB abstraction ────────────────────────────────────────────────
// Supports SQLite (via better-sqlite3) and PostgreSQL (via pg).
// Both packages are optional — the server falls back to file-based storage if
// neither DATABASE_URL is set nor the required package is installed.
//
// Usage:
//   const { createDb } = require('./server/db');
//   const db = createDb('sqlite:./data/sourcedesk.db');
//
// db interface:
//   db.run(sql, params)   → Promise<{lastID, changes}>
//   db.get(sql, params)   → Promise<row | undefined>
//   db.all(sql, params)   → Promise<row[]>
//   db.exec(sql)          → Promise<void>   (multi-statement, no params)
//   db.close()            → Promise<void>
//   db.type               → 'sqlite' | 'postgres'
//   db.runMigrations(dir) → Promise<string[]>   newly applied filenames

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────────────────────────────────────

function createDb(url) {
  if (!url) throw new Error('createDb: DATABASE_URL is required');

  if (url.startsWith('sqlite:') || url.startsWith('file:')) {
    return _createSqliteDb(url);
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return _createPostgresDb(url);
  }
  throw new Error(
    'createDb: unknown URL scheme "' + url.split(':')[0] + '". Use sqlite: or postgres://'
  );
}

module.exports = { createDb };

// ─────────────────────────────────────────────────────────────────────────────
// SQLite backend (better-sqlite3, synchronous API wrapped in Promises)
// ─────────────────────────────────────────────────────────────────────────────

function _createSqliteDb(url) {
  // Strip scheme prefix: "sqlite:./foo.db" → "./foo.db", "file:///abs" → "/abs"
  let filePath = url
    .replace(/^sqlite:\/\/\//, '/')    // sqlite:///abs/path
    .replace(/^sqlite:\/\//, '')       // sqlite://relative (unusual but handle it)
    .replace(/^sqlite:/, '')           // sqlite:./relative
    .replace(/^file:\/\/\//, '/')      // file:///abs/path
    .replace(/^file:\/\//, '')         // file://relative
    .replace(/^file:/, '');            // file:./relative

  // Resolve relative to process.cwd()
  if (!path.isAbsolute(filePath)) filePath = path.resolve(process.cwd(), filePath);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    throw new Error(
      'better-sqlite3 is not installed. Run: npm install better-sqlite3\n' +
      '(Original error: ' + e.message + ')'
    );
  }

  const sqlite = new Database(filePath);
  // WAL mode: better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  function _spread(params) {
    // better-sqlite3 stmt.run/get/all accept spread positional args or a named object
    if (!params || (Array.isArray(params) && params.length === 0)) return [];
    if (Array.isArray(params)) return params;
    return [params]; // named-param object
  }

  const db = {
    type: 'sqlite',

    run(sql, params = []) {
      try {
        const stmt = sqlite.prepare(sql);
        const r = Array.isArray(params)
          ? stmt.run(...params)
          : stmt.run(params);
        return Promise.resolve({ lastID: r.lastInsertRowid, changes: r.changes });
      } catch (e) {
        return Promise.reject(e);
      }
    },

    get(sql, params = []) {
      try {
        const stmt = sqlite.prepare(sql);
        const row = Array.isArray(params)
          ? stmt.get(...params)
          : stmt.get(params);
        return Promise.resolve(row);
      } catch (e) {
        return Promise.reject(e);
      }
    },

    all(sql, params = []) {
      try {
        const stmt = sqlite.prepare(sql);
        const rows = Array.isArray(params)
          ? stmt.all(...params)
          : stmt.all(params);
        return Promise.resolve(rows);
      } catch (e) {
        return Promise.reject(e);
      }
    },

    exec(sql) {
      try {
        sqlite.exec(sql);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },

    close() {
      try {
        sqlite.close();
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },

    runMigrations(migrationsDir) {
      return _runMigrations(db, migrationsDir);
    },
  };

  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL backend (pg, async)
// ─────────────────────────────────────────────────────────────────────────────

function _createPostgresDb(url) {
  let Pool;
  try {
    Pool = require('pg').Pool;
  } catch (e) {
    throw new Error(
      'pg is not installed. Run: npm install pg\n' +
      '(Original error: ' + e.message + ')'
    );
  }

  const pool = new Pool({ connectionString: url });

  const db = {
    type: 'postgres',

    async run(sql, params = []) {
      // Convert SQLite ? placeholders to $1, $2, ...
      let pgSql = sql;
      let i = 0;
      pgSql = pgSql.replace(/\?/g, function() { return '$' + (++i); });
      const r = await pool.query(pgSql, params);
      return { lastID: (r.rows[0] && r.rows[0].id) || null, changes: r.rowCount };
    },

    async get(sql, params = []) {
      let pgSql = sql;
      let i = 0;
      pgSql = pgSql.replace(/\?/g, function() { return '$' + (++i); });
      const r = await pool.query(pgSql, params);
      return r.rows[0];
    },

    async all(sql, params = []) {
      let pgSql = sql;
      let i = 0;
      pgSql = pgSql.replace(/\?/g, function() { return '$' + (++i); });
      const r = await pool.query(pgSql, params);
      return r.rows;
    },

    async exec(sql) {
      // Split on semicolons, filter empty, run each statement individually
      const stmts = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^--/));
      for (const stmt of stmts) {
        await pool.query(stmt);
      }
    },

    close() {
      return pool.end();
    },

    runMigrations(migrationsDir) {
      return _runMigrations(db, migrationsDir);
    },
  };

  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrations runner (shared by both backends)
// ─────────────────────────────────────────────────────────────────────────────

async function _runMigrations(db, migrationsDir) {
  // Ensure the schema_migrations table exists
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
    '  version TEXT PRIMARY KEY,' +
    '  applied_at TEXT NOT NULL' +
    ')'
  );

  // Read all .sql files, sorted by name
  let files;
  try {
    files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (e) {
    // migrations dir doesn't exist — nothing to apply
    return [];
  }

  const applied = [];
  for (const file of files) {
    // Check if already applied
    const existing = await db.get(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [file]
    );
    if (existing) continue; // skip

    // Apply the migration
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);

    // Record it
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [file, now]
    );
    applied.push(file);
  }

  return applied;
}
