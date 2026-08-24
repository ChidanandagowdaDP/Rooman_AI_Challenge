"""
InterviewAI backend — FastAPI application.

Routes are intentionally thin: they validate input via Pydantic, delegate to
session_service, and shape the response. All real logic lives in
agents/ and services/.
"""
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.db import init_db
from app.models.schemas import (
    FinalReportOut,
    QuestionOut,
    QuestionRecord,
    SessionDetailOut,
    SessionSummaryOut,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TopicScore,
)
from app.services import session_service
from app.services.llm_service import LLMJSONError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="InterviewAI API",
    description="Adaptive AI interviewer & candidate evaluation system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    settings.validate()
    init_db()
    logger.info("InterviewAI backend started (env=%s, model=%s)", settings.ENV, settings.MODEL_NAME)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/interviews", response_model=list[SessionSummaryOut])
def list_interviews() -> list[SessionSummaryOut]:
    return [SessionSummaryOut(**s) for s in session_service.list_sessions()]


@app.get("/api/interviews/{session_id}", response_model=SessionDetailOut)
def get_interview(session_id: str) -> SessionDetailOut:
    try:
        view = session_service.get_session_view(session_id)
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    return SessionDetailOut(**view)


@app.post("/api/interviews", response_model=StartInterviewResponse)
def start_interview(payload: StartInterviewRequest) -> StartInterviewResponse:
    try:
        state = session_service.create_session(
            role=payload.role,
            experience=payload.experience,
            skills=payload.skills,
            interview_type=payload.interview_type.value,
            difficulty=payload.difficulty,
            num_questions=payload.num_questions,
        )
    except LLMJSONError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    q = state["current_question"]
    return StartInterviewResponse(
        session_id=state["session_id"],
        first_question=QuestionOut(
            id=q["id"],
            text=q["text"],
            topic=q["topic"],
            difficulty=q["difficulty"],
            index=1,
            total=state["num_questions"],
        ),
    )


@app.post("/api/interviews/{session_id}/answers", response_model=SubmitAnswerResponse)
def submit_answer(session_id: str, payload: SubmitAnswerRequest) -> SubmitAnswerResponse:
    try:
        result = session_service.submit_answer(
            session_id,
            question_id=payload.question_id,
            answer_text=payload.answer_text,
        )
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except session_service.InterviewAlreadyCompleteError as exc:
        raise HTTPException(status_code=409, detail="Interview already complete") from exc
    except session_service.QuestionMismatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMJSONError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    next_q = None
    if result["next_question"] is not None:
        nq = result["next_question"]
        next_q = QuestionOut(
            id=nq["id"],
            text=nq["text"],
            topic=nq["topic"],
            difficulty=nq["difficulty"],
            index=result["progress"] + 1,
            total=result["total"],
        )

    return SubmitAnswerResponse(
        evaluation=result["evaluation"],
        adaptive_action=result["adaptive_action"],
        next_question=next_q,
        is_complete=result["is_complete"],
        progress=result["progress"],
        total=result["total"],
    )


@app.post("/api/interviews/{session_id}/answers/stream")
def submit_answer_stream(session_id: str, payload: SubmitAnswerRequest):
    """
    Server-Sent Events stream for one answer submission:
    evaluation -> adaptive action -> live question generation -> final question.
    """
    try:
        event_gen = session_service.submit_answer_stream(
            session_id,
            question_id=payload.question_id,
            answer_text=payload.answer_text,
        )
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except session_service.InterviewAlreadyCompleteError as exc:
        raise HTTPException(status_code=409, detail="Interview already complete") from exc
    except session_service.QuestionMismatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def sse():
        try:
            for event in event_gen:
                yield f"data: {json.dumps(event, default=str)}\n\n"
            yield 'data: {"type": "end"}\n\n'
        except LLMJSONError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/interviews/{session_id}/report", response_model=FinalReportOut)
def get_report(session_id: str) -> FinalReportOut:
    try:
        report = session_service.get_or_build_report(session_id)
        state = session_service.get_session(session_id)
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except session_service.InterviewAlreadyCompleteError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except LLMJSONError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    questions = [
        QuestionRecord(
            index=i + 1,
            topic=e["topic"],
            question_text=e["question_text"],
            answer_text=e["answer_text"],
            score=e["score"],
            difficulty=e["difficulty"],
        )
        for i, e in enumerate(state["evaluations"])
    ]
    topic_scores = [TopicScore(**t) for t in report["topic_scores"]]

    return FinalReportOut(
        session_id=session_id,
        role=report["role"],
        overall_score=report["overall_score"],
        technical_score=report["technical_score"],
        communication_score=report["communication_score"],
        problem_solving_score=report["problem_solving_score"],
        strengths=report["strengths"],
        weaknesses=report["weaknesses"],
        recommendation=report["recommendation"],
        summary=report["summary"],
        topic_scores=topic_scores,
        questions=questions,
    )
