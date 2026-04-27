// ─── GOOGLE DRIVE CONNECTOR ──────────────────────────────────────────────────

function openDriveModal() {
    const tokenEl = document.getElementById("drive-token-input");
    if (tokenEl) tokenEl.value = state.settings.driveToken || "";
    updateDriveStatus();
    showModal("modal-drive");
    if (state.settings.driveToken) {
        listDriveFiles();
    }
}

function updateDriveStatus() {
    const hasToken = !!state.settings.driveToken;
    const browserEl = document.getElementById("drive-browser");
    const backupEl = document.getElementById("drive-backup-section");
    const statusEl = document.getElementById("drive-connect-status");
    if (hasToken) {
        if (browserEl) browserEl.classList.remove("hidden");
        if (backupEl) backupEl.classList.remove("hidden");
        if (statusEl) {
            statusEl.textContent =
                "Token saved — click Connect / Verify to confirm it's still valid.";
            statusEl.style.color = "var(--text-muted)";
        }
    } else {
        if (browserEl) browserEl.classList.add("hidden");
        if (backupEl) backupEl.classList.add("hidden");
        if (statusEl) {
            statusEl.textContent = "Not connected";
            statusEl.style.color = "var(--text-muted)";
        }
    }
}

async function verifyDriveToken() {
    const tokenEl = document.getElementById("drive-token-input");
    const token = tokenEl ? tokenEl.value.trim() : "";
    const statusEl = document.getElementById("drive-connect-status");
    if (!token) {
        if (statusEl) {
            statusEl.textContent = "Paste an access token first.";
            statusEl.style.color = "var(--danger)";
        }
        return;
    }
    if (statusEl) {
        statusEl.textContent = "Verifying…";
        statusEl.style.color = "var(--text-muted)";
    }
    try {
        const res = await fetch(
            "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" +
                encodeURIComponent(token),
        );
        const info = await res.json();
        if (info.error) {
            throw new Error(info.error_description || info.error);
        }
        // Save token to state + DB
        state.settings.driveToken = token;
        await dbPut("settings", { key: "driveToken", value: token });

        const email = info.email ? " as " + info.email : "";
        const mins = info.expires_in
            ? " · expires in " + Math.round(info.expires_in / 60) + " min"
            : "";
        if (statusEl) {
            statusEl.textContent = "Connected" + email + mins;
            statusEl.style.color = "var(--success)";
        }
        const browserEl = document.getElementById("drive-browser");
        const backupEl = document.getElementById("drive-backup-section");
        if (browserEl) browserEl.classList.remove("hidden");
        if (backupEl) backupEl.classList.remove("hidden");
        await listDriveFiles();
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = "Invalid or expired token: " + err.message;
            statusEl.style.color = "var(--danger)";
        }
    }
}

async function disconnectDrive() {
    state.settings.driveToken = "";
    await dbPut("settings", { key: "driveToken", value: "" });
    const tokenEl = document.getElementById("drive-token-input");
    if (tokenEl) tokenEl.value = "";
    const browserEl = document.getElementById("drive-browser");
    const backupEl = document.getElementById("drive-backup-section");
    const statusEl = document.getElementById("drive-connect-status");
    const listEl = document.getElementById("drive-file-list");
    if (browserEl) browserEl.classList.add("hidden");
    if (backupEl) backupEl.classList.add("hidden");
    if (statusEl) {
        statusEl.textContent = "Disconnected";
        statusEl.style.color = "var(--text-muted)";
    }
    if (listEl) listEl.innerHTML = "";
}

async function listDriveFiles() {
    const token = state.settings.driveToken;
    if (!token) return;
    const searchEl = document.getElementById("drive-search");
    const q = searchEl ? searchEl.value.trim() : "";
    const listEl = document.getElementById("drive-file-list");
    if (listEl) {
        listEl.innerHTML =
            '<div style="color:var(--text-muted);padding:12px;text-align:center;font-size:12px">Loading…</div>';
    }

    // Only list file types we can import as text
    let gq =
        "trashed=false and (" +
        "mimeType='text/plain' or " +
        "mimeType='text/markdown' or " +
        "mimeType='text/csv' or " +
        "mimeType='application/json' or " +
        "mimeType='application/vnd.google-apps.document'" +
        ")";
    if (q) {
        gq += " and name contains '" + q.replace(/'/g, "\\'") + "'";
    }
    const url =
        "https://www.googleapis.com/drive/v3/files?" +
        "q=" +
        encodeURIComponent(gq) +
        "&fields=files(id,name,mimeType,modifiedTime,size)" +
        "&pageSize=50" +
        "&orderBy=modifiedTime+desc";

    try {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const data = await res.json();
        renderDriveFileList(data.files || []);
    } catch (err) {
        if (listEl) {
            listEl.innerHTML =
                '<div style="color:var(--danger);padding:12px;font-size:12px">Error: ' +
                err.message +
                "</div>";
        }
    }
}

function renderDriveFileList(files) {
    const listEl = document.getElementById("drive-file-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!files.length) {
        const empty = document.createElement("div");
        empty.style.cssText =
            "color:var(--text-muted);padding:12px;text-align:center;font-size:12px";
        empty.textContent = "No supported files found";
        listEl.appendChild(empty);
        return;
    }
    for (const f of files) {
        const item = document.createElement("div");
        item.className = "drive-file-item";

        const info = document.createElement("div");
        info.className = "drive-file-info";

        const nameEl = document.createElement("span");
        nameEl.className = "drive-file-name";
        nameEl.textContent = f.name;

        const metaEl = document.createElement("span");
        metaEl.className = "drive-file-meta";
        const typeLabel =
            f.mimeType === "application/vnd.google-apps.document"
                ? "Google Doc"
                : f.mimeType.split("/").pop().toUpperCase();
        const dateLabel = f.modifiedTime
            ? new Date(f.modifiedTime).toLocaleDateString()
            : "";
        metaEl.textContent = typeLabel + (dateLabel ? " · " + dateLabel : "");

        info.appendChild(nameEl);
        info.appendChild(metaEl);

        const btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.style.cssText = "font-size:12px;padding:4px 10px;flex-shrink:0";
        btn.textContent = "Import";
        // Capture loop variables in closure
        (function (fileId, fileName, mimeType) {
            btn.onclick = function () {
                importFromDrive(fileId, fileName, mimeType);
            };
        })(f.id, f.name, f.mimeType);

        item.appendChild(info);
        item.appendChild(btn);
        listEl.appendChild(item);
    }
}

async function importFromDrive(fileId, fileName, mimeType) {
    if (!state.activeProject) {
        alert(
            "Open a project first — imported files are added as project documents.",
        );
        return;
    }
    const token = state.settings.driveToken;
    if (!token) return;

    let url;
    if (mimeType === "application/vnd.google-apps.document") {
        url =
            "https://www.googleapis.com/drive/v3/files/" +
            fileId +
            "/export?mimeType=text%2Fplain";
    } else {
        url =
            "https://www.googleapis.com/drive/v3/files/" +
            fileId +
            "?alt=media";
    }

    try {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const content = await res.text();
        const doc = {
            id: uid(),
            projectId: state.activeProject.id,
            name: fileName,
            content: content,
            uploadedAt: Date.now(),
        };
        await dbPut("docs", doc);
        await renderRightPanel();
        closeModal();
        alert('"' + fileName + '" imported as a document in this project.');
    } catch (err) {
        alert("Import failed: " + err.message);
    }
}

async function backupToDrive() {
    const token = state.settings.driveToken;
    if (!token) return;
    const btn = document.getElementById("drive-backup-btn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Uploading…";
    }
    try {
        const stores = [
            "templates",
            "projects",
            "docs",
            "chats",
            "notes",
            "settings",
        ];
        const data = {
            version: DB_VERSION,
            appVersion: APP_VERSION,
            exportedAt: new Date().toISOString(),
            stores: {},
        };
        for (const s of stores) data.stores[s] = await dbGetAll(s);
        const json = JSON.stringify(data, null, 2);
        const filename =
            "sourcedesk-backup-" +
            new Date().toISOString().slice(0, 10) +
            ".json";
        const metadata = { name: filename, mimeType: "application/json" };

        const form = new FormData();
        form.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], { type: "application/json" }),
        );
        form.append("file", new Blob([json], { type: "application/json" }));

        const res = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: form,
            },
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
                (err.error && err.error.message) ||
                    "Drive API error " + res.status,
            );
        }
        const file = await res.json();
        alert("Backup saved to Google Drive: " + (file.name || filename));
    } catch (err) {
        alert("Backup failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Backup Database to Drive";
        }
    }
}

function validateImportShape(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (typeof obj.version !== "number") return false;
    if (typeof obj.exportedAt !== "string") return false;
    if (!obj.stores || typeof obj.stores !== "object") return false;
    if (
        !["templates", "projects", "docs", "chats", "settings"].every((k) =>
            Array.isArray(obj.stores[k]),
        )
    )
        return false;
    // notes store is optional — older backups won't have it
    return true;
}

function triggerImportDialog() {
    document.getElementById("import-file-input").click();
}

async function importDatabase(file) {
    if (!file) return;
    const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.onerror = rej;
        r.readAsText(file);
    });
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        alert("Invalid JSON file.");
        return;
    }
    if (!validateImportShape(data)) {
        alert("File does not appear to be a valid SourceDesk backup.");
        return;
    }
    if (
        !confirm(
            `Import backup from ${data.exportedAt}?\n\nThis will REPLACE all current data.`,
        )
    )
        return;
    const stores = [
        "templates",
        "projects",
        "docs",
        "chats",
        "settings",
        "notes",
    ];
    for (const s of stores) {
        const items = await dbGetAll(s);
        for (const item of items)
            await dbDelete(s, item[s === "settings" ? "key" : "id"]);
    }
    for (const s of stores) {
        // notes may be absent in older backups — skip gracefully
        if (!data.stores[s]) continue;
        for (const item of data.stores[s]) await dbPut(s, item);
    }
    location.reload();
}

async function exportProject() {
    if (!state.activeProject) return;
    const docs = await dbGetByIndex(
        "docs",
        "projectId",
        state.activeProject.id,
    );

    // Ask the user whether to include full document bodies (may be large)
    const includeBodies = confirm(
        "Include full document bodies in the export? The file may be large. Click OK to include, Cancel to exclude.",
    );

    const payload = {
        project: state.activeProject,
        messages: state.messages,
        docs: docs.map((d) => {
            const base = {
                id: d.id,
                name: d.name,
                uploadedAt: d.uploadedAt,
            };
            if (includeBodies) base.content = d.content;
            return base;
        }),
        exportedAt: new Date().toISOString(),
        includeFullDocs: !!includeBodies,
    };

    const json = JSON.stringify(payload, null, 2);
    const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    const safeName = state.activeProject.name
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
    a.download = `${safeName}-export${includeBodies ? "-full" : ""}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
