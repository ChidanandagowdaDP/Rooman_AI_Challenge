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
from app.db import load_session, save_session
from app.models.schemas import AdaptiveAction, Difficulty


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
    )

    state = {
        "session_id": session_id,
        "role": role,
        "experience": experience,
        "skills": skills,
        "interview_type": interview_type,
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


def submit_answer(session_id: str, *, question_id: str, answer_text: str) -> dict:
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
