// ============================================
// Config
// ============================================

const API_BASE = "http://127.0.0.1:8000";

// ============================================
// State
// ============================================

let tasks = [];
let projects = [];
let checklistToday = [];
let workoutWeek = [];
let loadedDate = null;
let currentPage = "home"; // "home" | "tasks"
let currentView = "all"; // "all" | project id (number)

// ============================================
// DOM refs
// ============================================

const el = {
  navHome: document.querySelector('.nav-item[data-page="home"]'),
  navTasks: document.querySelector('.nav-item[data-page="tasks"]'),
  allCount: document.getElementById("all-count"),
  projectList: document.getElementById("project-list"),
  addProjectForm: document.getElementById("add-project-form"),
  newProjectInput: document.getElementById("new-project-input"),

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
  taskList: document.getElementById("task-list"),
  addExistingWrap: document.getElementById("add-existing-wrap"),
  addExistingSelect: document.getElementById("add-existing-select"),
  emptyState: document.getElementById("empty-state"),
  errorBanner: document.getElementById("error-banner"),
};

// ============================================
// API helpers
// ============================================

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
      /* no JSON body */
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
  createTask: (title, project_id) =>
    apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({ title, project_id }),
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

// ============================================
// Error banner
// ============================================

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.hidden = false;
}

function clearError() {
  el.errorBanner.hidden = true;
  el.errorBanner.textContent = "";
}

// ============================================
// Helpers
// ============================================

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

// ============================================
// Rendering
// ============================================

function renderSidebar() {
  el.allCount.textContent = tasks.length;
  el.navHome.classList.toggle("is-active", currentPage === "home");
  el.navTasks.classList.toggle("is-active", currentPage === "tasks" && currentView === "all");

  el.projectList.innerHTML = "";
  projects.forEach((project) => {
    const li = document.createElement("li");
    li.className =
      "project-item" +
      (currentPage === "tasks" && currentView === project.id ? " is-active" : "");

    const btn = document.createElement("button");
    btn.className = "project-item-btn";
    btn.type = "button";
    btn.addEventListener("click", () => {
      currentPage = "tasks";
      currentView = project.id;
      render();
    });

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
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteProject(project.id);
    });

    actions.append(infoIcon, deleteBtn);
    li.append(btn, actions);
    el.projectList.appendChild(li);
  });

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
}

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
    deleteBtn.addEventListener("click", () => handleDeleteChecklistItem(item.id));

    row.append(checkbox, title, deleteBtn);
    el.checklistItems.appendChild(row);
  });

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
    wrap.append(name, actions);
    el.workoutToday.appendChild(wrap);
  });
}

function getVisibleTasks() {
  if (currentView === "all") return tasks;
  return tasks.filter((t) => t.project_id === currentView);
}

function renderTasks() {
  const visible = getVisibleTasks();

  if (currentView === "all") {
    el.viewTitle.textContent = "All tasks";
  } else {
    const project = projects.find((p) => p.id === currentView);
    el.viewTitle.textContent = project ? project.name : "Project";
  }
  el.viewCount.textContent = `${visible.length} task${visible.length === 1 ? "" : "s"}`;

  el.taskList.innerHTML = "";
  el.emptyState.hidden = visible.length !== 0;

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

    const infoIcon = createInfoIcon([
      `Created ${formatCreatedAt(task.created_at)}`,
      task.completed ? `Completed ${formatCreatedAt(task.completed_at)}` : "Incomplete",
    ]);
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

    row.appendChild(projectSelect);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "task-delete";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Delete "${task.title}"`);
    deleteBtn.innerHTML = "&times;";
    deleteBtn.addEventListener("click", () => handleDeleteTask(task.id));

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

function render() {
  renderPages();
  renderSidebar();
  renderHome();
  renderTasks();
  renderAddExisting();
}

// ============================================
// Actions
// ============================================

async function loadAll() {
  try {
    const today = getLocalDateString();
    const [taskData, projectData, checklistData, weekData] = await Promise.all([
      api.getTasks(),
      api.getProjects(),
      api.getChecklistToday(today),
      api.getWorkoutWeek(today),
    ]);
    tasks = taskData;
    projects = projectData;
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

  try {
    const created = await api.createTask(title, project_id);
    tasks.unshift(created);
    el.newTaskInput.value = "";
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
    clearError();
    renderTasks();
  } catch (err) {
    showError(err.message);
  }
}

async function handleReassignTask(id, project_id) {
  try {
    const updated = await api.updateTask(id, { project_id });
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
  const name = el.newProjectInput.value.trim();
  if (!name) return;

  try {
    const created = await api.createProject(name);
    projects.push(created);
    el.newProjectInput.value = "";
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
    if (currentView === id) currentView = "all";
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
    /* non-fatal */
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

// ============================================
// Event wiring
// ============================================

el.navHome.addEventListener("click", () => {
  currentPage = "home";
  render();
});

el.navTasks.addEventListener("click", () => {
  currentPage = "tasks";
  currentView = "all";
  render();
});

el.addTaskForm.addEventListener("submit", handleAddTask);
el.addProjectForm.addEventListener("submit", handleAddProject);
el.addChecklistForm.addEventListener("submit", handleAddChecklistItem);

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

// ============================================
// Init
// ============================================

loadAll();