from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timedelta
from db.database import get_db

router = APIRouter()


class Direction(str, Enum):
    INCOME = "+"
    EXPENSE = "-"


class Account(str, Enum):
    CASH = "cash"
    REVOLUT = "revolut"


class Transaction(BaseModel):
    amount: float = Field(..., gt=0, le=1_000_000)
    direction: Direction
    category: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = Field(None, max_length=500)
    account: Optional[Account] = Account.CASH

@router.post("/transactions")
def add_transaction(t: Transaction):
    conn = get_db()
    now = datetime.now().isoformat()
    account_val = (t.account or Account.CASH).value
    conn.execute(
        "INSERT INTO transactions (created_at, amount, direction, category, note, account) VALUES (?,?,?,?,?,?)",
        (now, t.amount, t.direction.value, t.category, t.note, account_val)
    )
    conn.commit()
    saldo_cash = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='cash'"
    ).fetchone()[0]
    saldo_revolut = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='revolut'"
    ).fetchone()[0]
    conn.close()
    return {"status": "ok", "saldo_cash": round(saldo_cash, 2), "saldo_revolut": round(saldo_revolut, 2)}

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
    uscite  = sum(r["amount"] for r in rows if r["direction"] == "-")

    saldo_cash = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='cash'"
    ).fetchone()[0]
    saldo_revolut = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='revolut'"
    ).fetchone()[0]

    conn.close()
    return {
        "period":        period,
        "entrate":       round(entrate, 2),
        "uscite":        round(uscite, 2),
        "saldo":         round(saldo_cash + saldo_revolut, 2),
        "saldo_cash":    round(saldo_cash, 2),
        "saldo_revolut": round(saldo_revolut, 2),
        "transazioni":   len(rows),
    }

@router.get("/transactions")
def get_transactions():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
