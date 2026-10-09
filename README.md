Private API

A personal productivity and life-management application designed to keep tasks, projects, daily habits, and workouts organized in one place.

Private API combines a FastAPI backend with a simple web frontend to make everyday planning easier. It allows you to manage tasks, organize larger goals into projects, track daily checklists, and view your workout schedule through a single dashboard.

The project is currently under development, with plans to improve the workout dashboard, refine the user interface, and make the application accessible from a phone.

Features

✅ Task Management

- Create, view, update, complete, and delete tasks.
- Record when a task was created.
- Track when a task was completed.
- Store tasks persistently using SQLite, so data remains available after restarting the server.

📁 Project-Based Organization

- Group related tasks under a common project.
- Break larger goals into smaller, manageable tasks.
- Keep multiple projects organized without mixing their tasks together.

📅 Daily Checklist

- Maintain a checklist of recurring daily activities, such as studying, reading, and working out.
- Start each day with a fresh checklist.
- Track daily routines separately from longer-term tasks.

💪 Workout Dashboard

- View today's workout in a dedicated dashboard section.
- See a mini overview of the week's workout schedule.

Current status: The workout dashboard is still being developed, and some functionality does not work as intended yet.

🖥️ Web-Based Interface

- A frontend built with HTML, CSS, and JavaScript.
- A FastAPI backend that handles application operations.
- A SQLite database for persistent storage.

Tech Stack

Technology| Purpose
Python| Backend programming
FastAPI| API development
SQLite| Persistent database storage
HTML| Frontend structure
CSS| Frontend styling
JavaScript| Frontend functionality

The frontend was developed with assistance from Claude.

Getting Started

Prerequisites

Make sure you have the following installed:

- Python 3.10 or later, compatible with your dependencies
- Git
- A modern web browser

1. Clone the Repository

git clone https://github.com/AbirGoated/private-api.git
cd private-api

2. Set Up the Backend

Create and activate a virtual environment.

Windows:

python -m venv .venv
.venv\Scripts\activate

Install the backend dependencies:

pip install fastapi uvicorn

If the project has a "requirements.txt" file, install the complete dependency list instead:

pip install -r Backend/requirements.txt

Use the requirements file's actual location if it differs.

3. Start the FastAPI Server

Navigate to the backend directory:

cd Backend

Start the server:

uvicorn main:app --reload

This command assumes that "main.py" contains the FastAPI application instance named "app".

Once the server starts, open:

- API root: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

4. Open the Frontend

Open the frontend's main HTML file in your browser, or use the local development server configured for the frontend if required.

The frontend must be configured to send API requests to the running FastAPI server.

«Note: The backend and frontend are currently intended for local use. The server must be running for the application to communicate with the API.»

How It Works

The application separates data storage, backend operations, and the user interface.

1. Frontend: Provides the interface for managing tasks, daily checklists, projects, and workout information.
2. FastAPI backend: Receives API requests and performs the corresponding operations.
3. SQLite database: Stores persistent application data.
4. Dashboard: Brings everyday planning and productivity information together in one interface.

The aim is to keep long-term tasks, project work, and daily routines organized without requiring multiple separate applications.

Roadmap

The project is actively evolving. Planned improvements include:

- Fix and complete the workout dashboard functionality.
- Improve the user interface and overall user experience.
- Add more productivity and life-management features.
- Improve the organization and tracking of daily routines.
- Make the application accessible from a phone.
- Explore a more convenient way to access the application beyond the local computer.

These are planned improvements, not features currently guaranteed to be available.

Current Limitations

- The workout dashboard does not work completely as intended.
- The application currently runs locally and requires the backend server to be running.
- Mobile access and deployment improvements are still planned.

Future Vision

The long-term goal is to turn Private API into a personal productivity system that helps manage everyday life from one place.

Rather than being just another to-do list, the project aims to bring together task management, project organization, daily routines, and workout planning in a practical, customizable application.

Contributing

This is currently a personal project built for learning, experimentation, and everyday use. The codebase and features may change as development continues.

Suggestions and constructive feedback are welcome.

License

No open-source license has been selected yet. Until a license is added to the repository, permissions to reuse, modify, or distribute the code should not be assumed.