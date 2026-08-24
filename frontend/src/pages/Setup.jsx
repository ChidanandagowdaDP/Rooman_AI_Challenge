import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import "./Setup.css";

const EXPERIENCE_LEVELS = ["Fresher", "Junior (1-2 yrs)", "Mid (3-5 yrs)", "Senior (5+ yrs)"];
const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical", hint: "Coding & system knowledge" },
  { value: "behavioral", label: "Behavioral", hint: "Situations & soft skills" },
  { value: "mixed", label: "Mixed", hint: "A blend of both" },
];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function Setup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState(EXPERIENCE_LEVELS[0]);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [interviewType, setInterviewType] = useState("technical");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function addSkill(raw) {
    const value = raw.trim().replace(/,+$/, "");
    if (!value) return;
    if (!skills.includes(value)) setSkills([...skills, value]);
    setSkillInput("");
  }

  function handleSkillKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === "Backspace" && !skillInput && skills.length) {
      setSkills(skills.slice(0, -1));
    }
  }

  function removeSkill(skill) {
    setSkills(skills.filter((s) => s !== skill));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!role.trim() || skills.length === 0) {
      setError("Add a target role and at least one skill before starting.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.startInterview({
        role: role.trim(),
        experience,
        skills,
        interview_type: interviewType,
        difficulty,
        num_questions: numQuestions,
      });
      navigate(`/interview/${result.session_id}`, {
        state: { firstQuestion: result.first_question },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong starting the interview.");
      setSubmitting(false);
    }
  }

  return (
    <main className="container setup">
      <header className="setup__head fade-up">
        <span className="badge badge--accent">Interview setup</span>
        <h1>Configure your <span className="gradient-text">session</span></h1>
        <p>Every field here shapes the questions the AI interviewer writes — be specific.</p>
      </header>

      <div className="setup__layout fade-up fade-up-1">
        <form className="panel setup__form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="role">Target role</label>
            <input
              id="role"
              type="text"
              placeholder="e.g. Python Backend Developer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="experience">Experience level</label>
              <select id="experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="num_questions">
                Questions · <span className="mono setup__count">{numQuestions}</span>
              </label>
              <div className="setup__slider-wrap">
                <input
                  id="num_questions"
                  type="range"
                  min={5}
                  max={10}
                  step={1}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                />
                <div className="setup__ticks mono" aria-hidden="true">
                  {[5, 6, 7, 8, 9, 10].map((n) => (
                    <span key={n} data-active={n <= numQuestions}>{n}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="skills">Skills to probe</label>
            <div className="skill-input" onClick={() => document.getElementById("skills")?.focus()}>
              {skills.map((skill) => (
                <span className="skill-chip mono" key={skill}>
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                    ×
                  </button>
                </span>
              ))}
              <input
                id="skills"
                type="text"
                placeholder={skills.length ? "" : "Type a skill and press Enter"}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                onBlur={() => addSkill(skillInput)}
              />
            </div>
            <span className="field__hint">Press Enter or comma to add · Backspace removes the last chip</span>
          </div>

          <div className="field">
            <span className="field__legend">Interview type</span>
            <div className="pill-group pill-group--cards">
              {INTERVIEW_TYPES.map((opt) => (
                <label key={opt.value} className={`pill-card ${interviewType === opt.value ? "pill-card--active" : ""}`}>
                  <input
                    type="radio"
                    name="interview_type"
                    value={opt.value}
                    checked={interviewType === opt.value}
                    onChange={() => setInterviewType(opt.value)}
                  />
                  <strong>{opt.label}</strong>
                  <span>{opt.hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__legend">Starting difficulty</span>
            <div className="pill-group">
              {DIFFICULTIES.map((opt) => (
                <label key={opt.value} className={`pill ${difficulty === opt.value ? "pill--active" : ""}`}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={opt.value}
                    checked={difficulty === opt.value}
                    onChange={() => setDifficulty(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && <div className="error-banner">⚠ {error}</div>}
        </form>

        {/* Live summary card */}
        <aside className="setup__summary panel">
          <span className="section-label">Session brief</span>
          <dl className="setup__brief">
            <BriefRow label="Role" value={role.trim() || "—"} strong={!role.trim()} />
            <BriefRow label="Experience" value={experience} />
            <BriefRow
              label="Skills"
              value={skills.length ? skills.join(", ") : "—"}
            />
            <BriefRow label="Type" value={INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label} />
            <BriefRow label="Opening at" value={difficulty.toUpperCase()} mono />
            <BriefRow label="Length" value={`${numQuestions} questions`} />
          </dl>
          <div className="setup__estimate">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
            </svg>
            Estimated time: ~{numQuestions * 3} min (local model)
          </div>
          <button
            type="submit"
            form="none"
            className="btn btn--primary setup__submit"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span className="spinner" /> Generating first question…
              </>
            ) : (
              "Start interview"
            )}
          </button>
          <p className="setup__privacy">Runs on a local open-source model — nothing leaves this machine.</p>
        </aside>
      </div>
    </main>
  );
}

function BriefRow({ label, value, mono, strong }) {
  return (
    <div className="brief-row">
      <dt>{label}</dt>
      <dd className={`${mono ? "mono" : ""} ${strong ? "brief-row--empty" : ""}`}>{value}</dd>
    </div>
  );
}
