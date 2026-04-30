// ─── TASKS ────────────────────────────────────────────────────────────────────

async function loadTasks() {
    if (!state.activeProject) return;
    state.currentTask = null;
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    renderTaskList(tasks);
    // Show placeholder, hide form
    const placeholder = document.getElementById("task-detail-placeholder");
    const form = document.getElementById("task-detail-form");
    if (placeholder) placeholder.style.display = "flex";
    if (form) form.style.display = "none";
    // Clear filter
    const filterEl = document.getElementById("task-filter");
    if (filterEl) filterEl.value = "";
}

function _taskStatusIcon(status) {
    if (status === "done") return "✅";
    if (status === "in-progress") return "🔄";
    return "⬜";
}

function _taskPriorityColor(priority) {
    if (priority === "high") return "var(--danger, #e55)";
    if (priority === "low") return "var(--text-muted)";
    return "var(--accent)";
}

function renderTaskList(tasks) {
    const list = document.getElementById("task-list");
    if (!list) return;
    list.innerHTML = "";
    if (!tasks || tasks.length === 0) {
        list.innerHTML =
            '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic">No tasks yet. Click + New Task to create one.</div>';
        return;
    }
    // Sort: todo/in-progress first, then done; within group by createdAt desc
    const sorted = [...tasks].sort((a, b) => {
        const order = { todo: 0, "in-progress": 1, done: 2 };
        const oa = order[a.status] ?? 0;
        const ob = order[b.status] ?? 0;
        if (oa !== ob) return oa - ob;
        return b.createdAt - a.createdAt;
    });
    sorted.forEach((t) => {
        const el = document.createElement("div");
        el.className =
            "sq-item" +
            (state.currentTask && state.currentTask.id === t.id
                ? " active"
                : "");
        el.dataset.taskId = t.id;
        const icon = _taskStatusIcon(t.status);
        const prioColor = _taskPriorityColor(t.priority);
        const dueStr = t.dueDate
            ? '<span style="font-size:10px;color:var(--text-muted);margin-left:4px">due ' +
              t.dueDate +
              "</span>"
            : "";
        const ctxDot = t.includeInContext
            ? '<span title="In context" style="color:var(--accent);font-size:10px;margin-left:4px">●</span>'
            : "";
        el.innerHTML = `<span class="sq-item-icon" style="font-size:14px">${icon}</span>
<div class="sq-item-text">
  <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
    <span style="font-size:12px;color:var(--text);font-weight:500;word-break:break-word">${(t.title || "Untitled").replace(/</g, "&lt;")}</span>
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${prioColor};flex-shrink:0" title="${t.priority || "medium"} priority"></span>
    ${ctxDot}
  </div>
  <div style="display:flex;align-items:center;gap:4px">${dueStr}</div>
</div>`;
        el.onclick = () => selectTask(t.id);
        list.appendChild(el);
    });
}

async function selectTask(taskId) {
    const task = await dbGet("tasks", taskId);
    if (!task) return;
    state.currentTask = task;

    // Highlight in list
    document.querySelectorAll("#task-list .sq-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.taskId === taskId);
    });

    // Show form, hide placeholder
    const placeholder = document.getElementById("task-detail-placeholder");
    const form = document.getElementById("task-detail-form");
    if (placeholder) placeholder.style.display = "none";
    if (form) form.style.display = "flex";

    // Fill fields
    const titleInput = document.getElementById("task-title-input");
    const descInput = document.getElementById("task-desc-input");
    const dueInput = document.getElementById("task-due-input");
    const ctxToggle = document.getElementById("task-ctx-toggle");
    const deleteBtn = document.getElementById("task-delete-btn");

    if (titleInput) titleInput.value = task.title || "";
    if (descInput) descInput.value = task.description || "";
    if (dueInput) dueInput.value = task.dueDate || "";
    if (ctxToggle) ctxToggle.checked = !!task.includeInContext;
    if (deleteBtn) deleteBtn.style.display = "";

    // Status pills
    _setActivePillByVal("task-status-pills", task.status || "todo");
    // Priority pills
    _setActivePillByVal("task-priority-pills", task.priority || "medium");
}

function _setActivePillByVal(containerId, val) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(".type-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.val === val);
    });
}

function _getActivePillVal(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return "";
    const active = container.querySelector(".type-pill.active");
    return active ? active.dataset.val : "";
}

function openNewTask() {
    if (!state.activeProject) return;
    state.currentTask = null;

    // Deselect list items
    document
        .querySelectorAll("#task-list .sq-item")
        .forEach((el) => el.classList.remove("active"));

    // Show form, hide placeholder
    const placeholder = document.getElementById("task-detail-placeholder");
    const form = document.getElementById("task-detail-form");
    if (placeholder) placeholder.style.display = "none";
    if (form) form.style.display = "flex";

    // Clear fields
    const titleInput = document.getElementById("task-title-input");
    const descInput = document.getElementById("task-desc-input");
    const dueInput = document.getElementById("task-due-input");
    const ctxToggle = document.getElementById("task-ctx-toggle");
    const deleteBtn = document.getElementById("task-delete-btn");

    if (titleInput) {
        titleInput.value = "";
        titleInput.focus();
    }
    if (descInput) descInput.value = "";
    if (dueInput) dueInput.value = "";
    if (ctxToggle) ctxToggle.checked = false;
    if (deleteBtn) deleteBtn.style.display = "none";

    // Default pills
    _setActivePillByVal("task-status-pills", "todo");
    _setActivePillByVal("task-priority-pills", "medium");
}

async function saveCurrentTask() {
    if (!state.activeProject) return;

    const titleInput = document.getElementById("task-title-input");
    const descInput = document.getElementById("task-desc-input");
    const dueInput = document.getElementById("task-due-input");
    const ctxToggle = document.getElementById("task-ctx-toggle");

    const title = titleInput ? titleInput.value.trim() : "";
    if (!title) {
        if (titleInput) titleInput.focus();
        return;
    }

    const now = Date.now();
    const status = _getActivePillVal("task-status-pills") || "todo";
    const priority = _getActivePillVal("task-priority-pills") || "medium";
    const description = descInput ? descInput.value.trim() : "";
    const dueDate = dueInput ? dueInput.value : "";
    const includeInContext = ctxToggle ? ctxToggle.checked : false;

    if (state.currentTask) {
        // Update existing
        state.currentTask.title = title;
        state.currentTask.description = description;
        state.currentTask.status = status;
        state.currentTask.priority = priority;
        state.currentTask.dueDate = dueDate;
        state.currentTask.includeInContext = includeInContext;
        state.currentTask.updatedAt = now;
        await dbPut("tasks", state.currentTask);
    } else {
        // Create new
        const task = {
            id: uid(),
            projectId: state.activeProject.id,
            title,
            description,
            status,
            priority,
            dueDate,
            includeInContext,
            createdAt: now,
            updatedAt: now,
        };
        await dbPut("tasks", task);
        state.currentTask = task;
    }

    // Reload list and re-select
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    renderTaskList(tasks);
    if (state.currentTask) {
        document.querySelectorAll("#task-list .sq-item").forEach((el) => {
            el.classList.toggle(
                "active",
                el.dataset.taskId === state.currentTask.id,
            );
        });
        // Show delete button
        const deleteBtn = document.getElementById("task-delete-btn");
        if (deleteBtn) deleteBtn.style.display = "";
    }
}

async function deleteCurrentTask() {
    if (!state.currentTask) return;
    if (!confirm("Delete this task?")) return;
    await dbDelete("tasks", state.currentTask.id);
    state.currentTask = null;

    const placeholder = document.getElementById("task-detail-placeholder");
    const form = document.getElementById("task-detail-form");
    if (placeholder) placeholder.style.display = "flex";
    if (form) form.style.display = "none";

    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    renderTaskList(tasks);
}

async function filterTaskList(value) {
    if (!state.activeProject) return;
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    const q = (value || "").toLowerCase().trim();
    const filtered = q
        ? tasks.filter(
              (t) =>
                  (t.title || "").toLowerCase().includes(q) ||
                  (t.description || "").toLowerCase().includes(q),
          )
        : tasks;
    renderTaskList(filtered);
}

async function toggleTaskStatus(taskId) {
    const task = await dbGet("tasks", taskId);
    if (!task) return;
    const cycle = { todo: "in-progress", "in-progress": "done", done: "todo" };
    task.status = cycle[task.status] || "todo";
    task.updatedAt = Date.now();
    await dbPut("tasks", task);
    if (state.currentTask && state.currentTask.id === taskId) {
        state.currentTask.status = task.status;
        _setActivePillByVal("task-status-pills", task.status);
    }
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    renderTaskList(tasks);
}

async function exportTasksMarkdown() {
    if (!state.activeProject) return;
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    if (!tasks || tasks.length === 0) {
        alert("No tasks to export.");
        return;
    }

    const statusGroups = [
        { key: "todo", label: "To Do" },
        { key: "in-progress", label: "In Progress" },
        { key: "done", label: "Done" },
    ];
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityLabel = { high: "High", medium: "Medium", low: "Low" };

    const today = new Date().toISOString().slice(0, 10);
    let md = "# Tasks \u2014 " + state.activeProject.name + "\n";
    md += "*Exported: " + today + "*\n";

    for (const group of statusGroups) {
        const grouped = tasks.filter((t) => (t.status || "todo") === group.key);
        if (!grouped.length) continue;
        grouped.sort(
            (a, b) =>
                (priorityOrder[a.priority] ?? 1) -
                (priorityOrder[b.priority] ?? 1),
        );
        md += "\n## " + group.label + "\n";
        for (const t of grouped) {
            md += "\n### " + (t.title || "Untitled") + "\n";
            md +=
                "**Priority:** " +
                (priorityLabel[t.priority] || "Medium") +
                "  **Due:** " +
                (t.dueDate || "\u2014") +
                "\n";
            if (t.description && t.description.trim()) {
                md += "\n" + t.description.trim() + "\n";
            }
            md += "\n---\n";
        }
    }

    const safeName = state.activeProject.name
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks-" + safeName + "-" + today + ".md";
    a.click();
    URL.revokeObjectURL(url);
}

async function exportTasksCSV() {
    if (!state.activeProject) return;
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    if (!tasks || tasks.length === 0) {
        alert("No tasks to export.");
        return;
    }

    const statusLabel = {
        todo: "To Do",
        "in-progress": "In Progress",
        done: "Done",
    };
    const priorityLabel = { low: "Low", medium: "Medium", high: "High" };
    function csvEscTask(val) {
        return '"' + String(val ?? "").replace(/"/g, '""') + '"';
    }

    let csv = "Title,Status,Priority,Due Date,Description\n";
    for (const t of tasks) {
        csv +=
            [
                csvEscTask(t.title || ""),
                csvEscTask(statusLabel[t.status] || t.status || ""),
                csvEscTask(priorityLabel[t.priority] || t.priority || ""),
                csvEscTask(t.dueDate || ""),
                csvEscTask(t.description || ""),
            ].join(",") + "\n";
    }

    const today = new Date().toISOString().slice(0, 10);
    const safeName = state.activeProject.name
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks-" + safeName + "-" + today + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

async function toggleTaskInContext(taskId) {
    const task = await dbGet("tasks", taskId);
    if (!task) return;
    task.includeInContext = !task.includeInContext;
    task.updatedAt = Date.now();
    await dbPut("tasks", task);
    if (state.currentTask && state.currentTask.id === taskId) {
        state.currentTask.includeInContext = task.includeInContext;
        const ctxToggle = document.getElementById("task-ctx-toggle");
        if (ctxToggle) ctxToggle.checked = task.includeInContext;
    }
    const tasks = await dbGetByIndex(
        "tasks",
        "projectId",
        state.activeProject.id,
    );
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    renderTaskList(tasks);
}
