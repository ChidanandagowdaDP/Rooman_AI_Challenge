"""
Tests for the local code runner service and its API endpoint.
"""
import sys
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.services import code_runner

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_db():
    init_db()
    yield


def _auth_headers():
    import uuid

    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/api/auth/register", json={"email": email, "password": "s3cret-pass!"}
    )
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def test_run_python_prints_stdout():
    result = code_runner.run_code("python", 'print("hello runner")')
    assert result["supported"] is True
    assert result["exit_code"] == 0
    assert "hello runner" in result["stdout"]


def test_run_python_reports_stderr_and_exit_code():
    result = code_runner.run_code("python", "raise ValueError('boom')")
    assert result["exit_code"] != 0
    assert "ValueError" in result["stderr"]


def test_unsupported_language_returns_message():
    result = code_runner.run_code("java", "class Main {}")
    assert result["supported"] is False
    assert "python" in result["message"]


def test_supported_languages_lists_python():
    # The test interpreter itself is Python, so it must always be offered.
    assert "python" in code_runner.supported_languages()


def test_timeout_is_reported():
    with patch.object(code_runner, "TIMEOUT_SECONDS", 1):
        result = code_runner.run_code("python", "while True:\n    pass\n")
    assert result["timed_out"] is True
    assert result["message"]


# ---------- endpoint ----------

def test_run_code_requires_auth():
    resp = client.post(
        "/api/run-code", json={"language": "python", "code": "print(1)"}
    )
    assert resp.status_code == 401


def test_run_code_endpoint_executes():
    resp = client.post(
        "/api/run-code",
        json={"language": "python", "code": "print(sum(range(5)))"},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["supported"] is True
    assert body["stdout"].strip() == str(sum(range(5)))


def test_run_code_endpoint_rejects_blank_code():
    resp = client.post(
        "/api/run-code",
        json={"language": "python", "code": "   \n  "},
        headers=_auth_headers(),
    )
    assert resp.status_code == 422


if sys.platform != "win32":  # pragma: no cover — informational guard
    pass
