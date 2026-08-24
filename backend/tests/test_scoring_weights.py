"""
Scoring-focus presets: weight resolution and score math.
"""
import pytest

from app.services.scoring_service import (
    DEFAULT_FOCUS,
    WEIGHT_PRESETS,
    compute_question_score,
    normalize_focus,
    weights_for,
)


def _dims(accuracy=5, relevance=5, completeness=5, clarity=5, depth=5):
    return {
        "accuracy": accuracy,
        "relevance": relevance,
        "completeness": completeness,
        "clarity": clarity,
        "depth": depth,
    }


def test_all_presets_sum_to_one():
    for name, weights in WEIGHT_PRESETS.items():
        assert abs(sum(weights.values()) - 1.0) < 1e-9, f"preset {name} does not sum to 1"
        assert set(weights) == {"accuracy", "relevance", "completeness", "clarity", "depth"}


def test_weights_for_known_and_unknown():
    assert weights_for("balanced") is WEIGHT_PRESETS["balanced"]
    assert weights_for(None) is WEIGHT_PRESETS[DEFAULT_FOCUS]
    assert weights_for("nonsense") is WEIGHT_PRESETS[DEFAULT_FOCUS]


def test_normalize_focus():
    assert normalize_focus("communication") == "communication"
    assert normalize_focus("bogus") == DEFAULT_FOCUS
    assert normalize_focus(None) == DEFAULT_FOCUS


def test_equal_dims_score_the_same_under_every_preset():
    dims = _dims()
    for name in WEIGHT_PRESETS:
        assert compute_question_score(dims, WEIGHT_PRESETS[name]) == 5.0


def test_clarity_heavy_answer_scores_higher_under_communication_focus():
    # A clear but shallow answer: clarity 10, depth 2.
    dims = _dims(accuracy=6, relevance=7, completeness=4, clarity=10, depth=2)
    comm = compute_question_score(dims, WEIGHT_PRESETS["communication"])
    tech = compute_question_score(dims, WEIGHT_PRESETS["technical_depth"])
    assert comm > tech


def test_deep_answer_scores_higher_under_technical_depth_focus():
    # A deep but muddled answer: depth 10, clarity 3.
    dims = _dims(accuracy=8, relevance=6, completeness=7, clarity=3, depth=10)
    tech = compute_question_score(dims, WEIGHT_PRESETS["technical_depth"])
    comm = compute_question_score(dims, WEIGHT_PRESETS["communication"])
    assert tech > comm


def test_default_weights_used_when_none_passed():
    assert compute_question_score(_dims()) == 5.0
    with pytest.raises(KeyError):
        compute_question_score({"accuracy": 5})  # missing dims under any preset


def test_scores_are_clamped():
    dims = _dims(accuracy=99, relevance=-5, completeness=5, clarity=5, depth=5)
    score = compute_question_score(dims)
    assert 0.0 <= score <= 10.0
