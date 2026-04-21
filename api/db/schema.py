"""
Schema DB unificato — unica fonte di verità.
`init_schema()` è idempotente: va chiamato allo startup dell'app.
Include anche migrazioni non distruttive (ADD COLUMN) per schema esistenti.
"""
import logging
import sqlite3

from config import DB_PATH

logger = logging.getLogger(__name__)


TABLES = [
    # Transazioni
    """CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        amount REAL NOT NULL,
        direction TEXT NOT NULL,
        category TEXT,
        note TEXT,
        account TEXT DEFAULT 'cash'
    )""",

    # Workout
    """CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        reps INTEGER,
        sets INTEGER,
        notes TEXT,
        logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",

    # Peso corporeo
    """CREATE TABLE IF NOT EXISTS body_weight (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight_kg REAL NOT NULL,
        logged_at TEXT DEFAULT (datetime('now'))
    )""",

    # Database cibi (schema live: id pk, name unique)
    """CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        kcal_100g REAL,
        protein_100g REAL,
        carbs_100g REAL,
        fat_100g REAL
    )""",

    # Pasti
    """CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        logged_at TEXT DEFAULT (datetime('now')),
        description TEXT,
        kcal REAL DEFAULT 0,
        protein REAL DEFAULT 0,
        carbs REAL DEFAULT 0,
        fat REAL DEFAULT 0,
        note TEXT
    )""",

    # Promemoria
    """CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        remind_at TEXT,
        sent INTEGER DEFAULT 0
    )""",

    # Storico conversazioni (query + task)
    """CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        chat_id TEXT,
        category TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",

    # Config key/value
    """CREATE TABLE IF NOT EXISTS jarvis_config (
        key TEXT PRIMARY KEY,
        value TEXT
    )""",

    # File pending (upload Telegram in attesa di classificazione)
    """CREATE TABLE IF NOT EXISTS pending_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        upload_time TEXT NOT NULL
    )""",
]

# Indici per query frequenti (evitiamo full scan su DB che cresce)
INDICES = [
    "CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account)",
    "CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise ON workout_logs(exercise, logged_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workout_logs_logged ON workout_logs(logged_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_body_weight_logged ON body_weight(logged_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_meals_logged ON meals(logged_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(sent, remind_at)",
    "CREATE INDEX IF NOT EXISTS idx_conv_history_created ON conversation_history(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_conv_history_chat ON conversation_history(chat_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_pending_chat ON pending_files(chat_id, upload_time DESC)",
]

# Migrazioni non distruttive (ADD COLUMN idempotente)
# Lista di tuple (tabella, colonna, definizione)
MIGRATIONS = [
    ("conversation_history", "chat_id", "TEXT"),
    ("conversation_history", "category", "TEXT"),
    ("transactions", "account", "TEXT DEFAULT 'cash'"),
    ("meals", "note", "TEXT"),
]


def _column_exists(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def init_schema():
    """Crea tutte le tabelle, indici, applica migrazioni non distruttive."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for stmt in TABLES:
        cur.execute(stmt)

    for table, column, col_def in MIGRATIONS:
        try:
            if not _column_exists(cur, table, column):
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
                logger.info("schema migration: %s.%s added", table, column)
        except sqlite3.OperationalError as e:
            logger.warning("migration %s.%s skipped: %s", table, column, e)

    for idx in INDICES:
        cur.execute(idx)

    conn.commit()
    conn.close()
    logger.info("schema initialized (tables=%d, indices=%d)", len(TABLES), len(INDICES))
