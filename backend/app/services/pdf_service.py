"""
Renders a finished interview report as a downloadable PDF.

Uses fpdf2 with core fonts only (no font files to ship). All text is
sanitized to latin-1 because the LLM occasionally emits smart quotes or
arrows that core fonts can't encode.
"""
import datetime
import io

from fpdf import FPDF

_PAGE_MARGIN = 16


def _latin(text: str) -> str:
    return (text or "").encode("latin-1", errors="replace").decode("latin-1")


def section_title(pdf: FPDF, title: str) -> None:
    pdf.ln(2)
    pdf.set_font("helvetica", "B", 12.5)
    pdf.set_text_color(60, 62, 120)
    pdf.set_x(_PAGE_MARGIN)
    pdf.cell(0, 8, _latin(title.upper()), new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(210, 212, 226)
    pdf.line(_PAGE_MARGIN, pdf.get_y(), pdf.w - _PAGE_MARGIN, pdf.get_y())
    pdf.ln(3)
    pdf.set_text_color(20, 20, 20)


def bullets(pdf: FPDF, items: list) -> None:
    pdf.set_font("helvetica", "", 10.5)
    for item in items:
        pdf.set_x(_PAGE_MARGIN + 4)
        pdf.multi_cell(pdf.epw - 8, 6, f"-  {_latin(str(item))}", new_x="LMARGIN", new_y="NEXT")


def paragraph(pdf: FPDF, text: str, indent: int = 0) -> None:
    pdf.set_x(_PAGE_MARGIN + indent)
    pdf.multi_cell(pdf.epw - indent, 5.5, _latin(text), new_x="LMARGIN", new_y="NEXT")


def build_report_pdf(report: dict) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=_PAGE_MARGIN)
    pdf.set_margins(_PAGE_MARGIN, _PAGE_MARGIN, _PAGE_MARGIN)
    pdf.add_page()

    # ---------- Header ----------
    pdf.set_fill_color(26, 27, 58)
    pdf.set_text_color(255, 255, 255)
    pdf.rect(0, 0, pdf.w, 34, style="F")
    pdf.set_xy(_PAGE_MARGIN, 8)
    pdf.set_font("helvetica", "B", 17)
    pdf.cell(0, 9, "InterviewAI - Interview Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(_PAGE_MARGIN)
    pdf.set_font("helvetica", "", 10.5)
    pdf.cell(
        0,
        7,
        _latin(f"Role: {report['role']}    ·    Session: {report['session_id'][:12]}"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_x(_PAGE_MARGIN)
    pdf.cell(0, 6, datetime.date.today().strftime("Generated %d %b %Y"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_y(42)
    pdf.set_text_color(20, 20, 20)

    # ---------- Scores ----------
    def score_line(label: str, value: float) -> None:
        pdf.set_font("helvetica", "", 11.5)
        pdf.set_x(_PAGE_MARGIN + 2)
        pdf.cell(64, 8, _latin(label))
        pdf.set_font("helvetica", "B", 11.5)
        pdf.cell(24, 8, f"{value:.0f}/100", new_x="LMARGIN", new_y="NEXT")

    section_title(pdf, "Scores")
    score_line("Overall", report["overall_score"])
    score_line("Technical", report["technical_score"])
    score_line("Communication", report["communication_score"])
    score_line("Problem solving", report["problem_solving_score"])

    # ---------- Strengths / weaknesses ----------
    section_title(pdf, "Strengths")
    bullets(pdf, report.get("strengths") or [])
    section_title(pdf, "Areas to improve")
    bullets(pdf, report.get("weaknesses") or [])

    # ---------- Recommendation ----------
    section_title(pdf, "Recommendation")
    paragraph(pdf, report.get("recommendation", ""))
    if report.get("summary"):
        paragraph(pdf, report["summary"])

    # ---------- Topic calibration ----------
    topics = report.get("topic_scores") or []
    if topics:
        section_title(pdf, "Topic calibration")
        pdf.set_font("helvetica", "", 10.5)
        for t in sorted(topics, key=lambda x: -x["average_score"]):
            bar_len = int((t["average_score"] / 10) * 40)
            pdf.set_x(_PAGE_MARGIN + 2)
            pdf.cell(46, 7, _latin(str(t["topic"]))[:44])
            pdf.set_font("helvetica", "B", 10.5)
            pdf.cell(14, 7, f"{t['average_score']:.1f}")
            pdf.set_font("helvetica", "", 10.5)
            pdf.cell(70, 7, "|" * bar_len)
            pdf.cell(0, 7, f"{t['question_count']} q", new_x="LMARGIN", new_y="NEXT")

    # ---------- Q&A ----------
    questions = report.get("questions") or []
    if questions:
        pdf.add_page()
        section_title(pdf, "Question-by-question")
        for q in questions:
            pdf.set_font("helvetica", "B", 11)
            pdf.set_x(_PAGE_MARGIN + 2)
            header = (
                f"Q{q['index']} · {_latin(q['topic'])} · "
                f"{q['difficulty']} · scored {q['score']:.1f}/10"
            )
            pdf.multi_cell(pdf.epw, 7, header, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("helvetica", "I", 10.5)
            paragraph(pdf, q["question_text"], indent=6)
            answer = q.get("answer_text") or "(no answer provided)"
            pdf.set_font("helvetica", "", 10.5)
            paragraph(pdf, f"Answer: {answer}", indent=6)
            pdf.ln(3)

    return bytes(pdf.output())
