"""
Interviewer agent — responsible for exactly one thing: turning interview
context into the next question. All state tracking (what's been asked,
current difficulty, question count) is owned by session_service and passed
in; this agent is stateless.
"""
import uuid

from app.models.schemas import Difficulty
from app.prompts.question_prompt import SYSTEM_PROMPT, build_question_prompt
from app.services.llm_service import call_json, stream_text


def _question_context(
    *,
    role: str,
    experience: str,
    skills: list[str],
    interview_type: str,
    difficulty: Difficulty,
    previously_asked: list[str],
    weak_topic: str | None,
    question_index: int,
    total_questions: int,
    include_coding: bool = False,
):
    return dict(
        role=role,
        experience=experience,
        skills=skills,
        interview_type=interview_type,
        difficulty=difficulty.value,
        previously_asked=previously_asked,
        weak_topic=weak_topic,
        question_index=question_index,
        total_questions=total_questions,
        include_coding=include_coding,
    )


def _coding_fields(result: dict, include_coding: bool) -> dict:
    """Extract optional coding-challenge fields from an LLM response."""
    if not include_coding or not result.get("is_coding"):
        return {"is_coding": False, "language": None, "starter_code": None}
    language = result.get("language") or "python"
    starter = (result.get("starter_code") or "").strip() or None
    return {
        "is_coding": True,
        "language": str(language).strip().lower(),
        "starter_code": starter,
    }


def generate_question(
    *,
    role: str,
    experience: str,
    skills: list[str],
    interview_type: str,
    difficulty: Difficulty,
    previously_asked: list[str],
    weak_topic: str | None,
    question_index: int,
    total_questions: int,
    include_coding: bool = False,
) -> dict:
    prompt = build_question_prompt(
        **_question_context(
            role=role,
            experience=experience,
            skills=skills,
            interview_type=interview_type,
            difficulty=difficulty,
            previously_asked=previously_asked,
            weak_topic=weak_topic,
            question_index=question_index,
            total_questions=total_questions,
            include_coding=include_coding,
        )
    )
    # Coding challenges carry a starter-code skeleton, so allow more tokens.
    max_tokens = 700 if include_coding else 400
    result = call_json(system_prompt=SYSTEM_PROMPT, user_prompt=prompt, max_tokens=max_tokens)

    return {
        "id": uuid.uuid4().hex[:12],
        "text": result["question"],
        "topic": result.get("topic", "General"),
        "difficulty": difficulty,
        "index": question_index,
        **_coding_fields(result, include_coding),
    }


def stream_question_text(**kwargs):
    """
    Yield the next question's text in chunks as it is generated. The caller
    receives (topic_hint, chunk_generator); persistence of the full question
    object still goes through generate_question() — this is a preview stream
    used by the SSE endpoint so the UI can show the question being written.
    """
    context = _question_context(**kwargs)
    prompt = build_question_prompt(**context)
    max_tokens = 700 if context.get("include_coding") else 400
    return stream_text(system_prompt=SYSTEM_PROMPT, user_prompt=prompt, max_tokens=max_tokens)
