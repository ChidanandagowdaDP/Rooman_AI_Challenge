"""
End-to-end API tests with the LLM layer mocked out. These cover the three
demo scenarios from the README: a strong candidate, a weak candidate, and a
mixed candidate whose weak topic should get specifically targeted.
"""
import itertools
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
    resp = client.post("/api/interviews", json=_start_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_question"]["index"] == 1
    assert body["first_question"]["total"] == 5


@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.call_json")
def test_strong_candidate_increases_difficulty(mock_question, mock_eval):
    mock_question.return_value = _question_response()
    start = client.post("/api/interviews", json=_start_payload()).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    mock_eval.return_value = _eval_response(
        {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 9, "depth": 9}
    )
    resp = client.post(
        f"/api/interviews/{session_id}/answers",
        json={"question_id": question_id, "answer_text": "A thorough, correct answer."},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["adaptive_action"] == "INCREASE_DIFFICULTY"
    assert body["next_question"]["difficulty"] == "hard"


@patch("app.agents.evaluator.call_json")
@patch("app.agents.interviewer.call_json")
def test_weak_candidate_decreases_difficulty(mock_question, mock_eval):
    mock_question.return_value = _question_response("SQL")
    start = client.post("/api/interviews", json=_start_payload()).json()
    session_id = start["session_id"]
    question_id = start["first_question"]["id"]

    mock_eval.return_value = _eval_response(
        {"accuracy": 3, "relevance": 4, "completeness": 3, "clarity": 5, "depth": 2}
    )
    resp = client.post(
        f"/api/interviews/{session_id}/answers",
        json={"question_id": question_id, "answer_text": "A weak, vague answer."},
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
    start = client.post("/api/interviews", json=payload).json()
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
        )
        last_body = resp.json()
        if last_body["next_question"]:
            question_id = last_body["next_question"]["id"]

    assert last_body["is_complete"] is True

    mock_report.return_value = _report_response()
    report_resp = client.get(f"/api/interviews/{session_id}/report")
    assert report_resp.status_code == 200
    report = report_resp.json()
    assert report["overall_score"] > 0
    assert len(report["questions"]) == 5
    sql_topic = next(t for t in report["topic_scores"] if t["topic"] == "SQL")
    assert sql_topic["average_score"] < 6.0
