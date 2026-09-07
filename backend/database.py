import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = "./chat_history.db"


def _get_conn() -> sqlite3.Connection:
    """Return a connection with row_factory set for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables if they don't already exist. Called once at app startup."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id            TEXT PRIMARY KEY,
                title         TEXT NOT NULL DEFAULT 'New Conversation',
                document_name TEXT,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id    TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                role          TEXT    NOT NULL CHECK(role IN ('user', 'ai')),
                content       TEXT    NOT NULL,
                context_used  TEXT,
                created_at    TEXT    NOT NULL
            );
        """)


# ─── Session helpers ──────────────────────────────────────────────────────────

def create_session(title: str = "New Conversation", document_name: str = "") -> dict:
    """Insert a new session and return it as a dict."""
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (id, title, document_name, created_at) VALUES (?, ?, ?, ?)",
            (session_id, title, document_name, now),
        )
    return {"id": session_id, "title": title, "document_name": document_name, "created_at": now}


def get_all_sessions() -> list[dict]:
    """Return all sessions ordered newest-first."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def update_session_title(session_id: str, title: str):
    """Update the display title of a session."""
    with _get_conn() as conn:
        conn.execute(
            "UPDATE sessions SET title = ? WHERE id = ?",
            (title, session_id),
        )


def delete_session(session_id: str):
    """Delete a session and all its messages (cascade handles messages)."""
    with _get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


# ─── Message helpers ──────────────────────────────────────────────────────────

def save_message(
    session_id: str,
    role: str,
    content: str,
    context_used: str | None = None,
) -> dict:
    """Insert a message and return it as a dict."""
    now = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO messages (session_id, role, content, context_used, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, context_used, now),
        )
        msg_id = cursor.lastrowid
    return {
        "id": msg_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "context_used": context_used,
        "created_at": now,
    }


def get_messages(session_id: str) -> list[dict]:
    """Return all messages for a session ordered oldest-first."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]
