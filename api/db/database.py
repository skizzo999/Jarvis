import sqlite3
from contextlib import contextmanager

from config import DB_PATH


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_connection():
    """Context manager — chiude la connessione automaticamente."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Legacy shim — lo schema è ora gestito da `db.schema.init_schema()`,
    chiamato una volta sola allo startup dell'app in main.py."""
    from db.schema import init_schema
    init_schema()
