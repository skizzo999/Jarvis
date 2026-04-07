from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from db.database import get_db, init_db

router = APIRouter()
init_db()

class Transaction(BaseModel):
    amount: float
    direction: str
    category: Optional[str] = None
    note: Optional[str] = None

@router.post("/transactions")
def add_transaction(t: Transaction):
    conn = get_db()
    now = datetime.now().isoformat()
    conn.execute(
        "INSERT INTO transactions (created_at, amount, direction, category, note) VALUES (?,?,?,?,?)",
        (now, t.amount, t.direction, t.category, t.note)
    )
    conn.commit()
    saldo = conn.execute(
        "SELECT SUM(CASE WHEN direction='+' THEN amount ELSE -amount END) FROM transactions"
    ).fetchone()[0] or 0
    conn.close()
    return {"status": "ok", "saldo": round(saldo, 2)}

@router.get("/transactions/report")
def report(period: str = "today"):
    conn = get_db()
    now = datetime.now()
    if period == "today":
        from_date = now.strftime("%Y-%m-%d")
    elif period == "week":
        from_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        from_date = now.strftime("%Y-%m-01")
    else:
        from_date = now.strftime("%Y-%m-%d")
    rows = conn.execute(
        "SELECT * FROM transactions WHERE created_at >= ? ORDER BY created_at DESC",
        (from_date,)
    ).fetchall()
    entrate = sum(r["amount"] for r in rows if r["direction"] == "+")
    uscite = sum(r["amount"] for r in rows if r["direction"] == "-")
    conn.close()
    return {
        "period": period,
        "entrate": round(entrate, 2),
        "uscite": round(uscite, 2),
        "saldo": round(entrate - uscite, 2),
        "transazioni": len(rows)
    }

@router.get("/transactions")
def get_transactions():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
