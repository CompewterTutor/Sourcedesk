// ─── PROPOSAL EVALUATION ─────────────────────────────────────────────────────
// Per-project proposal evaluation workflow: weighted criteria, candidates, AI scoring.
// evalCriteria:  { id, projectId, name, weight, maxScore, description, createdAt }
// evalCandidates:{ id, projectId, name, notes, sourceDocIds: [], createdAt }
// evalScores:    { id, projectId, candidateId, criterionId, score, justification, createdAt }

let _evalTab = 'criteria'; // 'criteria' | 'candidates' | 'scorecard'
let _currentCriterion = null;
let _currentCandidate = null;

// ─── TOP-LEVEL LOAD ──────────────────────────────────────────────────────────

async function loadEvaluation() {
    if (!state.activeProject) return;
    _currentCriterion = null;
    _currentCandidate = null;
    _evalTab = 'criteria';
    _renderEvalTab();
}

// ─── TAB MANAGEMENT ──────────────────────────────────────────────────────────

function _renderEvalTab() {
    // Highlight active tab button
    var tabs = ['criteria', 'candidates', 'scorecard'];
    tabs.forEach(function(tab) {
        var btn = document.getElementById('eval-tab-' + tab);
        if (!btn) return;
        btn.style.opacity = _evalTab === tab ? '1' : '0.5';
        btn.style.fontWeight = _evalTab === tab ? '600' : '400';
    });

    // Show/hide panels
    var panelMap = {
        criteria:   'eval-criteria-panel',
        candidates: 'eval-candidates-panel',
        scorecard:  'eval-scorecard-panel'
    };
    for (var t in panelMap) {
        var el = document.getElementById(panelMap[t]);
        if (el) el.style.display = _evalTab === t ? 'flex' : 'none';
    }

    // Render active tab content
    if (_evalTab === 'criteria')   _renderCriteriaTab();
    if (_evalTab === 'candidates') _renderCandidatesTab();
    if (_evalTab === 'scorecard')  _renderScorecardTab();
}

function switchEvalTab(tab) {
    _evalTab = tab;
    _renderEvalTab();
}

// ─── CRITERIA TAB ────────────────────────────────────────────────────────────

async function _renderCriteriaTab() {
    if (!state.activeProject) return;
    var criteria = await dbGetByIndex('evalCriteria', 'projectId', state.activeProject.id);
    criteria.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    var list = document.getElementById('eval-criteria-list');
    if (!list) return;
    list.innerHTML = '';

    if (!criteria.length) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic">No criteria yet. Click + Add Criterion.</div>';
        return;
    }

    criteria.forEach(function(c) {
        var el = document.createElement('div');
        el.className = 'sq-item' + (_currentCriterion && _currentCriterion.id === c.id ? ' active' : '');
        el.dataset.criterionId = c.id;
        el.innerHTML = '<div class="sq-item-text">' +
            '<div style="font-size:12px;color:var(--text);font-weight:500">' + (c.name || 'Untitled').replace(/</g, '&lt;') + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted)">' + (c.weight || 0) + '% weight · max ' + (c.maxScore || 10) + '</div>' +
            '</div>';
        el.onclick = (function(id) { return function() { _selectCriterion(id); }; })(c.id);
        list.appendChild(el);
    });
}

async function _selectCriterion(criterionId) {
    if (!state.activeProject) return;
    var criteria = await dbGetByIndex('evalCriteria', 'projectId', state.activeProject.id);
    var c = null;
    for (var i = 0; i < criteria.length; i++) {
        if (criteria[i].id === criterionId) { c = criteria[i]; break; }
    }
    if (!c) return;
    _currentCriterion = c;

    document.querySelectorAll('#eval-criteria-list .sq-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.criterionId === criterionId);
    });

    var placeholder = document.getElementById('eval-criterion-placeholder');
    var form = document.getElementById('eval-criterion-form');
    if (placeholder) placeholder.style.display = 'none';
    if (form) form.style.display = 'flex';

    _setEvalInput('eval-crit-name',    c.name);
    _setEvalInput('eval-crit-weight',  c.weight);
    _setEvalInput('eval-crit-maxscore',c.maxScore);
    _setEvalInput('eval-crit-desc',    c.description);

    var delBtn = document.getElementById('eval-crit-delete-btn');
    if (delBtn) delBtn.style.display = '';
}

async function openNewCriterion() {
    if (!state.activeProject) return;
    _currentCriterion = null;

    document.querySelectorAll('#eval-criteria-list .sq-item').forEach(function(el) {
        el.classList.remove('active');
    });

    var placeholder = document.getElementById('eval-criterion-placeholder');
    var form = document.getElementById('eval-criterion-form');
    if (placeholder) placeholder.style.display = 'none';
    if (form) form.style.display = 'flex';

    _setEvalInput('eval-crit-name',    '');
    _setEvalInput('eval-crit-weight',  '20');
    _setEvalInput('eval-crit-maxscore','10');
    _setEvalInput('eval-crit-desc',    '');

    var delBtn = document.getElementById('eval-crit-delete-btn');
    if (delBtn) delBtn.style.display = 'none';

    var nameInput = document.getElementById('eval-crit-name');
    if (nameInput) nameInput.focus();
}

async function saveCurrentCriterion() {
    if (!state.activeProject) return;
    var name = _getEvalInput('eval-crit-name');
    if (!name) {
        var nameEl = document.getElementById('eval-crit-name');
        if (nameEl) nameEl.focus();
        return;
    }
    var weight    = parseFloat(_getEvalInput('eval-crit-weight'))   || 0;
    var maxScore  = parseFloat(_getEvalInput('eval-crit-maxscore')) || 10;
    var description = _getEvalInput('eval-crit-desc');
    var now = Date.now();

    if (_currentCriterion) {
        Object.assign(_currentCriterion, { name: name, weight: weight, maxScore: maxScore, description: description });
        await dbPut('evalCriteria', _currentCriterion);
    } else {
        var c = { id: uid(), projectId: state.activeProject.id, name: name, weight: weight, maxScore: maxScore, description: description, createdAt: now };
        await dbPut('evalCriteria', c);
        _currentCriterion = c;
    }

    await _renderCriteriaTab();

    document.querySelectorAll('#eval-criteria-list .sq-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.criterionId === _currentCriterion.id);
    });

    var delBtn = document.getElementById('eval-crit-delete-btn');
    if (delBtn) delBtn.style.display = '';
}

async function deleteCurrentCriterion(id) {
    if (!state.activeProject) return;
    if (!confirm('Delete this criterion? All scores for it will also be deleted.')) return;

    await dbDelete('evalCriteria', id);

    // Delete all evalScores for this criterion (load by projectId, filter by criterionId)
    var allScores = await dbGetByIndex('evalScores', 'projectId', state.activeProject.id);
    for (var i = 0; i < allScores.length; i++) {
        if (allScores[i].criterionId === id) await dbDelete('evalScores', allScores[i].id);
    }

    _currentCriterion = null;

    var placeholder = document.getElementById('eval-criterion-placeholder');
    var form = document.getElementById('eval-criterion-form');
    if (placeholder) placeholder.style.display = 'flex';
    if (form) form.style.display = 'none';

    await _renderCriteriaTab();
}

// Thin wrapper called from HTML onclick (mangle-safe)
function _evalDeleteCriterion() {
    if (!_currentCriterion) return;
    deleteCurrentCriterion(_currentCriterion.id);
}

// ─── CANDIDATES TAB ──────────────────────────────────────────────────────────

async function _renderCandidatesTab() {
    if (!state.activeProject) return;
    var candidates = await dbGetByIndex('evalCandidates', 'projectId', state.activeProject.id);
    candidates.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    var list = document.getElementById('eval-candidates-list');
    if (!list) return;
    list.innerHTML = '';

    if (!candidates.length) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic">No candidates yet. Click + Add Candidate.</div>';
        return;
    }

    candidates.forEach(function(c) {
        var el = document.createElement('div');
        el.className = 'sq-item' + (_currentCandidate && _currentCandidate.id === c.id ? ' active' : '');
        el.dataset.candidateId = c.id;
        var docCount = (c.sourceDocIds || []).length;
        el.innerHTML = '<div class="sq-item-text">' +
            '<div style="font-size:12px;color:var(--text);font-weight:500">' + (c.name || 'Untitled').replace(/</g, '&lt;') + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted)">' + docCount + ' source doc' + (docCount !== 1 ? 's' : '') + '</div>' +
            '</div>';
        el.onclick = (function(id) { return function() { _selectCandidate(id); }; })(c.id);
        list.appendChild(el);
    });
}

async function _selectCandidate(candidateId) {
    if (!state.activeProject) return;
    var candidates = await dbGetByIndex('evalCandidates', 'projectId', state.activeProject.id);
    var c = null;
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].id === candidateId) { c = candidates[i]; break; }
    }
    if (!c) return;
    _currentCandidate = c;

    document.querySelectorAll('#eval-candidates-list .sq-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.candidateId === candidateId);
    });

    var placeholder = document.getElementById('eval-candidate-placeholder');
    var form = document.getElementById('eval-candidate-form');
    if (placeholder) placeholder.style.display = 'none';
    if (form) form.style.display = 'flex';

    _setEvalInput('eval-cand-name',  c.name);
    _setEvalInput('eval-cand-notes', c.notes);

    await _renderCandidateDocPicker();

    var delBtn = document.getElementById('eval-cand-delete-btn');
    if (delBtn) delBtn.style.display = '';
}

async function openNewCandidate() {
    if (!state.activeProject) return;
    _currentCandidate = null;

    document.querySelectorAll('#eval-candidates-list .sq-item').forEach(function(el) {
        el.classList.remove('active');
    });

    var placeholder = document.getElementById('eval-candidate-placeholder');
    var form = document.getElementById('eval-candidate-form');
    if (placeholder) placeholder.style.display = 'none';
    if (form) form.style.display = 'flex';

    _setEvalInput('eval-cand-name',  '');
    _setEvalInput('eval-cand-notes', '');

    var docsEl = document.getElementById('eval-cand-docs');
    if (docsEl) docsEl.innerHTML = '<div style="color:var(--text-muted);font-size:11px;font-style:italic">Save candidate first, then associate documents.</div>';

    var delBtn = document.getElementById('eval-cand-delete-btn');
    if (delBtn) delBtn.style.display = 'none';

    var nameInput = document.getElementById('eval-cand-name');
    if (nameInput) nameInput.focus();
}

async function saveCurrentCandidate() {
    if (!state.activeProject) return;
    var name = _getEvalInput('eval-cand-name');
    if (!name) {
        var nameEl = document.getElementById('eval-cand-name');
        if (nameEl) nameEl.focus();
        return;
    }
    var notes = _getEvalInput('eval-cand-notes');
    var now = Date.now();

    if (_currentCandidate) {
        Object.assign(_currentCandidate, { name: name, notes: notes });
        await dbPut('evalCandidates', _currentCandidate);
    } else {
        var c = { id: uid(), projectId: state.activeProject.id, name: name, notes: notes, sourceDocIds: [], createdAt: now };
        await dbPut('evalCandidates', c);
        _currentCandidate = c;
    }

    await _renderCandidatesTab();

    document.querySelectorAll('#eval-candidates-list .sq-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.candidateId === _currentCandidate.id);
    });

    await _renderCandidateDocPicker();

    var delBtn = document.getElementById('eval-cand-delete-btn');
    if (delBtn) delBtn.style.display = '';
}

async function deleteCurrentCandidate(id) {
    if (!state.activeProject) return;
    if (!confirm('Delete this candidate? All scores for it will also be deleted.')) return;

    await dbDelete('evalCandidates', id);

    // Delete all evalScores for this candidate using the candidateId index
    var candScores = await dbGetByIndex('evalScores', 'candidateId', id);
    for (var i = 0; i < candScores.length; i++) {
        await dbDelete('evalScores', candScores[i].id);
    }

    _currentCandidate = null;

    var placeholder = document.getElementById('eval-candidate-placeholder');
    var form = document.getElementById('eval-candidate-form');
    if (placeholder) placeholder.style.display = 'flex';
    if (form) form.style.display = 'none';

    await _renderCandidatesTab();
}

// Thin wrapper called from HTML onclick (mangle-safe)
function _evalDeleteCandidate() {
    if (!_currentCandidate) return;
    deleteCurrentCandidate(_currentCandidate.id);
}

// ─── CANDIDATE DOC PICKER ────────────────────────────────────────────────────

async function _renderCandidateDocPicker() {
    if (!state.activeProject || !_currentCandidate) return;
    var docsEl = document.getElementById('eval-cand-docs');
    if (!docsEl) return;

    var allDocs = await dbGetByIndex('docs', 'projectId', state.activeProject.id);
    var projectDocs = allDocs.filter(function(d) { return d.docType !== 'guideline'; });

    if (!projectDocs.length) {
        docsEl.innerHTML = '<div style="color:var(--text-muted);font-size:11px;font-style:italic">No documents in this project yet. Upload docs in the right panel.</div>';
        return;
    }

    var selectedIds = _currentCandidate.sourceDocIds || [];
    docsEl.innerHTML = '';

    projectDocs.forEach(function(d) {
        var row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);padding:4px 0';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedIds.indexOf(d.id) !== -1;
        cb.style.flexShrink = '0';
        (function(docId) {
            cb.onchange = function() {
                if (cb.checked) addDocToCandidate(docId);
                else removeDocFromCandidate(docId);
            };
        })(d.id);

        var span = document.createElement('span');
        span.textContent = d.name || d.id;
        span.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

        row.appendChild(cb);
        row.appendChild(span);
        docsEl.appendChild(row);
    });
}

async function addDocToCandidate(docId) {
    if (!_currentCandidate) return;
    if (!_currentCandidate.sourceDocIds) _currentCandidate.sourceDocIds = [];
    if (_currentCandidate.sourceDocIds.indexOf(docId) === -1) {
        _currentCandidate.sourceDocIds.push(docId);
        await dbPut('evalCandidates', _currentCandidate);
    }
}

async function removeDocFromCandidate(docId) {
    if (!_currentCandidate) return;
    _currentCandidate.sourceDocIds = (_currentCandidate.sourceDocIds || []).filter(function(id) {
        return id !== docId;
    });
    await dbPut('evalCandidates', _currentCandidate);
}

// ─── SCORECARD TAB ───────────────────────────────────────────────────────────

async function _renderScorecardTab() {
    if (!state.activeProject) return;
    var area = document.getElementById('eval-scorecard-area');
    if (!area) return;

    var criteria = await dbGetByIndex('evalCriteria',   'projectId', state.activeProject.id);
    criteria.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    var candidates = await dbGetByIndex('evalCandidates', 'projectId', state.activeProject.id);
    candidates.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    if (!criteria.length || !candidates.length) {
        var what = [];
        if (!criteria.length)   what.push('evaluation criteria');
        if (!candidates.length) what.push('at least one candidate');
        area.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;text-align:center;padding:32px;line-height:1.7">Add ' + what.join(' and ') + ' to see the scorecard.</div>';
        return;
    }

    var scores = await dbGetByIndex('evalScores', 'projectId', state.activeProject.id);

    // Build lookup: candidateId → criterionId → scoreRecord
    var scoreMap = {};
    scores.forEach(function(s) {
        if (!scoreMap[s.candidateId]) scoreMap[s.candidateId] = {};
        scoreMap[s.candidateId][s.criterionId] = s;
    });

    // Scorecard table
    var html = '<table style="border-collapse:collapse;width:100%;font-size:12px;min-width:500px">';

    // Header row
    html += '<thead><tr>';
    html += '<th style="padding:8px 12px;text-align:left;background:var(--surface2);border:1px solid var(--border);white-space:nowrap;font-family:\'DM Mono\',monospace;font-weight:600;color:var(--text-dim)">Candidate</th>';
    criteria.forEach(function(c) {
        var desc = (c.description || '').replace(/"/g, '&quot;');
        html += '<th style="padding:8px 10px;text-align:center;background:var(--surface2);border:1px solid var(--border);min-width:90px;font-family:\'DM Mono\',monospace;font-weight:600;color:var(--text-dim)" title="' + desc + '">' +
            (c.name || '').replace(/</g, '&lt;') + '<br><span style="font-size:10px;color:var(--text-muted);font-weight:400">' + (c.weight || 0) + '% wt</span></th>';
    });
    html += '<th style="padding:8px 12px;text-align:center;background:var(--surface2);border:1px solid var(--border);font-family:\'DM Mono\',monospace;font-weight:600;color:var(--accent)">Score</th>';
    html += '<th style="padding:8px 12px;text-align:center;background:var(--surface2);border:1px solid var(--border);font-family:\'DM Mono\',monospace;font-weight:600;color:var(--text-dim)">AI Evaluate</th>';
    html += '</tr></thead>';

    // Candidate rows
    html += '<tbody>';
    candidates.forEach(function(cand) {
        var candScores = scoreMap[cand.id] || {};
        // Weighted total = sum(score/maxScore * weight) across scored criteria
        var weightedTotal = 0;
        var scoredCount = 0;
        criteria.forEach(function(crit) {
            var sr = candScores[crit.id];
            if (sr && sr.score != null) {
                weightedTotal += (sr.score / (crit.maxScore || 10)) * (crit.weight || 0);
                scoredCount++;
            }
        });
        var scoreDisplay = scoredCount > 0 ? weightedTotal.toFixed(1) + '%' : '—';

        html += '<tr>';
        html += '<td style="padding:8px 12px;border:1px solid var(--border);color:var(--text);font-weight:500;white-space:nowrap">' + (cand.name || '').replace(/</g, '&lt;') + '</td>';

        criteria.forEach(function(crit) {
            var sr = candScores[crit.id];
            if (sr && sr.score != null) {
                var pct = Math.round(sr.score / (crit.maxScore || 10) * 100);
                var col = pct >= 70 ? 'var(--success)' : (pct >= 40 ? 'var(--accent)' : 'var(--danger)');
                var tip = (sr.justification || '').replace(/"/g, '&quot;');
                html += '<td style="padding:8px 10px;border:1px solid var(--border);text-align:center;color:' + col + ';cursor:help" title="' + tip + '">' +
                    sr.score + '/' + (crit.maxScore || 10) + '</td>';
            } else {
                html += '<td style="padding:8px 10px;border:1px solid var(--border);text-align:center;color:var(--text-muted)">—</td>';
            }
        });

        html += '<td style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:var(--accent)">' + scoreDisplay + '</td>';
        html += '<td style="padding:6px 8px;border:1px solid var(--border);text-align:center">' +
            '<button class="btn-secondary" style="font-size:11px;padding:3px 10px;white-space:nowrap" id="eval-btn-' + cand.id + '" onclick="evaluateCandidate(\'' + cand.id + '\')">🤖 Evaluate</button>' +
            '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';

    area.innerHTML = html;
}

// ─── AI EVALUATION ───────────────────────────────────────────────────────────

async function evaluateCandidate(candidateId) {
    if (!state.activeProject) return;
    var btn = document.getElementById('eval-btn-' + candidateId);
    if (btn) { btn.disabled = true; btn.textContent = 'Evaluating…'; }

    try {
        var cand = await dbGet('evalCandidates', candidateId);
        if (!cand) throw new Error('Candidate not found');

        var criteria = await dbGetByIndex('evalCriteria', 'projectId', state.activeProject.id);
        criteria.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        if (!criteria.length) throw new Error('No evaluation criteria defined. Add criteria first.');

        // Load and concatenate source documents (truncated to 6000 chars)
        var docContent = '';
        var docIds = cand.sourceDocIds || [];
        for (var i = 0; i < docIds.length; i++) {
            var doc = await dbGet('docs', docIds[i]);
            if (doc && doc.content) docContent += '\n\n' + doc.content;
        }
        docContent = docContent.slice(0, 6000);

        // Build criteria description for the prompt
        var criteriaText = criteria.map(function(c) {
            return '- ' + c.name + ' (max score: ' + c.maxScore + ', weight: ' + c.weight + '%): ' + (c.description || 'No description provided');
        }).join('\n');

        var systemPrompt = 'You are an objective proposal evaluator. Score the provided proposal text against each criterion and return a JSON array only. Do not include any explanation, markdown, or text outside the JSON array.';

        var userMsg = 'Project: ' + state.activeProject.name + '\n\n' +
            '## Proposal: ' + cand.name + '\n' +
            (docContent.trim() || '(No source documents attached to this candidate)') + '\n\n' +
            '## Evaluation Criteria\n' + criteriaText + '\n\n' +
            'Return a JSON array with this exact shape:\n' +
            '[{"criterionId": "...", "score": N, "justification": "one sentence"}]\n' +
            'Only output the JSON array, nothing else. Use the exact criterionId values shown in the criteria list above.';

        // Build API call and switch off streaming
        var call = buildApiCall(systemPrompt, [{ role: 'user', content: userMsg }]);
        var bodyObj = JSON.parse(call.body);
        bodyObj.stream = false;
        bodyObj.max_tokens = 1024;
        call.body = JSON.stringify(bodyObj);

        var resp = await fetch(call.url, { method: 'POST', headers: call.headers, body: call.body });
        if (!resp.ok) {
            var errData = await resp.json().catch(function() { return {}; });
            throw new Error((errData.error && errData.error.message) || 'API error ' + resp.status);
        }
        var data = await resp.json();

        // Extract text content from response (Anthropic vs OpenAI-compat shapes)
        var text = '';
        var provider = state.settings.provider || 'anthropic';
        if (provider === 'anthropic') {
            text = (data.content && data.content[0] && data.content[0].text) || '';
        } else {
            text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        }

        // Strip code fences and extract the JSON array
        var jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array found in the model response. Try again.');
        var items = JSON.parse(jsonMatch[0]);

        // Build lookup of existing scores for this candidate to avoid duplicates
        var existingScores = await dbGetByIndex('evalScores', 'candidateId', candidateId);
        var existingMap = {};
        existingScores.forEach(function(s) { existingMap[s.criterionId] = s; });

        var now = Date.now();
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            if (!item.criterionId) continue;
            var existing = existingMap[item.criterionId];
            if (existing) {
                existing.score = item.score;
                existing.justification = item.justification || '';
                await dbPut('evalScores', existing);
            } else {
                await dbPut('evalScores', {
                    id: uid(),
                    projectId: state.activeProject.id,
                    candidateId: candidateId,
                    criterionId: item.criterionId,
                    score: item.score,
                    justification: item.justification || '',
                    createdAt: now
                });
            }
        }

        // Show success feedback, then re-render the scorecard after 2 s
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Evaluated!';
        }
        setTimeout(function() { _renderScorecardTab(); }, 2000);

    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = '🤖 Evaluate'; }
        alert('Evaluation failed: ' + (e.message || e));
    }
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────

async function exportScorecardMarkdown() {
    if (!state.activeProject) return;

    var criteria = await dbGetByIndex('evalCriteria',   'projectId', state.activeProject.id);
    criteria.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    var candidates = await dbGetByIndex('evalCandidates', 'projectId', state.activeProject.id);
    candidates.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    if (!criteria.length || !candidates.length) {
        alert('Add evaluation criteria and candidates before exporting.');
        return;
    }

    var scores = await dbGetByIndex('evalScores', 'projectId', state.activeProject.id);
    var scoreMap = {};
    scores.forEach(function(s) {
        if (!scoreMap[s.candidateId]) scoreMap[s.candidateId] = {};
        scoreMap[s.candidateId][s.criterionId] = s;
    });

    var md = '# Proposal Evaluation Scorecard\n\n';
    md += '**Project:** ' + (state.activeProject.name || '') + '  \n';
    md += '**Date:** ' + new Date().toLocaleDateString() + '\n\n';

    // Criteria summary table
    md += '## Evaluation Criteria\n\n';
    md += '| Criterion | Weight | Max Score | Description |\n';
    md += '|-----------|--------|-----------|-------------|\n';
    criteria.forEach(function(c) {
        md += '| ' + (c.name || '') + ' | ' + (c.weight || 0) + '% | ' + (c.maxScore || 10) + ' | ' + (c.description || '') + ' |\n';
    });
    md += '\n';

    // Scorecard matrix
    md += '## Scorecard\n\n';
    var header = ['Candidate'].concat(criteria.map(function(c) { return c.name + ' (' + c.weight + '%)'; })).concat(['Weighted Score']);
    md += '| ' + header.join(' | ') + ' |\n';
    md += '|' + header.map(function() { return '---'; }).join('|') + '|\n';

    candidates.forEach(function(cand) {
        var candScores = scoreMap[cand.id] || {};
        var weightedTotal = 0;
        var scoredCount = 0;
        var cells = criteria.map(function(crit) {
            var sr = candScores[crit.id];
            if (sr && sr.score != null) {
                weightedTotal += (sr.score / (crit.maxScore || 10)) * (crit.weight || 0);
                scoredCount++;
                return sr.score + '/' + (crit.maxScore || 10);
            }
            return '—';
        });
        var scoreDisplay = scoredCount > 0 ? weightedTotal.toFixed(1) + '%' : '—';
        md += '| ' + [cand.name || ''].concat(cells).concat([scoreDisplay]).join(' | ') + ' |\n';
    });
    md += '\n';

    // Justifications
    md += '## Score Justifications\n\n';
    candidates.forEach(function(cand) {
        var candScores = scoreMap[cand.id] || {};
        md += '### ' + (cand.name || 'Candidate') + '\n\n';
        var hasAny = false;
        criteria.forEach(function(crit) {
            var sr = candScores[crit.id];
            if (sr && sr.justification) {
                md += '- **' + crit.name + ':** ' + sr.justification + '\n';
                hasAny = true;
            }
        });
        if (!hasAny) md += '_No scores yet._\n';
        md += '\n';
    });

    // Download
    var projSlug = (state.activeProject.name || 'project').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    var dateStr = new Date().toISOString().slice(0, 10);
    var filename = 'scorecard-' + projSlug + '-' + dateStr + '.md';

    var url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

function _setEvalInput(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = (val == null ? '' : val);
}

function _getEvalInput(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}
