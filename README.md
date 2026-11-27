# Personal OS

A personal productivity app that keeps tasks, projects, a daily checklist and a weekly workout schedule in one place.

It is a FastAPI backend with a SQLite database and a plain HTML, CSS and JavaScript frontend. There is no build step and no frontend framework. The backend serves both the API and the frontend, so one process runs the whole app.

The project is under active development and is currently meant to run locally. See [Known issues](#known-issues) before relying on it.

## Features

### Tasks

- Create, complete, reopen and delete tasks.
- Optional due date, editable after creation.
- Assign a task to a project, change its project, or leave it unassigned.
- Creation and completion times are recorded and shown in an info tooltip.
- Lists are sorted with unfinished tasks first (earliest due date first), then finished tasks (most recently completed first).

### Projects and folders

- Group tasks under projects. Each project shows its task count.
- Create folders inside a project and nest them up to 10 levels deep.
- Rename folders inline. Names are unique within the same parent, ignoring case.
- Move a task between folders with the move picker.
- Deleting a folder does not delete its contents: its tasks and subfolders move up to the parent.
- A project can only be deleted once it has no tasks.
- Breadcrumbs and browser back/forward work for project and folder navigation.

### Home dashboard

- **Daily Checklist:** recurring items that start unchecked every day. Completions are stored per date, so history is kept.
- **Scheduled:** unfinished tasks that are overdue or due within the next 7 days, colour-coded by urgency.
- **Today's Workout:** mark today's workout as done or skipped.
- **This Week:** Monday to Sunday overview showing each day as completed, missed, pending or rest.

### Mobile and PWA

- Responsive layout: the sidebar becomes a bottom tab bar (Home, Tasks, Projects) at 720px and below.
- Web app manifest and icons, so it can be installed to a home screen.
- A service worker shows an offline page when the server cannot be reached. It does not cache data, so the app itself needs the server.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite (standard library `sqlite3`, no ORM) |
| Frontend | HTML, CSS, vanilla JavaScript |
| Server | Uvicorn |

The frontend was developed with assistance from Claude.

## Project structure

```
personal-os/
├── backend/
│   ├── main.py          FastAPI app: request models, routes, static file serving
│   └── database.py      Schema creation, migrations and all SQL queries
├── frontend/
│   ├── index.html       Page markup (sidebar, Home, Tasks, Projects, move picker)
│   ├── script.js        All client logic: state, API calls, rendering, navigation
│   ├── style.css        All styles, including the mobile layout
│   ├── sw.js            Service worker (offline fallback only)
│   ├── offline.html     Page shown when the server is unreachable
│   ├── manifest.webmanifest
│   └── icons/
└── README.md
```

## Getting started

### Prerequisites

- Python 3.10 or later
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AbirGoated/personal-os.git
cd personal-os
```

### 2. Create a virtual environment and install dependencies

macOS and Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
```

Windows:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install fastapi uvicorn
```

There is no `requirements.txt` yet. Last verified with FastAPI 0.165, Uvicorn 0.54 and Pydantic 2.14.

### 3. Start the server

Run this from the repository root, not from inside `backend/`:

```bash
uvicorn backend.main:app --reload
```

### 4. Open the app

- App: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs

Open the app through the server URL. Opening `frontend/index.html` directly as a file will not work, because the frontend sends API requests to the origin it was loaded from.

### Using it from a phone

To reach the app from another device on the same network, bind to all interfaces and open `http://<your-computer-ip>:8000` on the phone:

```bash
uvicorn backend.main:app --host 0.0.0.0
```

The app has no login, so only do this on a network you trust. Browsers also require HTTPS (or localhost) for service workers, so the offline page and home-screen install will not work over a plain `http://` network address.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PERSONAL_OS_DB` | `backend/tasks.db` | Path to the SQLite database file |

## Data

- The database file is created automatically on first start, and is ignored by Git.
- Tables: `projects`, `folders`, `tasks`, `checklist_items`, `checklist_log`, `workout_plan`, `workout_log`.
- Schema changes are applied on startup by `database.py`, which adds any missing columns to an existing database.
- On first run the workout plan is seeded with a default six-day split (Monday to Saturday, Sunday rest).
- Timestamps are stored in UTC. "Today" for the checklist and workouts is the browser's local date, which the frontend sends with each request.
- Removing a checklist item deactivates it rather than deleting it, so its history is kept.

## API overview

Full request and response schemas are available at `/docs` while the server is running.

**Tasks**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/tasks` | List all tasks |
| GET | `/tasks/{id}` | Get one task |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/{id}` | Update only the fields sent |
| DELETE | `/tasks/{id}` | Delete a task |

**Projects**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/projects` | List projects with task counts |
| GET | `/projects/{id}` | Get one project |
| POST | `/projects` | Create a project |
| PUT | `/projects/{id}` | Rename a project |
| DELETE | `/projects/{id}` | Delete a project that has no tasks |

**Folders**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/folders` | List all folders |
| POST | `/folders` | Create a folder in a project, optionally under a parent |
| PUT | `/folders/{id}` | Rename a folder |
| DELETE | `/folders/{id}` | Delete a folder and move its contents to the parent |

**Daily checklist**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/checklist/items` | List active checklist items |
| POST | `/checklist/items` | Add an item |
| DELETE | `/checklist/items/{id}` | Deactivate an item |
| GET | `/checklist/today?date=YYYY-MM-DD` | Items with their completion state for a date |
| POST | `/checklist/today/{id}/complete?date=` | Mark an item complete for a date |
| DELETE | `/checklist/today/{id}/complete?date=` | Clear completion for a date |

**Workouts**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/workouts/plan` | List the weekly plan (`day_of_week` 0 = Monday, 6 = Sunday) |
| POST | `/workouts/plan` | Add a plan entry |
| DELETE | `/workouts/plan/{id}` | Delete a plan entry that has no logged history |
| GET | `/workouts/week?today=YYYY-MM-DD` | The week containing `today`, with a status per entry |
| POST | `/workouts/log/{plan_id}/complete?date=&today=` | Log a workout as completed |
| POST | `/workouts/log/{plan_id}/skip?date=&today=` | Log a workout as missed |
| DELETE | `/workouts/log/{plan_id}?date=&today=` | Clear a log entry |

## Known issues

- **Local only.** There is no authentication and CORS allows every origin. Do not expose the server to the internet as it is.
- **Not deployable yet.** Data lives in a local SQLite file and there is no dependency file or hosting configuration.
- **Workout plan cannot be edited in the app.** The plan endpoints exist, but the interface only shows the seeded plan. Only today's workout can be logged; past days without a log show as missed.
- **Move picker does not open from "All tasks".** Moving a task to a folder only works from inside its project.
- **Move picker renders names as HTML.** Project and folder names are inserted unescaped there.
- **Projects cannot be renamed in the app.** The endpoint exists but the interface does not use it.
- **Duplicate functions in `database.py`.** `create_task`, `get_task`, `get_tasks`, `update_task` and `delete_project` are each defined twice. The later definitions are the ones in use.
- **Loose input validation.** The API accepts empty titles and does not check the format of `date` query values.
- **No automated tests.**

## Roadmap

- Fix the known issues above.
- Make the workout plan editable and complete the workout dashboard.
- Move to a hosted database and add a login, so the app can be deployed and used from a phone anywhere.
- Split the frontend script and stylesheet into smaller files.
- Add tests for the API.
- Add more productivity and life-management features.

These are plans, not features that are currently available.

## Contributing

This is a personal project built for learning, experimentation and everyday use. The code and features may change as development continues. Suggestions and constructive feedback are welcome.

## License

No open-source license has been selected yet. Until one is added, do not assume permission to reuse, modify or distribute the code.
