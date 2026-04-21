from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timedelta
from db.database import get_db
from routers.realtime import publish

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


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0, le=1_000_000)
    direction: Optional[Direction] = None
    category: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = Field(None, max_length=500)
    account: Optional[Account] = None

@router.post("/transactions")
def add_transaction(t: Transaction):
    conn = get_db()
    now = datetime.now().isoformat()
    account_val = (t.account or Account.CASH).value
    cur = conn.execute(
        "INSERT INTO transactions (created_at, amount, direction, category, note, account) VALUES (?,?,?,?,?,?)",
        (now, t.amount, t.direction.value, t.category, t.note, account_val)
    )
    tx_id = cur.lastrowid
    conn.commit()
    saldo_cash = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='cash'"
    ).fetchone()[0]
    saldo_revolut = conn.execute(
        "SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='revolut'"
    ).fetchone()[0]
    conn.close()
    publish("tx.created", {"id": tx_id, "amount": t.amount, "direction": t.direction.value, "account": account_val})
    return {"status": "ok", "id": tx_id, "saldo_cash": round(saldo_cash, 2), "saldo_revolut": round(saldo_revolut, 2)}


@router.put("/transactions/{tx_id}")
def update_transaction(tx_id: int, patch: TransactionUpdate):
    """Edit campi di una transazione esistente. Tutti i campi sono opzionali."""
    fields = []
    values: list = []
    if patch.amount is not None:
        fields.append("amount = ?"); values.append(patch.amount)
    if patch.direction is not None:
        fields.append("direction = ?"); values.append(patch.direction.value)
    if patch.category is not None:
        fields.append("category = ?"); values.append(patch.category)
    if patch.note is not None:
        fields.append("note = ?"); values.append(patch.note)
    if patch.account is not None:
        fields.append("account = ?"); values.append(patch.account.value)
    if not fields:
        raise HTTPException(400, "Nessun campo da aggiornare")

    conn = get_db()
    row = conn.execute("SELECT id FROM transactions WHERE id = ?", (tx_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Transazione non trovata")
    values.append(tx_id)
    conn.execute(f"UPDATE transactions SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    publish("tx.updated", {"id": tx_id})
    return {"status": "ok", "id": tx_id}


@router.delete("/transactions/{tx_id}")
def delete_transaction(tx_id: int):
    conn = get_db()
    row = conn.execute("SELECT id FROM transactions WHERE id = ?", (tx_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Transazione non trovata")
    conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    conn.commit()
    conn.close()
    publish("tx.deleted", {"id": tx_id})
    return {"status": "ok", "id": tx_id}

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
