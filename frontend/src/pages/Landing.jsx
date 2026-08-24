import { useNavigate } from "react-router-dom";
import DifficultyGauge from "../components/DifficultyGauge.jsx";
import "./Landing.css";

const LOOP = [
  { step: "01", title: "Set the target", body: "Role, experience level, skills, and how many questions." },
  { step: "02", title: "Ask", body: "A question generated for that exact profile — never a fixed bank." },
  { step: "03", title: "Evaluate", body: "Scored on accuracy, relevance, completeness, clarity, and depth." },
  { step: "04", title: "Recalibrate", body: "Difficulty moves up, down, or targets a weak topic — before the next question." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="landing">
      <section className="landing__hero container">
        <div className="landing__hero-copy">
          <span className="landing__eyebrow mono">ADAPTIVE INTERVIEW ENGINE</span>
          <h1 className="landing__title">
            An interviewer that recalibrates <em>after every answer.</em>
          </h1>
          <p className="landing__lede">
            InterviewAI generates role-specific questions, scores each answer
            across five dimensions, and adjusts difficulty and topic focus in
            real time — then produces a structured report a hiring panel
            could actually use.
          </p>
          <button className="btn btn--primary" onClick={() => navigate("/setup")}>
            Start an interview
          </button>
        </div>

        <div className="landing__hero-instrument">
          <DifficultyGauge difficulty="hard" lastAction="INCREASE_DIFFICULTY" />
          <p className="landing__instrument-caption">
            Difficulty responds live to how you're answering.
          </p>
        </div>
      </section>

      <section className="landing__loop container">
        {LOOP.map((item) => (
          <div className="loop-card" key={item.step}>
            <span className="loop-card__step mono">{item.step}</span>
            <h3 className="loop-card__title">{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
