import sqlite3
import os
from datetime import datetime, timezone, date, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.db")

def get_connection():
    connection = sqlite3.connect(DB_PATH, timeout=5)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection

connection = get_connection()
cursor = connection.cursor()

#project table creation:
cursor.execute("""
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")

#tasks table creation:
cursor.execute("""
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    project_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS checklist_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (item_id) REFERENCES checklist_items(id),
    UNIQUE (item_id, date)
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS workout_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    workout_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS workout_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_plan_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    logged_at TEXT,
    FOREIGN KEY (workout_plan_id) REFERENCES workout_plan(id),
    UNIQUE (workout_plan_id, date)
)
""")

existing_task_columns = [row[1] for row in cursor.execute("PRAGMA table_info(tasks)")]
if "completed_at" not in existing_task_columns:
    cursor.execute("ALTER TABLE tasks ADD COLUMN completed_at TEXT")
for table in ("projects", "tasks"):
    existing_columns = [row[1] for row in cursor.execute(f"PRAGMA table_info({table})")]
    if "created_at" not in existing_columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN created_at TEXT")

now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
for table in ("projects", "tasks"):
    cursor.execute(f"UPDATE {table} SET created_at = ? WHERE created_at IS NULL", (now,))

connection.commit()
connection.close()

def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def create_task(title, project_id=None):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """INSERT INTO tasks (title, completed, project_id, created_at) VALUES (?, ?, ?, ?)""",
            (title, 0, project_id, _now())
        )
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_tasks():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""SELECT tasks.id, tasks.title, tasks.completed, tasks.project_id, projects.name, tasks.created_at, tasks.completed_at FROM tasks LEFT JOIN projects ON tasks.project_id = projects.id ORDER BY tasks.id DESC""")
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "title": row[1],
                "completed": bool(row[2]),
                "project_id": row[3],
                "project_name": row[4],
                "created_at": row[5],
                "completed_at": row[6],
            }
            for row in rows
        ]
    finally:
        connection.close()

def get_task(task_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""SELECT tasks.id, tasks.title, tasks.completed, tasks.project_id, projects.name, tasks.created_at, tasks.completed_at FROM tasks LEFT JOIN projects ON tasks.project_id = projects.id WHERE tasks.id = ?""", (task_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "title": row[1],
            "completed": bool(row[2]),
            "project_id": row[3],
            "project_name": row[4],
            "created_at": row[5],
            "completed_at": row[6],
        }
    finally:
        connection.close()

def complete_task(task_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""UPDATE tasks SET completed = 1 WHERE id = ?""", (task_id,))
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()

def update_task(task_id, **fields):
    """
    Updates only the fields actually passed in.
    Pass exactly the fields the caller sent (e.g. via `.model_dump(exclude_unset=True)`)
    so that an explicit `None` (e.g. clearing project_id) is distinguishable from a
    field that was never sent at all.
    """
    if not fields:
        return 0
    if "completed" in fields:
        completed = fields["completed"]
        fields["completed"] = int(completed)
        fields["completed_at"] = _now() if completed else None

    connection = get_connection()
    try:
        cursor = connection.cursor()
        set_clause = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values()) + [task_id]
        cursor.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def delete_task(task_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""DELETE FROM tasks WHERE id = ?""", (task_id,))
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def create_project(name):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """INSERT INTO projects (name, created_at) VALUES (?, ?)""",
            (name, _now())
        )
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_projects():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT projects.id, projects.name, COUNT(tasks.id), projects.created_at
            FROM projects
            LEFT JOIN tasks ON tasks.project_id = projects.id
            GROUP BY projects.id
            ORDER BY projects.id
        """)
        rows = cursor.fetchall()
        return [
            {"id": row[0], "name": row[1], "task_count": row[2], "created_at": row[3]}
            for row in rows
        ]
    finally:
        connection.close()


def get_project(project_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT projects.id, projects.name, COUNT(tasks.id), projects.created_at
            FROM projects
            LEFT JOIN tasks ON tasks.project_id = projects.id
            WHERE projects.id = ?
            GROUP BY projects.id
        """, (project_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        return {"id": row[0], "name": row[1], "task_count": row[2], "created_at": row[3]}
    finally:
        connection.close()


def update_project(project_id, **fields):
    if not fields:
        return 0
    connection = get_connection()
    try:
        cursor = connection.cursor()
        set_clause = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values()) + [project_id]
        cursor.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def delete_project(project_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""DELETE FROM projects WHERE id = ?""", (project_id,))
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def create_checklist_item(title):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO checklist_items (title, active, created_at) VALUES (?, 1, ?)",
            (title, _now())
        )
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_checklist_items():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT id, title, active, created_at FROM checklist_items WHERE active = 1 ORDER BY id"
        )
        rows = cursor.fetchall()
        return [
            {"id": row[0], "title": row[1], "active": bool(row[2]), "created_at": row[3]}
            for row in rows
        ]
    finally:
        connection.close()


def delete_checklist_item(item_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE checklist_items SET active = 0 WHERE id = ? AND active = 1",
            (item_id,)
        )
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def get_checklist_today(date):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT checklist_items.id, checklist_items.title, checklist_log.completed_at
            FROM checklist_items
            LEFT JOIN checklist_log
                ON checklist_log.item_id = checklist_items.id
                AND checklist_log.date = ?
            WHERE checklist_items.active = 1
            ORDER BY checklist_items.id
        """, (date,))
        rows = cursor.fetchall()
        return [
            {"id": row[0], "title": row[1], "completed_at": row[2]}
            for row in rows
        ]
    finally:
        connection.close()


def complete_checklist_item(item_id, date):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT id FROM checklist_items WHERE id = ? AND active = 1",
            (item_id,)
        )
        if cursor.fetchone() is None:
            return None
        timestamp = _now()
        cursor.execute("""
            INSERT INTO checklist_log (item_id, date, completed_at)
            VALUES (?, ?, ?)
            ON CONFLICT(item_id, date) DO UPDATE SET completed_at = excluded.completed_at
        """, (item_id, date, timestamp))
        connection.commit()
        return timestamp
    finally:
        connection.close()


def uncomplete_checklist_item(item_id, date):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM checklist_log WHERE item_id = ? AND date = ?",
            (item_id, date)
        )
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()

def create_workout_plan(day_of_week, workout_name):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO workout_plan (day_of_week, workout_name, created_at) VALUES (?, ?, ?)",
            (day_of_week, workout_name, _now())
        )
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_workout_plan():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT id, day_of_week, workout_name, created_at FROM workout_plan ORDER BY day_of_week, id"
        )
        rows = cursor.fetchall()
        return [
            {"id": row[0], "day_of_week": row[1], "workout_name": row[2], "created_at": row[3]}
            for row in rows
        ]
    finally:
        connection.close()


def delete_workout_plan(plan_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM workout_plan WHERE id = ?", (plan_id,))
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()


def _workout_status(plan_id, date_str, today_str, cursor):
    cursor.execute(
        "SELECT status FROM workout_log WHERE workout_plan_id = ? AND date = ?",
        (plan_id, date_str)
    )
    row = cursor.fetchone()
    if row is not None:
        return row[0]
    if date_str < today_str:
        return "missed"
    return "pending"


def get_workout_week(today_str):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT id, day_of_week, workout_name FROM workout_plan ORDER BY day_of_week, id")
        plan_rows = cursor.fetchall()

        today = date.fromisoformat(today_str)
        week_start = today - timedelta(days=today.weekday())

        days = []
        for offset in range(7):
            day_date = week_start + timedelta(days=offset)
            day_date_str = day_date.isoformat()
            entries = []
            for plan_id, day_of_week, workout_name in plan_rows:
                if day_of_week != offset:
                    continue
                status = _workout_status(plan_id, day_date_str, today_str, cursor)
                entries.append({"plan_id": plan_id, "workout_name": workout_name, "status": status})
            days.append({"date": day_date_str, "day_of_week": offset, "entries": entries})
        return days
    finally:
        connection.close()


def get_workout_entry(plan_id, date_str, today_str):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT workout_name FROM workout_plan WHERE id = ?",
            (plan_id,)
        )
        row = cursor.fetchone()
        if row is None:
            return None
        status = _workout_status(plan_id, date_str, today_str, cursor)
        return {"plan_id": plan_id, "workout_name": row[0], "status": status}
    finally:
        connection.close()


def log_workout(plan_id, date_str, status):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM workout_plan WHERE id = ?", (plan_id,))
        if cursor.fetchone() is None:
            return False
        cursor.execute("""
            INSERT INTO workout_log (workout_plan_id, date, status, logged_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(workout_plan_id, date) DO UPDATE SET
                status = excluded.status,
                logged_at = excluded.logged_at
        """, (plan_id, date_str, status, _now()))
        connection.commit()
        return True
    finally:
        connection.close()


def clear_workout_log(plan_id, date_str):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM workout_log WHERE workout_plan_id = ? AND date = ?",
            (plan_id, date_str)
        )
        connection.commit()
        return cursor.rowcount
    finally:
        connection.close()