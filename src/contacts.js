// ─── CONTACTS & RESOURCES ────────────────────────────────────────────────────
// Per-project contact cards or resource links. Each record:
//   { id, projectId, type: 'contact' | 'resource',
//     name, role, org, email, phone, url, notes,
//     tags: string[], includeInContext: bool, createdAt, updatedAt }

async function loadContacts() {
    if (!state.activeProject) return;
    state.currentContact = null;
    const items = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderContactList(items);

    const placeholder = document.getElementById("contact-detail-placeholder");
    const form = document.getElementById("contact-detail-form");
    if (placeholder) placeholder.style.display = "flex";
    if (form) form.style.display = "none";

    const filterEl = document.getElementById("contact-filter");
    if (filterEl) filterEl.value = "";
}

function _contactTypeIcon(type) {
    return type === "resource" ? "🔗" : "👤";
}

function renderContactList(items) {
    const list = document.getElementById("contact-list");
    if (!list) return;
    list.innerHTML = "";
    if (!items || items.length === 0) {
        list.innerHTML =
            '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic">No contacts or resources yet.</div>';
        return;
    }
    items.forEach((c) => {
        const el = document.createElement("div");
        el.className =
            "sq-item" +
            (state.currentContact && state.currentContact.id === c.id
                ? " active"
                : "");
        el.dataset.contactId = c.id;
        const icon = _contactTypeIcon(c.type);
        const sub =
            c.type === "resource"
                ? c.url || ""
                : [c.role, c.org].filter(Boolean).join(" · ");
        const tags = (c.tags || [])
            .map(
                (t) =>
                    `<span style="display:inline-block;font-size:10px;background:var(--surface2);color:var(--text-muted);padding:1px 6px;border-radius:8px;margin-right:3px">${(t || "").replace(/</g, "&lt;")}</span>`,
            )
            .join("");
        const ctxDot = c.includeInContext
            ? '<span title="In context" style="color:var(--accent);font-size:10px;margin-left:4px">●</span>'
            : "";
        el.innerHTML = `<span class="sq-item-icon" style="font-size:14px">${icon}</span>
<div class="sq-item-text">
  <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
    <span style="font-size:12px;color:var(--text);font-weight:500;word-break:break-word">${(c.name || "Untitled").replace(/</g, "&lt;")}</span>
    ${ctxDot}
  </div>
  <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(sub || "").replace(/</g, "&lt;")}</div>
  <div style="margin-top:2px">${tags}</div>
</div>`;
        el.onclick = () => selectContact(c.id);
        list.appendChild(el);
    });
}

async function selectContact(contactId) {
    const c = await dbGet("contacts", contactId);
    if (!c) return;
    state.currentContact = c;

    document.querySelectorAll("#contact-list .sq-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.contactId === contactId);
    });

    const placeholder = document.getElementById("contact-detail-placeholder");
    const form = document.getElementById("contact-detail-form");
    if (placeholder) placeholder.style.display = "none";
    if (form) form.style.display = "flex";

    _setContactFormFields(c);
    const deleteBtn = document.getElementById("contact-delete-btn");
    if (deleteBtn) deleteBtn.style.display = "";
}

function _setContactFormFields(c) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val == null ? "" : val;
    };
    set("contact-name-input", c.name);
    set("contact-role-input", c.role);
    set("contact-org-input", c.org);
    set("contact-email-input", c.email);
    set("contact-phone-input", c.phone);
    set("contact-url-input", c.url);
    set("contact-notes-input", c.notes);
    set("contact-tags-input", (c.tags || []).join(", "));
    const ctx = document.getElementById("contact-ctx-toggle");
    if (ctx) ctx.checked = !!c.includeInContext;
    _setActivePillByVal("contact-type-pills", c.type || "contact");
    _toggleContactFieldsByType(c.type || "contact");
}

function _toggleContactFieldsByType(type) {
    const isResource = type === "resource";
    // For resources, hide contact-only fields (role, org, email, phone)
    const ids = [
        "contact-row-role",
        "contact-row-org",
        "contact-row-email",
        "contact-row-phone",
    ];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = isResource ? "none" : "";
    });
    const urlRow = document.getElementById("contact-row-url");
    if (urlRow) urlRow.style.display = isResource ? "" : "";
    // Re-label name input for resources
    const nameLabel = document.getElementById("contact-name-label");
    if (nameLabel) nameLabel.textContent = isResource ? "Title" : "Name";
}

function selectContactTypePill(el) {
    selectPill(el, "contact-type-pills");
    _toggleContactFieldsByType(el.dataset.val);
}

function openNewContact() {
    if (!state.activeProject) return;
    state.currentContact = null;

    document
        .querySelectorAll("#contact-list .sq-item")
        .forEach((el) => el.classList.remove("active"));

    const placeholder = document.getElementById("contact-detail-placeholder");
    const form = document.getElementById("contact-detail-form");
    if (placeholder) placeholder.style.display = "none";
    if (form) form.style.display = "flex";

    _setContactFormFields({ type: "contact" });
    const deleteBtn = document.getElementById("contact-delete-btn");
    if (deleteBtn) deleteBtn.style.display = "none";
    const nameInput = document.getElementById("contact-name-input");
    if (nameInput) nameInput.focus();
}

function _readContactFromForm() {
    const get = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };
    const tagsRaw = get("contact-tags-input");
    const tags = tagsRaw
        ? tagsRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
        : [];
    const ctx = document.getElementById("contact-ctx-toggle");
    return {
        type: _getActivePillVal("contact-type-pills") || "contact",
        name: get("contact-name-input"),
        role: get("contact-role-input"),
        org: get("contact-org-input"),
        email: get("contact-email-input"),
        phone: get("contact-phone-input"),
        url: get("contact-url-input"),
        notes: get("contact-notes-input"),
        tags,
        includeInContext: ctx ? ctx.checked : false,
    };
}

async function saveCurrentContact() {
    if (!state.activeProject) return;
    const fields = _readContactFromForm();
    if (!fields.name) {
        const nameInput = document.getElementById("contact-name-input");
        if (nameInput) nameInput.focus();
        return;
    }
    const now = Date.now();
    if (state.currentContact) {
        Object.assign(state.currentContact, fields, { updatedAt: now });
        await dbPut("contacts", state.currentContact);
    } else {
        const c = Object.assign(
            {
                id: uid(),
                projectId: state.activeProject.id,
                createdAt: now,
                updatedAt: now,
            },
            fields,
        );
        await dbPut("contacts", c);
        state.currentContact = c;
    }
    const items = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderContactList(items);
    document.querySelectorAll("#contact-list .sq-item").forEach((el) => {
        el.classList.toggle(
            "active",
            el.dataset.contactId === state.currentContact.id,
        );
    });
    const deleteBtn = document.getElementById("contact-delete-btn");
    if (deleteBtn) deleteBtn.style.display = "";
}

async function deleteCurrentContact() {
    if (!state.currentContact) return;
    if (!confirm("Delete this contact/resource?")) return;
    await dbDelete("contacts", state.currentContact.id);
    state.currentContact = null;
    const placeholder = document.getElementById("contact-detail-placeholder");
    const form = document.getElementById("contact-detail-form");
    if (placeholder) placeholder.style.display = "flex";
    if (form) form.style.display = "none";
    const items = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderContactList(items);
}

async function filterContactList(value) {
    if (!state.activeProject) return;
    const items = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const q = (value || "").toLowerCase().trim();
    const filtered = q
        ? items.filter((c) => {
              const hay = [
                  c.name,
                  c.role,
                  c.org,
                  c.email,
                  c.phone,
                  c.url,
                  c.notes,
                  (c.tags || []).join(" "),
              ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
              return hay.includes(q);
          })
        : items;
    renderContactList(filtered);
}

async function toggleContactInContext(contactId) {
    const c = await dbGet("contacts", contactId);
    if (!c) return;
    c.includeInContext = !c.includeInContext;
    c.updatedAt = Date.now();
    await dbPut("contacts", c);
    if (state.currentContact && state.currentContact.id === contactId) {
        state.currentContact.includeInContext = c.includeInContext;
        const ctx = document.getElementById("contact-ctx-toggle");
        if (ctx) ctx.checked = c.includeInContext;
    }
    const items = await dbGetByIndex(
        "contacts",
        "projectId",
        state.activeProject.id,
    );
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderContactList(items);
}

// Build a markdown block for inclusion in chat system prompt.
// Returns "" if there is nothing to include.
function _buildContactsContextBlock(contacts) {
    if (!contacts || !contacts.length) return "";
    const lines = ["\n\n## Important Contacts & Resources"];
    for (const c of contacts) {
        const isResource = c.type === "resource";
        const head = isResource ? "🔗 " : "👤 ";
        const parts = [head + (c.name || "Untitled")];
        if (!isResource) {
            const roleOrg = [c.role, c.org].filter(Boolean).join(" — ");
            if (roleOrg) parts.push(roleOrg);
            if (c.email) parts.push(`email: ${c.email}`);
            if (c.phone) parts.push(`phone: ${c.phone}`);
        }
        if (c.url) parts.push(`url: ${c.url}`);
        if (c.tags && c.tags.length) parts.push(`tags: ${c.tags.join(", ")}`);
        if (c.notes) parts.push(`notes: ${c.notes}`);
        lines.push("- " + parts.join(" | "));
    }
    return lines.join("\n");
}
