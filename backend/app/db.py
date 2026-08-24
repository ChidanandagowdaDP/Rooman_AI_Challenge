"""
Lightweight SQLite persistence.

Interview state is stored as a single JSON blob per session — the schema
inside that blob is owned by services/session_service.py. This keeps the
storage layer trivial while still surviving server restarts (important for
anything that claims to be "production ready").
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
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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


def save_session(session_id: str, state: dict) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (id, state, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET state = excluded.state,
                                           updated_at = datetime('now')
            """,
            (session_id, json.dumps(state)),
        )
        conn.commit()


def load_session(session_id: str) -> dict | None:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT state FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return json.loads(row[0]) if row else None


def list_sessions() -> list[dict]:
    """All sessions, newest first, with their timestamps attached."""
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT id, state, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
    sessions = []
    for session_id, raw_state, created_at, updated_at in rows:
        state = json.loads(raw_state)
        state["created_at"] = created_at
        state["updated_at"] = updated_at
        sessions.append(state)
    return sessions
