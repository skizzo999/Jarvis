import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, date
import sqlite3

from config import DB_PATH

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fitness", tags=["fitness"])

def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

# ── WORKOUT ───────────────────────────────────────────────────────────────────

class WorkoutLogIn(BaseModel):
    exercise: str = Field(..., min_length=1, max_length=100)
    weight_kg: float = Field(..., ge=0, le=500)
    reps: int | None = Field(None, ge=0, le=1000)
    sets: int | None = Field(None, ge=0, le=100)
    notes: str | None = Field(None, max_length=500)

@router.post("/log")
def log_workout(body: WorkoutLogIn) -> dict:
    con = get_db(); cur = con.cursor()
    cur.execute("INSERT INTO workout_logs (exercise,weight_kg,reps,sets,notes,logged_at) VALUES (?,?,?,?,?,?)",
        (body.exercise.lower().strip(), body.weight_kg, body.reps, body.sets, body.notes, datetime.now().isoformat()))
    con.commit(); con.close()
    logger.info("workout logged: %s %.1fkg", body.exercise, body.weight_kg)
    return {"status": "ok", "exercise": body.exercise, "weight_kg": body.weight_kg}

@router.get("/last")
def get_last_weights() -> list:
    con = get_db(); cur = con.cursor()
    cur.execute("""SELECT exercise,weight_kg,reps,sets,notes,logged_at FROM workout_logs
        WHERE id IN (SELECT MAX(id) FROM workout_logs GROUP BY exercise) ORDER BY exercise""")
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in rows]

@router.get("/history/{exercise}")
def get_exercise_history(exercise: str, limit: int = 20) -> list:
    con = get_db(); cur = con.cursor()
    cur.execute("""SELECT weight_kg,reps,sets,notes,logged_at FROM workout_logs
        WHERE LOWER(exercise)=LOWER(?) ORDER BY logged_at DESC LIMIT ?""", (exercise, limit))
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in reversed(rows)]

@router.delete("/log/{log_id}")
def delete_log(log_id: int) -> dict:
    con = get_db(); cur = con.cursor()
    cur.execute("DELETE FROM workout_logs WHERE id=?", (log_id,))
    if cur.rowcount == 0: con.close(); raise HTTPException(404, "Log non trovato")
    con.commit(); con.close()
    return {"status": "ok"}

# ── BODY WEIGHT ───────────────────────────────────────────────────────────────

class BodyWeightIn(BaseModel):
    weight_kg: float = Field(..., ge=20, le=300)

@router.post("/weight")
def log_body_weight(body: BodyWeightIn) -> dict:
    con = get_db(); cur = con.cursor()
    cur.execute("INSERT INTO body_weight (weight_kg,logged_at) VALUES (?,?)",
        (body.weight_kg, datetime.now().isoformat()))
    con.commit(); con.close()
    return {"status": "ok", "weight_kg": body.weight_kg}

@router.get("/weight/history")
def get_weight_history(limit: int = 30) -> list:
    con = get_db(); cur = con.cursor()
    cur.execute("SELECT weight_kg, logged_at FROM body_weight ORDER BY logged_at DESC LIMIT ?", (limit,))
    rows = cur.fetchall(); con.close()
    return [{"kg": r["weight_kg"], "date": r["logged_at"][:10]} for r in reversed(rows)]

# ── FOODS ─────────────────────────────────────────────────────────────────────

class FoodIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    kcal_100g: float = Field(..., ge=0, le=2000)
    protein_100g: float = Field(..., ge=0, le=100)
    carbs_100g: float = Field(..., ge=0, le=100)
    fat_100g: float = Field(..., ge=0, le=100)

@router.get("/foods")
def get_foods() -> list:
    con = get_db(); cur = con.cursor()
    cur.execute("SELECT * FROM foods ORDER BY name")
    rows = cur.fetchall(); con.close()
    return [dict(r) for r in rows]

@router.post("/foods")
def add_food(body: FoodIn) -> dict:
    con = get_db(); cur = con.cursor()
    cur.execute("INSERT OR REPLACE INTO foods (name,kcal_100g,protein_100g,carbs_100g,fat_100g) VALUES (?,?,?,?,?)",
        (body.name.lower().strip(), body.kcal_100g, body.protein_100g, body.carbs_100g, body.fat_100g))
    con.commit(); con.close()
    return {"status": "ok", "name": body.name}

# ── MEALS ─────────────────────────────────────────────────────────────────────

class MealIn(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    kcal: float = Field(..., ge=0, le=10000)
    protein: float = Field(..., ge=0, le=500)
    carbs: float = Field(..., ge=0, le=1000)
    fat: float = Field(..., ge=0, le=500)
    note: str | None = Field(None, max_length=500)

@router.post("/meal")
def log_meal(body: MealIn) -> dict:
    con = get_db(); cur = con.cursor()
    cur.execute("INSERT INTO meals (logged_at,description,kcal,protein,carbs,fat,note) VALUES (?,?,?,?,?,?,?)",
        (datetime.now().isoformat(), body.description, body.kcal, body.protein, body.carbs, body.fat, body.note))
    con.commit(); con.close()
    return {"status": "ok"}

@router.get("/meals/today")
def get_meals_today() -> dict:
    con = get_db(); cur = con.cursor()
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
    con = get_db(); cur = con.cursor()
    cur.execute("DELETE FROM meals WHERE id=?", (meal_id,))
    if cur.rowcount == 0: con.close(); raise HTTPException(404, "Pasto non trovato")
    con.commit(); con.close()
    return {"status": "ok"}
