"""
Prompt 3 — Final Report (qualitative narrative only).

Every number in the final report is computed deterministically in
services/scoring_service.py. The LLM is only asked to turn those already-
computed numbers into a short, well-written narrative — it cannot invent or
override a score.
"""

SYSTEM_PROMPT = """You are a hiring panel lead writing the qualitative \
summary of a completed interview. You have been given the FINAL, already- \
calculated scores — you must not change or contradict them. Your only job \
is to explain them clearly and give an actionable recommendation.

Return ONLY valid JSON. No markdown fences, no preamble, no explanation \
outside the JSON object."""


def build_final_report_prompt(
    *,
    role: str,
    experience: str,
    overall_score: float,
    technical_score: float,
    communication_score: float,
    problem_solving_score: float,
    topic_scores: list[dict],
    per_question_feedback: list[dict],
) -> str:
    topics_block = "\n".join(
        f"- {t['topic']}: {t['average_score']}/10 ({t['question_count']} question(s))"
        for t in topic_scores
    )
    qa_block = "\n".join(
        f"- Q{i + 1} [{q['topic']}] score {q['score']}/10: {q['feedback']}"
        for i, q in enumerate(per_question_feedback)
    )

    return f"""Write the qualitative summary for this completed interview. \
Do not change any of the numbers below — treat them as fixed facts.

Role: {role}
Experience level: {experience}

Overall score: {overall_score}/100
Technical score: {technical_score}/100
Communication score: {communication_score}/100
Problem solving score: {problem_solving_score}/100

Topic performance:
{topics_block}

Per-question feedback:
{qa_block}

Return JSON in exactly this shape:
{{
  "strengths": ["short bullet naming a real strong topic/area", "..."],
  "weaknesses": ["short bullet naming a real weak topic/area", "..."],
  "recommendation": "2-3 sentence hiring-panel style recommendation",
  "summary": "3-4 sentence overall interview summary"
}}"""
