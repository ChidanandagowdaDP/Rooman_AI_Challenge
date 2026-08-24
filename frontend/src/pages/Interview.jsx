import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DifficultyGauge from "../components/DifficultyGauge.jsx";
import DimensionScores from "../components/DimensionScores.jsx";
import { api, ApiError } from "../api/client.js";
import "./Interview.css";

export default function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [question, setQuestion] = useState(location.state?.firstQuestion ?? null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [adaptiveAction, setAdaptiveAction] = useState(null);
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "medium");
  const [progress, setProgress] = useState({ answered: 0, total: question?.total ?? 0 });
  const [phase, setPhase] = useState("answering"); // answering | evaluating | reviewing | finishing
  const [error, setError] = useState(null);

  if (!question) {
    // Page was opened directly (e.g. refresh) without setup state.
    return (
      <main className="container interview-empty">
        <div className="panel interview-empty__card">
          <h2>No active interview found</h2>
          <p>This session's question data isn't available in this browser tab.</p>
          <button className="btn btn--primary" onClick={() => navigate("/setup")}>
            Start a new interview
          </button>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer.trim()) {
      setError("Write an answer before submitting.");
      return;
    }
    setError(null);
    setPhase("evaluating");

    try {
      const result = await api.submitAnswer(sessionId, {
        question_id: question.id,
        answer_text: answer,
      });
      setEvaluation(result.evaluation);
      setAdaptiveAction(result.adaptive_action);
      setProgress({ answered: result.progress, total: result.total });

      if (result.next_question) {
        setDifficulty(result.next_question.difficulty);
      }

      if (result.is_complete) {
        setPhase("finishing");
      } else {
        setPhase("reviewing");
        setQuestion(result.next_question);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not evaluate your answer.");
      setPhase("answering");
    }
  }

  function handleContinue() {
    setAnswer("");
    setEvaluation(null);
    setAdaptiveAction(null);
    setPhase("answering");
  }

  function handleViewReport() {
    navigate(`/results/${sessionId}`);
  }

  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;

  return (
    <main className="container interview">
      <div className="interview__grid">
        <section className="panel interview__stage">
          <div className="interview__stage-header">
            <span className="interview__progress-label mono">
              Question {Math.min(progress.answered + 1, progress.total || question.total)} / {progress.total || question.total}
            </span>
            <span className="interview__topic-chip">{question.topic}</span>
          </div>

          <div className="interview__progress-track">
            <div className="interview__progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {phase !== "finishing" && (
            <>
              <p className="interview__question">{question.text}</p>

              {(phase === "answering" || phase === "evaluating") && (
                <form onSubmit={handleSubmit} className="interview__form">
                  <textarea
                    rows={8}
                    placeholder="Type your answer here…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={phase === "evaluating"}
                  />
                  {error && <div className="error-banner">{error}</div>}
                  <button type="submit" className="btn btn--primary" disabled={phase === "evaluating"}>
                    {phase === "evaluating" ? "Evaluating your answer…" : "Submit answer"}
                  </button>
                </form>
              )}

              {phase === "reviewing" && evaluation && (
                <div className="interview__result">
                  <div className="interview__result-header">
                    <span className="interview__result-score mono">
                      {evaluation.score.toFixed(1)}
                      <span className="interview__result-max">/10</span>
                    </span>
                    <span className="interview__result-label">Question score</span>
                  </div>

                  <DimensionScores evaluation={evaluation} />

                  {evaluation.strengths?.length > 0 && (
                    <FeedbackList title="Strengths" items={evaluation.strengths} tone="good" />
                  )}
                  {evaluation.weaknesses?.length > 0 && (
                    <FeedbackList title="Areas to improve" items={evaluation.weaknesses} tone="bad" />
                  )}
                  <p className="interview__result-feedback">{evaluation.feedback}</p>

                  <button className="btn btn--primary" onClick={handleContinue}>
                    Continue interview
                  </button>
                </div>
              )}
            </>
          )}

          {phase === "finishing" && evaluation && (
            <div className="interview__result">
              <div className="interview__result-header">
                <span className="interview__result-score mono">
                  {evaluation.score.toFixed(1)}
                  <span className="interview__result-max">/10</span>
                </span>
                <span className="interview__result-label">Final question score</span>
              </div>
              <DimensionScores evaluation={evaluation} />
              <p className="interview__result-feedback">{evaluation.feedback}</p>
              <p className="interview__complete-note">
                That was the last question — your full report is ready.
              </p>
              <button className="btn btn--primary" onClick={handleViewReport}>
                View interview report
              </button>
            </div>
          )}
        </section>

        <aside className="interview__sidebar">
          <div className="panel interview__gauge-card">
            <DifficultyGauge difficulty={difficulty} lastAction={adaptiveAction} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function FeedbackList({ title, items, tone }) {
  return (
    <div className={`feedback-list feedback-list--${tone}`}>
      <span className="feedback-list__title">{title}</span>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
