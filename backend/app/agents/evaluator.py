"""
Evaluator agent — turns a (question, answer) pair into structured dimension
scores + qualitative feedback. The weighted overall score is NOT computed
here; that's deterministic logic and belongs to scoring_service.
"""
from app.prompts.evaluation_prompt import SYSTEM_PROMPT, build_evaluation_prompt
from app.services.llm_service import call_json
from app.services.scoring_service import clamp, compute_question_score


def evaluate_answer(
    *,
    question: str,
    topic: str,
    role: str,
    experience: str,
    answer: str,
    weights: dict | None = None,
) -> dict:
    prompt = build_evaluation_prompt(
        question=question, topic=topic, role=role, experience=experience, answer=answer
    )
    result = call_json(system_prompt=SYSTEM_PROMPT, user_prompt=prompt, max_tokens=700)

    dimensions = {
        "accuracy": clamp(float(result["accuracy"])),
        "relevance": clamp(float(result["relevance"])),
        "completeness": clamp(float(result["completeness"])),
        "clarity": clamp(float(result["clarity"])),
        "depth": clamp(float(result["depth"])),
    }

    return {
        **dimensions,
        "score": compute_question_score(dimensions, weights),
        "strengths": result.get("strengths", []),
        "weaknesses": result.get("weaknesses", []),
        "feedback": result.get("feedback", ""),
        "concepts_demonstrated": result.get("concepts_demonstrated", []),
        "concepts_missing": result.get("concepts_missing", []),
    }
