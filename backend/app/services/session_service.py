"""
Session service — the orchestrator. This is where the agents (interviewer,
evaluator, adaptive_controller) get wired together with persistent state.

Design choice: all interview STATE (question count, transcript, current
difficulty, topic history) is owned and mutated here in plain Python. The
LLM never tracks state across calls — every prompt is built fresh from the
state this module maintains. See README "Design Decisions" for why.
"""
import uuid

from app.agents import adaptive_controller, evaluator, interviewer
from app.db import (
    list_sessions as _db_list_sessions,
    load_session,
    save_session,
)
from app.models.schemas import AdaptiveAction, Difficulty
from app.services import llm_service, scoring_service


class SessionNotFoundError(Exception):
    pass


class InterviewAlreadyCompleteError(Exception):
    pass


class QuestionMismatchError(Exception):
    pass


def create_session(
    *,
    role: str,
    experience: str,
    skills: list[str],
    interview_type: str,
    difficulty: Difficulty,
    num_questions: int,
    owner_id: str | None = None,
    scoring_focus: str = "technical_depth",
    include_coding: bool = False,
) -> dict:
    session_id = uuid.uuid4().hex

    first_question = interviewer.generate_question(
        role=role,
        experience=experience,
        skills=skills,
        interview_type=interview_type,
        difficulty=difficulty,
        previously_asked=[],
        weak_topic=None,
        question_index=1,
        total_questions=num_questions,
        include_coding=include_coding,
    )

    state = {
        "session_id": session_id,
        "owner_id": owner_id,
        "role": role,
        "experience": experience,
        "skills": skills,
        "interview_type": interview_type,
        "scoring_focus": scoring_service.normalize_focus(scoring_focus),
        "include_coding": bool(include_coding),
        "current_difficulty": difficulty.value,
        "num_questions": num_questions,
        "current_question": first_question | {"difficulty": difficulty.value},
        "questions_asked": [],
        "evaluations": [],
        "completed": False,
        "report": None,
    }
    save_session(session_id, state)
    return state


def get_session(session_id: str) -> dict:
    state = load_session(session_id)
    if state is None:
        raise SessionNotFoundError(session_id)
    return state


def _summary(state: dict) -> dict:
    return {
        "session_id": state["session_id"],
        "role": state["role"],
        "experience": state["experience"],
        "interview_type": state["interview_type"],
        "current_difficulty": state["current_difficulty"],
        "num_questions": state["num_questions"],
        "answered": len(state["evaluations"]),
        "completed": state["completed"],
        "created_at": state.get("created_at"),
        "updated_at": state.get("updated_at"),
    }


def list_sessions(owner_id: str | None = None) -> list[dict]:
    """Newest-first summaries for the interview history view."""
    return [_summary(state) for state in _db_list_sessions(owner_id)]


def get_session_view(session_id: str) -> dict:
    """
    Client-facing session detail. Includes the live current question so a
    browser refresh mid-interview can resume exactly where it left off.
    """
    state = get_session(session_id)
    view = _summary(state)
    if not state["completed"] and state["current_question"] is not None:
        q = state["current_question"]
        view["current_question"] = {
            **q,
            "index": len(state["evaluations"]) + 1,
            "total": state["num_questions"],
        }
    return view


def submit_answer(
    session_id: str,
    *,
    question_id: str,
    answer_text: str,
    code_language: str | None = None,
) -> dict:
    state = get_session(session_id)

    if state["completed"]:
        raise InterviewAlreadyCompleteError(session_id)

    current_q = state["current_question"]
    if current_q["id"] != question_id:
        raise QuestionMismatchError(
            f"expected {current_q['id']}, got {question_id}"
        )

    evaluation = evaluator.evaluate_answer(
        question=current_q["text"],
        topic=current_q["topic"],
        role=state["role"],
        experience=state["experience"],
            answer=answer_text,
            weights=scoring_service.weights_for(state.get("scoring_focus")),
            answer_is_code=bool(current_q.get("is_coding")),
            language=code_language or current_q.get("language"),
        )

    record = {
        "question_id": current_q["id"],
        "question_text": current_q["text"],
        "topic": current_q["topic"],
        "difficulty": current_q["difficulty"],
        "answer_text": answer_text,
        **evaluation,
    }

    state["questions_asked"].append(current_q)
    state["evaluations"].append(record)

    answered_count = len(state["evaluations"])
    is_last = answered_count >= state["num_questions"]

    action, next_difficulty, weak_topic = adaptive_controller.decide_next_action(
        latest_score=evaluation["score"],
        current_difficulty=Difficulty(state["current_difficulty"]),
        evaluations=state["evaluations"],
    )
    state["current_difficulty"] = next_difficulty.value

    next_question = None
    if not is_last:
        previously_asked = [q["text"] for q in state["questions_asked"]]
        next_question = interviewer.generate_question(
            role=state["role"],
            experience=state["experience"],
            skills=state["skills"],
            interview_type=state["interview_type"],
            difficulty=next_difficulty,
            previously_asked=previously_asked,
            weak_topic=weak_topic,
            question_index=answered_count + 1,
            total_questions=state["num_questions"],
            include_coding=state.get("include_coding", False),
        )
        state["current_question"] = next_question | {"difficulty": next_difficulty.value}
    else:
        state["completed"] = True
        state["current_question"] = None

    save_session(session_id, state)

    return {
        "evaluation": record,
        "adaptive_action": action,
        "next_question": next_question,
        "is_complete": is_last,
        "progress": answered_count,
        "total": state["num_questions"],
    }


def submit_answer_stream(
    session_id: str,
    *,
    question_id: str,
    answer_text: str,
    code_language: str | None = None,
):
    """
    Streaming variant of submit_answer.

    Validates eagerly (so HTTP errors surface before the response starts),
    then returns a generator of typed events:
      {"type": "evaluation", ...}       — full evaluation + adaptive decision
      {"type": "question_delta", ...}   — growing preview of the next question
      {"type": "next_question", ...}    — the persisted final question object
      {"type": "complete"}              — interview finished
    """
    state = get_session(session_id)
    if state["completed"]:
        raise InterviewAlreadyCompleteError(session_id)
    current_q = state["current_question"]
    if current_q["id"] != question_id:
        raise QuestionMismatchError(f"expected {current_q['id']}, got {question_id}")

    def events():
        evaluation = evaluator.evaluate_answer(
            question=current_q["text"],
            topic=current_q["topic"],
            role=state["role"],
            experience=state["experience"],
            answer=answer_text,
            weights=scoring_service.weights_for(state.get("scoring_focus")),
            answer_is_code=bool(current_q.get("is_coding")),
            language=code_language or current_q.get("language"),
        )

        record = {
            "question_id": current_q["id"],
            "question_text": current_q["text"],
            "topic": current_q["topic"],
            "difficulty": current_q["difficulty"],
            "answer_text": answer_text,
            **evaluation,
        }
        state["questions_asked"].append(current_q)
        state["evaluations"].append(record)

        answered_count = len(state["evaluations"])
        is_last = answered_count >= state["num_questions"]

        action, next_difficulty, weak_topic = adaptive_controller.decide_next_action(
            latest_score=evaluation["score"],
            current_difficulty=Difficulty(state["current_difficulty"]),
            evaluations=state["evaluations"],
        )
        state["current_difficulty"] = next_difficulty.value

        yield {
            "type": "evaluation",
            "evaluation": record,
            "adaptive_action": action,
            "next_difficulty": next_difficulty.value,
            "is_complete": is_last,
            "progress": answered_count,
            "total": state["num_questions"],
        }

        if is_last:
            state["completed"] = True
            state["current_question"] = None
            save_session(session_id, state)
            yield {"type": "complete"}
            return

        gen_kwargs = dict(
            role=state["role"],
            experience=state["experience"],
            skills=state["skills"],
            interview_type=state["interview_type"],
            difficulty=next_difficulty,
            previously_asked=[q["text"] for q in state["questions_asked"]],
            weak_topic=weak_topic,
            question_index=answered_count + 1,
            total_questions=state["num_questions"],
            include_coding=state.get("include_coding", False),
        )

        sent_chars = 0
        raw = ""
        try:
            for chunk in interviewer.stream_question_text(**gen_kwargs):
                raw += chunk
                partial = llm_service.extract_partial_question(raw)
                if len(partial) > sent_chars:
                    yield {
                        "type": "question_delta",
                        "text": partial[sent_chars:],
                    }
                    sent_chars = len(partial)
        except llm_service.LLMJSONError:
            pass  # fall through to non-streaming generation below

        parsed = llm_service.try_parse_json(raw)
        if parsed and parsed.get("question"):
            next_question = {
                "id": uuid.uuid4().hex[:12],
                "text": parsed["question"],
                "topic": parsed.get("topic", "General"),
                "difficulty": next_difficulty,
                "index": answered_count + 1,
                **interviewer._coding_fields(parsed, state.get("include_coding", False)),
            }
        else:
            # Stream failed or returned unparseable text — authoritative retry.
            next_question = interviewer.generate_question(**gen_kwargs)

        state["current_question"] = next_question | {"difficulty": next_difficulty.value}
        save_session(session_id, state)

        yield {"type": "next_question", "next_question": next_question}

    return events()


def get_or_build_report(session_id: str) -> dict:
    from app.services.report_service import build_final_report

    state = get_session(session_id)
    if not state["completed"]:
        raise InterviewAlreadyCompleteError(
            "Interview is not finished yet — cannot generate final report."
        )

    if state["report"] is None:
        report = build_final_report(
            role=state["role"],
            experience=state["experience"],
            evaluations=state["evaluations"],
        )
        state["report"] = report
        save_session(session_id, state)

    return {**state["report"], "session_id": session_id, "role": state["role"]}
