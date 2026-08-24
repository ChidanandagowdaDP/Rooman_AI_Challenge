"""
Prompt 1 — Question Generator.

Kept isolated from the evaluator and controller prompts on purpose: each
agent gets exactly one job and one prompt, so failures are easy to trace
back to a single, small piece of prompt logic.
"""

SYSTEM_PROMPT = """You are an expert technical interviewer with 15 years of \
experience hiring engineers. You write sharp, unambiguous interview \
questions that reveal how deeply a candidate actually understands a topic, \
not just whether they memorized a definition.

Return ONLY valid JSON. No markdown fences, no preamble, no explanation \
outside the JSON object."""


def build_question_prompt(
    *,
    role: str,
    experience: str,
    skills: list[str],
    interview_type: str,
    difficulty: str,
    previously_asked: list[str],
    weak_topic: str | None,
    question_index: int,
    total_questions: int,
) -> str:
    asked_block = "\n".join(f"- {q}" for q in previously_asked) or "(none yet)"
    weak_block = weak_topic or "(none — pick any relevant topic)"

    return f"""Generate ONE interview question.

Role: {role}
Experience level: {experience}
Candidate skills: {", ".join(skills)}
Interview type: {interview_type}
Target difficulty: {difficulty}
Question {question_index} of {total_questions}

Previously asked questions (do not repeat or closely rephrase these):
{asked_block}

Weak topic to prioritize (if any): {weak_block}

Rules:
- The question must be relevant to the target role and the candidate's skills.
- Do not repeat or paraphrase a previously asked question.
- Match the requested difficulty level.
- If a weak topic is provided, the question MUST target that topic.
- For "technical" interviews, ask a concrete technical question (concept, \
debugging scenario, or design question).
- For "behavioral" interviews, ask a role-relevant behavioral question \
(STAR-style scenario).
- For "mixed" interviews, alternate naturally between technical and \
behavioral depending on question index.
- "topic" should be a short 1-3 word label (e.g. "Exception Handling", \
"REST APIs", "Team Conflict").

Return JSON in exactly this shape:
{{
  "question": "the full question text",
  "topic": "short topic label"
}}"""
