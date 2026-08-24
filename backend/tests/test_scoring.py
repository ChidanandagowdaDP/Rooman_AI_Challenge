from app.services.scoring_service import (
    compute_final_scores,
    compute_question_score,
    compute_topic_scores,
    weakest_topic,
)


def test_compute_question_score_weighted_average():
    dims = {"accuracy": 9, "relevance": 8, "completeness": 7, "clarity": 9, "depth": 6}
    # 9*.3 + 8*.2 + 7*.2 + 9*.1 + 6*.2 = 2.7+1.6+1.4+0.9+1.2 = 7.8
    assert compute_question_score(dims) == 7.8


def test_compute_question_score_clamps_out_of_range_inputs():
    dims = {"accuracy": 15, "relevance": -2, "completeness": 7, "clarity": 9, "depth": 6}
    score = compute_question_score(dims)
    assert 0 <= score <= 10


def test_compute_topic_scores_averages_per_topic():
    evaluations = [
        {"topic": "Python", "score": 8.0},
        {"topic": "Python", "score": 6.0},
        {"topic": "SQL", "score": 5.0},
    ]
    topics = {t["topic"]: t for t in compute_topic_scores(evaluations)}
    assert topics["Python"]["average_score"] == 7.0
    assert topics["Python"]["question_count"] == 2
    assert topics["SQL"]["average_score"] == 5.0


def test_weakest_topic_below_threshold():
    evaluations = [
        {"topic": "Python", "score": 8.5},
        {"topic": "SQL", "score": 5.0},
    ]
    assert weakest_topic(evaluations, threshold=6.0) == "SQL"


def test_weakest_topic_returns_none_when_all_strong():
    evaluations = [
        {"topic": "Python", "score": 8.5},
        {"topic": "SQL", "score": 7.0},
    ]
    assert weakest_topic(evaluations, threshold=6.0) is None


def test_compute_final_scores_empty_returns_zeroes():
    scores = compute_final_scores([])
    assert scores["overall_score"] == 0.0


def test_compute_final_scores_strong_candidate():
    evaluations = [
        {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 9, "depth": 9, "score": 9.0}
        for _ in range(5)
    ]
    scores = compute_final_scores(evaluations)
    assert scores["overall_score"] == 90.0
    assert scores["technical_score"] == 90.0
