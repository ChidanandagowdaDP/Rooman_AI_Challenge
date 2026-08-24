"""
Unit tests for the PDF renderer itself.
"""
from app.services.pdf_service import build_report_pdf


def _report():
    return {
        "session_id": "abc123def456",
        "role": "Python Developer",
        "overall_score": 71.4,
        "technical_score": 74.0,
        "communication_score": 68.0,
        "problem_solving_score": 70.5,
        "strengths": ["Solid fundamentals", "Clear communication — even with émojis 🎉"],
        "weaknesses": ["SQL depth"],
        "recommendation": "Proceed to next round.",
        "summary": "Candidate showed strong Python basics with gaps in databases.",
        "topic_scores": [
            {"topic": "Python", "average_score": 8.1, "question_count": 3},
            {"topic": "SQL", "average_score": 4.6, "question_count": 2},
        ],
        "questions": [
            {
                "index": 1,
                "topic": "Python",
                "question_text": "Explain list comprehensions.",
                "answer_text": "They build lists from iterables in one line…",
                "score": 8.5,
                "difficulty": "medium",
            },
            {
                "index": 2,
                "topic": "SQL",
                "question_text": "What is an index?",
                "answer_text": "",
                "score": 4.0,
                "difficulty": "easy",
            },
        ],
    }


def test_pdf_starts_with_magic_bytes():
    pdf = build_report_pdf(_report())
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF")
    assert b"%%EOF" in pdf[-64:]


def test_pdf_survives_unencodable_characters():
    report = _report()
    report["summary"] = "Smart quotes “and” arrows → must not crash."
    pdf = build_report_pdf(report)
    assert pdf.startswith(b"%PDF")


def test_pdf_with_empty_answer_and_no_topics():
    report = _report()
    report["questions"][0]["answer_text"] = ""
    report["questions"][1]["answer_text"] = None
    report["topic_scores"] = []
    pdf = build_report_pdf(report)
    assert pdf.startswith(b"%PDF")
