#!/usr/bin/env node
/**
 * rfp-source-finder.js
 *
 * Takes a BidNet Q&A CSV export (from the SourceDesk Chrome extension) and an
 * RFP markdown file, runs each answered question through a local LLM to
 * identify which section of the RFP the answer comes from, and writes a
 * three-column CSV:  question_number, answer, source
 *
 * Usage:
 *   node scripts/rfp-source-finder.js --qa bidnet-qa-export.csv --rfp rfp.md
 *   node scripts/rfp-source-finder.js --qa qa.csv --rfp rfp.md --out results.csv \
 *     --url http://localhost:1234/v1 --model google/gemma-4-26b-a4b --top 5
 *
 * Options:
 *   --qa     <file>   BidNet CSV export (required)
 *                     Expected columns: question_number, question, answer
 *   --rfp    <file>   RFP markdown file (required)
 *   --out    <file>   Output CSV path   (default: rfp-sources.csv)
 *   --url    <url>    LM Studio / OpenAI-compat base URL
 *                     (default: $LOCAL_LLM_URL or http://localhost:1234/v1)
 *   --model  <id>     Model identifier
 *                     (default: $LLM_MODEL or google/gemma-4-26b-a4b)
 *   --top    <n>      Top-N RFP sections to include as context per question
 *                     (default: 4)
 *   --skip-empty      Skip rows with no answer instead of writing a blank source
 *
 * No npm dependencies — uses only Node.js built-in modules.
 */

'use strict';

const fs    = require('fs');
const http  = require('http');
const https = require('https');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const ARGS = (() => {
  const a = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = a.indexOf(flag);
    return (i !== -1 && a[i + 1] !== undefined) ? a[i + 1] : fallback;
  };
  return {
    qa:        get('--qa',    null),
    rfp:       get('--rfp',   null),
    out:       get('--out',   'rfp-sources.csv'),
    url:       get('--url',   process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1'),
    model:     get('--model', process.env.LLM_MODEL     || 'google/gemma-4-26b-a4b'),
    top:       parseInt(get('--top', '4'), 10),
    skipEmpty: a.includes('--skip-empty'),
  };
})();

if (!ARGS.qa || !ARGS.rfp) {
  console.error([
    'Usage: node scripts/rfp-source-finder.js --qa <file.csv> --rfp <file.md>',
    '       [--out results.csv] [--url http://localhost:1234/v1]',
    '       [--model google/gemma-4-26b-a4b] [--top 4] [--skip-empty]',
  ].join('\n'));
  process.exit(1);
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
// Handles quoted fields, embedded commas, embedded newlines, "" escapes.

function parseCSV(text) {
  const rows   = [];
  let   row    = [];
  let   field  = '';
  let   quoted = false;

  // normalise line endings
  const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < chars.length; i++) {
    const ch   = chars[i];
    const next = chars[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') { field += '"'; i++; }  // escaped "
      else if (ch === '"')            { quoted = false; }
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { quoted = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else                  { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));  // drop blank rows
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

// ─── RFP section parser ───────────────────────────────────────────────────────
// Splits markdown into sections by headings (# through ####).
// Builds a hierarchy path like "2. Scope of Work > 2.3 Deliverables".

function parseRFPSections(markdown) {
  const lines    = markdown.split('\n');
  const sections = [];
  let   current  = null;

  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)/);
    if (m) {
      if (current) sections.push(current);
      current = {
        heading:  m[2].trim(),
        level:    m[1].length,
        content:  '',
        fullPath: m[2].trim(),   // filled in next pass
      };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push(current);

  // Build hierarchy path: each section gets "Parent Heading > Child Heading"
  const stack = [];   // [ { level, heading } ]
  for (const sec of sections) {
    while (stack.length && stack[stack.length - 1].level >= sec.level) stack.pop();
    stack.push({ level: sec.level, heading: sec.heading });
    sec.fullPath = stack.map(s => s.heading).join(' > ');
  }

  return sections;
}

// ─── Section scoring (keyword overlap) ───────────────────────────────────────
// Scores each RFP section by how many unique query words appear in it.
// Fast enough for a 100-section RFP; no external deps needed.

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Build a per-section token set once, then reuse for all queries
function buildSectionIndex(sections) {
  return sections.map(sec => ({
    sec,
    tokens: new Set(tokenize(sec.heading + ' ' + sec.content)),
  }));
}

function topSections(queryText, index, n) {
  const qTokens = tokenize(queryText);
  const scored  = index.map(({ sec, tokens }) => {
    let hits = 0;
    for (const t of qTokens) if (tokens.has(t)) hits++;
    return { sec, score: hits };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).filter(x => x.score > 0).map(x => x.sec);
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + (u.search || ''),
      method:   'POST',
      headers:  { ...headers, 'content-length': Buffer.byteLength(body) },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(180_000, () => req.destroy(new Error('LLM request timed out (180 s)')));
    req.write(body);
    req.end();
  });
}

async function askLLM(systemPrompt, userPrompt, attempt) {
  const url  = ARGS.url.replace(/\/+$/, '') + '/chat/completions';
  const body = JSON.stringify({
    model:       ARGS.model,
    stream:      false,
    max_tokens:  200,
    temperature: 0,   // deterministic — we want a precise section name
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  });

  const resp = await httpPost(url, { 'content-type': 'application/json' }, body);

  if (resp.status !== 200) {
    throw new Error(`HTTP ${resp.status}: ${resp.text.slice(0, 300)}`);
  }

  let parsed;
  try { parsed = JSON.parse(resp.text); }
  catch (e) { throw new Error(`JSON parse error: ${e.message} — ${resp.text.slice(0, 200)}`); }

  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Unexpected response shape: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  return content.trim();
}

// ─── CSV writer ───────────────────────────────────────────────────────────────

function csvEscape(val) {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function writeCSV(path, rows) {
  const header = ['question_number', 'answer', 'source'].map(csvEscape).join(',');
  const lines  = [
    header,
    ...rows.map(r => [r.question_number, r.answer, r.source].map(csvEscape).join(',')),
  ];
  fs.writeFileSync(path, lines.join('\r\n') + '\r\n', 'utf8');
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function progress(done, total, label) {
  const pct  = Math.round((done / total) * 100);
  const bar  = '█'.repeat(Math.floor(pct / 4)) + '░'.repeat(25 - Math.floor(pct / 4));
  process.stdout.write(`\r[${bar}] ${done}/${total}  ${label.slice(0, 50).padEnd(50)}`);
  if (done === total) process.stdout.write('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a precise procurement analyst. Given some RFP sections and a question-answer pair, \
identify which RFP section heading is the primary source or reference for the answer.

Rules:
- Respond with ONLY the exact section heading as it appears in the context — nothing else.
- Do not add punctuation, quotes, or explanation.
- If the answer references multiple sections, give the single most specific and relevant one.
- If no section matches at all, respond exactly: Unknown`;

async function main() {
  // ── Load inputs
  console.log(`[rfp-source-finder] Loading "${ARGS.qa}" and "${ARGS.rfp}"...`);

  if (!fs.existsSync(ARGS.qa))  { console.error(`File not found: ${ARGS.qa}`);  process.exit(1); }
  if (!fs.existsSync(ARGS.rfp)) { console.error(`File not found: ${ARGS.rfp}`); process.exit(1); }

  const qaText  = fs.readFileSync(ARGS.qa,  'utf8');
  const rfpText = fs.readFileSync(ARGS.rfp, 'utf8');

  // ── Parse
  const rows     = csvToObjects(qaText);
  const sections = parseRFPSections(rfpText);
  const index    = buildSectionIndex(sections);

  const answeredRows = ARGS.skipEmpty
    ? rows.filter(r => (r.answer || r.answer_text || '').trim())
    : rows;

  console.log(`[rfp-source-finder] ${answeredRows.length} Q&A rows | ${sections.length} RFP sections`);
  console.log(`[rfp-source-finder] LLM: ${ARGS.url}  model: ${ARGS.model}`);
  console.log(`[rfp-source-finder] Top-${ARGS.top} sections used as context per question`);

  if (sections.length === 0) {
    console.error('[rfp-source-finder] No sections found in RFP — make sure it uses markdown headings (## heading).');
    process.exit(1);
  }

  // ── Sanity-check the LLM is reachable before processing everything
  process.stdout.write('[rfp-source-finder] Testing LLM connection... ');
  try {
    await askLLM('Respond with the word OK.', 'Are you there?');
    console.log('OK');
  } catch (err) {
    console.error(`FAILED\n[rfp-source-finder] Cannot reach LLM at ${ARGS.url}: ${err.message}`);
    console.error('[rfp-source-finder] Check that LM Studio is running and set to listen on all interfaces (0.0.0.0).');
    process.exit(1);
  }

  // ── Process each row
  const results = [];
  let   done    = 0;

  for (const row of answeredRows) {
    // Flexible column name support — BidNet CSV, SourceDesk SQ export, etc.
    const qNum  = row.question_number || row.question_no || row['#'] || `Q${done + 1}`;
    const qText = row.question || row.question_text || '';
    const aText = row.answer   || row.answer_text   || '';

    done++;
    progress(done, answeredRows.length, qNum);

    if (!aText.trim()) {
      results.push({ question_number: qNum, answer: aText, source: '' });
      continue;
    }

    // Find most relevant RFP sections for this Q&A
    const query   = qText + ' ' + aText;
    const topSecs = topSections(query, index, ARGS.top);

    // Fall back to first N sections if nothing scored (e.g. heavily numeric content)
    const ctxSecs = topSecs.length > 0
      ? topSecs
      : sections.slice(0, ARGS.top);

    const ctxBlock = ctxSecs
      .map(s => `### ${s.fullPath}\n${s.content.slice(0, 700).trim()}`)
      .join('\n\n');

    const userPrompt = [
      '## Relevant RFP Sections',
      '',
      ctxBlock,
      '',
      '## Question',
      qNum + (qText ? ': ' + qText : ''),
      '',
      '## Answer',
      aText,
      '',
      'Which section heading above is the primary source for this answer?',
    ].join('\n');

    let source = 'Unknown';
    try {
      const raw = await askLLM(SYSTEM_PROMPT, userPrompt);
      // Strip any wrapping quotes, "Section:" prefixes, leading # markers
      source = raw
        .replace(/^["'`#*]+|["'`]+$/g, '')
        .replace(/^(section|reference|source|answer):\s*/i, '')
        .trim() || 'Unknown';
    } catch (err) {
      source = `ERROR: ${err.message.slice(0, 80)}`;
      process.stdout.write(`\n[rfp-source-finder] ${qNum}: ${source}\n`);
    }

    results.push({ question_number: qNum, answer: aText, source });
  }

  // ── Write output
  writeCSV(ARGS.out, results);
  console.log(`\n[rfp-source-finder] Done — ${results.length} rows written to: ${ARGS.out}`);

  // ── Quick summary
  const unknown = results.filter(r => r.source === 'Unknown' || r.source.startsWith('ERROR')).length;
  const sourced = results.length - unknown;
  console.log(`[rfp-source-finder] Sourced: ${sourced}  Unknown/error: ${unknown}`);
}

main().catch(err => {
  console.error('\n[rfp-source-finder] Fatal error:', err.message);
  process.exit(1);
});
