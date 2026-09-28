from backend.database import get_workout_plan, create_workout_plan

PLAN = [
    (0, "Shoulders and Triceps"),
    (1, "Back and Biceps"),
    (2, "Chest + Abs"),
    (3, "Shoulders and Triceps"),
    (4, "Back and Biceps"),
    (5, "Chest + Abs"),
]


def seed():
    if get_workout_plan():
        print("Workout plan already exists, nothing changed.")
        return
    for day_of_week, workout_name in PLAN:
        create_workout_plan(day_of_week, workout_name)
    print(f"Added {len(PLAN)} workouts to the plan.")


if __name__ == "__main__":
    seed()