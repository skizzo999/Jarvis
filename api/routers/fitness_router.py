from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import sqlite3

router = APIRouter(prefix="/fitness", tags=["fitness"])

DB_PATH = "/home/jarvis/data/jarvis.db"

def get_db():
    return sqlite3.connect(DB_PATH)

def ensure_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS workout_logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise   TEXT NOT NULL,
            weight_kg  REAL NOT NULL,
            reps       INTEGER,
            sets       INTEGER,
            notes      TEXT,
            logged_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

class WorkoutLogIn(BaseModel):
    exercise: str
    weight_kg: float
    reps: int | None = None
    sets: int | None = None
    notes: str | None = None

@router.post("/log")
def log_workout(body: WorkoutLogIn):
    con = get_db()
    cur = con.cursor()
    ensure_table(cur)
    cur.execute(
        "INSERT INTO workout_logs (exercise, weight_kg, reps, sets, notes, logged_at) VALUES (?,?,?,?,?,?)",
        (body.exercise.lower().strip(), body.weight_kg, body.reps, body.sets,
         body.notes, datetime.now().isoformat())
    )
    con.commit()
    con.close()
    return {"status": "ok", "exercise": body.exercise, "weight_kg": body.weight_kg}

@router.get("/last")
def get_last_weights():
    """Ritorna l'ultimo log per ogni esercizio."""
    con = get_db()
    cur = con.cursor()
    ensure_table(cur)
    cur.execute("""
        SELECT exercise, weight_kg, reps, sets, notes, logged_at
        FROM workout_logs
        WHERE id IN (
            SELECT MAX(id) FROM workout_logs GROUP BY exercise
        )
        ORDER BY exercise
    """)
    rows = cur.fetchall()
    con.close()
    return [
        {
            "exercise": r[0],
            "weight_kg": r[1],
            "reps": r[2],
            "sets": r[3],
            "notes": r[4],
            "logged_at": r[5],
        }
        for r in rows
    ]

@router.get("/history/{exercise}")
def get_exercise_history(exercise: str, limit: int = 20):
    """Ritorna la cronologia di un esercizio specifico (per i grafici di progressione)."""
    con = get_db()
    cur = con.cursor()
    ensure_table(cur)
    cur.execute("""
        SELECT weight_kg, reps, sets, notes, logged_at
        FROM workout_logs
        WHERE LOWER(exercise) = LOWER(?)
        ORDER BY logged_at DESC LIMIT ?
    """, (exercise, limit))
    rows = cur.fetchall()
    con.close()
    return [
        {
            "weight_kg": r[0],
            "reps": r[1],
            "sets": r[2],
            "notes": r[3],
            "logged_at": r[4],
        }
        for r in reversed(rows)
    ]

@router.delete("/log/{log_id}")
def delete_log(log_id: int):
    con = get_db()
    cur = con.cursor()
    ensure_table(cur)
    cur.execute("DELETE FROM workout_logs WHERE id=?", (log_id,))
    if cur.rowcount == 0:
        con.close()
        raise HTTPException(status_code=404, detail="Log non trovato")
    con.commit()
    con.close()
    return {"status": "ok"}
