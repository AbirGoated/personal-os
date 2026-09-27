import sqlite3
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.database import (
    get_tasks, get_task, create_task, delete_task, update_task,
    get_projects, get_project, create_project, update_project, delete_project,
    create_checklist_item, get_checklist_items, delete_checklist_item,
    get_checklist_today, complete_checklist_item, uncomplete_checklist_item,
    create_workout_plan, get_workout_plan, delete_workout_plan,
    get_workout_week, get_workout_entry, log_workout, clear_workout_log,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Task(BaseModel):
    title: str
    completed: bool = False
    project_id: int | None = None

class TaskUpdate(BaseModel):
    title: str | None = None
    completed: bool | None = None
    project_id: int | None = None

class TaskOut(BaseModel):
    id: int
    title: str
    completed: bool = False
    project_id: int | None = None
    project_name: str | None = None
    created_at: str
    completed_at: str | None = None

class Project(BaseModel):
    name: str

class ProjectUpdate(BaseModel):
    name: str | None = None

class ProjectOut(BaseModel):
    id: int
    name: str
    task_count: int
    created_at: str

class ChecklistItem(BaseModel):
    title: str

class ChecklistItemOut(BaseModel):
    id: int
    title: str
    active: bool
    created_at: str

class ChecklistTodayOut(BaseModel):
    id: int
    title: str
    completed_at: str | None = None

class WorkoutPlanIn(BaseModel):
    day_of_week: int
    workout_name: str

class WorkoutPlanOut(BaseModel):
    id: int
    day_of_week: int
    workout_name: str
    created_at: str

class WorkoutEntryOut(BaseModel):
    plan_id: int
    workout_name: str
    status: str

class WorkoutDayOut(BaseModel):
    date: str
    day_of_week: int
    entries: list[WorkoutEntryOut]


@app.get("/tasks", response_model=list[TaskOut])
def read_tasks():
    return get_tasks()

@app.get("/tasks/{task_id}", response_model=TaskOut)
def read_task(task_id: int):
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@app.post("/tasks", response_model=TaskOut)
def create_new_task(task: Task):
    try:
        task_id = create_task(task.title, task.project_id)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="project_id does not exist")
    return get_task(task_id)

@app.delete("/tasks/{task_id}")
def remove_task(task_id: int):
    rows_deleted = delete_task(task_id)
    if rows_deleted == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@app.put("/tasks/{task_id}", response_model=TaskOut)
def update_existing_task(task_id: int, task: TaskUpdate):
    updates = task.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    try:
        rows_updated = update_task(task_id, **updates)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="project_id does not exist")
    if rows_updated == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return get_task(task_id)


@app.get("/projects", response_model=list[ProjectOut])
def read_projects():
    return get_projects()

@app.get("/projects/{project_id}", response_model=ProjectOut)
def read_project(project_id: int):
    project = get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.post("/projects", response_model=ProjectOut)
def create_new_project(project: Project):
    project_id = create_project(project.name)
    return get_project(project_id)

@app.put("/projects/{project_id}", response_model=ProjectOut)
def update_existing_project(project_id: int, project: ProjectUpdate):
    updates = project.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    rows_updated = update_project(project_id, **updates)
    if rows_updated == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_project(project_id)

@app.delete("/projects/{project_id}")
def remove_project(project_id: int):
    try:
        rows_deleted = delete_project(project_id)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete project with tasks still linked to it. Reassign or delete those tasks first."
        )
    if rows_deleted == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


@app.get("/checklist/items", response_model=list[ChecklistItemOut])
def read_checklist_items():
    return get_checklist_items()

@app.post("/checklist/items", response_model=ChecklistItemOut)
def create_new_checklist_item(item: ChecklistItem):
    item_id = create_checklist_item(item.title)
    items = get_checklist_items()
    for existing in items:
        if existing["id"] == item_id:
            return existing
    raise HTTPException(status_code=500, detail="Failed to create checklist item")

@app.delete("/checklist/items/{item_id}")
def remove_checklist_item(item_id: int):
    rows_deleted = delete_checklist_item(item_id)
    if rows_deleted == 0:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return {"message": "Checklist item removed"}

@app.get("/checklist/today", response_model=list[ChecklistTodayOut])
def read_checklist_today(date: str = Query(...)):
    return get_checklist_today(date)

@app.post("/checklist/today/{item_id}/complete", response_model=ChecklistTodayOut)
def complete_checklist_today(item_id: int, date: str = Query(...)):
    completed_at = complete_checklist_item(item_id, date)
    if completed_at is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    today = get_checklist_today(date)
    for entry in today:
        if entry["id"] == item_id:
            return entry
    raise HTTPException(status_code=404, detail="Checklist item not found")

@app.delete("/checklist/today/{item_id}/complete", response_model=ChecklistTodayOut)
def uncomplete_checklist_today(item_id: int, date: str = Query(...)):
    uncomplete_checklist_item(item_id, date)
    today = get_checklist_today(date)
    for entry in today:
        if entry["id"] == item_id:
            return entry
    raise HTTPException(status_code=404, detail="Checklist item not found")


@app.get("/workouts/plan", response_model=list[WorkoutPlanOut])
def read_workout_plan():
    return get_workout_plan()

@app.post("/workouts/plan", response_model=WorkoutPlanOut)
def create_new_workout_plan(plan: WorkoutPlanIn):
    if not 0 <= plan.day_of_week <= 6:
        raise HTTPException(status_code=400, detail="day_of_week must be 0 (Monday) through 6 (Sunday)")
    plan_id = create_workout_plan(plan.day_of_week, plan.workout_name)
    for entry in get_workout_plan():
        if entry["id"] == plan_id:
            return entry
    raise HTTPException(status_code=500, detail="Failed to create workout plan entry")

@app.delete("/workouts/plan/{plan_id}")
def remove_workout_plan(plan_id: int):
    try:
        rows_deleted = delete_workout_plan(plan_id)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a workout plan entry with logged history. Remove its log entries first."
        )
    if rows_deleted == 0:
        raise HTTPException(status_code=404, detail="Workout plan entry not found")
    return {"message": "Workout plan entry deleted"}

@app.get("/workouts/week", response_model=list[WorkoutDayOut])
def read_workout_week(today: str = Query(...)):
    return get_workout_week(today)

@app.post("/workouts/log/{plan_id}/complete", response_model=WorkoutEntryOut)
def complete_workout(plan_id: int, date: str = Query(...), today: str = Query(...)):
    ok = log_workout(plan_id, date, "completed")
    if not ok:
        raise HTTPException(status_code=404, detail="Workout plan entry not found")
    return get_workout_entry(plan_id, date, today)

@app.post("/workouts/log/{plan_id}/skip", response_model=WorkoutEntryOut)
def skip_workout(plan_id: int, date: str = Query(...), today: str = Query(...)):
    ok = log_workout(plan_id, date, "missed")
    if not ok:
        raise HTTPException(status_code=404, detail="Workout plan entry not found")
    return get_workout_entry(plan_id, date, today)

@app.delete("/workouts/log/{plan_id}", response_model=WorkoutEntryOut)
def reset_workout(plan_id: int, date: str = Query(...), today: str = Query(...)):
    clear_workout_log(plan_id, date)
    entry = get_workout_entry(plan_id, date, today)
    if entry is None:
        raise HTTPException(status_code=404, detail="Workout plan entry not found")
    return entry