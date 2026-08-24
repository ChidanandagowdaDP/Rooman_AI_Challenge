"""
All request/response and internal data models for InterviewAI.
Kept in one module because the schemas are small and heavily cross-referenced.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.sanitize import clean_multiline, clean_skills, clean_single_line


class InterviewType(str, Enum):
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    MIXED = "mixed"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ScoringFocus(str, Enum):
    TECHNICAL_DEPTH = "technical_depth"
    BALANCED = "balanced"
    COMMUNICATION = "communication"


class AdaptiveAction(str, Enum):
    INCREASE_DIFFICULTY = "INCREASE_DIFFICULTY"
    MAINTAIN_DIFFICULTY = "MAINTAIN_DIFFICULTY"
    DECREASE_DIFFICULTY = "DECREASE_DIFFICULTY"
    TARGET_WEAK_TOPIC = "TARGET_WEAK_TOPIC"


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


# ---------- Setup / start interview ----------

class StartInterviewRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=120)
    experience: str = Field(..., min_length=2, max_length=60)
    skills: list[str] = Field(..., min_length=1, max_length=15)
    interview_type: InterviewType = InterviewType.TECHNICAL
    difficulty: Difficulty = Difficulty.MEDIUM
    num_questions: int = Field(default=7, ge=5, le=10)
    scoring_focus: ScoringFocus = ScoringFocus.TECHNICAL_DEPTH
    include_coding: bool = False

    @field_validator("role")
    @classmethod
    def clean_role(cls, v: str) -> str:
        cleaned = clean_single_line(v, 120)
        if len(cleaned) < 2:
            raise ValueError("Role must contain at least 2 visible characters")
        return cleaned

    @field_validator("experience")
    @classmethod
    def clean_experience(cls, v: str) -> str:
        cleaned = clean_single_line(v, 60)
        if len(cleaned) < 2:
            raise ValueError("Experience level must contain at least 2 visible characters")
        return cleaned

    @field_validator("skills")
    @classmethod
    def clean_skills_field(cls, v: list[str]) -> list[str]:
        cleaned = clean_skills(v, max_items=15, max_length_each=40)
        if not cleaned:
            raise ValueError("At least one skill is required")
        return cleaned


class QuestionOut(BaseModel):
    id: str
    text: str
    topic: str
    difficulty: Difficulty
    index: int
    total: int
    is_coding: bool = False
    language: Optional[str] = None
    starter_code: Optional[str] = None
    # Unix epoch seconds when this question became current — lets the UI
    # restore the per-question timer after a refresh.
    started_at: Optional[int] = None


class StartInterviewResponse(BaseModel):
    session_id: str
    first_question: QuestionOut


# ---------- Session listing / detail ----------

class SessionSummaryOut(BaseModel):
    session_id: str
    role: str
    experience: str
    interview_type: str
    current_difficulty: Difficulty
    num_questions: int
    answered: int
    completed: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SessionDetailOut(SessionSummaryOut):
    current_question: Optional[QuestionOut] = None


# ---------- Answer submission ----------

class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer_text: str = Field(..., min_length=1, max_length=8000)
    # Language the candidate wrote their solution in (coding questions).
    # Overrides the question's own language so evaluation matches reality.
    code_language: Optional[str] = None

    @field_validator("answer_text")
    @classmethod
    def clean_answer(cls, v: str) -> str:
        cleaned = clean_multiline(v, 8000)
        if not cleaned:
            raise ValueError("Answer must contain visible text")
        return cleaned

    @field_validator("code_language")
    @classmethod
    def clean_code_language(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = clean_single_line(v, 30)
        return cleaned.lower() or None


class EvaluationOut(BaseModel):
    accuracy: float
    relevance: float
    completeness: float
    clarity: float
    depth: float
    score: float
    strengths: list[str]
    weaknesses: list[str]
    feedback: str
    concepts_demonstrated: list[str]
    concepts_missing: list[str]


class SubmitAnswerResponse(BaseModel):
    evaluation: EvaluationOut
    adaptive_action: AdaptiveAction
    next_question: Optional[QuestionOut] = None
    is_complete: bool
    progress: int
    total: int


# ---------- Code execution ----------

class RunCodeRequest(BaseModel):
    language: str = Field(..., min_length=1, max_length=30)
    code: str = Field(..., min_length=1, max_length=20000)

    @field_validator("language")
    @classmethod
    def clean_language(cls, v: str) -> str:
        cleaned = clean_single_line(v, 30)
        if not cleaned:
            raise ValueError("Language is required")
        return cleaned.lower()

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        cleaned = clean_multiline(v, 20000)
        if not cleaned:
            raise ValueError("Code must contain visible text")
        return cleaned


class RunCodeOut(BaseModel):
    supported: bool
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    message: Optional[str] = None


# ---------- Final report ----------

class TopicScore(BaseModel):
    topic: str
    average_score: float
    question_count: int


class QuestionRecord(BaseModel):
    index: int
    topic: str
    question_text: str
    answer_text: str
    score: float
    difficulty: Difficulty


class FinalReportOut(BaseModel):
    session_id: str
    role: str
    overall_score: float
    technical_score: float
    communication_score: float
    problem_solving_score: float
    strengths: list[str]
    weaknesses: list[str]
    recommendation: str
    summary: str
    topic_scores: list[TopicScore]
    questions: list[QuestionRecord]


# ---------- Internal (not exposed directly) ----------

class InternalQuestion(BaseModel):
    id: str
    text: str
    topic: str
    difficulty: Difficulty
    index: int
    is_coding: bool = False
    language: Optional[str] = None
    starter_code: Optional[str] = None
    started_at: Optional[int] = None


class InternalEvaluation(BaseModel):
    question_id: str
    topic: str
    difficulty: Difficulty
    answer_text: str
    question_text: str
    accuracy: float
    relevance: float
    completeness: float
    clarity: float
    depth: float
    score: float
    strengths: list[str]
    weaknesses: list[str]
    feedback: str
    concepts_demonstrated: list[str]
    concepts_missing: list[str]
