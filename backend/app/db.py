"""
Lightweight SQLite persistence.

Interview state is stored as a single JSON blob per session — the schema
inside that blob is owned by services/session_service.py. Users live in a
separate small table. Sessions carry an owner_id so reports and history
are scoped to the account that created them.
"""
import json
import sqlite3
import threading
from contextlib import contextmanager

from app.config import settings

_lock = threading.Lock()


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                user_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        # Migration for databases created before auth existed.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(sessions)")}
        if "user_id" not in cols:
            conn.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.commit()


@contextmanager
def _connect():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    try:
        yield conn
    finally:
        conn.close()


# ---------- Users ----------

def create_user(user_id: str, email: str, password_hash: str) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
            (user_id, email, password_hash),
        )
        conn.commit()


def get_user_by_email(email: str) -> dict | None:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    return {"id": row[0], "email": row[1], "password_hash": row[2]} if row else None


# ---------- Sessions ----------

def save_session(session_id: str, state: dict) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (id, state, user_id, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET state = excluded.state,
                                           updated_at = datetime('now')
            """,
            (session_id, json.dumps(state), state.get("owner_id")),
        )
        conn.commit()


def load_session(session_id: str) -> dict | None:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT state FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return json.loads(row[0]) if row else None


def list_sessions(owner_id: str | None = None) -> list[dict]:
    """Sessions newest-first, optionally filtered by owner, timestamps attached."""
    query = "SELECT id, state, created_at, updated_at FROM sessions"
    params = ()
    if owner_id is not None:
        query += " WHERE user_id = ?"
        params = (owner_id,)
    query += " ORDER BY updated_at DESC"

    with _lock, _connect() as conn:
        rows = conn.execute(query, params).fetchall()
    sessions = []
    for session_id, raw_state, created_at, updated_at in rows:
        state = json.loads(raw_state)
        state["created_at"] = created_at
        state["updated_at"] = updated_at
        sessions.append(state)
    return sessions
