# InterviewAI

Adaptive AI interviewer & candidate evaluation system. It generates
role-specific interview questions, scores each answer across five
dimensions, adjusts difficulty (or targets a weak topic) after every
answer, and produces a structured final report.

## Overview

InterviewAI runs a full interview loop end-to-end:

1. A candidate profile is set up (role, experience, skills, interview type,
   difficulty, number of questions).
2. The AI interviewer generates one question at a time — never a fixed
   question bank.
3. The AI evaluator scores the answer on accuracy, relevance, completeness,
   clarity, and depth, and returns structured feedback.
4. A deterministic adaptive controller decides what happens next: raise
   difficulty, hold it, lower it, or specifically target a topic the
   candidate is weak in.
5. After the last question, a final report is compiled: overall score,
   technical/communication/problem-solving breakdown, topic calibration,
   strengths, weaknesses, and a hiring recommendation.

## Problem statement

A static list of interview questions doesn't tell you much about a
candidate — everyone gets asked the same thing regardless of how they're
doing. InterviewAI instead behaves like a real interviewer: it reacts to
the candidate's last answer before deciding what to ask next, and it keeps
a running picture of which topics are strong and which are weak so it can
go back and specifically probe the weak ones.

## Features

- Adaptive question generation — no hardcoded question bank
- Five-dimension structured scoring (accuracy, relevance, completeness,
  clarity, depth), returned as JSON, not free text
- Deterministic adaptive policy (see below) that decides difficulty and
  topic targeting after every single answer
- Per-topic score tracking across the whole interview
- Structured final report with deterministic numeric scores and an
  LLM-written qualitative summary
- React UI: landing page, interview setup, live interview screen with a
  real-time difficulty gauge, and a final results dashboard
- Persistent sessions (SQLite) — a browser refresh doesn't lose interview
  state
- Test suite covering scoring math, the adaptive policy, and three full
  interview scenarios (strong / weak / mixed candidate)

## Architecture

```
interview-ai/
├── backend/                  FastAPI service — all agent + scoring logic
│   ├── app/
│   │   ├── main.py            REST API routes
│   │   ├── config.py          Environment/config loading
│   │   ├── db.py               SQLite persistence
│   │   ├── models/schemas.py   Pydantic request/response/internal models
│   │   ├── agents/
│   │   │   ├── interviewer.py         Generates the next question
│   │   │   ├── evaluator.py           Scores a candidate's answer
│   │   │   └── adaptive_controller.py Deterministic difficulty/topic policy
│   │   ├── services/
│   │   │   ├── llm_service.py    Anthropic API wrapper + JSON retry logic
│   │   │   ├── scoring_service.py Weighted scoring, topic averages
│   │   │   ├── report_service.py  Final report assembly
│   │   │   └── session_service.py Orchestrates agents + persists state
│   │   └── prompts/            One isolated prompt per agent
│   └── tests/
├── frontend/                 React (Vite) UI
│   └── src/
│       ├── api/client.js       Typed fetch wrapper for the backend
│       ├── components/         DifficultyGauge, TopicCalibrationBar, ...
│       └── pages/               Landing, Setup, Interview, Results
└── docker-compose.yml
```

## Agent workflow

```
Candidate Setup → Interview Planner (implicit, 1 Q at a time)
      → AI Interviewer generates a question
      → Candidate answers
      → AI Evaluator scores the answer (5 dimensions, structured JSON)
      → Adaptive Controller decides: increase / maintain / decrease
        difficulty, or target a weak topic
      → back to AI Interviewer for the next question
      → after N questions → Final Report (deterministic scores +
        LLM-written narrative)
```

## Adaptive interview logic

The adaptive controller (`app/agents/adaptive_controller.py`) is plain,
deterministic Python — it does **not** call the LLM. The same evaluation
always produces the same decision, which makes the "adaptive" behavior
testable and explainable rather than a black box.

```
score >= 8.0            → INCREASE_DIFFICULTY
6.0 <= score < 8.0       → MAINTAIN_DIFFICULTY
score < 6.0 and a topic
  has averaged < 6.0     → TARGET_WEAK_TOPIC (difficulty also steps down)
score < 6.0 (otherwise)  → DECREASE_DIFFICULTY
```

Difficulty moves along a 3-step ladder (`easy → medium → hard`) and never
goes out of bounds in either direction.

## Evaluation method

The evaluator LLM call never returns a single "score" — it returns five
independent 0-10 dimension scores plus qualitative feedback. The actual
per-question score is a **deterministic weighted average**, computed in
`scoring_service.py`, not by the model:

| Dimension    | Weight |
|--------------|--------|
| Accuracy     | 30%    |
| Relevance    | 20%    |
| Completeness | 20%    |
| Clarity      | 10%    |
| Depth        | 20%    |

Topic averages, the weakest-topic lookup, and the three headline 0-100
scores on the final report (technical / communication / problem-solving)
are all derived from these same per-question numbers — see
`scoring_service.compute_final_scores`.

## Technology stack

- **Backend**: Python, FastAPI, Pydantic v2, SQLite, Anthropic SDK
- **Frontend**: React 18, Vite, React Router — no CSS framework; a small
  hand-built design-token system (see `frontend/src/styles/tokens.css`)
- **Testing**: pytest, FastAPI's `TestClient`, mocked LLM calls
- **Deployment**: Dockerfiles for both services + a root `docker-compose.yml`

## Installation

### Prerequisites

- Python 3.11+
- Node.js 20+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then add your ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # defaults to http://localhost:8000
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### Docker (both services)

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
docker compose up --build
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:8000`

## Environment variables

**backend/.env**

| Variable            | Required | Default                  | Description                          |
|---------------------|----------|---------------------------|---------------------------------------|
| `ANTHROPIC_API_KEY`  | Yes      | —                          | Your Anthropic API key                |
| `MODEL_NAME`         | No       | `claude-sonnet-4-6`        | Model used for all three agent calls  |
| `DATABASE_PATH`      | No       | `interview_ai.db`          | SQLite file location                  |
| `CORS_ORIGINS`       | No       | `http://localhost:5173`    | Comma-separated allowed origins       |
| `MAX_LLM_RETRIES`    | No       | `3`                        | Retries on malformed JSON from model  |

**frontend/.env**

| Variable        | Required | Default                  | Description             |
|------------------|----------|----------------------------|--------------------------|
| `VITE_API_URL`   | No       | `http://localhost:8000`    | Backend base URL         |

## Running the application

1. Start the backend (`uvicorn app.main:app --reload --port 8000`)
2. Start the frontend (`npm run dev`)
3. Open the app, click **Start an interview**
4. Fill in role / experience / skills / interview type / difficulty /
   number of questions
5. Answer each question — the gauge on the right updates after every
   submission to show how difficulty is being recalibrated
6. After the last question, click through to the final report

## Example interview

**Setup**: Role `Python Backend Developer`, Experience `Fresher`,
Skills `Python, SQL, Django, REST API`, Type `Technical`,
Difficulty `Medium`, Questions `7`

| # | Topic     | Candidate performance      | Score | Adaptive action        |
|---|-----------|-----------------------------|-------|--------------------------|
| 1 | Python    | Strong, correct, detailed   | 9.0   | INCREASE_DIFFICULTY      |
| 2 | Python    | Correct but shallow          | 6.5   | MAINTAIN_DIFFICULTY      |
| 3 | SQL       | Vague, missing key concepts | 4.5   | DECREASE_DIFFICULTY      |
| 4 | SQL       | Still weak on joins          | 4.0   | TARGET_WEAK_TOPIC (SQL)  |
| 5 | SQL       | Improved, foundational        | 6.0   | MAINTAIN_DIFFICULTY      |
| 6 | Django    | Strong                       | 8.5   | INCREASE_DIFFICULTY      |
| 7 | REST API  | Strong                       | 8.0   | MAINTAIN_DIFFICULTY      |

Final report: overall ~73/100, SQL flagged as the weakest topic,
recommendation to revisit joins and query optimization before an
advanced backend round.

## Sample results

Three demo scenarios are covered by the automated test suite
(`backend/tests/test_api.py`) instead of static sample files, so they stay
correct as the code changes:

- **Strong candidate** — every answer scores 9+, difficulty should climb
  to `hard` and stay there.
- **Weak candidate** — every answer scores under 6, difficulty should drop
  toward `easy`.
- **Mixed candidate** — strong on one topic, weak on another across
  repeated questions — the weak topic should get specifically targeted,
  and the final report's topic breakdown should reflect it.

## Testing

```bash
cd backend
pytest
```

Tests cover:

- `test_scoring.py` — weighted score math, clamping, topic averaging
- `test_adaptive_controller.py` — every branch of the adaptive policy,
  including the difficulty-ladder boundaries
- `test_api.py` — full request/response cycles for the strong / weak /
  mixed scenarios above, with the Anthropic client mocked out so the suite
  runs without an API key or network access

## Design decisions

- **LLM does judgment, Python does arithmetic and state.** The LLM
  generates questions, scores answer quality on five dimensions, and
  writes qualitative text. It never computes the weighted score, topic
  averages, or the difficulty decision — those are deterministic Python so
  they're testable, reproducible, and cheap to run repeatedly.
- **Three separate prompts, three separate agents.** One prompt per job
  (question generation, evaluation, final narrative) instead of one large
  prompt handling everything. Smaller prompts are easier to debug and
  produce more reliable structured output.
- **Structured JSON everywhere.** Every LLM call is required to return
  JSON, parsed by `llm_service.call_json`, with an automatic one-shot retry
  if the model returns malformed JSON. This makes the whole pipeline
  testable with mocks instead of parsing free-form text.
- **SQLite over in-memory state.** Interview sessions survive a backend
  restart. For a single-instance deployment this is enough; see
  Limitations for what a multi-instance deployment would need instead.
- **React + hand-built design tokens over a CSS framework.** Kept the
  bundle small and let the interface commit to a specific visual identity
  (a "calibration console" look, since the product's whole point is
  measuring and recalibrating) rather than generic component defaults.

## Tradeoffs

**Why an LLM instead of a traditional classifier for evaluation?**
LLMs can judge open-ended, free-text technical answers without a labeled
training set. A traditional classifier would need thousands of
human-scored answers per role/skill combination to reach comparable
quality — impractical here. The tradeoff is consistency: see Limitations.

**Why FastAPI + React instead of a single Streamlit app?**
Splitting the UI from the API costs more setup time but produces something
closer to a real product: the API can be tested independently of the UI
(see `test_api.py`, which never touches a browser), and the same backend
could serve a different client later without changes.

**Why structured JSON output instead of free-form LLM text?**
Structured output makes evaluation deterministic to parse, easy to
validate against a schema, and simple to unit test with mocked responses.
Free-form text would require fragile regex/NLP parsing to extract scores.

**Why deterministic scoring instead of letting the LLM report a single
number?**
A model asked "rate this 0-10" is inconsistent between calls on
essentially identical input. Asking it only for five sub-scores and
computing the weighted average ourselves removes that inconsistency from
the part of the system that most needs to be trustworthy: the number a
hiring decision might be based on.

## Limitations

- LLM evaluation is still inherently somewhat subjective, especially for
  open-ended, discursive answers. A production system would want a
  benchmark set of pre-scored answers to calibrate against, and periodic
  human review of a sample of scored interviews.
- SQLite is appropriate for a single backend instance. A multi-instance
  production deployment would need a shared database (e.g. Postgres) since
  SQLite doesn't handle concurrent writers across processes well.
- There's no authentication layer — anyone with a session ID can fetch
  that session's report. A real deployment would need to tie sessions to
  authenticated users.
- The adaptive policy's thresholds (8.0 / 6.0) were chosen to be
  explainable and are not tuned against real interview outcome data.

## Future improvements

- Configurable scoring weights per role (e.g. weight `depth` higher for
  senior roles)
- Multi-interviewer / panel mode with independent scoring passes
- Exportable PDF report
- Resume-aware question generation (upload a resume, questions reference it)
- Real-time transcription for a spoken-interview mode
