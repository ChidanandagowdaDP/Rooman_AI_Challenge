const POSITIONS = {
  easy: { angle: -60, label: "EASY", tone: "good" },
  medium: { angle: 0, label: "MEDIUM", tone: "warn" },
  hard: { angle: 60, label: "HARD", tone: "bad" },
};

/**
 * The interview's signature visual: a needle instrument that physically
 * moves as the adaptive controller changes difficulty.
 */
export default function DifficultyGauge({ difficulty = "medium", lastAction }) {
  const pos = POSITIONS[difficulty] ?? POSITIONS.medium;

  return (
    <div className="gauge">
      <svg viewBox="0 0 200 120" className="gauge__face" aria-hidden="true">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--border)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 90 22"
          fill="none"
          stroke="var(--good)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M 90 22 A 80 80 0 0 1 110 22"
          fill="none"
          stroke="var(--warn)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 110 22 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--bad)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.45"
        />
        {[20, 60, 100, 140, 180].map((x, i) => (
          <circle key={i} cx={x} cy={i === 2 ? 16.3 : i === 0 || i === 4 ? 96 : 56} r="2.4" fill="var(--text-faint)" opacity="0.6" />
        ))}
        <g className="gauge__needle" style={{ "--angle": `${pos.angle}deg` }}>
          <line x1="100" y1="100" x2="100" y2="36" />
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--bg-panel-raised)" stroke="var(--text)" strokeWidth="2" />
      </svg>

      <div className="gauge__readout">
        <span className={`badge badge--${pos.tone} mono`}>{pos.label}</span>
        <span className="gauge__caption">
          {lastAction ? formatAction(lastAction) : "Calibrating from your first answer"}
        </span>
      </div>
    </div>
  );
}

function formatAction(action) {
  switch (action) {
    case "INCREASE_DIFFICULTY":
      return "Strong answer — raising difficulty";
    case "DECREASE_DIFFICULTY":
      return "Difficulty lowered";
    case "TARGET_WEAK_TOPIC":
      return "Targeting a weak topic";
    default:
      return "Holding steady";
  }
}
