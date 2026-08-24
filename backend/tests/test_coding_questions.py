"""
Coding-challenge feature tests: interviewer parsing, prompt wiring, and the
API surface (is_coding/language/starter_code on questions, code_language on
submission feeding the evaluation prompt).
"""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.agents.interviewer import _coding_fields
from app.db import init_db
from app.main import app
from app.prompts.evaluation_prompt import build_evaluation_prompt
from app.prompts.question_prompt import build_question_prompt

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_db():
    init_db()
    yield


def _register_and_login():
    import uuid

    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/api/auth/register", json={"email": email, "password": "s3cret-pass!"}
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


CODING_LLM_RESPONSE = {
    "question": "Write a function that reverses a string without slicing.",
    "topic": "Strings",
    "is_coding": True,
    "language": "Python",
    "starter_code": "def reverse(s):\n    # TODO\n    pass",
}

PLAIN_LLM_RESPONSE = {
    "question": "Explain how dictionaries work internally.",
    "topic": "Dictionaries",
}


# ---------- unit level ----------

def test_coding_fields_disabled_when_flag_off():
    fields = _coding_fields(CODING_LLM_RESPONSE, include_coding=False)
    assert fields == {"is_coding": False, "language": None, "starter_code": None}


def test_coding_fields_parsed_and_normalized():
    fields = _coding_fields(CODING_LLM_RESPONSE, include_coding=True)
    assert fields["is_coding"] is True
    assert fields["language"] == "python"
    assert fields["starter_code"].startswith("def reverse")


def test_coding_fields_empty_starter_becomes_none():
    fields = _coding_fields(
        {**CODING_LLM_RESPONSE, "starter_code": "   "}, include_coding=True
    )
    assert fields["starter_code"] is None


def test_question_prompt_includes_coding_rules_only_when_enabled():
    base = dict(
        role="Python Developer",
        experience="Fresher",
        skills=["Python"],
        interview_type="technical",
        difficulty="medium",
        previously_asked=[],
        weak_topic=None,
        question_index=2,
        total_questions=5,
    )
    assert "starter_code" not in build_question_prompt(**base)
    with_coding = build_question_prompt(**base, include_coding=True)
    assert "every third question" in with_coding
    assert "starter_code" in with_coding
    assert "is_coding" in with_coding


def test_evaluation_prompt_flags_code_answers():
    plain = build_evaluation_prompt(
        question="q", topic="t", role="r", experience="e", answer="a"
    )
    coded = build_evaluation_prompt(
        question="q",
        topic="t",
        role="r",
        experience="e",
        answer="print(1)",
        answer_is_code=True,
        language="go",
    )
    assert "CODING question" not in plain
    assert "CODING question" in coded
    assert "in go" in coded


# ---------- API level ----------

def test_start_with_coding_returns_coding_first_question():
    headers = _register_and_login()
    with patch("app.agents.interviewer.call_json") as mock_q:
        mock_q.return_value = CODING_LLM_RESPONSE
        resp = client.post(
            "/api/interviews",
            json={
                "role": "Python Developer",
                "experience": "Fresher",
                "skills": ["Python"],
                "num_questions": 5,
                "include_coding": True,
            },
            headers=headers,
        )
    assert resp.status_code == 200
    q = resp.json()["first_question"]
    assert q["is_coding"] is True
    assert q["language"] == "python"
    assert "def reverse" in q["starter_code"]


def test_default_interviews_have_no_coding_fields():
    headers = _register_and_login()
    with patch("app.agents.interviewer.call_json") as mock_q:
        mock_q.return_value = PLAIN_LLM_RESPONSE
        resp = client.post(
            "/api/interviews",
            json={
                "role": "Python Developer",
                "experience": "Fresher",
                "skills": ["Python"],
                "num_questions": 5,
            },
            headers=headers,
        )
    q = resp.json()["first_question"]
    assert q["is_coding"] is False
    assert q["language"] is None
    assert q["starter_code"] is None


def test_submit_answer_passes_chosen_language_to_evaluator():
    headers = _register_and_login()
    with patch("app.agents.interviewer.call_json") as mock_q:
        mock_q.return_value = CODING_LLM_RESPONSE
        started = client.post(
            "/api/interviews",
            json={
                "role": "Python Developer",
                "experience": "Fresher",
                "skills": ["Python", "Go"],
                "num_questions": 5,
                "include_coding": True,
            },
            headers=headers,
        ).json()

    question_id = started["first_question"]["id"]
    captured = {}

    real_build = build_evaluation_prompt

    def spy(**kwargs):
        captured.update(kwargs)
        return real_build(**kwargs)

    eval_payload = {
        "accuracy": 8,
        "relevance": 8,
        "completeness": 7,
        "clarity": 8,
        "depth": 6,
        "strengths": [],
        "weaknesses": [],
        "feedback": "ok",
        "concepts_demonstrated": [],
        "concepts_missing": [],
    }
    with patch("app.agents.evaluator.build_evaluation_prompt", side_effect=spy):
        with patch("app.agents.interviewer.call_json") as mock_q:
            # A conceptual follow-up question; only its shape matters here.
            mock_q.return_value = PLAIN_LLM_RESPONSE
            resp = client.post(
                f"/api/interviews/{started['session_id']}/answers",
                json={
                    "question_id": question_id,
                    "answer_text": "func reverse(s string) string { ... }",
                    "code_language": " Go ",
                },
                headers=headers,
            )

    assert resp.status_code == 200
    assert captured.get("answer_is_code") is True
    assert captured.get("language") == "go"
