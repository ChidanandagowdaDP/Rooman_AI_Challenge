import "./TopicCalibrationBar.css";

function scoreColor(score) {
  if (score >= 7.5) return "var(--good)";
  if (score >= 5.5) return "var(--accent)";
  return "var(--bad)";
}

export default function TopicCalibrationBar({ topic, score, questionCount }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));

  return (
    <div className="calibration-row">
      <div className="calibration-row__label">
        <span>{topic}</span>
        <span className="calibration-row__count">
          {questionCount} question{questionCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="calibration-row__track">
        <div
          className="calibration-row__fill"
          style={{ width: `${pct}%`, background: scoreColor(score) }}
        />
        <div className="calibration-row__ticks" aria-hidden="true">
          {[2, 4, 6, 8].map((t) => (
            <span key={t} style={{ left: `${t * 10}%` }} />
          ))}
        </div>
      </div>
      <span className="calibration-row__value mono">{score.toFixed(1)}</span>
    </div>
  );
}
