import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DifficultyGauge from "../components/DifficultyGauge.jsx";
import { api } from "../api/client.js";
import { useAuth } from "../auth.jsx";
import "./Landing.css";

const FEATURES = [
  {
    icon: "M12 2 2 7l10 5 10-5-10-5Zm0 9L2 6v12l10 5 10-5V6l-10 5Z",
    title: "Adaptive question generation",
    body: "No fixed question bank. Every question is written for your role, skills and experience — and for how you've answered so far.",
  },
  {
    icon: "M4 4h16v2H4V4Zm0 5h10v2H4V9Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z",
    title: "Five-dimension scoring",
    body: "Accuracy, relevance, completeness, clarity and depth are scored independently, then weighted into one defensible number.",
  },
  {
    icon: "M13 2 3 14h7l-1 8 11-13h-7l1-7H13Z",
    title: "Real-time recalibration",
    body: "A deterministic controller raises or lowers difficulty after every single answer — visible on a live gauge as you go.",
  },
  {
    icon: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z",
    title: "Weak-topic targeting",
    body: "Struggle twice on a topic and the interviewer deliberately goes back to probe it before moving on.",
  },
  {
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm2 16H8v-2h8Zm0-4H8v-2h8Zm-3-5V3.5L18.5 9H13Z",
    title: "Hiring-ready reports",
    body: "Overall and sub-scores computed deterministically, with an AI-written narrative, topic calibration and per-question breakdown.",
  },
  {
    icon: "M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 0 1 6 0v3H9Z",
    title: "Private by design",
    body: "Runs on open-source models served locally via Ollama. Your answers never leave this machine.",
  },
];

const STEPS = [
  { step: "01", title: "Set the target", body: "Role, experience level, key skills, interview type and length." },
  { step: "02", title: "Answer", body: "One generated question at a time — each scored across five dimensions." },
  { step: "03", title: "Recalibrate", body: "Difficulty climbs, holds or drops; weak topics get probed again." },
  { step: "04", title: "Review", body: "A structured report with scores, calibration and a recommendation." },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSessions(null);
      return;
    }
    let cancelled = false;
    api
      .listInterviews()
      .then((data) => !cancelled && setSessions(data.slice(0, 5)))
      .catch(() => !cancelled && setSessions([]));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <main className="landing">
      {/* ---------- Hero ---------- */}
      <section className="container landing__hero">
        <div className="landing__hero-copy">
          <span className="badge badge--accent fade-up">
            <span className="landing__pulse" aria-hidden="true" />
            Adaptive interview engine · local LLM
          </span>
          <h1 className="landing__title fade-up fade-up-1">
            An interviewer that recalibrates{" "}
            <em className="gradient-text">after every answer.</em>
          </h1>
          <p className="landing__lede fade-up fade-up-2">
            InterviewAI generates role-specific questions, scores each answer
            across five dimensions, and adjusts difficulty and topic focus in
            real time — then produces a structured report a hiring panel could
            actually use.
          </p>
          <div className="landing__cta-row fade-up fade-up-3">
            <button className="btn btn--primary" onClick={() => navigate("/setup")}>
              Start an interview
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <a className="btn btn--ghost" href="#how-it-works">See how it works</a>
          </div>
          <dl className="landing__stats fade-up fade-up-4">
            <div><dt>5</dt><dd>scored dimensions</dd></div>
            <div><dt>3</dt><dd>difficulty rungs</dd></div>
            <div><dt>100%</dt><dd>local &amp; private</dd></div>
          </dl>
        </div>

        <div className="landing__hero-card panel fade-up fade-up-2">
          <div className="landing__hero-card-head mono">
            <span>DIFFICULTY CALIBRATION</span>
            <span className="landing__live"><span className="landing__pulse landing__pulse--dot" /> LIVE</span>
          </div>
          <DifficultyGauge difficulty="hard" lastAction="INCREASE_DIFFICULTY" />
          <div className="landing__hero-readings">
            <Reading label="Accuracy" value="8.5" />
            <Reading label="Depth" value="9.0" />
            <Reading label="Clarity" value="7.5" />
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="container landing__features">
        <span className="section-label">Capabilities</span>
        <h2 className="landing__section-title">
          Everything a real interviewer does, <span className="gradient-text">automated</span>.
        </h2>
        <div className="landing__feature-grid">
          {FEATURES.map((f) => (
            <article className="feature-card panel" key={f.title}>
              <span className="feature-card__icon">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d={f.icon} /></svg>
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="container landing__how">
        <span className="section-label">How it works</span>
        <h2 className="landing__section-title">The feedback loop</h2>
        <ol className="landing__steps">
          {STEPS.map((s) => (
            <li className="step-card panel" key={s.step}>
              <span className="step-card__num mono">{s.step}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Recent sessions ---------- */}
      <section className="container landing__history">
        <span className="section-label">Your activity</span>
        <h2 className="landing__section-title">Recent interviews</h2>

        {!isAuthenticated ? (
          <div className="panel panel--pad landing__history-empty">
            <p>Sign in to see your interview history and reports.</p>
            <Link to="/login" className="btn btn--primary btn--sm">Sign in</Link>
          </div>
        ) : sessions === null ? (
          <div className="panel panel--pad landing__history-empty">
            <span className="spinner" /> Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="panel panel--pad landing__history-empty">
            <p>No interviews yet. Your sessions will appear here.</p>
            <Link to="/setup" className="btn btn--primary btn--sm">Start your first</Link>
          </div>
        ) : (
          <div className="panel landing__history-table-wrap">
            <table className="landing__history-table">
              <thead>
                <tr>
                  <th>Role</th><th>Type</th><th>Progress</th><th>Status</th><th>When</th><th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="landing__history-role">{s.role}</td>
                    <td className="mono">{s.interview_type}</td>
                    <td className="mono">{s.answered}/{s.num_questions}</td>
                    <td>
                      {s.completed
                        ? <span className="badge badge--good">Complete</span>
                        : <span className="badge badge--warn">In progress</span>}
                    </td>
                    <td className="landing__history-time">{formatWhen(s.updated_at)}</td>
                    <td>
                      {s.completed ? (
                        <Link className="btn btn--sm" to={`/results/${s.session_id}`}>Report</Link>
                      ) : (
                        <Link className="btn btn--sm" to={`/interview/${s.session_id}`}>Resume</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="container">
        <div className="landing__cta-band panel">
          <h2>Ready to be interviewed?</h2>
          <p>Tailored questions, honest scoring, zero setup beyond one command.</p>
          <Link to="/setup" className="btn btn--primary">Start an interview</Link>
        </div>
      </section>
    </main>
  );
}

function Reading({ label, value }) {
  return (
    <div className="reading">
      <span className="reading__label">{label}</span>
      <span className="reading__value mono">{value}<em>/10</em></span>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 90) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString();
}
