"""
Report service — combines the deterministic scores from scoring_service with
an LLM-written qualitative narrative to produce the final report shown on
the results dashboard.
"""
from app.prompts.final_report_prompt import SYSTEM_PROMPT, build_final_report_prompt
from app.services.llm_service import LLMJSONError, call_json
from app.services.scoring_service import compute_final_scores, compute_topic_scores

_FALLBACK_SUMMARY = (
    "The candidate completed the interview. See per-question feedback and "
    "topic scores below for a detailed breakdown."
)


def build_final_report(
    *, role: str, experience: str, evaluations: list[dict]
) -> dict:
    scores = compute_final_scores(evaluations)
    topic_scores = compute_topic_scores(evaluations)

    per_question_feedback = [
        {"topic": e["topic"], "score": e["score"], "feedback": e["feedback"]}
        for e in evaluations
    ]

    try:
        narrative = call_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_final_report_prompt(
                role=role,
                experience=experience,
                overall_score=scores["overall_score"],
                technical_score=scores["technical_score"],
                communication_score=scores["communication_score"],
                problem_solving_score=scores["problem_solving_score"],
                topic_scores=topic_scores,
                per_question_feedback=per_question_feedback,
            ),
            max_tokens=600,
        )
    except LLMJSONError:
        # Deterministic scores are already known-good; degrade gracefully on
        # the qualitative narrative rather than failing the whole report.
        sorted_topics = sorted(
            topic_scores, key=lambda t: t["average_score"], reverse=True
        )
        narrative = {
            "strengths": [t["topic"] for t in sorted_topics[:2]],
            "weaknesses": [t["topic"] for t in sorted_topics[-2:]],
            "recommendation": (
                "Automated narrative generation failed; review topic scores "
                "and per-question feedback directly."
            ),
            "summary": _FALLBACK_SUMMARY,
        }

    return {**scores, "topic_scores": topic_scores, **narrative}
