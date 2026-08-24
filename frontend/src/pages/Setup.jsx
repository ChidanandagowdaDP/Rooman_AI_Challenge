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
const SCORING_FOCUS_OPTIONS = [
  { value: "technical_depth", label: "Technical depth", hint: "Correctness & understanding weigh most" },
  { value: "balanced", label: "Balanced", hint: "All five dimensions equal" },
  { value: "communication", label: "Communication", hint: "Clarity weighs most" },
];
const COMMON_ROLES = [
  "Python Developer",
  "Java Developer",
  ".NET Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "MERN Stack Developer",
  "Mobile App Developer",
  "Flutter Developer",
  "Data Analyst",
  "Data Scientist",
  "Data Engineer",
  "Machine Learning Engineer",
  "AI Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Database Administrator",
  "QA Engineer",
  "Automation Test Engineer",
  "Cybersecurity Analyst",
  "Business Analyst",
  "Software Tester",
  "Technical Support Engineer",
  "Embedded Systems Engineer",
  "Game Developer",
];
const POPULAR_SKILLS = [
  "Python", "Java", "C", "C++", "C#", "JavaScript", "TypeScript", "Go",
  "Rust", "PHP", "Ruby", "Kotlin", "Swift", "SQL", "NoSQL", "HTML/CSS",
  "React", "Angular", "Vue.js", "Next.js", "Node.js", "Express.js",
  "Django", "Flask", "FastAPI", "Spring Boot", ".NET Core",
  "REST API", "GraphQL", "Microservices", "System Design",
  "MongoDB", "PostgreSQL", "MySQL", "Redis", "Firebase",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Jenkins",
  "Git", "Linux", "CI/CD", "Terraform",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
  "TensorFlow", "PyTorch", "Pandas", "NumPy", "scikit-learn",
  "Power BI", "Tableau", "Excel", "Selenium", "Cypress", "Jira", "Agile/Scrum",
];

export default function Setup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState(EXPERIENCE_LEVELS[0]);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [interviewType, setInterviewType] = useState("technical");
  const [difficulty, setDifficulty] = useState("medium");
  const [scoringFocus, setScoringFocus] = useState("technical_depth");
  const [includeCoding, setIncludeCoding] = useState(false);
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
      // A datalist suggestion highlighted with the arrow keys is already in
      // the DOM input value but may not have reached React state yet — read
      // the node after the current tick so the picked suggestion is added.
      const el = e.currentTarget;
      setTimeout(() => addSkill(el.value), 0);
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
        scoring_focus: scoringFocus,
        include_coding: includeCoding,
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
              list="role-options"
              placeholder="Pick a role or type your own"
              autoComplete="off"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={120}
            />
            <datalist id="role-options">
              {COMMON_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <span className="field__hint">Start typing to see common roles — anything custom works too.</span>
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
                list="skill-options"
                autoComplete="off"
                placeholder={skills.length ? "" : "Type a skill and press Enter"}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                onBlur={() => addSkill(skillInput)}
              />
            </div>
            <datalist id="skill-options">
              {POPULAR_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <span className="field__hint">
              Start typing for suggestions · Enter or comma adds · Backspace removes the last chip
            </span>
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

          <div className="field">
            <span className="field__legend">Scoring focus</span>
            <div className="pill-group pill-group--cards">
              {SCORING_FOCUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`pill-card ${scoringFocus === opt.value ? "pill-card--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="scoring_focus"
                    value={opt.value}
                    checked={scoringFocus === opt.value}
                    onChange={() => setScoringFocus(opt.value)}
                  />
                  <strong>{opt.label}</strong>
                  <span>{opt.hint}</span>
                </label>
              ))}
            </div>
            <span className="field__hint">
              Controls how the five answer dimensions are weighted into each question score.
            </span>
          </div>

          <div className="field">
            <label className="setup__toggle">
              <input
                type="checkbox"
                checked={includeCoding}
                onChange={(e) => setIncludeCoding(e.target.checked)}
              />
              <span>
                <strong>Include coding challenges</strong>
                <em>
                  Every third question becomes a hands-on programming task answered
                  in a built-in code editor (any language).
                </em>
              </span>
              <span className={`setup__toggle-state mono ${includeCoding ? "is-on" : ""}`}>
                {includeCoding ? "ON" : "OFF"}
              </span>
            </label>
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
            <BriefRow label="Coding challenges" value={includeCoding ? "Included" : "None"} />
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
