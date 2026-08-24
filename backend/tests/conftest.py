import os
import tempfile

# Must be set before any app module is imported (config.py reads them at
# import time). A real temp file is used instead of ":memory:" because each
# db call opens a fresh sqlite3 connection — an in-memory DB would not
# persist across those separate connections.
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")
os.environ.setdefault(
    "DATABASE_PATH", os.path.join(tempfile.gettempdir(), "interview_ai_test.db")
)
