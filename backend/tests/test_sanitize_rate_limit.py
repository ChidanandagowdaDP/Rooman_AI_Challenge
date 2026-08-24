"""
Unit tests for input sanitization and the sliding-window rate limiter,
plus an API-level test that 429s are actually returned.
"""
from app.config import settings
from app.rate_limit import SlidingWindowLimiter, limiter as global_limiter
from app.sanitize import clean_multiline, clean_single_line, clean_skills


# ---------- sanitize ----------

def test_clean_single_line_collapses_whitespace_and_strips_controls():
    assert clean_single_line("  Python \t Developer  ", 120) == "Python Developer"
    dirty = "Sen\x00ior De\x1bveloper\nwith\rnewlines"
    # Control characters are removed outright; regular whitespace is collapsed.
    assert clean_single_line(dirty, 120) == "Senior Developerwithnewlines"
    assert clean_single_line("line one\n line two", 120) == "line one line two"


def test_clean_single_line_caps_length():
    assert len(clean_single_line("a" * 500, 100)) == 100


def test_clean_multiline_preserves_intentional_newlines():
    text = "First point.\r\nSecond point.\n\n\n\nFourth point."
    cleaned = clean_multiline(text, 8000)
    assert cleaned == "First point.\nSecond point.\n\nFourth point."


def test_clean_multiline_strips_invisible_characters():
    assert clean_multiline("answer\x07 with bell\x08", 8000) == "answer with bell"


def test_clean_skills_dedupes_and_drops_empties():
    skills = ["Python", "  python ", "", "SQL\t", "DJANGO", "django"]
    assert clean_skills(skills, max_items=15, max_length_each=40) == [
        "Python",
        "SQL",
        "DJANGO",
    ]


def test_clean_skills_caps_count():
    skills = [f"skill{i}" for i in range(30)]
    assert len(clean_skills(skills, max_items=15, max_length_each=40)) == 15


# ---------- rate limiter ----------

def test_limiter_allows_within_limit_then_blocks():
    box = SlidingWindowLimiter()
    for _ in range(5):
        assert box.allow("k", limit=5, window_seconds=60)
    assert not box.allow("k", limit=5, window_seconds=60)
    # Independent keys are independent.
    assert box.allow("other", limit=5, window_seconds=60)


def test_limiter_window_expires(monkeypatch):
    box = SlidingWindowLimiter()
    fake_now = [1000.0]
    monkeypatch.setattr("app.rate_limit.time.monotonic", lambda: fake_now[0])
    for _ in range(3):
        assert box.allow("t", limit=3, window_seconds=60)
    assert not box.allow("t", limit=3, window_seconds=60)
    fake_now[0] += 61  # window has fully elapsed
    assert box.allow("t", limit=3, window_seconds=60)


def test_api_returns_429_when_limit_hit():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    settings.RATE_LIMIT_AUTH_PER_MIN = 2
    try:
        global_limiter._hits.clear()
        email = "ratelimit@example.com"
        payload = {"email": email, "password": "whatever-pass"}
        assert client.post("/api/auth/login", json=payload).status_code == 401
        assert client.post("/api/auth/login", json=payload).status_code == 401
        blocked = client.post("/api/auth/login", json=payload)
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) >= 1
    finally:
        settings.RATE_LIMIT_AUTH_PER_MIN = 30
        global_limiter._hits.clear()
