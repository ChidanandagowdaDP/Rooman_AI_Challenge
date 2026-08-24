"""
All numeric scoring lives here, in plain deterministic Python — never in the
LLM. The LLM produces raw 0-10 dimension scores and qualitative text; this
module is the single source of truth for turning those into the weighted
per-question score, topic averages, and the final 0-100 composite scores.
"""

# Weighted average — accuracy and depth matter most for a technical bar.
DIMENSION_WEIGHTS = {
    "accuracy": 0.30,
    "relevance": 0.20,
    "completeness": 0.20,
    "clarity": 0.10,
    "depth": 0.20,
}


def clamp(value: float, lo: float = 0.0, hi: float = 10.0) -> float:
    return max(lo, min(hi, value))


def compute_question_score(dimensions: dict) -> float:
    """Weighted average of the five evaluation dimensions, rounded to 1dp."""
    total = sum(
        clamp(float(dimensions[dim])) * weight
        for dim, weight in DIMENSION_WEIGHTS.items()
    )
    return round(total, 1)


def compute_topic_scores(evaluations: list[dict]) -> list[dict]:
    """Average score per topic across all answered questions so far."""
    buckets: dict[str, list[float]] = {}
    for ev in evaluations:
        buckets.setdefault(ev["topic"], []).append(ev["score"])

    return [
        {
            "topic": topic,
            "average_score": round(sum(scores) / len(scores), 1),
            "question_count": len(scores),
        }
        for topic, scores in buckets.items()
    ]


def weakest_topic(evaluations: list[dict], threshold: float = 6.0) -> str | None:
    """Return the topic with the lowest average score, if it's below threshold."""
    topics = compute_topic_scores(evaluations)
    if not topics:
        return None
    weakest = min(topics, key=lambda t: t["average_score"])
    return weakest["topic"] if weakest["average_score"] < threshold else None


def compute_final_scores(evaluations: list[dict]) -> dict:
    """
    Roll all per-question evaluations up into the three headline 0-100
    scores shown on the final dashboard, plus the overall composite.
    """
    if not evaluations:
        return {
            "overall_score": 0.0,
            "technical_score": 0.0,
            "communication_score": 0.0,
            "problem_solving_score": 0.0,
        }

    n = len(evaluations)
    avg_accuracy = sum(e["accuracy"] for e in evaluations) / n
    avg_relevance = sum(e["relevance"] for e in evaluations) / n
    avg_completeness = sum(e["completeness"] for e in evaluations) / n
    avg_clarity = sum(e["clarity"] for e in evaluations) / n
    avg_depth = sum(e["depth"] for e in evaluations) / n
    avg_score = sum(e["score"] for e in evaluations) / n

    # Technical = accuracy + depth (correctness and understanding)
    technical_score = round(((avg_accuracy + avg_depth) / 2) * 10, 1)
    # Communication = clarity + relevance (how well it was conveyed)
    communication_score = round(((avg_clarity + avg_relevance) / 2) * 10, 1)
    # Problem solving = completeness + depth (thoroughness of the approach)
    problem_solving_score = round(((avg_completeness + avg_depth) / 2) * 10, 1)
    overall_score = round(avg_score * 10, 1)

    return {
        "overall_score": overall_score,
        "technical_score": technical_score,
        "communication_score": communication_score,
        "problem_solving_score": problem_solving_score,
    }
