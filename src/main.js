// ─── FLAGS ──────────────────────────────────────────────────────────────────
const DEBUG       = window.__SOURCEDESK_DEBUG__ || false;
const TEST        = window.__SOURCEDESK_TEST__  || false;
const APP_VERSION = '0.2.0';
function log(...args) { if (DEBUG) console.log('[SD]', ...args); }

// ─── IndexedDB ────────────────────────────────────────────────────────────────
const DB_NAME = 'sourcedesk', DB_VERSION = 1;
let db;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('docs')) { const s = d.createObjectStore('docs', { keyPath: 'id' }); s.createIndex('projectId', 'projectId', { unique: false }); }
      if (!d.objectStoreNames.contains('chats')) { const s = d.createObjectStore('chats', { keyPath: 'id' }); s.createIndex('projectId', 'projectId', { unique: false }); }
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = () => rej(req.error);
  });
}

function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbPut(store, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(val);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbGetByIndex(store, index, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(index).getAll(val);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
  projects: [],
  templates: [],
  settings: { apiKey: '', model: 'claude-sonnet-4-20250514', globalContext: '' },
  activeProject: null,
  activeDocs: new Set(),        // doc IDs toggled on
  activeOtherProjects: new Set(), // other project IDs whose docs to include
  messages: [],                 // current chat
  streaming: false,
  rightPanelOpen: true,
  editingTemplateId: null,
};

// ─── BOOT ─────────────────────────────────────────────────────────────────────
async function boot() {
  await openDB();
  state.templates = await dbGetAll('templates');
  state.projects = await dbGetAll('projects');
  const apiKey = await dbGet('settings', 'apiKey');
  const model = await dbGet('settings', 'model');
  const globalContext = await dbGet('settings', 'globalContext');
  if (apiKey) state.settings.apiKey = apiKey.value;
  if (model) state.settings.model = model.value;
  if (globalContext) state.settings.globalContext = globalContext.value;
  renderSidebar();
  checkApiKey();
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────
function showView(v) {
  document.getElementById('templates-view').style.display = v === 'templates' ? 'flex' : 'none';
  document.getElementById('chat-view').style.display = v === 'chat' ? 'flex' : 'none';
  if (v === 'templates') renderTemplatesGrid();
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('projects-list');
  list.innerHTML = '';
  const icons = { RFP: '📋', RFI: '📄', 'Vendor Q': '🏢', Contract: '📑', Other: '📁' };
  state.projects.slice().reverse().forEach(p => {
    const item = document.createElement('div');
    item.className = 'sidebar-item' + (state.activeProject?.id === p.id ? ' active' : '');
    item.innerHTML = `<span class="item-icon">${icons[p.category] || '📁'}</span><span class="item-name">${p.name}</span>`;
    item.onclick = () => loadProject(p.id);
    list.appendChild(item);
  });
}

// ─── LOAD PROJECT ─────────────────────────────────────────────────────────────
async function loadProject(id) {
  const proj = state.projects.find(p => p.id === id);
  if (!proj) return;
  state.activeProject = proj;
  state.messages = [];
  state.activeDocs = new Set();
  state.activeOtherProjects = new Set();

  // load chat history
  const chats = await dbGetByIndex('chats', 'projectId', id);
  if (chats.length) state.messages = chats[0].messages || [];

  // load docs for project — enable all by default
  const docs = await dbGetByIndex('docs', 'projectId', id);
  docs.forEach(d => state.activeDocs.add(d.id));

  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('chat-messages').classList.remove('hidden');
  document.getElementById('chat-input-area').classList.remove('hidden');

  const badge = document.getElementById('project-type-badge');
  document.getElementById('project-title').textContent = proj.name;
  badge.textContent = proj.category;
  badge.classList.remove('hidden');

  renderSidebar();
  renderMessages();
  await renderRightPanel();
  checkApiKey();
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  state.messages.forEach(m => appendMessageEl(m.role, m.content, m.sources));
  container.scrollTop = container.scrollHeight;
}

function appendMessageEl(role, content, sources) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const avatarLabel = role === 'assistant' ? 'SD' : 'You';
  let sourcesHtml = '';
  if (sources && sources.length) {
    sourcesHtml = `<div class="chunk-used">Referenced: ${sources.map(s => `<span class="chunk-source">${s}</span>`).join(', ')}</div>`;
  }
  div.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div>
      <div class="msg-bubble">${formatMarkdown(content)}</div>
      ${sourcesHtml}
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function formatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h4 style="margin:10px 0 4px;font-family:DM Serif Display,serif;color:var(--accent)">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 style="margin:10px 0 4px;font-family:DM Serif Display,serif">$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup])(.+)$/gm, '<p>$1</p>');
}

// ─── BM25 SEARCH ──────────────────────────────────────────────────────────────
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function buildIndex(chunks) {
  const idf = {}, N = chunks.length;
  const tfs = chunks.map(c => {
    const tokens = tokenize(c.text), freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    return { freq, len: tokens.length };
  });
  const df = {};
  tfs.forEach(({ freq }) => { Object.keys(freq).forEach(t => { df[t] = (df[t] || 0) + 1; }); });
  Object.keys(df).forEach(t => { idf[t] = Math.log((N - df[t] + 0.5) / (df[t] + 0.5) + 1); });
  return { tfs, idf, avgLen: tfs.reduce((s, x) => s + x.len, 0) / (N || 1) };
}

function bm25Score(query, idx, i, k1 = 1.5, b = 0.75) {
  const { tfs, idf, avgLen } = idx;
  const { freq, len } = tfs[i];
  return tokenize(query).reduce((score, t) => {
    const tf = freq[t] || 0;
    const idfVal = idf[t] || 0;
    return score + idfVal * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len / avgLen));
  }, 0);
}

function chunkText(text, size = 400, overlap = 60) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return chunks;
}

async function retrieveContext(query, topK = 4) {
  if (!state.activeProject) return { context: '', sources: [] };

  // Gather all active doc IDs
  const docIds = [...state.activeDocs];
  // Add toggled-in other project docs
  for (const pid of state.activeOtherProjects) {
    const otherDocs = await dbGetByIndex('docs', 'projectId', pid);
    otherDocs.forEach(d => docIds.push(d.id));
  }
  // Add template content if project has one
  const templateChunks = [];
  if (state.activeProject.templateId) {
    const tmpl = state.templates.find(t => t.id === state.activeProject.templateId);
    if (tmpl) templateChunks.push({ text: tmpl.content, source: `Template: ${tmpl.name}` });
  }

  if (!docIds.length && !templateChunks.length) return { context: '', sources: [] };

  const allChunks = [...templateChunks];
  for (const id of docIds) {
    const doc = await dbGet('docs', id);
    if (!doc) continue;
    const chunks = chunkText(doc.content);
    chunks.forEach(c => allChunks.push({ text: c, source: doc.name }));
  }

  if (!allChunks.length) return { context: '', sources: [] };

  const idx = buildIndex(allChunks);
  const scores = allChunks.map((_, i) => ({ i, score: bm25Score(query, idx, i) }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, topK).filter(s => s.score > 0);
  const sources = [...new Set(top.map(s => allChunks[s.i].source))];
  const context = top.map(s => `[from: ${allChunks[s.i].source}]\n${allChunks[s.i].text}`).join('\n\n---\n\n');
  return { context, sources };
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendMessage() {
  if (state.streaming || !state.activeProject) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!state.settings.apiKey) { alert('Please add your Anthropic API key in Settings.'); return; }

  input.value = '';
  input.style.height = 'auto';

  state.messages.push({ role: 'user', content: text });
  appendMessageEl('user', text);

  // Retrieve context
  const { context, sources } = await retrieveContext(text);

  // Build system prompt
  let systemPrompt = `You are SourceDesk, an expert AI assistant for strategic sourcing and procurement at a university. You help with RFPs, RFIs, vendor questionnaires, contract review, and supplier analysis.

Be precise, professional, and concise. Use procurement terminology correctly. When filling in templates, follow the structure exactly. Flag any compliance concerns relevant to higher-education procurement.`;

  if (state.settings.globalContext) systemPrompt += `\n\n## Institutional Context\n${state.settings.globalContext}`;
  if (state.activeProject) {
    systemPrompt += `\n\n## Current Project\nName: ${state.activeProject.name}\nCategory: ${state.activeProject.category}`;
    if (state.activeProject.notes) systemPrompt += `\nNotes: ${state.activeProject.notes}`;
    if (state.activeProject.workingContent) systemPrompt += `\n\n## Working Document (current draft)\n${state.activeProject.workingContent}`;
  }
  if (context) systemPrompt += `\n\n## Retrieved Context (from project documents)\n${context}`;

  // Build messages for API
  const apiMessages = state.messages.map(m => ({ role: m.role, content: m.content }));

  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg assistant';
  typingDiv.innerHTML = `<div class="msg-avatar">SD</div><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  document.getElementById('chat-messages').appendChild(typingDiv);
  document.getElementById('chat-messages').scrollTop = 99999;
  document.getElementById('send-btn').disabled = true;
  state.streaming = true;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: state.settings.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
        stream: true
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }

    typingDiv.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg assistant';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    msgDiv.innerHTML = `<div class="msg-avatar">SD</div>`;
    msgDiv.appendChild(bubble);
    document.getElementById('chat-messages').appendChild(msgDiv);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              bubble.innerHTML = formatMarkdown(fullText);
              document.getElementById('chat-messages').scrollTop = 99999;
            }
          } catch {}
        }
      }
    }

    if (sources.length) {
      const src = document.createElement('div');
      src.className = 'chunk-used';
      src.innerHTML = `Referenced: ${sources.map(s => `<span class="chunk-source">${s}</span>`).join(', ')}`;
      msgDiv.appendChild(src);
    }

    state.messages.push({ role: 'assistant', content: fullText, sources });
    await saveChat();

  } catch (e) {
    typingDiv.remove();
    appendMessageEl('assistant', `⚠ Error: ${e.message}`);
  }

  state.streaming = false;
  document.getElementById('send-btn').disabled = false;
}

async function saveChat() {
  if (!state.activeProject) return;
  await dbPut('chats', { id: state.activeProject.id, projectId: state.activeProject.id, messages: state.messages });
}

// ─── RIGHT PANEL ──────────────────────────────────────────────────────────────
async function renderRightPanel() {
  if (!state.activeProject) return;

  // Template ref
  const tmplEl = document.getElementById('ctx-template');
  if (state.activeProject.templateId) {
    const tmpl = state.templates.find(t => t.id === state.activeProject.templateId);
    if (tmpl) {
      tmplEl.innerHTML = `<div class="template-ref">
        <span style="flex:1">${tmpl.name}</span>
        <span class="tcard-btn" onclick="openFillTemplate('${tmpl.id}')">Fill</span>
        <span class="tcard-btn" onclick="viewTemplateContent('${tmpl.id}')">View</span>
      </div>`;
    }
  } else {
    tmplEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No template — <span style="color:var(--accent);cursor:pointer" onclick="promptAttachTemplate()">attach one</span></div>`;
  }

  // Project docs
  const docs = await dbGetByIndex('docs', 'projectId', state.activeProject.id);
  const docsEl = document.getElementById('ctx-project-docs');
  docsEl.innerHTML = '';
  if (!docs.length) {
    docsEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">No docs yet — upload files to give Claude context.</div>`;
  }
  docs.forEach(doc => {
    const active = state.activeDocs.has(doc.id);
    const el = document.createElement('div');
    el.className = `context-doc${active ? ' active' : ''}`;
    el.innerHTML = `<div class="doc-toggle">${active ? '✓' : ''}</div><div class="doc-name">${doc.name}</div><span class="tcard-btn del" onclick="deleteDoc('${doc.id}',event)" style="opacity:0.5;margin-left:4px">✕</span>`;
    el.onclick = (e) => { if (e.target.classList.contains('tcard-btn')) return; toggleDoc(doc.id, el); };
    docsEl.appendChild(el);
  });

  // Other projects
  const otherEl = document.getElementById('ctx-other-projects');
  otherEl.innerHTML = '';
  const others = state.projects.filter(p => p.id !== state.activeProject.id);
  if (!others.length) {
    otherEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No other projects yet.</div>`;
  }
  others.forEach(p => {
    const checked = state.activeOtherProjects.has(p.id);
    const el = document.createElement('div');
    el.className = 'other-project-item';
    el.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleOtherProject('${p.id}', this.checked)"> <span>${p.name}</span> <span style="font-size:10px;color:var(--text-muted);font-family:DM Mono,monospace">${p.category}</span>`;
    otherEl.appendChild(el);
  });

  // Doc count
  document.getElementById('ctx-doc-count').textContent = `${docs.length} doc${docs.length !== 1 ? 's' : ''}`;
}

function toggleDoc(id, el) {
  if (state.activeDocs.has(id)) { state.activeDocs.delete(id); el.classList.remove('active'); el.querySelector('.doc-toggle').textContent = ''; }
  else { state.activeDocs.add(id); el.classList.add('active'); el.querySelector('.doc-toggle').textContent = '✓'; }
}

function toggleOtherProject(id, checked) {
  if (checked) state.activeOtherProjects.add(id); else state.activeOtherProjects.delete(id);
}

async function deleteDoc(id, e) {
  e.stopPropagation();
  if (!confirm('Remove this document?')) return;
  await dbDelete('docs', id);
  state.activeDocs.delete(id);
  await renderRightPanel();
}

function toggleRightPanel() {
  state.rightPanelOpen = !state.rightPanelOpen;
  document.getElementById('panel-right').classList.toggle('collapsed', !state.rightPanelOpen);
}

// ─── DOC UPLOAD ───────────────────────────────────────────────────────────────
async function handleDocUpload(event) {
  if (!state.activeProject) return;
  const files = Array.from(event.target.files);
  for (const file of files) {
    const text = await readFileAsText(file);
    const doc = { id: uid(), projectId: state.activeProject.id, name: file.name, content: text, uploadedAt: Date.now() };
    await dbPut('docs', doc);
    state.activeDocs.add(doc.id);
  }
  event.target.value = '';
  await renderRightPanel();
}

function readFileAsText(file) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = () => res(`[Could not read file: ${file.name}]`);
    reader.readAsText(file);
  });
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function renderTemplatesGrid() {
  const grid = document.getElementById('templates-grid');
  grid.innerHTML = '';
  if (!state.templates.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="30" height="30" rx="3"/><line x1="12" y1="14" x2="28" y2="14"/><line x1="12" y1="20" x2="28" y2="20"/><line x1="12" y1="26" x2="20" y2="26"/></svg><span>No templates yet — create your first one.</span></div>`;
    return;
  }
  state.templates.forEach(t => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-card-actions">
        <span class="tcard-btn" onclick="openEditTemplate('${t.id}')">Edit</span>
        <span class="tcard-btn del" onclick="deleteTemplate('${t.id}')">Delete</span>
      </div>
      <div class="template-card-type ${t.type === 'skeleton' ? 'type-skeleton' : 'type-example'}">${t.type}</div>
      <div class="template-card-name">${t.name}</div>
      <div class="template-card-category">${t.category}</div>`;
    grid.appendChild(card);
  });
}

function openNewTemplate() {
  state.editingTemplateId = null;
  document.getElementById('modal-template-title').textContent = 'New Template';
  document.getElementById('tmpl-name').value = '';
  document.getElementById('tmpl-content').value = '';
  selectPillByVal('tmpl-category-pills', 'RFP');
  selectPillByVal('tmpl-type-pills', 'skeleton');
  showModal('modal-template');
}

function openEditTemplate(id) {
  const t = state.templates.find(x => x.id === id);
  if (!t) return;
  state.editingTemplateId = id;
  document.getElementById('modal-template-title').textContent = 'Edit Template';
  document.getElementById('tmpl-name').value = t.name;
  document.getElementById('tmpl-content').value = t.content;
  selectPillByVal('tmpl-category-pills', t.category);
  selectPillByVal('tmpl-type-pills', t.type);
  showModal('modal-template');
}

async function saveTemplate() {
  const name = document.getElementById('tmpl-name').value.trim();
  const content = document.getElementById('tmpl-content').value.trim();
  const category = getActivePill('tmpl-category-pills');
  const type = getActivePill('tmpl-type-pills');
  if (!name || !content) { alert('Please fill in the name and content.'); return; }
  const id = state.editingTemplateId || uid();
  const tmpl = { id, name, category, type, content, updatedAt: Date.now() };
  await dbPut('templates', tmpl);
  if (state.editingTemplateId) {
    state.templates = state.templates.map(t => t.id === id ? tmpl : t);
  } else {
    state.templates.push(tmpl);
  }
  closeModal();
  renderTemplatesGrid();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  await dbDelete('templates', id);
  state.templates = state.templates.filter(t => t.id !== id);
  renderTemplatesGrid();
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────
function openNewProject() {
  document.getElementById('proj-name').value = '';
  document.getElementById('proj-notes').value = '';
  selectPillByVal('proj-category-pills', 'RFP');
  // populate template select
  const sel = document.getElementById('proj-template-select');
  sel.innerHTML = '<option value="">— Start blank —</option>';
  state.templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `[${t.category}] ${t.name}`;
    sel.appendChild(opt);
  });
  showModal('modal-project');
}

async function saveProject() {
  const name = document.getElementById('proj-name').value.trim();
  const notes = document.getElementById('proj-notes').value.trim();
  const category = getActivePill('proj-category-pills');
  const templateId = document.getElementById('proj-template-select').value || null;
  if (!name) { alert('Please enter a project name.'); return; }

  let workingContent = '';
  if (templateId) {
    const tmpl = state.templates.find(t => t.id === templateId);
    if (tmpl) workingContent = tmpl.content;
  }

  const proj = { id: uid(), name, category, templateId, notes, workingContent, createdAt: Date.now() };
  await dbPut('projects', proj);
  state.projects.push(proj);
  closeModal();
  renderSidebar();
  await loadProject(proj.id);
}

// ─── FILL TEMPLATE ────────────────────────────────────────────────────────────
function openFillTemplate(templateId) {
  const tmpl = state.templates.find(t => t.id === templateId);
  if (!tmpl || tmpl.type !== 'skeleton') {
    viewTemplateContent(templateId); return;
  }
  const placeholders = [...new Set([...tmpl.content.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))];
  if (!placeholders.length) { viewTemplateContent(templateId); return; }

  document.getElementById('modal-fill-subtitle').textContent = `Fill in the blanks for "${tmpl.name}"`;
  const fields = document.getElementById('fill-fields');
  fields.innerHTML = '';
  placeholders.forEach(ph => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `<label class="form-label">${ph}</label><input class="form-input" data-placeholder="${ph}" placeholder="Enter ${ph}…">`;
    fields.appendChild(row);
  });
  fields.dataset.templateId = templateId;
  showModal('modal-fill');
}

function applyFill() {
  const fields = document.getElementById('fill-fields');
  const tmpl = state.templates.find(t => t.id === fields.dataset.templateId);
  if (!tmpl) return;
  let filled = tmpl.content;
  fields.querySelectorAll('[data-placeholder]').forEach(inp => {
    const val = inp.value.trim() || `[${inp.dataset.placeholder}]`;
    filled = filled.split(`{{${inp.dataset.placeholder}}}`).join(val);
  });
  document.getElementById('chat-input').value = `Please help me review and complete this document:\n\n${filled}`;
  closeModal();
  document.getElementById('chat-input').focus();
}

function viewTemplateContent(templateId) {
  const tmpl = state.templates.find(t => t.id === templateId);
  if (!tmpl) return;
  document.getElementById('chat-input').value = `I'd like to work on the "${tmpl.name}" template. Here's the content:\n\n${tmpl.content}`;
  closeModal();
  document.getElementById('chat-input').focus();
}

function promptAttachTemplate() {
  openNewProject();
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-apikey').value = state.settings.apiKey || '';
  document.getElementById('settings-model').value = state.settings.model;
  document.getElementById('settings-context').value = state.settings.globalContext || '';
  updateApiKeyStatus(!!state.settings.apiKey);
  showModal('modal-settings');
}

async function saveSettings() {
  const key = document.getElementById('settings-apikey').value.trim();
  const model = document.getElementById('settings-model').value;
  const ctx = document.getElementById('settings-context').value.trim();
  state.settings.apiKey = key;
  state.settings.model = model;
  state.settings.globalContext = ctx;
  await dbPut('settings', { key: 'apiKey', value: key });
  await dbPut('settings', { key: 'model', value: model });
  await dbPut('settings', { key: 'globalContext', value: ctx });
  closeModal();
  checkApiKey();
}

function updateApiKeyStatus(hasKey) {
  document.getElementById('apikey-dot').classList.toggle('ok', hasKey);
  document.getElementById('apikey-status-text').textContent = hasKey ? 'API key saved' : 'No key saved';
}

function checkApiKey() {
  const banner = document.getElementById('no-key-banner');
  banner.classList.toggle('hidden', !!state.settings.apiKey || !state.activeProject);
}

async function clearAllData() {
  if (!confirm('This will delete ALL projects, templates, documents, and chat history. Are you sure?')) return;
  const stores = ['templates', 'projects', 'docs', 'chats', 'settings'];
  for (const s of stores) {
    const items = await dbGetAll(s);
    for (const item of items) await dbDelete(s, item[s === 'settings' ? 'key' : 'id']);
  }
  location.reload();
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function selectPill(el, groupId) {
  document.querySelectorAll(`#${groupId} .type-pill`).forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}
function selectPillByVal(groupId, val) {
  document.querySelectorAll(`#${groupId} .type-pill`).forEach(p => {
    p.classList.toggle('active', p.dataset.val === val);
  });
}
function getActivePill(groupId) {
  return document.querySelector(`#${groupId} .type-pill.active`)?.dataset.val || '';
}

// ─── INPUT RESIZE ────────────────────────────────────────────────────────────
if (!TEST) {
  document.addEventListener('DOMContentLoaded', () => {
    const ta = document.getElementById('chat-input');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    showView('chat');
    boot();
  });
}
