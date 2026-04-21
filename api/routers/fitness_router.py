import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, date
import sqlite3

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fitness", tags=["fitness"])
DB_PATH = "/home/matteo/Jarvis/data/jarvis.db"

def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def ensure_tables(cur):
    cur.execute("""CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, exercise TEXT NOT NULL,
        weight_kg REAL NOT NULL, reps INTEGER, sets INTEGER, notes TEXT,
        logged_at TEXT NOT NULL DEFAULT (datetime('now')))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS body_weight (
        id INTEGER PRIMARY KEY AUTOINCREMENT, weight_kg REAL NOT NULL,
        logged_at TEXT DEFAULT (datetime('now')))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
        kcal_100g REAL, protein_100g REAL, carbs_100g REAL, fat_100g REAL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        logged_at TEXT DEFAULT (datetime('now')),
        description TEXT, kcal REAL DEFAULT 0,
        protein REAL DEFAULT 0, carbs REAL DEFAULT 0,
        fat REAL DEFAULT 0, note TEXT)""")

# ── WORKOUT ───────────────────────────────────────────────────────────────────

class WorkoutLogIn(BaseModel):
    exercise: str
    weight_kg: float
    reps: int | None = None
    sets: int | None = None
    notes: str | None = None

@router.post("/log")
def log_workout(body: WorkoutLogIn) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT INTO workout_logs (exercise,weight_kg,reps,sets,notes,logged_at) VALUES (?,?,?,?,?,?)",
        (body.exercise.lower().strip(), body.weight_kg, body.reps, body.sets, body.notes, datetime.now().isoformat()))
    con.commit(); con.close()
    logger.info("workout logged: %s %.1fkg", body.exercise, body.weight_kg)
    return {"status": "ok", "exercise": body.exercise, "weight_kg": body.weight_kg}

@router.get("/last")
def get_last_weights() -> list:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("""SELECT exercise,weight_kg,reps,sets,notes,logged_at FROM workout_logs
        WHERE id IN (SELECT MAX(id) FROM workout_logs GROUP BY exercise) ORDER BY exercise""")
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in rows]

@router.get("/history/{exercise}")
def get_exercise_history(exercise: str, limit: int = 20) -> list:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("""SELECT weight_kg,reps,sets,notes,logged_at FROM workout_logs
        WHERE LOWER(exercise)=LOWER(?) ORDER BY logged_at DESC LIMIT ?""", (exercise, limit))
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in reversed(rows)]

@router.delete("/log/{log_id}")
def delete_log(log_id: int) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("DELETE FROM workout_logs WHERE id=?", (log_id,))
    if cur.rowcount == 0: con.close(); raise HTTPException(404, "Log non trovato")
    con.commit(); con.close()
    return {"status": "ok"}

# ── BODY WEIGHT ───────────────────────────────────────────────────────────────

class BodyWeightIn(BaseModel):
    weight_kg: float

@router.post("/weight")
def log_body_weight(body: BodyWeightIn) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT INTO body_weight (weight_kg,logged_at) VALUES (?,?)",
        (body.weight_kg, datetime.now().isoformat()))
    con.commit(); con.close()
    return {"status": "ok", "weight_kg": body.weight_kg}

@router.get("/weight/history")
def get_weight_history(limit: int = 30) -> list:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("SELECT weight_kg, logged_at FROM body_weight ORDER BY logged_at DESC LIMIT ?", (limit,))
    rows = cur.fetchall(); con.close()
    return [{"kg": r["weight_kg"], "date": r["logged_at"][:10]} for r in reversed(rows)]

# ── FOODS ─────────────────────────────────────────────────────────────────────

class FoodIn(BaseModel):
    name: str
    kcal_100g: float
    protein_100g: float
    carbs_100g: float
    fat_100g: float

@router.get("/foods")
def get_foods() -> list:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("SELECT * FROM foods ORDER BY name")
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in rows]

@router.post("/foods")
def add_food(body: FoodIn) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT OR REPLACE INTO foods (name,kcal_100g,protein_100g,carbs_100g,fat_100g) VALUES (?,?,?,?,?)",
        (body.name.lower().strip(), body.kcal_100g, body.protein_100g, body.carbs_100g, body.fat_100g))
    con.commit(); con.close()
    return {"status": "ok", "name": body.name}

# ── MEALS ─────────────────────────────────────────────────────────────────────

class MealIn(BaseModel):
    description: str
    kcal: float
    protein: float
    carbs: float
    fat: float
    note: str | None = None

@router.post("/meal")
def log_meal(body: MealIn) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT INTO meals (logged_at,description,kcal,protein,carbs,fat,note) VALUES (?,?,?,?,?,?,?)",
        (datetime.now().isoformat(), body.description, body.kcal, body.protein, body.carbs, body.fat, body.note))
    con.commit(); con.close()
    return {"status": "ok"}

@router.get("/meals/today")
def get_meals_today() -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    today = date.today().isoformat()
    cur.execute("SELECT * FROM meals WHERE logged_at >= ? ORDER BY logged_at", (today,))
    rows = cur.fetchall()
    meals = [dict(r) for r in rows]
    totals = {
        "kcal":    round(sum(m["kcal"] for m in meals), 1),
        "protein": round(sum(m["protein"] for m in meals), 1),
        "carbs":   round(sum(m["carbs"] for m in meals), 1),
        "fat":     round(sum(m["fat"] for m in meals), 1),
    }
    con.close()
    return {"meals": meals, "totals": totals}

@router.delete("/meal/{meal_id}")
def delete_meal(meal_id: int) -> dict:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("DELETE FROM meals WHERE id=?", (meal_id,))
    if cur.rowcount == 0: con.close(); raise HTTPException(404, "Pasto non trovato")
    con.commit(); con.close()
    return {"status": "ok"}
