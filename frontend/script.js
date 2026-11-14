window.addEventListener("error", (event) => {
  const banner = document.getElementById("error-banner");
  if (!banner) return;
  banner.textContent = `Something went wrong while loading: ${event.message}. Try reloading the page.`;
  banner.hidden = false;
});

const API_BASE = window.location.origin;

let tasks = [];
let projects = [];
let folders = [];
let checklistToday = [];
let workoutWeek = [];
let loadedDate = null;
let currentPage = "home";
let currentView = "all";
let currentFolder = null;
let formView = null;

const el = {
  navHome: document.querySelector('.nav-item[data-page="home"]'),
  navTasks: document.querySelector('.nav-item[data-page="tasks"]'),
  allCount: document.getElementById("all-count"),
  projectList: document.getElementById("project-list"),
  addProjectForm: document.getElementById("add-project-form"),
  newProjectInput: document.getElementById("new-project-input"),
  projectListPage: document.getElementById("project-list-page"),
  addProjectFormPage: document.getElementById("add-project-form-page"),
  newProjectInputPage: document.getElementById("new-project-input-page"),
  pageProjects: document.getElementById("page-projects"),
  projectsCount: document.getElementById("projects-count"),
  projectsEmptyState: document.getElementById("projects-empty-state"),
  tabbarItems: document.querySelectorAll(".tabbar-item"),

  pageHome: document.getElementById("page-home"),
  pageTasks: document.getElementById("page-tasks"),
  homeDate: document.getElementById("home-date"),
  checklistItems: document.getElementById("checklist-items"),
  checklistEmptyState: document.getElementById("checklist-empty-state"),
  addChecklistForm: document.getElementById("add-checklist-form"),
  newChecklistInput: document.getElementById("new-checklist-input"),
  weekList: document.getElementById("week-list"),
  workoutToday: document.getElementById("workout-today"),
  workoutEmptyState: document.getElementById("workout-empty-state"),

  viewTitle: document.getElementById("view-title"),
  viewCount: document.getElementById("view-count"),
  addTaskForm: document.getElementById("add-task-form"),
  newTaskInput: document.getElementById("new-task-input"),
  newTaskProject: document.getElementById("new-task-project"),
  newTaskDue: document.getElementById("new-task-due"),
  scheduledList: document.getElementById("scheduled-list"),
  scheduledEmptyState: document.getElementById("scheduled-empty-state"),
  taskList: document.getElementById("task-list"),
  addExistingWrap: document.getElementById("add-existing-wrap"),
  addExistingSelect: document.getElementById("add-existing-select"),
  emptyState: document.getElementById("empty-state"),
  errorBanner: document.getElementById("error-banner"),

  crumbs: document.getElementById("crumbs"),
  newFolderBtn: document.getElementById("new-folder-btn"),
  newFolderForm: document.getElementById("new-folder-form"),
  newFolderInput: document.getElementById("new-folder-input"),
  cancelFolderBtn: document.getElementById("cancel-folder-btn"),
  folderList: document.getElementById("folder-list"),
  notice: document.getElementById("notice"),
  movePickerBackdrop: document.getElementById("move-picker-backdrop"),
  movePicker: document.getElementById("move-picker"),
  movePickerTitle: document.getElementById("move-picker-title"),
  movePickerBody: document.getElementById("move-picker-body"),
  movePickerClose: document.getElementById("move-picker-close"),
};

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    throw new Error("Can't reach the API. Is the backend running on port 8000?");
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch (_) {
    }
    throw new Error(detail);
  }

  if (response.status === 200 && response.headers.get("content-length") !== "0") {
    try {
      return await response.json();
    } catch (_) {
      return null;
    }
  }
  return null;
}

const api = {
  getTasks: () => apiRequest("/tasks"),
  createTask: (title, project_id, due_date, folder_id) =>
    apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({ title, project_id, due_date, folder_id }),
    }),
  updateTask: (id, fields) =>
    apiRequest(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    }),
  deleteTask: (id) => apiRequest(`/tasks/${id}`, { method: "DELETE" }),

  getProjects: () => apiRequest("/projects"),
  createProject: (name) =>
    apiRequest("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (id) => apiRequest(`/projects/${id}`, { method: "DELETE" }),

  getFolders: () => apiRequest("/folders"),
  createFolder: (project_id, parent_id, name) =>
    apiRequest("/folders", {
      method: "POST",
      body: JSON.stringify({ project_id, parent_id, name }),
    }),
  renameFolder: (id, name) =>
    apiRequest(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteFolder: (id) => apiRequest(`/folders/${id}`, { method: "DELETE" }),

  getChecklistToday: (date) => apiRequest(`/checklist/today?date=${date}`),
  createChecklistItem: (title) =>
    apiRequest("/checklist/items", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  deleteChecklistItem: (id) => apiRequest(`/checklist/items/${id}`, { method: "DELETE" }),
  completeChecklistItem: (id, date) =>
    apiRequest(`/checklist/today/${id}/complete?date=${date}`, { method: "POST" }),
  uncompleteChecklistItem: (id, date) =>
    apiRequest(`/checklist/today/${id}/complete?date=${date}`, { method: "DELETE" }),

  getWorkoutWeek: (today) => apiRequest(`/workouts/week?today=${today}`),
  completeWorkout: (planId, date, today) =>
    apiRequest(`/workouts/log/${planId}/complete?date=${date}&today=${today}`, { method: "POST" }),
  skipWorkout: (planId, date, today) =>
    apiRequest(`/workouts/log/${planId}/skip?date=${date}&today=${today}`, { method: "POST" }),
  resetWorkout: (planId, date, today) =>
    apiRequest(`/workouts/log/${planId}?date=${date}&today=${today}`, { method: "DELETE" }),
};

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.hidden = false;
}

function clearError() {
  el.errorBanner.hidden = true;
  el.errorBanner.textContent = "";
}

function showNotice(message) {
  el.notice.textContent = message;
  el.notice.hidden = false;
  setTimeout(() => {
    el.notice.hidden = true;
    el.notice.textContent = "";
  }, 5000);
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCreatedAt(sqliteTimestamp) {
  if (!sqliteTimestamp) return "Unknown";
  const date = new Date(sqliteTimestamp.replace(" ", "T") + "Z");
  if (isNaN(date)) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTodayHeading() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function aggregateDayStatus(day) {
  if (day.entries.length === 0) return "rest";
  if (day.entries.every((e) => e.status === "completed")) return "completed";
  if (day.entries.some((e) => e.status === "missed")) return "missed";
  return "pending";
}

function createInfoIcon(lines) {
  const lineList = Array.isArray(lines) ? lines : [lines];

  const wrap = document.createElement("span");
  wrap.className = "info-icon-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "info-icon";
  button.setAttribute("aria-label", lineList.join(" — "));
  button.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M8 7.2V11.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<circle cx="8" cy="5" r="0.9" fill="currentColor"/>' +
    "</svg>";
  button.addEventListener("click", (e) => e.stopPropagation());

  const tooltip = document.createElement("span");
  tooltip.className = "info-tooltip";
  tooltip.setAttribute("role", "tooltip");

  lineList.forEach((line) => {
    const lineEl = document.createElement("span");
    lineEl.className = "info-tooltip-line";
    lineEl.textContent = line;
    tooltip.appendChild(lineEl);
  });

  wrap.append(button, tooltip);
  return wrap;
}

function armDelete(button, onConfirm) {
  const original = button.innerHTML;
  let armed = false;
  let timer = null;

  const disarm = () => {
    armed = false;
    clearTimeout(timer);
    button.classList.remove("is-armed");
    button.innerHTML = original;
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true;
      button.classList.add("is-armed");
      button.textContent = "Delete?";
      timer = setTimeout(disarm, 3000);
      return;
    }
    clearTimeout(timer);
    onConfirm();
  });
}

function buildProjectItem(project) {
  const li = document.createElement("li");
  li.className =
    "project-item" +
    (currentPage === "tasks" && currentView === project.id ? " is-active" : "");

  const btn = document.createElement("button");
  btn.className = "project-item-btn";
  btn.type = "button";
  btn.addEventListener("click", () => navigate({ page: "tasks", view: project.id, folder: null }));

  const name = document.createElement("span");
  name.className = "project-item-name";
  name.textContent = project.name;

  const count = document.createElement("span");
  count.className = "project-item-count";
  count.textContent = project.task_count;

  btn.append(name, count);

  const actions = document.createElement("span");
  actions.className = "project-item-actions";

  const infoIcon = createInfoIcon(`Created ${formatCreatedAt(project.created_at)}`);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "project-item-delete";
  deleteBtn.type = "button";
  deleteBtn.setAttribute("aria-label", `Delete ${project.name}`);
  deleteBtn.innerHTML = "&times;";
  armDelete(deleteBtn, () => handleDeleteProject(project.id));

  actions.append(infoIcon, deleteBtn);
  li.append(btn, actions);
  return li;
}

function renderSidebar() {
  el.allCount.textContent = tasks.length;
  el.navHome.classList.toggle("is-active", currentPage === "home");
  el.navTasks.classList.toggle("is-active", currentPage === "tasks" && currentView === "all");

  el.tabbarItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.tab === currentPage);
  });

  [el.projectList, el.projectListPage].forEach((list) => {
    list.innerHTML = "";
    projects.forEach((project) => list.appendChild(buildProjectItem(project)));
  });

  el.projectsCount.textContent = `${projects.length} project${projects.length === 1 ? "" : "s"}`;
  el.projectsEmptyState.hidden = projects.length !== 0;

  const previousValue = el.newTaskProject.value;
  el.newTaskProject.innerHTML = '<option value="">No project</option>';
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    el.newTaskProject.appendChild(option);
  });
  el.newTaskProject.value = previousValue;
}

function renderPages() {
  el.pageHome.hidden = currentPage !== "home";
  el.pageTasks.hidden = currentPage !== "tasks";
  el.pageProjects.hidden = currentPage !== "projects";
}

function folderById(id) {
  return folders.find((f) => f.id === id);
}

function childFolders(projectId, parentId) {
  return folders
    .filter((f) => f.project_id === projectId && (f.parent_id ?? null) === (parentId ?? null))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function folderChain(folderId) {
  const chain = [];
  let current = folderById(folderId);
  while (current) {
    chain.unshift(current);
    current = folderById(current.parent_id);
  }
  return chain;
}

function folderPathText(folderId) {
  if (folderId === null) return "";
  const chain = folderChain(folderId);
  return chain.map((f) => f.name).join(" › ");
}

function subtreeStats(folderId) {
  let unfinished = 0;
  let total = 0;
  const countInFolder = (fid) => {
    tasks.forEach((t) => {
      if ((t.folder_id ?? null) === fid) {
        total++;
        if (!t.completed) unfinished++;
      }
    });
    childFolders(currentView, fid).forEach((f) => countInFolder(f.id));
  };
  countInFolder(folderId);
  return { unfinished, total };
}

function validateState() {
  if (currentFolder !== null) {
    const folder = folderById(currentFolder);
    if (!folder || folder.project_id !== currentView) {
      currentFolder = null;
    }
  }
}

function navigate(next) {
  if (
    next.page === currentPage &&
    next.view === currentView &&
    next.folder === currentFolder
  ) return;
  history.pushState(next, "");
  currentPage = next.page;
  currentView = next.view;
  currentFolder = next.folder;
  render();
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", (event) => {
  const state = event.state ?? { page: "home", view: "all", folder: null };
  currentPage = state.page;
  currentView = state.view;
  currentFolder = state.folder;
  render();
  window.scrollTo(0, 0);
});

function renderHome() {
  el.homeDate.textContent = formatTodayHeading();

  el.checklistItems.innerHTML = "";
  el.checklistEmptyState.hidden = checklistToday.length !== 0;

  checklistToday.forEach((item) => {
    const row = document.createElement("div");
    row.className = "checklist-item" + (item.completed_at ? " is-completed" : "");

    const checkbox = document.createElement("button");
    checkbox.className = "task-checkbox";
    checkbox.type = "button";
    checkbox.setAttribute("aria-label", item.completed_at ? "Mark incomplete" : "Mark complete");
    const mark = document.createElement("span");
    mark.className = "task-checkbox-mark";
    checkbox.appendChild(mark);
    checkbox.addEventListener("click", () => handleToggleChecklistItem(item));

    const title = document.createElement("span");
    title.className = "checklist-item-title";
    title.textContent = item.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "task-delete";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Remove "${item.title}"`);
    deleteBtn.innerHTML = "&times;";
    armDelete(deleteBtn, () => handleDeleteChecklistItem(item.id));

    row.append(checkbox, title, deleteBtn);
    el.checklistItems.appendChild(row);
  });

  renderScheduled();
  renderWeek();
  renderWorkoutToday();
}

const CHECK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

const CROSS_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  "</svg>";

const FOLDER_SVG =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' +
  "</svg>";

const CHEVRON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

const PENCIL_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';

const FOLDER_ARROW_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v10M12 10l-6 6M12 10l6 6"/></svg>';

const ARROW_LEFT_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

const CHECK_ICON_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

function renderScheduled() {
  const scheduled = getScheduledTasks();
  const previousScroll = el.scheduledList.scrollTop;

  el.scheduledList.innerHTML = "";
  el.scheduledEmptyState.hidden = scheduled.length !== 0;

  scheduled.forEach((task) => {
    const days = daysUntil(task.due_date);
    const row = document.createElement("div");
    row.className =
      "scheduled-row" + urgencyClass(days) + (task.completed ? " is-completed" : "");

    const checkbox = document.createElement("button");
    checkbox.className = "task-checkbox";
    checkbox.type = "button";
    checkbox.setAttribute("aria-label", `Mark "${task.title}" complete`);
    const mark = document.createElement("span");
    mark.className = "task-checkbox-mark";
    checkbox.appendChild(mark);
    checkbox.addEventListener("click", () => handleToggleComplete(task));

    const body = document.createElement("div");
    body.className = "scheduled-body";
    const title = document.createElement("span");
    title.className = "scheduled-title";
    title.textContent = task.title;

    let projectText = task.project_name || "No project";
    if (task.folder_id) {
      const folderPath = folderPathText(task.folder_id);
      if (folderPath) projectText = `${projectText} › ${folderPath}`;
    }
    const project = document.createElement("span");
    project.className = "scheduled-project";
    project.textContent = projectText;
    body.append(title, project);

    const due = document.createElement("span");
    due.className = "scheduled-due";
    due.textContent = dueLabel(days);

    row.append(checkbox, body, due);
    el.scheduledList.appendChild(row);
  });

  el.scheduledList.scrollTop = previousScroll;
  updateScheduledScrollHint();
}

function renderWeek() {
  const todayStr = getLocalDateString();
  el.weekList.innerHTML = "";

  workoutWeek.forEach((day) => {
    const status = aggregateDayStatus(day);

    const row = document.createElement("div");
    row.className = "week-row" + (day.date === todayStr ? " is-today" : "");

    const dayName = document.createElement("span");
    dayName.className = "week-row-day";
    dayName.textContent = DAY_NAMES[day.day_of_week];

    const workout = document.createElement("span");
    workout.className = "week-row-workout";
    workout.textContent =
      day.entries.length === 0 ? "Rest" : day.entries.map((e) => e.workout_name).join(" · ");
    workout.title = workout.textContent;

    const mark = document.createElement("span");
    mark.className = `week-row-mark is-${status}`;
    mark.setAttribute("aria-label", status);
    if (status === "completed") mark.innerHTML = CHECK_SVG;
    else if (status === "missed") mark.innerHTML = CROSS_SVG;
    else mark.textContent = "–";

    row.append(dayName, workout, mark);
    el.weekList.appendChild(row);
  });
}

function renderWorkoutToday() {
  const todayStr = getLocalDateString();
  const todayDay = workoutWeek.find((d) => d.date === todayStr);
  const entries = todayDay ? todayDay.entries : [];

  el.workoutToday.innerHTML = "";
  el.workoutEmptyState.hidden = entries.length !== 0;

  entries.forEach((entry) => {
    const wrap = document.createElement("div");
    wrap.className = "workout-entry";

    const name = document.createElement("span");
    name.className = "workout-entry-name";
    name.textContent = entry.workout_name;

    const actions = document.createElement("div");
    actions.className = "workout-actions";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "workout-btn workout-btn-done" + (entry.status === "completed" ? " is-active" : "");
    doneBtn.setAttribute("aria-label", "Mark workout done");
    doneBtn.innerHTML = CHECK_SVG;
    doneBtn.addEventListener("click", () => handleWorkoutAction(entry, "done"));

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "workout-btn workout-btn-skip" + (entry.status === "missed" ? " is-active" : "");
    skipBtn.setAttribute("aria-label", "Mark workout skipped");
    skipBtn.innerHTML = CROSS_SVG;
    skipBtn.addEventListener("click", () => handleWorkoutAction(entry, "skip"));

    actions.append(doneBtn, skipBtn);

    const status = document.createElement("span");
    status.className = `workout-status is-${entry.status}`;
    status.textContent =
      entry.status === "completed" ? "Done" : entry.status === "missed" ? "Skipped" : "Not done yet";

    wrap.append(name, actions, status);
    el.workoutToday.appendChild(wrap);
  });
}

const recentlyToggled = new Set();
const toggleTimers = new Map();

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [ty, tm, td] = getLocalDateString().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function formatDueShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueLabel(days) {
  if (days < 0) return `Overdue · ${-days}d`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function urgencyClass(days) {
  if (days < 0) return " is-overdue";
  if (days <= 2) return " is-red";
  if (days === 3) return " is-orange";
  return "";
}

function shownAsCompleted(task) {
  return recentlyToggled.has(task.id) ? !task.completed : task.completed;
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const aDone = shownAsCompleted(a);
    const bDone = shownAsCompleted(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone) return (b.completed_at || "").localeCompare(a.completed_at || "") || b.id - a.id;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return b.id - a.id;
  });
}

function getVisibleTasks() {
  if (currentView === "all") return tasks;
  return tasks.filter((t) => t.project_id === currentView && (t.folder_id ?? null) === (currentFolder ?? null));
}

function getScheduledTasks() {
  return tasks
    .filter((t) => t.due_date && !shownAsCompleted(t) && daysUntil(t.due_date) <= 7)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : b.id - a.id));
}

function updateScheduledScrollHint() {
  const list = el.scheduledList;
  const hiddenBelow = list.scrollHeight - list.scrollTop - list.clientHeight;
  list.classList.toggle("can-scroll-down", hiddenBelow > 4);
}

function renderBreadcrumbs() {
  if (currentView === "all") {
    el.crumbs.hidden = true;
    return;
  }
  el.crumbs.hidden = false;

  const project = projects.find((p) => p.id === currentView);
  if (!project) {
    el.crumbs.hidden = true;
    return;
  }

  el.crumbs.innerHTML = "";

  const upBtn = document.createElement("button");
  upBtn.id = "crumb-up";
  upBtn.type = "button";
  upBtn.className = "crumb-up";
  upBtn.setAttribute("aria-label", "Up");
  upBtn.innerHTML = ARROW_LEFT_SVG;
  upBtn.addEventListener("click", () => {
    if (currentFolder !== null) {
      const folder = folderById(currentFolder);
      navigate({ page: "tasks", view: currentView, folder: folder?.parent_id ?? null });
    } else {
      navigate({ page: "projects", view: "all", folder: null });
    }
  });
  if (currentFolder === null) {
    upBtn.hidden = true;
  }
  el.crumbs.appendChild(upBtn);

  const addCrumb = (text, onClick, isCurrent = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "crumb" + (isCurrent ? " is-current" : "");
    btn.textContent = text;
    if (!isCurrent) {
      btn.addEventListener("click", onClick);
    }
    el.crumbs.appendChild(btn);
  };

  addCrumb("Projects", () => navigate({ page: "projects", view: "all", folder: null }));
  addCrumb(project.name, () => navigate({ page: "tasks", view: currentView, folder: null }));

  const chain = folderChain(currentFolder);
  chain.forEach((folder) => {
    addCrumb(folder.name, () => navigate({ page: "tasks", view: currentView, folder: folder.id }));
  });

  if (!currentFolder) {
    const currentCrumb = el.crumbs.querySelector(".crumb:last-child");
    if (currentCrumb) currentCrumb.classList.add("is-current");
  }

  requestAnimationFrame(() => {
    el.crumbs.scrollLeft = el.crumbs.scrollWidth;
  });
}

function renderFolders() {
  el.folderList.innerHTML = "";

  if (currentView === "all") return;

  const childs = childFolders(currentView, currentFolder);

  childs.forEach((folder) => {
    const stats = subtreeStats(folder.id);
    const row = document.createElement("div");
    row.className = "folder-row";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "folder-open";
    openBtn.addEventListener("click", () => navigate({ page: "tasks", view: currentView, folder: folder.id }));

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML = FOLDER_SVG;

    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = folder.name;

    const meta = document.createElement("span");
    meta.className = "folder-meta";
    if (stats.total === 0) {
      meta.textContent = "Empty";
    } else if (stats.unfinished === 0) {
      meta.textContent = "All done";
    } else {
      meta.textContent = `${stats.unfinished} unfinished`;
    }

    const chevron = document.createElement("span");
    chevron.className = "folder-chevron";
    chevron.innerHTML = CHEVRON_SVG;

    openBtn.append(icon, name, meta, chevron);

    const actions = document.createElement("span");
    actions.className = "folder-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "folder-rename";
    renameBtn.setAttribute("aria-label", `Rename ${folder.name}`);
    renameBtn.innerHTML = PENCIL_SVG;
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startRenameFolder(folder, row, name);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "folder-delete";
    deleteBtn.setAttribute("aria-label", `Delete ${folder.name}`);
    deleteBtn.innerHTML = "&times;";
    armDelete(deleteBtn, () => handleDeleteFolder(folder.id));

    actions.append(renameBtn, deleteBtn);
    row.append(openBtn, actions);
    el.folderList.appendChild(row);
  });
}

function startRenameFolder(folder, row, nameEl) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "folder-rename-input";
  input.value = folder.name;
  input.maxLength = 60;

  let cancelled = false;

  const save = async () => {
    if (cancelled) return;
    cancelled = true;
    const newName = input.value.trim();
    if (!newName || newName === folder.name) {
      cancel();
      return;
    }
    try {
      await api.renameFolder(folder.id, newName);
      folders = await api.getFolders();
      clearError();
      render();
    } catch (err) {
      showError(err.message);
      cancel();
    }
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    nameEl.textContent = folder.name;
    const openBtn = row.querySelector(".folder-open");
    if (openBtn && input.parentNode === openBtn) {
      openBtn.replaceChild(nameEl, input);
    }
    input.removeEventListener("keydown", onKeydown);
    input.removeEventListener("blur", onBlur);
  };

  const onKeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  const onBlur = () => {
    save();
  };

  input.addEventListener("keydown", onKeydown);
  input.addEventListener("blur", onBlur);

  const openBtn = row.querySelector(".folder-open");
  if (openBtn) {
    openBtn.replaceChild(input, nameEl);
  }
  input.focus();
  input.select();
}

function renderTasks() {
  const visible = sortTasks(getVisibleTasks());

  if (currentView === "all") {
    el.viewTitle.textContent = "All tasks";
  } else if (currentFolder === null) {
    const project = projects.find((p) => p.id === currentView);
    el.viewTitle.textContent = project ? project.name : "Project";
  } else {
    const folder = folderById(currentFolder);
    el.viewTitle.textContent = folder ? folder.name : "Folder";
  }

  if (currentView === "all") {
    el.newTaskInput.placeholder = "Add a task…";
  } else if (currentFolder === null) {
    el.newTaskInput.placeholder = `Add a task to ${el.viewTitle.textContent}…`;
  } else {
    const path = folderPathText(currentFolder);
    const project = projects.find((p) => p.id === currentView);
    el.newTaskInput.placeholder = `Add a task to ${project?.name} › ${path}…`;
  }

  const finished = visible.filter((t) => t.completed).length;
  el.viewCount.textContent = `${visible.length - finished} unfinished · ${finished} finished`;

  el.newFolderBtn.hidden = currentView === "all";
  el.newFolderForm.hidden = true;

  el.taskList.innerHTML = "";
  el.emptyState.hidden = true;
  el.addExistingWrap.hidden = true;

  if (currentView !== "all") {
    if (childFolders(currentView, currentFolder).length === 0 && visible.length === 0) {
      el.emptyState.hidden = false;
      el.emptyState.textContent = "Nothing here yet. Add a task or create a folder.";
    }
    renderAddExisting();
  } else {
    if (visible.length === 0) {
      el.emptyState.hidden = false;
      el.emptyState.textContent = "Nothing here yet. Add a task above to get started.";
    }
  }

  visible.forEach((task) => {
    const row = document.createElement("div");
    row.className = "task-row" + (task.completed ? " is-completed" : "");

    const checkbox = document.createElement("button");
    checkbox.className = "task-checkbox";
    checkbox.type = "button";
    checkbox.setAttribute("aria-label", task.completed ? "Mark incomplete" : "Mark complete");
    const mark = document.createElement("span");
    mark.className = "task-checkbox-mark";
    checkbox.appendChild(mark);
    checkbox.addEventListener("click", () => handleToggleComplete(task));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    row.append(checkbox, title);

    const infoLines = [
      `Created ${formatCreatedAt(task.created_at)}`,
      task.completed ? `Completed ${formatCreatedAt(task.completed_at)}` : "Incomplete",
    ];
    if (task.folder_id && currentView !== "all") {
      const path = folderPathText(task.folder_id);
      if (path) infoLines.push(path);
    }
    const infoIcon = createInfoIcon(infoLines);
    row.appendChild(infoIcon);

    const projectSelect = document.createElement("select");
    projectSelect.className = "task-project-select";
    projectSelect.setAttribute("aria-label", `Change project for "${task.title}"`);

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "No project";
    projectSelect.appendChild(noneOption);

    projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      projectSelect.appendChild(option);
    });

    projectSelect.value = task.project_id ? String(task.project_id) : "";
    projectSelect.addEventListener("click", (e) => e.stopPropagation());
    projectSelect.addEventListener("change", () => {
      const newProjectId = projectSelect.value ? Number(projectSelect.value) : null;
      handleReassignTask(task.id, newProjectId);
    });

    const dueChip = document.createElement("label");
    dueChip.className = "task-due" + (task.due_date ? " has-date" : "");
    const dueText = document.createElement("span");
    dueText.textContent = task.due_date ? `Due ${formatDueShort(task.due_date)}` : "+ Due date";
    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.className = "task-due-input";
    dueInput.value = task.due_date || "";
    dueInput.setAttribute("aria-label", `Due date for "${task.title}"`);
    dueInput.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dueInput.showPicker) {
        try {
          dueInput.showPicker();
        } catch (_) {}
      }
    });
    dueInput.addEventListener("change", () => handleSetDueDate(task, dueInput.value));
    dueChip.append(dueText, dueInput);

    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "task-move";
    moveBtn.setAttribute("aria-label", `Move "${task.title}" to folder`);
    moveBtn.innerHTML = FOLDER_ARROW_SVG;
    if (task.project_id) {
      moveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMovePicker(task);
      });
    } else {
      moveBtn.style.visibility = "hidden";
    }

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.append(projectSelect, dueChip, moveBtn);
    row.appendChild(meta);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "task-delete";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Delete "${task.title}"`);
    deleteBtn.innerHTML = "&times;";
    armDelete(deleteBtn, () => handleDeleteTask(task.id));

    row.appendChild(deleteBtn);
    el.taskList.appendChild(row);
  });
}

function renderAddExisting() {
  if (currentView === "all") {
    el.addExistingWrap.hidden = true;
    return;
  }

  const candidates = tasks.filter((t) => t.project_id !== currentView);

  if (candidates.length === 0) {
    el.addExistingWrap.hidden = true;
    return;
  }

  el.addExistingWrap.hidden = false;
  el.addExistingSelect.innerHTML = '<option value="">Add existing task…</option>';
  candidates.forEach((task) => {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.project_name ? `${task.title} (${task.project_name})` : task.title;
    el.addExistingSelect.appendChild(option);
  });
}

function defaultProjectValue() {
  return currentView === "all" ? "" : String(currentView);
}

function syncAddTaskProject() {
  if (formView !== currentView) {
    el.newTaskProject.value = defaultProjectValue();
    formView = currentView;
  }
}

function render() {
  validateState();
  syncAddTaskProject();
  renderPages();
  renderSidebar();
  renderHome();
  renderBreadcrumbs();
  renderFolders();
  renderTasks();
  renderAddExisting();
}

async function loadAll() {
  try {
    const today = getLocalDateString();
    const [taskData, projectData, folderData, checklistData, weekData] = await Promise.all([
      api.getTasks(),
      api.getProjects(),
      api.getFolders().catch(() => []),
      api.getChecklistToday(today),
      api.getWorkoutWeek(today),
    ]);
    tasks = taskData;
    projects = projectData;
    folders = folderData;
    checklistToday = checklistData;
    workoutWeek = weekData;
    loadedDate = today;
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function handleAddTask(e) {
  e.preventDefault();
  const title = el.newTaskInput.value.trim();
  if (!title) return;

  const projectValue = el.newTaskProject.value;
  const project_id = projectValue ? Number(projectValue) : null;
  const due_date = el.newTaskDue.value || null;
  const folder_id = project_id === currentView ? (currentFolder ?? null) : null;

  try {
    const created = await api.createTask(title, project_id, due_date, folder_id);
    tasks.unshift(created);
    el.newTaskInput.value = "";
    el.newTaskDue.value = "";
    el.newTaskProject.value = defaultProjectValue();
    await refreshProjectCounts();
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function handleToggleComplete(task) {
  try {
    const updated = await api.updateTask(task.id, { completed: !task.completed });
    tasks = tasks.map((t) => (t.id === task.id ? updated : t));
    recentlyToggled.add(task.id);
    clearTimeout(toggleTimers.get(task.id));
    toggleTimers.set(
      task.id,
      setTimeout(() => {
        recentlyToggled.delete(task.id);
        toggleTimers.delete(task.id);
        renderTasks();
        renderHome();
      }, 450)
    );
    clearError();
    renderTasks();
    renderHome();
  } catch (err) {
    showError(err.message);
  }
}

async function handleSetDueDate(task, value) {
  try {
    const updated = await api.updateTask(task.id, { due_date: value || null });
    tasks = tasks.map((t) => (t.id === task.id ? updated : t));
    clearError();
    renderTasks();
    renderHome();
  } catch (err) {
    showError(err.message);
    renderTasks();
  }
}

async function handleReassignTask(id, project_id) {
  try {
    const task = tasks.find((t) => t.id === id);
    const folder_id = project_id === currentView ? (currentFolder ?? null) : null;
    const updated = await api.updateTask(id, { project_id, folder_id });
    tasks = tasks.map((t) => (t.id === id ? updated : t));
    await refreshProjectCounts();
    clearError();
    render();
  } catch (err) {
    showError(err.message);
    render();
  }
}

async function handleDeleteTask(id) {
  try {
    await api.deleteTask(id);
    tasks = tasks.filter((t) => t.id !== id);
    await refreshProjectCounts();
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function handleAddProject(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const input = form.id === "add-project-form-page" ? el.newProjectInputPage : el.newProjectInput;
  const name = input.value.trim();
  if (!name) return;

  try {
    const created = await api.createProject(name);
    projects.push(created);
    input.value = "";
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function handleDeleteProject(id) {
  try {
    await api.deleteProject(id);
    projects = projects.filter((p) => p.id !== id);
    if (currentView === id) {
      navigate({ page: "tasks", view: "all", folder: null });
    }
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function refreshProjectCounts() {
  try {
    projects = await api.getProjects();
  } catch (err) {
  }
}

async function handleToggleChecklistItem(item) {
  const date = getLocalDateString();
  try {
    const updated = item.completed_at
      ? await api.uncompleteChecklistItem(item.id, date)
      : await api.completeChecklistItem(item.id, date);
    checklistToday = checklistToday.map((i) => (i.id === item.id ? updated : i));
    clearError();
    renderHome();
  } catch (err) {
    showError(err.message);
  }
}

async function handleAddChecklistItem(e) {
  e.preventDefault();
  const title = el.newChecklistInput.value.trim();
  if (!title) return;

  try {
    await api.createChecklistItem(title);
    el.newChecklistInput.value = "";
    checklistToday = await api.getChecklistToday(getLocalDateString());
    clearError();
    renderHome();
  } catch (err) {
    showError(err.message);
  }
}

async function handleDeleteChecklistItem(id) {
  try {
    await api.deleteChecklistItem(id);
    checklistToday = checklistToday.filter((i) => i.id !== id);
    clearError();
    renderHome();
  } catch (err) {
    showError(err.message);
  }
}

async function handleWorkoutAction(entry, action) {
  const today = getLocalDateString();
  try {
    if (action === "done") {
      if (entry.status === "completed") await api.resetWorkout(entry.plan_id, today, today);
      else await api.completeWorkout(entry.plan_id, today, today);
    } else {
      if (entry.status === "missed") await api.resetWorkout(entry.plan_id, today, today);
      else await api.skipWorkout(entry.plan_id, today, today);
    }
    workoutWeek = await api.getWorkoutWeek(today);
    clearError();
    renderHome();
  } catch (err) {
    showError(err.message);
  }
}

el.newFolderBtn.addEventListener("click", () => {
  el.newFolderForm.hidden = false;
  el.newFolderInput.value = "";
  el.newFolderInput.focus();
});

el.cancelFolderBtn.addEventListener("click", () => {
  el.newFolderForm.hidden = true;
});

el.newFolderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = el.newFolderInput.value.trim();
  if (!name) return;

  try {
    const created = await api.createFolder(currentView, currentFolder, name);
    folders.push(created);
    el.newFolderForm.hidden = true;
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
});

async function handleDeleteFolder(id) {
  try {
    const folder = folderById(id);
    const destName = folder?.parent_id ? folderById(folder.parent_id)?.name : (projects.find((p) => p.id === currentView)?.name ?? "Project");
    const result = await api.deleteFolder(id);
    folders = await api.getFolders();
    tasks = await api.getTasks();
    await refreshProjectCounts();
    showNotice(`Folder deleted. ${result.moved_tasks} task${result.moved_tasks === 1 ? "" : "s"} and ${result.moved_folders} folder${result.moved_folders === 1 ? "" : "s"} moved to ${destName}.`);
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

let movePickerTaskId = null;

function openMovePicker(task) {
  movePickerTaskId = task.id;
  el.movePickerTitle.textContent = `Move "${task.title}"`;
  el.movePickerBody.innerHTML = "";

  const project = projects.find((p) => p.id === currentView);
  if (!project) return;

  const addRow = (text, folderId, isCurrent = false, depth = 0) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "picker-row" + (isCurrent ? " is-current" : "");
    row.style.paddingLeft = `${16 + depth * 18}px`;

    if (folderId === null) {
      row.innerHTML = `<span class="picker-icon">${FOLDER_SVG}</span> <span>${text}</span>`;
    } else {
      row.innerHTML = `<span class="picker-icon">${FOLDER_SVG}</span> <span>${text}</span>`;
    }

    if (isCurrent) {
      const check = document.createElement("span");
      check.className = "picker-check";
      check.innerHTML = CHECK_ICON_SVG;
      row.appendChild(check);
    }

    row.addEventListener("click", () => {
      if (folderId === (task.folder_id ?? null)) {
        closeMovePicker();
        return;
      }
      handleMoveTask(task.id, folderId);
      closeMovePicker();
    });

    el.movePickerBody.appendChild(row);
  };

  addRow(`<strong>${project.name}</strong>`, null, (task.folder_id ?? null) === null, 0);

  function addFolderTree(parentId, depth) {
    const childs = childFolders(currentView, parentId);
    childs.forEach((folder) => {
      const isCurrent = folder.id === (task.folder_id ?? null);
      addRow(folder.name, folder.id, isCurrent, depth + 1);
      addFolderTree(folder.id, depth + 1);
    });
  }

  addFolderTree(null, 0);

  if (childFolders(currentView, null).length === 0) {
    const empty = document.createElement("div");
    empty.className = "picker-empty";
    empty.textContent = "No folders yet.";
    el.movePickerBody.appendChild(empty);
  }

  el.movePickerBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeMovePicker() {
  el.movePickerBackdrop.hidden = true;
  document.body.style.overflow = "";
  movePickerTaskId = null;
}

async function handleMoveTask(taskId, folderId) {
  try {
    const updated = await api.updateTask(taskId, { folder_id: folderId });
    tasks = tasks.map((t) => (t.id === taskId ? updated : t));
    clearError();
    render();
  } catch (err) {
    showError(err.message);
  }
}

el.movePickerClose.addEventListener("click", closeMovePicker);
el.movePickerBackdrop.addEventListener("click", (e) => {
  if (e.target === el.movePickerBackdrop) closeMovePicker();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.movePickerBackdrop.hidden) {
    closeMovePicker();
  }
});

el.navHome.addEventListener("click", () => navigate({ page: "home", view: "all", folder: null }));

el.navTasks.addEventListener("click", () => navigate({ page: "tasks", view: "all", folder: null }));

el.addTaskForm.addEventListener("submit", handleAddTask);
el.addProjectForm.addEventListener("submit", handleAddProject);
el.addProjectFormPage.addEventListener("submit", handleAddProject);
el.addChecklistForm.addEventListener("submit", handleAddChecklistItem);

el.tabbarItems.forEach((item) => {
  item.addEventListener("click", () => {
    const tab = item.dataset.tab;
    if (tab === "home") navigate({ page: "home", view: "all", folder: null });
    else if (tab === "tasks") navigate({ page: "tasks", view: "all", folder: null });
    else if (tab === "projects") navigate({ page: "projects", view: "all", folder: null });
    window.scrollTo(0, 0);
  });
});

el.scheduledList.addEventListener("scroll", updateScheduledScrollHint);
window.addEventListener("resize", updateScheduledScrollHint);

el.addExistingSelect.addEventListener("change", () => {
  const taskId = Number(el.addExistingSelect.value);
  if (!taskId) return;
  handleReassignTask(taskId, currentView);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && loadedDate && getLocalDateString() !== loadedDate) {
    loadAll();
  }
});

history.replaceState({ page: "home", view: "all", folder: null }, "");

loadAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}