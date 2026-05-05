// ─── SourceDesk Hindsight memory adapter ──────────────────────────────────────
// Wraps @vectorize-io/hindsight-client with graceful no-ops when:
//   - HINDSIGHT_API_URL is not set in the environment
//   - @vectorize-io/hindsight-client is not installed (optionalDependency)
//
// All exported functions are safe to call unconditionally; they return
// sensible defaults (null / empty arrays) when Hindsight is unavailable.
//
// Usage:
//   const hindsight = require('./server/hindsight');
//   await hindsight.ensureBank(userId);
//   await hindsight.retainContent(userId, { content, documentId, tags });
//   const { memories } = await hindsight.recallForQuery(userId, { query, projectId });
//   const status = await hindsight.getStatus(userId);

'use strict';

// ─── Optional SDK load ────────────────────────────────────────────────────────
// @vectorize-io/hindsight-client is declared as an optionalDependency.
// If it is not installed the module still loads and all functions become no-ops.

let HindsightClient = null;
try {
  // Prefer the named export; fall back to the module default if needed.
  const pkg = require('@vectorize-io/hindsight-client');
  HindsightClient = pkg.HindsightClient || pkg.default || pkg;
  if (typeof HindsightClient !== 'function') HindsightClient = null;
} catch (_) {
  // SDK not installed — silently degrade
}

// ─── Procurement bank configuration ──────────────────────────────────────────
// Applied once to every newly created bank via updateBankConfig().
// Keys use camelCase as required by the Node.js SDK.

var PROCUREMENT_BANK_CONFIG = {
  retainMission:
    'Extract procurement decisions, vendor facts, pricing data, deadlines, ' +
    'key contacts, action items, commitments, and compliance requirements. ' +
    'Ignore greetings, small talk, and scheduling logistics.',
  observationsMission:
    'Identify recurring vendor patterns, budget trends, deadline patterns, and ' +
    'relationship dynamics. Flag when a vendor\'s reliability or pricing ' +
    'contradicts prior observations.',
  reflectMission:
    'You are an experienced procurement analyst with full context of this ' +
    'user\'s project history. Reference past decisions, vendor relationships, ' +
    'deadlines, and commitments when relevant. Be direct and concise.',
  dispositionSkepticism: 3,
  dispositionLiteralism: 4,
  dispositionEmpathy:    2,
  entityLabels: [
    {
      key:         'vendor',
      type:        'text',
      description: 'A vendor, supplier, or contractor mentioned in the conversation',
    },
    {
      key:    'project_type',
      type:   'value',
      tag:    true,
      values: [
        { value: 'rfp',      description: 'Request for Proposal'    },
        { value: 'rfi',      description: 'Request for Information'  },
        { value: 'vendor_q', description: 'Vendor Questionnaire'     },
        { value: 'contract', description: 'Contract or agreement'    },
        { value: 'research', description: 'Research or analysis'     },
      ],
    },
    {
      key:         'deadline',
      type:        'text',
      description: 'A date, deadline, or timeline mentioned',
    },
  ],
};

// ─── Internal client cache ────────────────────────────────────────────────────
// One HindsightClient instance per process; re-created if HINDSIGHT_API_URL changes.

var _client  = null;
var _baseUrl = null;

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Returns a live HindsightClient if HINDSIGHT_API_URL is set and the SDK is
 * installed, or null otherwise.
 *
 * @returns {object|null}
 */
function getClient() {
  var url = process.env.HINDSIGHT_API_URL;
  if (!url || !HindsightClient) return null;

  if (!_client || _baseUrl !== url) {
    _baseUrl = url;
    try {
      _client = new HindsightClient({ baseUrl: url });
    } catch (e) {
      console.warn('  [Hindsight] Failed to instantiate client:', e.message);
      _client = null;
    }
  }
  return _client;
}

/**
 * Idempotently ensures a Hindsight bank exists for userId and is configured
 * with the procurement domain config.
 *
 * - createBank() returning 409 (already exists) is silently ignored.
 * - All other errors are logged but never thrown.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function ensureBank(userId) {
  var client = getClient();
  if (!client || !userId) return;

  // Create bank — idempotent; 409 means it already exists
  try {
    await client.createBank(userId);
  } catch (e) {
    var is409 =
      (e && (e.status === 409 || e.statusCode === 409)) ||
      (e && typeof e.message === 'string' && /409|already exists/i.test(e.message));
    if (!is409) {
      console.warn('  [Hindsight] createBank failed for user ' + userId + ':', e.message);
    }
    // 409 → fall through and still apply config in case it was partially set up
  }

  // Apply / refresh the procurement config
  try {
    await client.updateBankConfig(userId, PROCUREMENT_BANK_CONFIG);
  } catch (e) {
    console.warn('  [Hindsight] updateBankConfig failed for user ' + userId + ':', e.message);
  }
}

/**
 * Stores content in the user's Hindsight bank using async (fire-and-forget) mode.
 * Returns immediately; retention happens in the background on the Hindsight server.
 *
 * @param {string} userId
 * @param {{ content: string, documentId?: string, context?: string, tags?: string[] }} opts
 * @returns {Promise<void>}
 */
async function retainContent(userId, opts) {
  var client = getClient();
  if (!client || !userId) return;

  var content = opts && opts.content;
  if (!content || typeof content !== 'string' || !content.trim()) return;

  var retainOpts = { async: true };
  if (opts.documentId)                               retainOpts.documentId = opts.documentId;
  if (opts.context)                                  retainOpts.context    = opts.context;
  if (Array.isArray(opts.tags) && opts.tags.length)  retainOpts.tags       = opts.tags;

  try {
    await client.retain(userId, content, retainOpts);
  } catch (e) {
    console.warn('  [Hindsight] retain failed for user ' + userId + ':', e.message);
  }
}

/**
 * Recalls memories relevant to a query, optionally scoped to a specific project.
 *
 * When projectId is provided, recall uses tags: ['project:<projectId>'] with
 * tagsMatch: 'any_strict' so that untagged memories from other projects are
 * excluded (unlike 'any', which would also return untagged memories).
 *
 * @param {string} userId
 * @param {{ query: string, projectId?: string, budget?: number }} opts
 * @returns {Promise<{ memories: string[], raw: object[] } | null>}
 */
async function recallForQuery(userId, opts) {
  var client = getClient();
  if (!client || !userId) return null;

  var query = opts && opts.query;
  if (!query || typeof query !== 'string' || !query.trim()) return null;

  var budget = (opts && opts.budget) || 2000;

  var recallOpts = {
    budget:    budget,
    maxTokens: budget,
  };

  // Project-scoped recall: any_strict ensures untagged memories are excluded
  if (opts && opts.projectId) {
    recallOpts.tags      = ['project:' + opts.projectId];
    recallOpts.tagsMatch = 'any_strict';
  }

  try {
    var result = await client.recall(userId, query, recallOpts);
    var items  = (result && result.results) || [];
    var memories = items
      .map(function(item) { return item && (item.text || item.content || ''); })
      .filter(function(t) { return typeof t === 'string' && t.trim().length > 0; });
    return { memories: memories, raw: items };
  } catch (e) {
    console.warn('  [Hindsight] recall failed for user ' + userId + ':', e.message);
    return null;
  }
}

/**
 * Returns a status object indicating whether Hindsight is available and
 * whether a bank already exists for the given user.
 *
 * Uses listMemories({ limit: 1 }) as a lightweight probe:
 *   - Success                → bankExists: true
 *   - 404 / "not found"      → bankExists: false  (available: true)
 *   - Network / other error  → available: false
 *
 * @param {string} userId
 * @returns {Promise<{ available: boolean, configured: boolean, bankExists: boolean, memoryCount: number|null }>}
 */
async function getStatus(userId) {
  var configured = !!(process.env.HINDSIGHT_API_URL && HindsightClient);

  if (!configured) {
    return { available: false, configured: false, bankExists: false, memoryCount: null };
  }

  var client = getClient();
  if (!client) {
    return { available: false, configured: true, bankExists: false, memoryCount: null };
  }

  try {
    await client.listMemories(userId, { limit: 1 });
    return { available: true, configured: true, bankExists: true, memoryCount: null };
  } catch (e) {
    var is404 =
      (e && (e.status === 404 || e.statusCode === 404)) ||
      (e && typeof e.message === 'string' && /404|not found/i.test(e.message));
    if (is404) {
      return { available: true, configured: true, bankExists: false, memoryCount: null };
    }
    console.warn('  [Hindsight] listMemories probe failed for user ' + userId + ':', e.message);
    return { available: false, configured: true, bankExists: false, memoryCount: null };
  }
}

module.exports = { getClient, ensureBank, retainContent, recallForQuery, getStatus };
