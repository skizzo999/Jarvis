import sqlite3

DB_PATH = "/home/jarvis/data/jarvis.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            amount REAL NOT NULL,
            direction TEXT NOT NULL,
            category TEXT,
            note TEXT
        )
    """)
    conn.commit()
    conn.close()
