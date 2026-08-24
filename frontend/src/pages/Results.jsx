import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopicCalibrationBar from "../components/TopicCalibrationBar.jsx";
import { api, ApiError } from "../api/client.js";
import "./Results.css";

export default function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

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
        <p className="mono">Compiling your report…</p>
      </main>
    );
  }

  return (
    <main className="container results">
      <div className="results__head">
        <span className="results__eyebrow mono">INTERVIEW REPORT</span>
        <h1>{report.role}</h1>
      </div>

      <section className="panel results__overall">
        <div className="results__overall-score">
          <span className="mono">{Math.round(report.overall_score)}</span>
          <span className="results__overall-max">/100</span>
        </div>
        <div className="results__sub-scores">
          <SubScore label="Technical" value={report.technical_score} />
          <SubScore label="Communication" value={report.communication_score} />
          <SubScore label="Problem solving" value={report.problem_solving_score} />
        </div>
      </section>

      <section className="results__grid">
        <div className="panel results__block">
          <h3 className="results__block-title good">Strengths</h3>
          <ul className="results__list">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="panel results__block">
          <h3 className="results__block-title bad">Areas to improve</h3>
          <ul className="results__list">
            {report.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel results__block">
        <h3 className="results__block-title">AI recommendation</h3>
        <p className="results__recommendation">{report.recommendation}</p>
        <p className="results__summary">{report.summary}</p>
      </section>

      <section className="panel results__block">
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

      <section className="panel results__block">
        <h3 className="results__block-title">Question-by-question</h3>
        <table className="results__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Topic</th>
              <th>Question</th>
              <th>Difficulty</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {report.questions.map((q) => (
              <tr key={q.index}>
                <td className="mono">{q.index}</td>
                <td>{q.topic}</td>
                <td className="results__table-question">{q.question_text}</td>
                <td className="results__table-difficulty">{q.difficulty}</td>
                <td className="mono">{q.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="results__actions">
        <button className="btn btn--primary" onClick={() => navigate("/setup")}>
          Start another interview
        </button>
      </div>
    </main>
  );
}

function SubScore({ label, value }) {
  return (
    <div className="sub-score">
      <span className="sub-score__label">{label}</span>
      <span className="sub-score__value mono">{Math.round(value)}</span>
    </div>
  );
}
