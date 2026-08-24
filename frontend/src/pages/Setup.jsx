import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import "./Setup.css";

const EXPERIENCE_LEVELS = ["Fresher", "Junior (1-2 yrs)", "Mid (3-5 yrs)", "Senior (5+ yrs)"];
const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "mixed", label: "Mixed" },
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
    const value = raw.trim();
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
      <h1 className="setup__title">Interview setup</h1>
      <p className="setup__subtitle">
        Every field here shapes the questions the AI interviewer writes — be specific.
      </p>

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

        <div className="field">
          <label htmlFor="experience">Experience level</label>
          <select id="experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="skills">Skills</label>
          <div className="skill-input">
            {skills.map((skill) => (
              <span className="skill-chip" key={skill}>
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
        </div>

        <div className="field">
          <span className="field__legend">Interview type</span>
          <div className="pill-group">
            {INTERVIEW_TYPES.map((opt) => (
              <label key={opt.value} className={`pill ${interviewType === opt.value ? "pill--active" : ""}`}>
                <input
                  type="radio"
                  name="interview_type"
                  value={opt.value}
                  checked={interviewType === opt.value}
                  onChange={() => setInterviewType(opt.value)}
                />
                {opt.label}
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
          <label htmlFor="num_questions">
            Number of questions <span className="mono">{numQuestions}</span>
          </label>
          <input
            id="num_questions"
            type="range"
            min={5}
            max={10}
            step={1}
            value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
          />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" className="btn btn--primary setup__submit" disabled={submitting}>
          {submitting ? "Generating your first question…" : "Start interview"}
        </button>
      </form>
    </main>
  );
}
