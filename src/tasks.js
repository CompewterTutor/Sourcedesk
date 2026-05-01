// ─── TASKS ────────────────────────────────────────────────────────────────────

// Calendar state
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-based
let _calSelectedDay = null; // 'YYYY-MM-DD' or null

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
  // Re-render calendar if visible
  const _calVisEl = document.getElementById("task-calendar");
  if (_calVisEl && _calVisEl.style.display !== "none") {
    renderTaskCalendar(tasks);
  }
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
      (state.currentTask && state.currentTask.id === t.id ? " active" : "");
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
      el.classList.toggle("active", el.dataset.taskId === state.currentTask.id);
    });
    // Show delete button
    const deleteBtn = document.getElementById("task-delete-btn");
    if (deleteBtn) deleteBtn.style.display = "";
  }
  // Update calendar dots if visible
  const _calSaveEl = document.getElementById("task-calendar");
  if (_calSaveEl && _calSaveEl.style.display !== "none") {
    renderTaskCalendar(tasks);
  }
}

// Debounced public hook — wired from oninput on task fields. Only saves an
// existing task; new (unsaved) tasks must use the explicit Save Task button
// because we need a title to be set before persisting.
function scheduleTaskAutosave() {
  if (!state.currentTask) return;
  scheduleAutosave("task", async function () {
    await saveCurrentTask();
  });
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
  // Update calendar dots if visible
  const _calDelEl = document.getElementById("task-calendar");
  if (_calDelEl && _calDelEl.style.display !== "none") {
    renderTaskCalendar(tasks);
  }
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
  // Update calendar dots if visible
  const _calStatEl = document.getElementById("task-calendar");
  if (_calStatEl && _calStatEl.style.display !== "none") {
    renderTaskCalendar(tasks);
  }
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
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1),
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
  // Update calendar dots if visible
  const _calCtxEl = document.getElementById("task-calendar");
  if (_calCtxEl && _calCtxEl.style.display !== "none") {
    renderTaskCalendar(tasks);
  }
}

// ─── TASK CALENDAR ───────────────────────────────────────────────────────────

function renderTaskCalendar(tasks) {
  var calEl = document.getElementById("task-calendar");
  if (!calEl) return;

  var MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var todayStr = new Date().toISOString().slice(0, 10);

  // Build tasksByDate map — only tasks that have a dueDate
  var tasksByDate = new Map();
  (tasks || []).forEach(function (t) {
    if (!t.dueDate) return;
    if (!tasksByDate.has(t.dueDate)) tasksByDate.set(t.dueDate, []);
    tasksByDate.get(t.dueDate).push(t);
  });

  // Highest-priority dot colour for a given day: high = danger, else accent
  function _dotColor(dayTasks) {
    return dayTasks.some(function (t) {
      return (t.priority || "medium") === "high";
    })
      ? "var(--danger)"
      : "var(--accent)";
  }

  var firstDow = new Date(_calYear, _calMonth, 1).getDay();
  var daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();

  // Day-name header row
  var dayHeadersHtml = DAYS.map(function (n) {
    return (
      '<div style="text-align:center;font-size:10px;color:var(--text-muted);' +
      'font-weight:600;padding:2px 0">' +
      n +
      "</div>"
    );
  }).join("");

  // Build day cells: leading empty spacers + one cell per day
  var cells = "";
  for (var i = 0; i < firstDow; i++) {
    cells += "<div></div>";
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var mm = String(_calMonth + 1).padStart(2, "0");
    var dd = String(d).padStart(2, "0");
    var dateStr = _calYear + "-" + mm + "-" + dd;
    var isToday = dateStr === todayStr;
    var isSelected = dateStr === _calSelectedDay;
    var dayTasks = tasksByDate.get(dateStr) || [];
    var hasTasks = dayTasks.length > 0;

    var bg = "";
    if (isSelected) bg = "background:var(--accent);color:#000;";
    else if (isToday) bg = "background:var(--accent-dim);color:var(--text);";
    else if (hasTasks) bg = "background:var(--surface2);";

    // Priority dots (max 3, then +N overflow label)
    var dotsHtml = "";
    if (hasTasks) {
      var shown = dayTasks.slice(0, 3);
      var extra = dayTasks.length - shown.length;
      var dc = _dotColor(dayTasks);
      dotsHtml =
        '<div style="display:flex;gap:2px;justify-content:center;' +
        'flex-wrap:wrap;margin-top:1px">';
      shown.forEach(function () {
        dotsHtml +=
          '<span style="display:inline-block;width:5px;height:5px;' +
          "border-radius:50%;background:" +
          dc +
          '"></span>';
      });
      if (extra > 0) {
        dotsHtml +=
          '<span style="font-size:8px;color:var(--text-muted);' +
          'line-height:8px">+' +
          extra +
          "</span>";
      }
      dotsHtml += "</div>";
    }

    cells +=
      "<div onclick=\"_calSelectDay('" +
      dateStr +
      "')\" " +
      'style="min-height:36px;padding:2px;text-align:center;border-radius:3px;' +
      "cursor:pointer;font-size:11px;" +
      bg +
      '">' +
      "<span>" +
      d +
      "</span>" +
      dotsHtml +
      "</div>";
  }

  var gridStyle = "display:grid;grid-template-columns:repeat(7,1fr);gap:2px;";

  calEl.innerHTML =
    // Nav header: Prev / Month+Year / Next / Today
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
    '<button class="btn-icon" onclick="_calNav(-1)" ' +
    'style="padding:2px 8px;font-size:14px" title="Previous month">&#8249;</button>' +
    '<span style="flex:1;text-align:center;font-size:12px;font-weight:600;color:var(--text)">' +
    MONTHS[_calMonth] +
    " " +
    _calYear +
    "</span>" +
    '<button class="btn-icon" onclick="_calNav(1)" ' +
    'style="padding:2px 8px;font-size:14px" title="Next month">&#8250;</button>' +
    '<button class="btn-secondary" onclick="_calToday()" ' +
    'style="font-size:10px;padding:2px 6px">Today</button>' +
    "</div>" +
    // Day-name header grid
    '<div style="' +
    gridStyle +
    'margin-bottom:4px">' +
    dayHeadersHtml +
    "</div>" +
    // Day cell grid
    '<div style="' +
    gridStyle +
    '">' +
    cells +
    "</div>";
}

// Internal helper: fetch tasks for the active project and re-render the calendar.
async function _calRender() {
  if (!state.activeProject) return;
  var tasks = await dbGetByIndex("tasks", "projectId", state.activeProject.id);
  renderTaskCalendar(tasks);
}

// Navigate calendar by one month. direction: -1 = prev, +1 = next.
function _calNav(direction) {
  _calMonth += direction;
  if (_calMonth < 0) {
    _calMonth = 11;
    _calYear--;
  }
  if (_calMonth > 11) {
    _calMonth = 0;
    _calYear++;
  }
  _calRender();
}

// Jump calendar to current month and clear day selection.
function _calToday() {
  var now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  _calSelectedDay = null;
  _calRender();
  // Reset task list to show all tasks
  if (state.activeProject) {
    dbGetByIndex("tasks", "projectId", state.activeProject.id).then(
      function (tasks) {
        tasks.sort(function (a, b) {
          return b.createdAt - a.createdAt;
        });
        renderTaskList(tasks);
      },
    );
  }
}

// Select (or deselect) a day; filter the task list to that day's tasks.
async function _calSelectDay(dateStr) {
  _calSelectedDay = _calSelectedDay === dateStr ? null : dateStr; // toggle
  _calRender();
  if (!state.activeProject) return;
  var tasks = await dbGetByIndex("tasks", "projectId", state.activeProject.id);
  if (_calSelectedDay) {
    var filtered = tasks.filter(function (t) {
      return t.dueDate === _calSelectedDay;
    });
    renderTaskList(filtered);
  } else {
    tasks.sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });
    renderTaskList(tasks);
  }
}

// Toggle the calendar widget on/off above the task list.
function toggleTaskCalendar() {
  var calEl = document.getElementById("task-calendar");
  var btn = document.getElementById("task-cal-toggle-btn");
  if (!calEl) return;
  if (calEl.style.display !== "none") {
    // Hide
    calEl.style.display = "none";
    if (btn) btn.style.opacity = "0.5";
    _calSelectedDay = null;
    loadTasks();
  } else {
    // Show
    calEl.style.display = "block";
    if (btn) btn.style.opacity = "1";
    _calRender();
  }
}
