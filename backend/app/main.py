"""
InterviewAI backend — FastAPI application.

Routes are intentionally thin: they validate input via Pydantic, delegate to
session_service, and shape the response. All real logic lives in
agents/ and services/.
"""
import json
import logging
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app import auth as auth_service
from app.config import settings
from app.db import create_user, get_user_by_email, init_db
from app.rate_limit import RateLimitExceeded, check_rate_limit
from app.services.pdf_service import build_report_pdf
from app.models.schemas import (
    FinalReportOut,
    LoginRequest,
    QuestionOut,
    QuestionRecord,
    RegisterRequest,
    SessionDetailOut,
    SessionSummaryOut,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TokenOut,
    TopicScore,
    UserOut,
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


@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    """Per-user/IP sliding-window limits; tighter on auth endpoints."""
    path = request.url.path
    if path.startswith("/api/") and not path.startswith("/api/health"):
        scope = "auth" if path.startswith("/api/auth") else "api"
        try:
            check_rate_limit(request, scope)
        except RateLimitExceeded as exc:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(exc.retry_after)},
            )
    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    settings.validate()
    init_db()
    logger.info("InterviewAI backend started (env=%s, model=%s)", settings.ENV, settings.MODEL_NAME)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# ---------- Auth ----------

def require_user(request: Request) -> UserOut:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    claims = auth_service.verify_token(auth_header.removeprefix("Bearer ").strip())
    if claims is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return UserOut(id=claims["sub"], email=claims.get("email", ""))


def _require_owner(state: dict, user: UserOut) -> None:
    """404 (not 403) so session IDs can't be probed for existence."""
    owner = state.get("owner_id")
    if owner is not None and owner != user.id:
        raise HTTPException(status_code=404, detail="Session not found")


@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: RegisterRequest) -> TokenOut:
    if get_user_by_email(payload.email.lower()) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = uuid.uuid4().hex
    create_user(user_id, payload.email.lower(), auth_service.hash_password(payload.password))
    token = auth_service.create_token(user_id, payload.email.lower())
    return TokenOut(token=token, user=UserOut(id=user_id, email=payload.email.lower()))


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginRequest) -> TokenOut:
    user = get_user_by_email(payload.email.lower())
    if user is None or not auth_service.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = auth_service.create_token(user["id"], user["email"])
    return TokenOut(token=token, user=UserOut(id=user["id"], email=user["email"]))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: UserOut = Depends(require_user)) -> UserOut:
    return user


@app.get("/api/interviews", response_model=list[SessionSummaryOut])
def list_interviews(user: UserOut = Depends(require_user)) -> list[SessionSummaryOut]:
    return [SessionSummaryOut(**s) for s in session_service.list_sessions(user.id)]


@app.get("/api/interviews/{session_id}", response_model=SessionDetailOut)
def get_interview(session_id: str, user: UserOut = Depends(require_user)) -> SessionDetailOut:
    try:
        state = session_service.get_session(session_id)
        _require_owner(state, user)
        view = session_service.get_session_view(session_id)
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    return SessionDetailOut(**view)


@app.post("/api/interviews", response_model=StartInterviewResponse)
def start_interview(
    payload: StartInterviewRequest, user: UserOut = Depends(require_user)
) -> StartInterviewResponse:
    try:
        state = session_service.create_session(
            role=payload.role,
            experience=payload.experience,
            skills=payload.skills,
            interview_type=payload.interview_type.value,
            difficulty=payload.difficulty,
            num_questions=payload.num_questions,
            owner_id=user.id,
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
def submit_answer(
    session_id: str,
    payload: SubmitAnswerRequest,
    user: UserOut = Depends(require_user),
) -> SubmitAnswerResponse:
    try:
        _require_owner(session_service.get_session(session_id), user)
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
def submit_answer_stream(
    session_id: str,
    payload: SubmitAnswerRequest,
    user: UserOut = Depends(require_user),
):
    """
    Server-Sent Events stream for one answer submission:
    evaluation -> adaptive action -> live question generation -> final question.
    """
    try:
        _require_owner(session_service.get_session(session_id), user)
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
def get_report(session_id: str, user: UserOut = Depends(require_user)) -> FinalReportOut:
    try:
        _require_owner(session_service.get_session(session_id), user)
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


@app.get("/api/interviews/{session_id}/report.pdf")
def download_report_pdf(session_id: str, user: UserOut = Depends(require_user)) -> Response:
    try:
        _require_owner(session_service.get_session(session_id), user)
        report = session_service.get_or_build_report(session_id)
    except session_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except session_service.InterviewAlreadyCompleteError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except LLMJSONError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    pdf_bytes = build_report_pdf(report)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="interview-report-{session_id[:12]}.pdf"'
        },
    )
