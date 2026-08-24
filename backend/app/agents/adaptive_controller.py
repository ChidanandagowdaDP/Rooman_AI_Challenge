"""
Adaptive controller — decides what happens next after a question is scored.

Deliberately deterministic (no LLM call). This is the "explainable policy"
the project is built around: the same evaluation always produces the same
decision, which makes the adaptive behavior testable and defensible in a
way an LLM-decided policy would not be.

Policy:
  score >= 8.0        -> INCREASE_DIFFICULTY
  6.0 <= score < 8.0   -> MAINTAIN_DIFFICULTY
  score < 6.0          -> DECREASE_DIFFICULTY (or TARGET_WEAK_TOPIC if a
                          topic has fallen below the weak-topic threshold)
"""
from app.models.schemas import AdaptiveAction, Difficulty
from app.services.scoring_service import weakest_topic

_LADDER = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]

INCREASE_THRESHOLD = 8.0
MAINTAIN_THRESHOLD = 6.0
WEAK_TOPIC_THRESHOLD = 6.0


def _step(difficulty: Difficulty, direction: int) -> Difficulty:
    idx = _LADDER.index(difficulty)
    new_idx = max(0, min(len(_LADDER) - 1, idx + direction))
    return _LADDER[new_idx]


def decide_next_action(
    *, latest_score: float, current_difficulty: Difficulty, evaluations: list[dict]
) -> tuple[AdaptiveAction, Difficulty, str | None]:
    """
    Returns (action, next_difficulty, weak_topic_to_target).
    `evaluations` is the full history so far, including the latest one.
    """
    weak_topic = weakest_topic(evaluations, threshold=WEAK_TOPIC_THRESHOLD)

    if latest_score < MAINTAIN_THRESHOLD and weak_topic is not None:
        next_difficulty = _step(current_difficulty, -1)
        return AdaptiveAction.TARGET_WEAK_TOPIC, next_difficulty, weak_topic

    if latest_score >= INCREASE_THRESHOLD:
        return AdaptiveAction.INCREASE_DIFFICULTY, _step(current_difficulty, 1), None

    if latest_score < MAINTAIN_THRESHOLD:
        return AdaptiveAction.DECREASE_DIFFICULTY, _step(current_difficulty, -1), None

    return AdaptiveAction.MAINTAIN_DIFFICULTY, current_difficulty, None
