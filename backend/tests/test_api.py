"""
End-to-end API tests with the LLM layer mocked out. These cover the three
demo scenarios from the README: a strong candidate, a weak candidate, and a
mixed candidate whose weak topic should get specifically targeted.
"""
import itertools
import json
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_db():
    init_db()
    yield


def _register_and_login():
    """Create a fresh user; return auth headers for API calls."""
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/api/auth/register", json={"email": email, "password": "s3cret-pass!"}
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _question_response(topic="Python Basics"):
    return {"question": f"Explain a concept in {topic}.", "topic": topic}


def _eval_response(score_dims):
    return {
        **score_dims,
        "strengths": ["Clear explanation"],
        "weaknesses": ["Could be more thorough"],
        "feedback": "Solid answer overall.",
        "concepts_demonstrated": ["basics"],
        "concepts_missing": [],
    }


def _report_response():
    return {
        "strengths": ["Python Basics"],
        "weaknesses": ["SQL"],
        "recommendation": "Proceed to next round.",
        "summary": "Candidate showed solid fundamentals.",
    }


def _start_payload():
    return {
        "role": "Python Developer",
        "experience": "Fresher",
        "skills": ["Python", "SQL", "Django"],
        "interview_type": "technical",
        "difficulty": "medium",
        "num_questions": 5,
    }


@patch("app.agents.interviewer.call_json")
def test_start_interview_returns_first_question(mock_call_json):
    mock_call_json.return_value = _question_response()
    resp = client.post("/api/interviews", json=_start_payload(), headers=_register_and_login())
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_question"]["index"] == 1
    assert body["first_question"]["total"] == 5


def test_endpoints_require_auth():
    assert client.get("/api/interviews").status_code == 401
    assert client.post("/api/interviews", json=_start_payload()).status_code == 401
    assert (
        client.post(
            "/api/interviews/abc/answers",
            json={"question_id": "q", "answer_text": "x"},
        ).status_code
        == 401
    )
    assert client.get("/api/interviews/abc/report").status_code == 401


def test_register_login_and_me():
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    reg = client.post(
        "/api/auth/register", json={"email": email, "password": "s3cret-pass!"}
    )
    assert reg.status_code == 200
    token = reg.json()["token"]
    assert reg.json()["user"]["email"] == email

    dup = client.post(
        "/api/auth/register", json={"email": email, "password": "s3cret-pass!"}
    )
    assert dup.status_code == 409

    bad = client.post(
        "/api/auth/login", json={"email": email, "password": "wrong-password"}
    )
    assert bad.status_code == 401

    login = client.post(
        "/api/auth/login", json={"email": email, "password": "s3cret-pass!"}
    )
    assert login.status_code == 200

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_sessions_are_scoped_to_owner():
    owner_headers = _register_and_login()
    other_headers = _register_and_login()

    with patch("app.agents.interviewer.call_json") as mock_call_json:
        mock_call_json.return_value = _question_response()
        created = client.post(
            "/api/interviews", json=_start_payload(), headers=owner_headers
        ).json()

    session_id = created["session_id"]
    assert client.get(f"/api/interviews/{session_id}", headers=other_headers).status_code == 404
    assert client.get(f"/api/interviews/{session_id}/report", headers=other_headers).status_code == 404
    listing = client.get("/api/interviews", headers=other_headers).json()
    assert session_id not in [s["session_id"] for s in listing]


@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.call_json")
def test_strong_candidate_increases_difficulty(mock_question, mock_eval):
    mock_question.return_value = _question_response()
    headers = _register_and_login()
    start = client.post("/api/interviews", json=_start_payload(), headers=headers).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    mock_eval.return_value = _eval_response(
        {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 9, "depth": 9}
    )
    resp = client.post(
        f"/api/interviews/{session_id}/answers",
        json={"question_id": question_id, "answer_text": "A thorough, correct answer."},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["adaptive_action"] == "INCREASE_DIFFICULTY"
    assert body["next_question"]["difficulty"] == "hard"


@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.call_json")
def test_weak_candidate_decreases_difficulty(mock_question, mock_eval):
    mock_question.return_value = _question_response("SQL")
    headers = _register_and_login()
    start = client.post("/api/interviews", json=_start_payload(), headers=headers).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    mock_eval.return_value = _eval_response(
        {"accuracy": 3, "relevance": 4, "completeness": 3, "clarity": 5, "depth": 2}
    )
    resp = client.post(
        f"/api/interviews/{session_id}/answers",
        json={"question_id": question_id, "answer_text": "A weak, vague answer."},
        headers=headers,
    )
    body = resp.json()
    assert body["adaptive_action"] in ("DECREASE_DIFFICULTY", "TARGET_WEAK_TOPIC")
    assert body["next_question"]["difficulty"] == "easy"


@patch("app.services.report_service.call_json")
@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.call_json")
def test_mixed_candidate_targets_weak_topic_and_builds_report(
    mock_question, mock_eval, mock_report
):
    # Strong on Python, weak on SQL twice in a row -> SQL should be targeted
    topics = itertools.cycle(["Python", "SQL", "SQL"])
    mock_question.side_effect = [_question_response(next(topics)) for _ in range(6)]

    payload = _start_payload()
    headers = _register_and_login()
    start = client.post("/api/interviews", json=payload, headers=headers).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    strong = {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 9, "depth": 9}
    weak = {"accuracy": 3, "relevance": 4, "completeness": 3, "clarity": 4, "depth": 3}
    mid = {"accuracy": 4, "relevance": 4, "completeness": 4, "clarity": 4, "depth": 4}
    eval_sequence = [
        _eval_response(strong), _eval_response(weak), _eval_response(mid),
        _eval_response(strong), _eval_response(mid),
    ]
    mock_eval.side_effect = eval_sequence

    last_body = None
    for _ in range(5):
        resp = client.post(
            f"/api/interviews/{session_id}/answers",
            json={"question_id": question_id, "answer_text": "An answer."},
            headers=headers,
        )
        last_body = resp.json()
        if last_body["next_question"]:
            question_id = last_body["next_question"]["id"]

    assert last_body["is_complete"] is True

    mock_report.return_value = _report_response()
    report_resp = client.get(
        f"/api/interviews/{session_id}/report", headers=headers
    )
    assert report_resp.status_code == 200
    report = report_resp.json()
    assert report["overall_score"] > 0
    assert len(report["questions"]) == 5
    sql_topic = next(t for t in report["topic_scores"] if t["topic"] == "SQL")
    assert sql_topic["average_score"] < 6.0

    # PDF export of the same finished session
    pdf_resp = client.get(f"/api/interviews/{session_id}/report.pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"].startswith("application/pdf")
    assert pdf_resp.content.startswith(b"%PDF")
    assert "attachment" in pdf_resp.headers["content-disposition"]

    other = _register_and_login()
    assert (
        client.get(f"/api/interviews/{session_id}/report.pdf", headers=other).status_code
        == 404
    )


@patch("app.agents.interviewer.call_json")
def test_list_interviews_returns_summaries(mock_call_json):
    mock_call_json.return_value = _question_response()
    headers = _register_and_login()
    created = client.post(
        "/api/interviews", json=_start_payload(), headers=headers
    ).json()
    resp = client.get("/api/interviews", headers=headers)
    assert resp.status_code == 200
    sessions = resp.json()
    summary = next(s for s in sessions if s["session_id"] == created["session_id"])
    assert summary["answered"] == 0
    assert summary["completed"] is False
    assert summary["num_questions"] == 5


@patch("app.agents.interviewer.call_json")
def test_get_interview_detail_includes_current_question(mock_call_json):
    mock_call_json.return_value = _question_response()
    headers = _register_and_login()
    created = client.post(
        "/api/interviews", json=_start_payload(), headers=headers
    ).json()

    resp = client.get(f"/api/interviews/{created['session_id']}", headers=headers)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["answered"] == 0
    assert detail["completed"] is False
    q = detail["current_question"]
    assert q["id"] == created["first_question"]["id"]
    assert q["index"] == 1
    assert q["total"] == 5

    missing = client.get("/api/interviews/does-not-exist", headers=headers)
    assert missing.status_code == 404


@patch("app.agents.interviewer.stream_question_text")
@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.generate_question")
def test_stream_submit_answer_emits_events(mock_gen, mock_eval, mock_stream):
    mock_gen.return_value = {
        "id": "startq123",
        "text": "Explain Python decorators.",
        "topic": "Python",
        "index": 1,
    }
    headers = _register_and_login()
    start = client.post("/api/interviews", json=_start_payload(), headers=headers).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    mock_eval.return_value = _eval_response(
        {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 9, "depth": 9}
    )

    def fake_stream(**kwargs):
        yield '{"question": "Explain '
        yield 'indexes in SQL.", "topic": "SQL"}'

    mock_stream.side_effect = fake_stream

    with client.stream(
        "POST",
        f"/api/interviews/{session_id}/answers/stream",
        json={"question_id": question_id, "answer_text": "A strong answer."},
        headers=headers,
    ) as resp:
        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    types = [e["type"] for e in events]
    assert "evaluation" in types
    assert "question_delta" in types
    assert "next_question" in types
    assert types[-1] == "end"

    eval_event = next(e for e in events if e["type"] == "evaluation")
    assert eval_event["adaptive_action"] == "INCREASE_DIFFICULTY"

    nq = next(e for e in events if e["type"] == "next_question")["next_question"]
    assert nq["text"] == "Explain indexes in SQL."
    assert nq["topic"] == "SQL"
    assert nq["difficulty"] == "hard"
