from app.agents.adaptive_controller import decide_next_action
from app.models.schemas import AdaptiveAction, Difficulty


def test_strong_answer_increases_difficulty():
    evaluations = [{"topic": "Python", "score": 9.0}]
    action, difficulty, weak_topic = decide_next_action(
        latest_score=9.0, current_difficulty=Difficulty.MEDIUM, evaluations=evaluations
    )
    assert action == AdaptiveAction.INCREASE_DIFFICULTY
    assert difficulty == Difficulty.HARD
    assert weak_topic is None


def test_mid_answer_maintains_difficulty():
    evaluations = [{"topic": "Python", "score": 7.0}]
    action, difficulty, weak_topic = decide_next_action(
        latest_score=7.0, current_difficulty=Difficulty.MEDIUM, evaluations=evaluations
    )
    assert action == AdaptiveAction.MAINTAIN_DIFFICULTY
    assert difficulty == Difficulty.MEDIUM


def test_weak_answer_with_repeated_weak_topic_targets_topic():
    evaluations = [
        {"topic": "SQL", "score": 5.0},
        {"topic": "SQL", "score": 4.0},
    ]
    action, difficulty, weak_topic = decide_next_action(
        latest_score=4.0, current_difficulty=Difficulty.MEDIUM, evaluations=evaluations
    )
    assert action == AdaptiveAction.TARGET_WEAK_TOPIC
    assert weak_topic == "SQL"
    assert difficulty == Difficulty.EASY


def test_difficulty_cannot_go_below_easy():
    evaluations = [{"topic": "SQL", "score": 2.0}]
    _, difficulty, _ = decide_next_action(
        latest_score=2.0, current_difficulty=Difficulty.EASY, evaluations=evaluations
    )
    assert difficulty == Difficulty.EASY


def test_difficulty_cannot_go_above_hard():
    evaluations = [{"topic": "Python", "score": 9.5}]
    _, difficulty, _ = decide_next_action(
        latest_score=9.5, current_difficulty=Difficulty.HARD, evaluations=evaluations
    )
    assert difficulty == Difficulty.HARD
