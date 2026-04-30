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

// ─── FOLDER HELPERS ──────────────────────────────────────────────────────────
//
// TWO separate folder strategies:
//
//  1. appDataFolder  (scope: drive.appdata)
//     Hidden from the user's Drive UI. Used for config and DB backups.
//     Parent alias = "appDataFolder" — no folder creation needed, Drive
//     manages it automatically per-app.
//
//  2. Visible "SourceDesk" root + per-project subfolders  (scope: drive.file)
//     Visible in the user's My Drive. Used for exports (Sheets, Docs, etc.).
//     We can only see/create files *we* created (drive.file scope), so we
//     store the folder IDs in appDataFolder config to avoid re-querying.
//
// Config file stored in appDataFolder: "sourcedesk-config.json"
//   { visibleRootFolderId, projectFolderIds: { [projectId]: folderId } }

async function convertFileToDriveText(file, token) {
    const ext = file.name.split(".").pop().toLowerCase();
    let sourceMime, googleMime, exportMime;
    if (ext === "docx") {
        sourceMime =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        googleMime = "application/vnd.google-apps.document";
        exportMime = "text/plain";
    } else if (ext === "xlsx") {
        sourceMime =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        googleMime = "application/vnd.google-apps.spreadsheet";
        exportMime = "text/csv";
    } else if (ext === "pptx") {
        sourceMime =
            "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        googleMime = "application/vnd.google-apps.presentation";
        exportMime = "text/plain";
    } else {
        throw new Error("Unsupported type for Drive conversion: " + file.name);
    }

    // Upload with multipart, setting mimeType to Google Apps type triggers auto-conversion
    const metadata = {
        name: file.name,
        mimeType: googleMime,
        parents: ["appDataFolder"],
    };
    const form = new FormData();
    form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append(
        "file",
        new Blob([await file.arrayBuffer()], { type: sourceMime }),
    );

    const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: form,
        },
    );
    if (!uploadRes.ok) await _driveApiError(uploadRes);
    const { id } = await uploadRes.json();

    // Export as plain text / CSV
    const exportRes = await fetch(
        "https://www.googleapis.com/drive/v3/files/" +
            id +
            "/export?mimeType=" +
            encodeURIComponent(exportMime),
        { headers: { Authorization: "Bearer " + token } },
    );
    if (!exportRes.ok) {
        // Best-effort delete before throwing
        fetch("https://www.googleapis.com/drive/v3/files/" + id, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
        }).catch(() => {});
        await _driveApiError(exportRes);
    }
    const text = await exportRes.text();

    // Clean up temp file (non-fatal)
    fetch("https://www.googleapis.com/drive/v3/files/" + id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
    }).catch(() => {});

    return text;
}

async function _driveApiError(res) {
    const e = await res.json().catch(() => ({}));
    throw new Error(
        (e.error && e.error.message) || "Drive API error " + res.status,
    );
}

// ── appDataFolder config read/write ──────────────────────────────────────────

async function _loadDriveConfig(token) {
    // List files in appDataFolder named "sourcedesk-config.json"
    const res = await fetch(
        "https://www.googleapis.com/drive/v3/files" +
            "?spaces=appDataFolder" +
            "&q=name%3D'sourcedesk-config.json'" +
            "&fields=files(id,name)&pageSize=1",
        { headers: { Authorization: "Bearer " + token } },
    );
    if (!res.ok) await _driveApiError(res);
    const data = await res.json();
    if (!data.files || !data.files.length) return { projectFolderIds: {} };
    const fileId = data.files[0].id;
    const content = await fetch(
        "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
        { headers: { Authorization: "Bearer " + token } },
    );
    if (!content.ok) return { projectFolderIds: {} };
    try {
        return await content.json();
    } catch {
        return { projectFolderIds: {} };
    }
}

async function _saveDriveConfig(token, config) {
    // Find existing config file id
    const res = await fetch(
        "https://www.googleapis.com/drive/v3/files" +
            "?spaces=appDataFolder" +
            "&q=name%3D'sourcedesk-config.json'" +
            "&fields=files(id)&pageSize=1",
        { headers: { Authorization: "Bearer " + token } },
    );
    const data = res.ok ? await res.json() : { files: [] };
    const json = JSON.stringify(config);
    const blob = new Blob([json], { type: "application/json" });

    if (data.files && data.files.length) {
        // PATCH (update) existing file
        const fileId = data.files[0].id;
        const form = new FormData();
        form.append(
            "metadata",
            new Blob([JSON.stringify({})], { type: "application/json" }),
        );
        form.append("file", blob);
        await fetch(
            "https://www.googleapis.com/upload/drive/v3/files/" +
                fileId +
                "?uploadType=multipart",
            {
                method: "PATCH",
                headers: { Authorization: "Bearer " + token },
                body: form,
            },
        );
    } else {
        // Create new config file in appDataFolder
        const meta = {
            name: "sourcedesk-config.json",
            parents: ["appDataFolder"],
        };
        const form = new FormData();
        form.append(
            "metadata",
            new Blob([JSON.stringify(meta)], { type: "application/json" }),
        );
        form.append("file", blob);
        await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: form,
            },
        );
    }
}

// ── Visible folder helpers (drive.file scope) ────────────────────────────────

async function _createFolder(token, name, parentId) {
    const body = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) body.parents = [parentId];
    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) await _driveApiError(res);
    const f = await res.json();
    return f.id;
}

// Returns the visible SourceDesk root folder ID, creating it if needed.
// Persists the ID to appDataFolder config so we don't create duplicates.
async function getOrCreateVisibleRootFolder(token) {
    const config = await _loadDriveConfig(token);
    if (config.visibleRootFolderId) return config.visibleRootFolderId;
    const folderId = await _createFolder(token, "SourceDesk", null);
    config.visibleRootFolderId = folderId;
    await _saveDriveConfig(token, config);
    return folderId;
}

// Returns a per-project subfolder ID inside the visible SourceDesk root,
// creating it (and the root) if needed.
async function getOrCreateProjectFolder(token, projectId, projectName) {
    const config = await _loadDriveConfig(token);
    if (!config.projectFolderIds) config.projectFolderIds = {};
    if (config.projectFolderIds[projectId])
        return config.projectFolderIds[projectId];
    // Ensure root exists
    if (!config.visibleRootFolderId) {
        config.visibleRootFolderId = await _createFolder(
            token,
            "SourceDesk",
            null,
        );
    }
    const safeName = (projectName || "Project")
        .replace(/[\\/:\*\?"<>|]/g, "-")
        .trim();
    const folderId = await _createFolder(
        token,
        safeName,
        config.visibleRootFolderId,
    );
    config.projectFolderIds[projectId] = folderId;
    await _saveDriveConfig(token, config);
    return folderId;
}

// Legacy alias — kept so backupToDrive can call a single helper.
// Backups go to appDataFolder (hidden), NOT the visible folder.
async function getOrCreateAppFolder(token) {
    // appDataFolder is a magic alias — no real folder object to create.
    // Return the string "appDataFolder" which the Drive API accepts as a parent.
    return "appDataFolder";
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
            "embeddings",
            "contacts",
            "suggestions",
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

        // Backups go to the hidden appDataFolder — invisible to the user
        // but protected from accidental deletion and inaccessible to other apps.
        const metadata = {
            name: filename,
            mimeType: "application/json",
            parents: ["appDataFolder"],
        };

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
        alert(
            "Backup saved to Google Drive (hidden app folder): " +
                (file.name || filename) +
                "\n\nThis file is stored in your Google Drive's hidden Application Data folder — " +
                "only SourceDesk can see it. Use Settings → Import DB to restore.",
        );
    } catch (err) {
        alert("Backup failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Backup Database to Drive";
        }
    }
}

// ─── SHEETS IMPORT / EXPORT ──────────────────────────────────────────────────

function parseSpreadsheetId(input) {
    if (!input) return input;
    const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : input.trim();
}

function importSheetsQuestionsFromInput() {
    const el = document.getElementById("sheets-import-id");
    const raw = el ? el.value.trim() : "";
    if (!raw) {
        alert("Paste a Spreadsheet ID or URL first.");
        return;
    }
    const token = state.settings.driveToken;
    if (!token) {
        alert("Connect to Google Drive first.");
        return;
    }
    const spreadsheetId = parseSpreadsheetId(raw);
    importSheetsQuestions(spreadsheetId, token);
}

async function importSheetsQuestions(spreadsheetId, token) {
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    try {
        const res = await fetch(
            "https://sheets.googleapis.com/v4/spreadsheets/" +
                encodeURIComponent(spreadsheetId) +
                "/values/A:Z",
            { headers: { Authorization: "Bearer " + token } },
        );
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(
                (e.error && e.error.message) ||
                    "Sheets API error " + res.status,
            );
        }
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length < 2) {
            alert("Sheet is empty or has no data rows.");
            return;
        }
        const headers = rows[0].map((h) => String(h).toLowerCase().trim());
        const qIdx = headers.indexOf("question");
        if (qIdx === -1) {
            alert('No "question" column found in the sheet header row.');
            return;
        }
        const aIdx = headers.indexOf("answer");
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const question = (row[qIdx] || "").trim();
            if (!question) continue;
            const answer = aIdx >= 0 ? (row[aIdx] || "").trim() : "";
            await dbPut("questions", {
                id: uid(),
                projectId: state.activeProject.id,
                question,
                answer,
                updatedAt: Date.now(),
            });
            count++;
        }
        alert("Imported " + count + " questions from sheet.");
    } catch (err) {
        alert("Import failed: " + err.message);
    }
}

async function exportQuestionsToSheets(token) {
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    if (!token) {
        alert("Connect to Google Drive first.");
        return;
    }
    try {
        const questions = await dbGetByIndex(
            "questions",
            "projectId",
            state.activeProject.id,
        );
        const date = new Date().toISOString().slice(0, 10);
        const title =
            "SourceDesk Questions \u2013 " +
            state.activeProject.name +
            " \u2013 " +
            date;
        // Create spreadsheet
        const createRes = await fetch(
            "https://sheets.googleapis.com/v4/spreadsheets",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    properties: { title },
                    sheets: [{ properties: { title: "Questions" } }],
                }),
            },
        );
        if (!createRes.ok) {
            const e = await createRes.json().catch(() => ({}));
            throw new Error(
                (e.error && e.error.message) ||
                    "Sheets API error " + createRes.status,
            );
        }
        const sheet = await createRes.json();
        const ssId = sheet.spreadsheetId;
        // Move the new spreadsheet into the project's visible Drive folder
        try {
            const projFolderId = await getOrCreateProjectFolder(
                token,
                state.activeProject.id,
                state.activeProject.name,
            );
            // Add the project folder as a parent (Drive API: addParents)
            await fetch(
                "https://www.googleapis.com/drive/v3/files/" +
                    ssId +
                    "?addParents=" +
                    encodeURIComponent(projFolderId) +
                    "&fields=id,parents",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer " + token,
                        "Content-Type": "application/json",
                    },
                    body: "{}",
                },
            );
        } catch (_) {
            /* non-fatal: sheet is still created */
        }
        // Build values
        const values = [["Question", "Answer"]].concat(
            questions.map((q) => [q.question || "", q.answer || ""]),
        );
        const updateRes = await fetch(
            "https://sheets.googleapis.com/v4/spreadsheets/" +
                ssId +
                "/values/Questions!A1:B" +
                values.length +
                "?valueInputOption=RAW",
            {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    range: "Questions!A1",
                    majorDimension: "ROWS",
                    values,
                }),
            },
        );
        if (!updateRes.ok) {
            const e = await updateRes.json().catch(() => ({}));
            throw new Error(
                (e.error && e.error.message) ||
                    "Sheets API error " + updateRes.status,
            );
        }
        const url = "https://docs.google.com/spreadsheets/d/" + ssId + "/edit";
        window.open(url, "_blank");
        alert(
            "Questions exported to Google Sheets in your SourceDesk/" +
                state.activeProject.name +
                " Drive folder.",
        );
    } catch (err) {
        alert("Export failed: " + err.message);
    }
}

// ─── CSV IMPORT / EXPORT ──────────────────────────────────────────────────────

function csvQuote(val) {
    const s = String(val == null ? "" : val);
    return '"' + s.replace(/"/g, '""') + '"';
}

async function exportQuestionsToCSV() {
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    const questions = await dbGetByIndex(
        "questions",
        "projectId",
        state.activeProject.id,
    );
    const date = new Date().toISOString().slice(0, 10);
    const rows = ['"Question","Answer"'].concat(
        questions.map((q) => csvQuote(q.question) + "," + csvQuote(q.answer)),
    );
    const csv = rows.join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    const safeName = state.activeProject.name
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
    a.download = "questions-" + safeName + "-" + date + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importQuestionsFromCSV(file) {
    if (!file) return;
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.onerror = rej;
        r.readAsText(file);
    });
    // Minimal CSV parser that handles quoted fields (including embedded commas/newlines)
    function parseCSV(str) {
        const rows = [];
        let row = [],
            field = "",
            inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (inQuote) {
                if (ch === '"') {
                    if (str[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else inQuote = false;
                } else {
                    field += ch;
                }
            } else {
                if (ch === '"') {
                    inQuote = true;
                } else if (ch === ",") {
                    row.push(field);
                    field = "";
                } else if (
                    ch === "\n" ||
                    (ch === "\r" && str[i + 1] === "\n")
                ) {
                    if (ch === "\r") i++;
                    row.push(field);
                    field = "";
                    if (row.some((f) => f !== "")) rows.push(row);
                    row = [];
                } else {
                    field += ch;
                }
            }
        }
        if (field !== "" || row.length > 0) {
            row.push(field);
            if (row.some((f) => f !== "")) rows.push(row);
        }
        return rows;
    }
    const rows = parseCSV(text);
    if (rows.length < 2) {
        alert("CSV has no data rows.");
        return;
    }
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const qIdx = headers.indexOf("question");
    if (qIdx === -1) {
        alert('No "question" column in CSV header.');
        return;
    }
    const aIdx = headers.indexOf("answer");
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const question = (row[qIdx] || "").trim();
        if (!question) continue;
        const answer = aIdx >= 0 ? (row[aIdx] || "").trim() : "";
        await dbPut("questions", {
            id: uid(),
            projectId: state.activeProject.id,
            question,
            answer,
            updatedAt: Date.now(),
        });
        count++;
    }
    alert("Imported " + count + " questions from CSV.");
}

// ─── GOOGLE DOCS EXPORT ───────────────────────────────────────────────────────

async function exportToGoogleDoc(title, content, token) {
    if (!token) {
        alert("Connect to Google Drive first.");
        return;
    }
    try {
        // Create the document
        const createRes = await fetch(
            "https://docs.googleapis.com/v1/documents",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ title }),
            },
        );
        if (!createRes.ok) {
            const e = await createRes.json().catch(() => ({}));
            throw new Error(
                (e.error && e.error.message) ||
                    "Docs API error " + createRes.status,
            );
        }
        const doc = await createRes.json();
        const docId = doc.documentId;
        // If there's an active project, move this doc into the project's visible Drive folder
        if (state.activeProject) {
            try {
                const projFolderId = await getOrCreateProjectFolder(
                    token,
                    state.activeProject.id,
                    state.activeProject.name,
                );
                await fetch(
                    "https://www.googleapis.com/drive/v3/files/" +
                        docId +
                        "?addParents=" +
                        encodeURIComponent(projFolderId) +
                        "&fields=id,parents",
                    {
                        method: "PATCH",
                        headers: {
                            Authorization: "Bearer " + token,
                            "Content-Type": "application/json",
                        },
                        body: "{}",
                    },
                );
            } catch (_) {
                /* non-fatal */
            }
        }
        const updateRes = await fetch(
            "https://docs.googleapis.com/v1/documents/" +
                docId +
                ":batchUpdate",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requests: [
                        {
                            insertText: {
                                location: { index: 1 },
                                text: content,
                            },
                        },
                    ],
                }),
            },
        );
        if (!updateRes.ok) {
            const e = await updateRes.json().catch(() => ({}));
            throw new Error(
                (e.error && e.error.message) ||
                    "Docs API error " + updateRes.status,
            );
        }
        const url = "https://docs.google.com/document/d/" + docId + "/edit";
        window.open(url, "_blank");
        return url;
    } catch (err) {
        alert("Export to Google Doc failed: " + err.message);
    }
}

async function exportQuestionsToDoc() {
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    const token = state.settings.driveToken;
    if (!token) {
        alert("Connect to Google Drive first.");
        return;
    }
    const questions = await dbGetByIndex(
        "questions",
        "projectId",
        state.activeProject.id,
    );
    if (!questions.length) {
        alert("No questions to export.");
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const title =
        "SourceDesk Questions \u2013 " +
        state.activeProject.name +
        " \u2013 " +
        date;
    const lines = questions.map((q, i) => {
        const qLine = i + 1 + ". " + (q.question || "");
        const aLine = q.answer
            ? "Answer: " + q.answer
            : "Answer: (not yet answered)";
        return qLine + "\n" + aLine;
    });
    const content = lines.join("\n\n");
    await exportToGoogleDoc(title, content, token);
}

async function exportWorkingDocToDoc() {
    if (!state.activeProject) {
        alert("Open a project first.");
        return;
    }
    const token = state.settings.driveToken;
    if (!token) {
        alert("Connect to Google Drive first.");
        return;
    }
    const content = state.activeProject.workingContent || "";
    if (!content.trim()) {
        alert("The working doc is empty.");
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const title =
        "SourceDesk Working Doc \u2013 " +
        state.activeProject.name +
        " \u2013 " +
        date;
    await exportToGoogleDoc(title, content, token);
}

// ─── DATABASE VALIDATION ──────────────────────────────────────────────────────

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
    // notes, embeddings stores are optional — older backups won't have them
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
        "embeddings",
        "contacts",
        "suggestions",
    ];
    for (const s of stores) {
        const items = await dbGetAll(s);
        for (const item of items)
            await dbDelete(s, item[s === "settings" ? "key" : "id"]);
    }
    for (const s of stores) {
        // some stores may be absent in older backups — skip gracefully
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
