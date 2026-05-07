'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════════════════════ */
let csvData           = [];   // parsed CSV rows
let pageQuestions     = [];   // questions scraped from page
let selectedIds       = new Set();  // checked question IDs in table
let filling           = false;      // true while batch fill is running
let fillStopFlag      = false;      // set true to abort fill loop
let filteredQuestions = [];         // questions visible after search filter

const MODULE_BADGES = {
  bidnet:      'BIDNET',
  sourcedesk:  'SOURCEDESK',
  settings:    'SETTINGS',
};

/* ═══════════════════════════════════════════════════════════════════════
   TAB SWITCHING
════════════════════════════════════════════════════════════════════════ */
function switchTab(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');

  const btn = document.querySelector('.tab-btn[data-view="' + viewName + '"]');
  if (btn) btn.classList.add('active');

  const badge = document.getElementById('module-badge');
  if (badge) badge.textContent = MODULE_BADGES[viewName] || viewName.toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════
   CARD COLLAPSE / EXPAND
════════════════════════════════════════════════════════════════════════ */
function toggleCard(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('collapsed');
}

/* ═══════════════════════════════════════════════════════════════════════
   LOGGING
════════════════════════════════════════════════════════════════════════ */
const MAX_LOG_ENTRIES = 20;

function appendLog(text, type) {
  // type: 'success' | 'error' | 'info' (default)
  const logEl = document.getElementById('log-output');
  if (!logEl) return;

  const level = type || 'info';
  const now   = new Date();
  const ts    = now.toTimeString().slice(0, 8);

  const entry = document.createElement('span');
  entry.className = 'log-entry log-' + level;
  entry.innerHTML = '<span class="log-ts">' + ts + '</span>' + escHtml(String(text));
  logEl.appendChild(document.createElement('br'));
  logEl.appendChild(entry);

  // Trim old entries (each entry is 2 nodes: <br> + <span>)
  while (logEl.childNodes.length > MAX_LOG_ENTRIES * 2 + 2) {
    logEl.removeChild(logEl.firstChild);
    if (logEl.firstChild) logEl.removeChild(logEl.firstChild);
  }

  logEl.scrollTop = logEl.scrollHeight;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════════════════════
   PROGRESS BAR
════════════════════════════════════════════════════════════════════════ */
function showProgress() {
  const wrap = document.getElementById('progress-wrap');
  if (wrap) wrap.classList.add('visible');
}

function hideProgress() {
  const wrap = document.getElementById('progress-wrap');
  if (wrap) wrap.classList.remove('visible');
  updateProgress(0, 0, '');
}

function updateProgress(current, total, label) {
  const lbl  = document.getElementById('progress-label');
  const fill = document.getElementById('progress-bar-fill');
  if (!lbl || !fill) return;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  lbl.textContent  = label ? (current + ' / ' + total + ' — ' + label) : (current + ' / ' + total);
  fill.style.width = pct + '%';
}

/* ═══════════════════════════════════════════════════════════════════════
   ACTIVE TAB HELPER
════════════════════════════════════════════════════════════════════════ */
async function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!tabs || tabs.length === 0) return reject(new Error('No active tab found'));
      resolve(tabs[0]);
    });
  });
}

async function sendToContentScript(message) {
  const tab = await getActiveTab();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION A — PAGE CONTROLS
════════════════════════════════════════════════════════════════════════ */
async function sendLoadAllQuestions() {
  const btn = document.getElementById('btn-load-all');
  btn.disabled = true;
  appendLog('Sending load-all-questions command…', 'info');
  try {
    const resp = await sendToContentScript({ action: 'loadAllQuestions' });
    appendLog(resp && resp.ok ? 'Page redirected to show all questions.' : 'Command sent.', 'success');
  } catch (err) {
    appendLog('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function sendExtractQA() {
  const btn = document.getElementById('btn-extract-qa');
  btn.disabled = true;
  appendLog('Extracting Q&A from page…', 'info');
  try {
    const resp = await sendToContentScript({ action: 'extractQA' });
    if (resp && resp.ok) {
      appendLog('Extracted ' + (resp.data ? resp.data.length : 0) + ' rows. CSV download triggered.', 'success');
      if (resp.data && resp.data.length > 0) handleExtractedQA(resp.data);
    } else {
      appendLog('Extract returned no data.', 'error');
    }
  } catch (err) {
    appendLog('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION B — CSV LOADING
════════════════════════════════════════════════════════════════════════ */
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('csv-dropzone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('csv-dropzone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('csv-dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processCSVFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processCSVFile(file);
}

function processCSVFile(file) {
  appendLog('Loading CSV: ' + file.name, 'info');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      csvData = parseCSV(e.target.result);
      appendLog('Loaded ' + csvData.length + ' rows from CSV.', 'success');
      renderCSVPreview();
      // Re-render questions table to show CSV match column
      if (pageQuestions.length > 0) renderQuestionsTable(pageQuestions);
    } catch (err) {
      appendLog('CSV parse error: ' + err.message, 'error');
    }
  };
  reader.onerror = () => appendLog('Failed to read file.', 'error');
  reader.readAsText(file);
}

/**
 * Parse CSV text into array of objects.
 * Expected columns: question_number, answer, visibility, comment
 * Handles quoted fields, blank lines.
 */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];

  // Tokenise a single CSV line, handling quoted fields
  function tokeniseLine(line) {
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') { field += '"'; i += 2; } // escaped quote
            else { i++; break; } // closing quote
          } else {
            field += line[i++];
          }
        }
        fields.push(field);
        if (line[i] === ',') i++; // skip comma separator
      } else {
        // Unquoted field
        const end = line.indexOf(',', i);
        if (end === -1) {
          fields.push(line.slice(i).trim());
          break;
        } else {
          fields.push(line.slice(i, end).trim());
          i = end + 1;
        }
      }
    }
    return fields;
  }

  if (lines.length < 2) throw new Error('CSV has fewer than 2 lines');

  // Parse header
  const headers = tokeniseLine(lines[0]).map(h => h.toLowerCase().trim());

  // Find column indices (flexible — tolerate extra columns)
  const colIdx = {
    question_number: headers.indexOf('question_number'),
    answer:          headers.indexOf('answer'),
    visibility:      headers.indexOf('visibility'),
    comment:         headers.indexOf('comment'),
  };
  // Fallback: positional if names don't match
  if (colIdx.question_number === -1) colIdx.question_number = 0;
  if (colIdx.answer === -1)          colIdx.answer = 1;
  if (colIdx.visibility === -1)      colIdx.visibility = 2;
  if (colIdx.comment === -1)         colIdx.comment = 3;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines
    const fields = tokeniseLine(lines[i]);
    const row = {
      question_number: (fields[colIdx.question_number] || '').trim(),
      answer:          (fields[colIdx.answer]          || '').trim(),
      visibility:      (fields[colIdx.visibility]      || '').trim().toLowerCase(),
      comment:         (fields[colIdx.comment]         || '').trim(),
    };
    if (row.question_number) rows.push(row);
  }

  return rows;
}

function renderCSVPreview() {
  const wrap  = document.getElementById('csv-preview-wrap');
  const tbody = document.getElementById('csv-preview-tbody');
  const badge = document.getElementById('csv-count-badge');

  wrap.classList.add('visible');
  badge.textContent = csvData.length + ' rows';
  tbody.innerHTML = '';

  const preview = csvData.slice(0, 5);
  preview.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="mono">' + escHtml(String(idx + 1)) + '</td>' +
      '<td class="mono">' + escHtml(row.question_number) + '</td>' +
      '<td>' + escHtml(truncate(row.answer, 40)) + '</td>' +
      '<td><span class="badge ' + (row.visibility === 'private' ? '' : 'badge-success') + '">' +
        escHtml(row.visibility || 'public') + '</span></td>' +
      '<td>' + escHtml(truncate(row.comment, 30)) + '</td>';
    tbody.appendChild(tr);
  });
}

function clearCsvData() {
  csvData = [];
  document.getElementById('csv-preview-wrap').classList.remove('visible');
  document.getElementById('csv-preview-tbody').innerHTML = '';
  document.getElementById('csv-file-input').value = '';
  appendLog('CSV data cleared.', 'info');
  if (pageQuestions.length > 0) renderQuestionsTable(pageQuestions);
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION C — BATCH OPERATIONS
════════════════════════════════════════════════════════════════════════ */

/* ── Fill Answers ──────────────────────────────────────────────────── */
async function startFilling() {
  if (filling) return;
  if (csvData.length === 0) {
    appendLog('No CSV data loaded. Load a CSV first.', 'error');
    return;
  }

  const useUI       = document.getElementById('chk-use-ui').checked;
  const overrideVis = document.getElementById('chk-override-vis').checked;
  const defaultVis  = document.getElementById('sel-default-vis').value;
  const delay       = parseInt(document.getElementById('inp-delay').value, 10) || 800;

  filling      = true;
  fillStopFlag = false;

  document.getElementById('btn-start-fill').disabled = true;
  showProgress();

  appendLog('Starting fill: ' + csvData.length + ' rows, delay=' + delay + 'ms', 'info');

  for (let i = 0; i < csvData.length; i++) {
    if (fillStopFlag) {
      appendLog('Fill stopped by user at row ' + (i + 1) + '.', 'info');
      break;
    }

    const row = csvData[i];
    const vis = overrideVis && row.visibility ? row.visibility : defaultVis;

    updateProgress(i + 1, csvData.length, 'Q#' + row.question_number);

    try {
      const resp = await sendToContentScript({
        action: 'fillAnswer',
        payload: {
          questionId:  row.question_number,
          answer:      row.answer,
          visibility:  vis,
          comment:     row.comment,
          useUI:       useUI,
          delay:       delay,
        },
      });
      if (resp && resp.ok) {
        appendLog('Q#' + row.question_number + ' filled ✓', 'success');
      } else {
        appendLog('Q#' + row.question_number + ' — ' + (resp && resp.error ? resp.error : 'unknown error'), 'error');
      }
    } catch (err) {
      appendLog('Q#' + row.question_number + ' error: ' + err.message, 'error');
    }

    if (i < csvData.length - 1 && !fillStopFlag) {
      await sleep(delay);
    }
  }

  filling      = false;
  fillStopFlag = false;
  document.getElementById('btn-start-fill').disabled = false;
  hideProgress();
  appendLog('Fill operation complete.', 'success');
}

function stopFilling() {
  fillStopFlag = true;
  appendLog('Stop requested — will halt after current row.', 'info');
}

/* ── Batch Visibility ──────────────────────────────────────────────── */
async function applyBatchVisibility() {
  if (selectedIds.size === 0) {
    appendLog('No questions selected. Use checkboxes in the table.', 'error');
    return;
  }
  const vis = document.querySelector('input[name="batch-vis"]:checked').value;
  const ids = Array.from(selectedIds);
  appendLog('Batch visibility: ' + vis + ' for ' + ids.length + ' questions…', 'info');
  try {
    const resp = await sendToContentScript({
      action:  'batchVisibility',
      payload: { questionIds: ids, visibility: vis },
    });
    if (resp && resp.ok) {
      appendLog('Batch visibility complete.', 'success');
    } else {
      appendLog('Batch visibility error: ' + (resp && resp.error ? resp.error : 'unknown'), 'error');
    }
  } catch (err) {
    appendLog('Error: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION D — QUESTIONS TABLE
════════════════════════════════════════════════════════════════════════ */
async function refreshQuestionsFromPage() {
  const btn = document.getElementById('btn-refresh-questions');
  btn.disabled = true;

  const container = document.getElementById('questions-table-container');
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span>Loading…</div>';
  appendLog('Fetching questions from page…', 'info');

  try {
    const resp = await sendToContentScript({ action: 'getPageQuestions' });
    if (resp && resp.ok && Array.isArray(resp.questions)) {
      pageQuestions = resp.questions;
      renderQuestionsTable(pageQuestions);
      appendLog('Loaded ' + pageQuestions.length + ' questions.', 'success');
    } else {
      container.innerHTML = '<div class="empty-state">No questions found on this page.</div>';
      appendLog('No questions returned.', 'error');
    }
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Error loading questions.</div>';
    appendLog('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/**
 * Render the questions table.
 * questions: [{id, number, text, answered, visibility}]
 */
function renderQuestionsTable(questions) {
  pageQuestions     = questions;
  filteredQuestions = questions;

  const searchVal = (document.getElementById('question-search').value || '').toLowerCase();
  if (searchVal) {
    filteredQuestions = questions.filter(q =>
      (q.text || '').toLowerCase().includes(searchVal) ||
      String(q.number || '').includes(searchVal)
    );
  }

  const container = document.getElementById('questions-table-container');
  const badge     = document.getElementById('questions-count-badge');
  badge.textContent = filteredQuestions.length;

  if (filteredQuestions.length === 0) {
    container.innerHTML = '<div class="empty-state">No questions match the filter.</div>';
    return;
  }

  // Build CSV lookup map: question_number → row
  const csvMap = {};
  csvData.forEach(row => { csvMap[String(row.question_number).trim()] = row; });

  const table  = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr>' +
    '<th>☐</th><th>#</th><th>Question</th><th>Status</th><th>Vis</th><th>CSV</th><th></th>' +
    '</tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  filteredQuestions.forEach((q) => {
    const qid     = String(q.id || q.number || '');
    const qnum    = String(q.number || '');
    const checked = selectedIds.has(qid);
    const inCsv   = csvMap[qnum] !== undefined;

    const visIcon = q.visibility === 'private'
      ? '<span class="vis-icon-private" title="Private">🔒</span>'
      : '<span class="vis-icon-public"  title="Public">🔓</span>';
    const csvMatch = inCsv
      ? '<span class="csv-match-yes">✓</span>'
      : '<span class="csv-match-no">—</span>';
    const statusEl = q.answered
      ? '<span class="status-answered">Answered</span>'
      : '<span class="status-open">Open</span>';

    const tr = document.createElement('tr');
    if (checked) tr.classList.add('selected');
    tr.dataset.qid = qid;

    // Build cells without inline event attributes
    tr.innerHTML =
      '<td><input type="checkbox"' + (checked ? ' checked' : '') + ' /></td>' +
      '<td class="mono">' + escHtml(qnum) + '</td>' +
      '<td>' + escHtml(truncate(q.text || '', 45)) + '</td>' +
      '<td>' + statusEl + '</td>' +
      '<td>' + visIcon + '</td>' +
      '<td>' + csvMatch + '</td>' +
      '<td><button class="btn btn-sm" title="Go to answer page">Go</button></td>';

    // Wire up events with addEventListener (required by MV3 CSP)
    const cb = tr.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', (e) => { toggleRowSelect(qid, e.target.checked, e); });
    cb.addEventListener('click',  (e) => { e.stopPropagation(); });

    const goBtn = tr.querySelector('button.btn-sm');
    goBtn.addEventListener('click', (e) => { goToQuestion(qid, e); });

    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      const newState = !cb.checked;
      cb.checked = newState;
      toggleRowSelect(qid, newState);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function filterQuestionsTable() {
  if (pageQuestions.length > 0) renderQuestionsTable(pageQuestions);
}

function toggleRowSelect(qid, checked, event) {
  if (event) event.stopPropagation();
  if (checked) {
    selectedIds.add(qid);
  } else {
    selectedIds.delete(qid);
    const selectAll = document.getElementById('chk-select-all');
    if (selectAll) selectAll.checked = false;
  }
  // Update row highlight
  const row = document.querySelector('tr[data-qid="' + escAttr(qid) + '"]');
  if (row) row.classList.toggle('selected', checked);
}

function toggleSelectAll(checked) {
  filteredQuestions.forEach((q) => {
    const qid = String(q.id || q.number || '');
    if (checked) selectedIds.add(qid); else selectedIds.delete(qid);
  });
  // Re-render to sync checkbox states
  if (pageQuestions.length > 0) renderQuestionsTable(pageQuestions);
  // Re-sync select-all checkbox state after re-render
  const selectAll = document.getElementById('chk-select-all');
  if (selectAll) selectAll.checked = checked;
}

function deselectAll() {
  selectedIds.clear();
  const selectAll = document.getElementById('chk-select-all');
  if (selectAll) selectAll.checked = false;
  if (pageQuestions.length > 0) renderQuestionsTable(pageQuestions);
}

async function goToQuestion(qid, event) {
  if (event) event.stopPropagation();
  appendLog('Navigating to Q#' + qid + '…', 'info');
  try {
    const resp = await sendToContentScript({
      action:  'navigateToQuestion',
      payload: { questionId: qid },
    });
    if (resp && resp.ok) {
      appendLog('Navigated to Q#' + qid, 'success');
    } else {
      appendLog('Navigate error: ' + (resp && resp.error ? resp.error : 'unknown'), 'error');
    }
  } catch (err) {
    appendLog('Error: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   INCOMING MESSAGES (from content script via background relay)
════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'progress')      updateProgress(msg.current, msg.total, msg.label || '');
  if (msg.action === 'log')           appendLog(msg.text, msg.level || 'info');
  if (msg.action === 'pageQuestions') renderQuestionsTable(msg.questions || []);
  if (msg.action === 'extractedQA')   handleExtractedQA(msg.data || []);
});

function handleExtractedQA(data) {
  appendLog('Received ' + data.length + ' extracted Q&A rows.', 'success');
  pageQuestions = data.map(row => ({
    id:         String(row.question_number || row.id || ''),
    number:     String(row.question_number || row.number || ''),
    text:       row.question || row.text || '',
    answered:   !!(row.answer || row.answered),
    visibility: row.visibility || 'public',
  }));
  renderQuestionsTable(pageQuestions);
}

/* ═══════════════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════════════ */
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escAttr(str) {
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ═══════════════════════════════════════════════════════════════════════
   WIRE UP STATIC EVENT LISTENERS
   (replaces all inline onclick / ondragover / oninput / etc. attributes)
════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // ── Tab bar ──────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });

  // ── Card headers (collapse/expand) ───────────────────────────────────
  document.querySelectorAll('.card-header[data-card]').forEach(header => {
    header.addEventListener('click', () => toggleCard(header.dataset.card));
  });

  // ── Section A: Page Controls ─────────────────────────────────────────
  document.getElementById('btn-load-all')
    .addEventListener('click', sendLoadAllQuestions);
  document.getElementById('btn-extract-qa')
    .addEventListener('click', sendExtractQA);

  // ── Section B: CSV Loading ────────────────────────────────────────────
  const dropzone = document.getElementById('csv-dropzone');
  dropzone.addEventListener('dragover',  handleDragOver);
  dropzone.addEventListener('dragleave', handleDragLeave);
  dropzone.addEventListener('drop',      handleDrop);

  document.getElementById('csv-file-input')
    .addEventListener('change', handleFileSelect);

  document.getElementById('btn-clear-csv')
    .addEventListener('click', clearCsvData);

  // ── Section C: Batch Operations ───────────────────────────────────────
  document.getElementById('btn-start-fill')
    .addEventListener('click', startFilling);
  document.getElementById('btn-stop')
    .addEventListener('click', stopFilling);
  document.getElementById('btn-apply-vis')
    .addEventListener('click', applyBatchVisibility);

  // ── Section D: Questions Table ────────────────────────────────────────
  document.getElementById('question-search')
    .addEventListener('input', filterQuestionsTable);
  document.getElementById('chk-select-all')
    .addEventListener('change', (e) => toggleSelectAll(e.target.checked));
  document.getElementById('btn-deselect')
    .addEventListener('click', deselectAll);
  document.getElementById('btn-refresh-questions')
    .addEventListener('click', refreshQuestionsFromPage);
});
