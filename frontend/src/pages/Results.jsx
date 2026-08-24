import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TopicCalibrationBar from "../components/TopicCalibrationBar.jsx";
import ScoreRing from "../components/ScoreRing.jsx";
import { api, ApiError } from "../api/client.js";
import "./Results.css";

export default function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [openQuestion, setOpenQuestion] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getReport(sessionId)
      .then((data) => !cancelled && setReport(data))
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Could not load the report.")
      );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const blob = await api.downloadReportPdf(sessionId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `interview-report-${sessionId.slice(0, 12)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(
        err instanceof ApiError ? err.message : "Could not generate the PDF."
      );
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) {
    return (
      <main className="container results-empty">
        <div className="panel results-empty__card">
          <h2>Report unavailable</h2>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={() => navigate("/setup")}>
            Start a new interview
          </button>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="container results-empty">
        <div className="panel results-empty__card">
          <span className="spinner" />
          <p className="mono">Compiling your report…</p>
        </div>
      </main>
    );
  }

  const recommendationTone = /advance|proceed|strong|hire|next round/i.test(report.recommendation)
    ? "good"
    : "warn";

  return (
    <main className="container results">
      {/* Header */}
      <header className="results__head fade-up">
        <span className="badge badge--accent">Interview report</span>
        <h1>{report.role}</h1>
        <p className="mono results__session">session · {sessionId.slice(0, 12)}…</p>
      </header>

      {/* Overall scores */}
      <section className="panel panel--pad results__overall fade-up fade-up-1">
        <ScoreRing value={report.overall_score} />
        <div className="results__sub-scores">
          <SubBar label="Technical" value={report.technical_score} />
          <SubBar label="Communication" value={report.communication_score} />
          <SubBar label="Problem solving" value={report.problem_solving_score} />
          <div
            className={`badge badge--${recommendationTone} results__verdict`}
          >
            {recommendationTone === "good" ? "✓ Positive recommendation" : "! Needs improvement"}
          </div>
        </div>
      </section>

      {/* Strengths / weaknesses */}
      <section className="results__grid fade-up fade-up-2">
        <div className="panel panel--pad results__block results__block--good">
          <h3 className="results__block-title good">Strengths</h3>
          <ul className="results__list">
            {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="panel panel--pad results__block results__block--bad">
          <h3 className="results__block-title bad">Areas to improve</h3>
          <ul className="results__list">
            {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      </section>

      {/* Recommendation */}
      <section className={`panel panel--pad results__recommendation-panel fade-up fade-up-3`}>
        <h3 className="results__block-title">AI recommendation</h3>
        <p className="results__recommendation">{report.recommendation}</p>
        <p className="results__summary">{report.summary}</p>
      </section>

      {/* Topics */}
      <section className="panel panel--pad fade-up fade-up-3">
        <h3 className="results__block-title">Topic calibration</h3>
        <div className="results__topics">
          {report.topic_scores
            .slice()
            .sort((a, b) => b.average_score - a.average_score)
            .map((t) => (
              <TopicCalibrationBar
                key={t.topic}
                topic={t.topic}
                score={t.average_score}
                questionCount={t.question_count}
              />
            ))}
        </div>
      </section>

      {/* Q&A accordion */}
      <section className="panel panel--pad fade-up fade-up-4">
        <h3 className="results__block-title">Question-by-question</h3>
        <div className="qa-list">
          {report.questions.map((q) => {
            const open = openQuestion === q.index;
            return (
              <div className={`qa-item ${open ? "qa-item--open" : ""}`} key={q.index}>
                <button
                  className="qa-item__head"
                  onClick={() => setOpenQuestion(open ? null : q.index)}
                  aria-expanded={open}
                >
                  <span className="qa-item__num mono">{String(q.index).padStart(2, "0")}</span>
                  <span className="qa-item__text">{q.question_text}</span>
                  <span className={`badge badge--${q.difficulty === "hard" ? "bad" : q.difficulty === "easy" ? "good" : "warn"} mono qa-item__diff`}>
                    {q.difficulty}
                  </span>
                  <span className={`qa-item__score mono ${scoreTone(q.score)}`}>{q.score.toFixed(1)}</span>
                  <svg className="qa-item__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {open && (
                  <div className="qa-item__body">
                    <span className="qa-item__body-label">Your answer</span>
                    <p>{q.answer_text || "—"}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="results__actions no-print">
        {pdfError && <p className="results__pdf-error">{pdfError}</p>}
        <Link to="/setup" className="btn btn--primary">Start another interview</Link>
        <button className="btn" onClick={downloadPdf} disabled={pdfBusy}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {pdfBusy ? "Generating PDF…" : "Download PDF"}
        </button>
      </div>
    </main>
  );
}

function SubBar({ label, value }) {
  return (
    <div className="sub-bar">
      <div className="sub-bar__head">
        <span className="sub-bar__label">{label}</span>
        <span className="sub-bar__value mono">{Math.round(value)}<em>/100</em></span>
      </div>
      <div className="sub-bar__track">
        <div className="sub-bar__fill" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function scoreTone(score) {
  if (score >= 7.5) return "good-text";
  if (score >= 5.5) return "mid-text";
  return "bad-text";
}
