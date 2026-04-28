// ─── PROMPT LIBRARY ──────────────────────────────────────────────────────────

let _plibClickOutside = null;

function openPromptLibrary() {
    const dropdown = document.getElementById('prompt-lib-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
        closePromptLibrary();
        return;
    }
    renderPromptLibraryDropdown().then(() => {
        dropdown.classList.add('open');
        // close on outside click
        setTimeout(() => {
            _plibClickOutside = (e) => {
                const btn = document.getElementById('prompt-lib-btn');
                if (btn && btn.contains(e.target)) return;
                closePromptLibrary();
            };
            document.addEventListener('click', _plibClickOutside);
        }, 0);
    });
}

function closePromptLibrary() {
    const dropdown = document.getElementById('prompt-lib-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    if (_plibClickOutside) {
        document.removeEventListener('click', _plibClickOutside);
        _plibClickOutside = null;
    }
}

async function renderPromptLibraryDropdown() {
    const dropdown = document.getElementById('prompt-lib-dropdown');
    if (!dropdown) return;

    let entries = [];
    try {
        entries = await dbGetAll('promptLibrary');
    } catch (e) {
        entries = [];
    }

    const favorites = entries.filter(e => e.favorite).sort((a, b) => b.updatedAt - a.updatedAt);
    const nonFavs = entries.filter(e => !e.favorite).sort((a, b) => b.createdAt - a.createdAt);
    const recent = nonFavs.slice(0, 5);

    let html = '<div class="plib-header"><span>📚 Prompt Library</span></div>';

    if (favorites.length === 0 && recent.length === 0) {
        html += '<div class="plib-empty">No saved prompts yet.<br>Hover a message and click 📚 to save one.</div>';
    } else {
        if (favorites.length > 0) {
            html += '<div class="plib-section-label">★ Favorites</div>';
            favorites.forEach(entry => {
                const title = _plibEscape(entry.title || entry.content.slice(0, 40));
                html += `<div class="plib-entry" data-plib-id="${entry.id}" title="${_plibEscape(entry.content)}"><span>★</span><span style="overflow:hidden;text-overflow:ellipsis;flex:1">${title}</span></div>`;
            });
        }
        if (recent.length > 0) {
            html += '<div class="plib-section-label">Recent</div>';
            recent.forEach(entry => {
                const title = _plibEscape(entry.title || entry.content.slice(0, 40));
                html += `<div class="plib-entry" data-plib-id="${entry.id}" title="${_plibEscape(entry.content)}"><span style="opacity:0.4">☆</span><span style="overflow:hidden;text-overflow:ellipsis;flex:1">${title}</span></div>`;
            });
        }
    }

    html += '<div class="plib-footer"><button class="btn-sm" onclick="closePromptLibrary();openManagePromptLibrary();" style="font-size:11px;padding:3px 10px;">Manage library</button></div>';

    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.plib-entry[data-plib-id]').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.plibId;
            const entry = entries.find(e => e.id === id);
            if (entry) insertPrompt(entry.content);
            closePromptLibrary();
        });
    });
}

function _plibEscape(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function insertPrompt(content) {
    const ta = document.getElementById('chat-input');
    if (!ta) return;
    ta.value = content;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
}

function openSavePromptModal(content) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const escaped = _plibEscape(content);
    overlay.innerHTML = `
<div class="modal" id="plib-save-modal" style="max-width:420px;width:90%">
  <div class="modal-header">
    <span class="modal-title">Save to Prompt Library</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
    <div>
      <label class="field-label">Title</label>
      <input id="plib-save-title" class="input" type="text" placeholder="Give this prompt a name…" style="width:100%;box-sizing:border-box" />
    </div>
    <div>
      <label class="field-label">Prompt preview</label>
      <textarea class="input" readonly rows="4" style="width:100%;box-sizing:border-box;resize:none;font-size:11px;color:var(--text-muted)">${escaped}</textarea>
    </div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-dim)">
      <input type="checkbox" id="plib-save-fav" style="accent-color:var(--accent)" />
      <span>★ Add to favorites</span>
    </label>
  </div>
  <div class="modal-footer">
    <button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="_plibSaveFromModal()">Save</button>
  </div>
</div>`;

    overlay.classList.remove('hidden');
    // stash content for the save handler
    overlay.dataset.plibContent = content;
    const titleEl = document.getElementById('plib-save-title');
    if (titleEl) titleEl.focus();
}

async function _plibSaveFromModal() {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('plib-save-title');
    const favEl = document.getElementById('plib-save-fav');
    if (!overlay) return;

    const content = overlay.dataset.plibContent || '';
    const title = (titleEl ? titleEl.value.trim() : '') || content.slice(0, 50);
    const favorite = favEl ? favEl.checked : false;
    const now = Date.now();

    const entry = {
        id: uid(),
        title,
        content,
        favorite,
        createdAt: now,
        updatedAt: now
    };
    await savePromptEntry(entry);
    closeModal();
}

async function savePromptEntry(entry) {
    await dbPut('promptLibrary', entry);
}

async function deletePromptEntry(id) {
    await dbDelete('promptLibrary', id);
}

async function togglePromptFavorite(id) {
    let entries = await dbGetAll('promptLibrary');
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    entry.favorite = !entry.favorite;
    entry.updatedAt = Date.now();
    await dbPut('promptLibrary', entry);
}

async function openManagePromptLibrary() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    let entries = [];
    try {
        entries = await dbGetAll('promptLibrary');
    } catch (e) { entries = []; }
    entries.sort((a, b) => {
        if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
        return b.updatedAt - a.updatedAt;
    });

    overlay.innerHTML = `
<div class="modal" id="plib-manage-modal" style="max-width:560px;width:95%">
  <div class="modal-header">
    <span class="modal-title">Manage Prompt Library</span>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body" style="padding:0;max-height:420px;overflow-y:auto">
    ${_plibRenderManageList(entries)}
  </div>
  <div class="modal-footer">
    <button class="btn-ghost" onclick="closeModal()">Close</button>
  </div>
</div>`;

    overlay.classList.remove('hidden');
}

function _plibRenderManageList(entries) {
    if (!entries.length) {
        return '<div style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">No saved prompts yet.</div>';
    }
    return entries.map(entry => {
        const title = _plibEscape(entry.title || entry.content.slice(0, 50));
        const preview = _plibEscape(entry.content.length > 80 ? entry.content.slice(0, 80) + '…' : entry.content);
        const favLabel = entry.favorite ? '★' : '☆';
        const favTitle = entry.favorite ? 'Remove from favorites' : 'Add to favorites';
        return `
<div class="plib-manage-row" id="plib-row-${entry.id}" style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border)">
  <button onclick="_plibToggleFavAndRefresh('${entry.id}')" title="${favTitle}" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--accent);flex-shrink:0;padding:0 2px;margin-top:1px">${favLabel}</button>
  <div style="flex:1;min-width:0">
    <div id="plib-view-${entry.id}">
      <div style="font-size:13px;color:var(--text);font-weight:500;margin-bottom:2px">${title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${preview}</div>
    </div>
    <div id="plib-edit-${entry.id}" style="display:none;flex-direction:column;gap:6px">
      <input id="plib-edit-title-${entry.id}" class="input" type="text" value="${title}" style="width:100%;box-sizing:border-box;font-size:12px" />
      <textarea id="plib-edit-content-${entry.id}" class="input" rows="3" style="width:100%;box-sizing:border-box;resize:vertical;font-size:12px">${_plibEscape(entry.content)}</textarea>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-ghost" style="font-size:11px;padding:3px 10px" onclick="_plibCancelEdit('${entry.id}')">Cancel</button>
        <button class="btn-primary" style="font-size:11px;padding:3px 10px" onclick="_plibSaveEdit('${entry.id}')">Save</button>
      </div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
    <button onclick="_plibStartEdit('${entry.id}')" title="Edit" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 4px;border-radius:3px" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'">✎</button>
    <button onclick="_plibDeleteAndRefresh('${entry.id}')" title="Delete" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 4px;border-radius:3px" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>
  </div>
</div>`;
    }).join('');
}

function _plibStartEdit(id) {
    const viewEl = document.getElementById('plib-view-' + id);
    const editEl = document.getElementById('plib-edit-' + id);
    if (viewEl) viewEl.style.display = 'none';
    if (editEl) editEl.style.display = 'flex';
}

function _plibCancelEdit(id) {
    const viewEl = document.getElementById('plib-view-' + id);
    const editEl = document.getElementById('plib-edit-' + id);
    if (viewEl) viewEl.style.display = '';
    if (editEl) editEl.style.display = 'none';
}

async function _plibSaveEdit(id) {
    const titleEl = document.getElementById('plib-edit-title-' + id);
    const contentEl = document.getElementById('plib-edit-content-' + id);
    if (!titleEl || !contentEl) return;
    let entries = await dbGetAll('promptLibrary');
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    entry.title = titleEl.value.trim() || contentEl.value.slice(0, 50);
    entry.content = contentEl.value;
    entry.updatedAt = Date.now();
    await dbPut('promptLibrary', entry);
    await openManagePromptLibrary();
}

async function _plibDeleteAndRefresh(id) {
    if (!confirm('Delete this prompt?')) return;
    await deletePromptEntry(id);
    await openManagePromptLibrary();
}

async function _plibToggleFavAndRefresh(id) {
    await togglePromptFavorite(id);
    await openManagePromptLibrary();
}
