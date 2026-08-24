import "./DifficultyGauge.css";

const POSITIONS = {
  easy: { angle: -60, label: "EASY" },
  medium: { angle: 0, label: "MEDIUM" },
  hard: { angle: 60, label: "HARD" },
};

/**
 * The interview's signature visual: a needle instrument that physically
 * moves as the adaptive controller changes difficulty. It's the one place
 * the "adaptive" part of the product becomes something you can *see*
 * happen, rather than a line of text saying "difficulty: hard".
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
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 90 22"
          fill="none"
          stroke="var(--good)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 90 22 A 80 80 0 0 1 110 22"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 110 22 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--bad)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.55"
        />
        <g className="gauge__needle" style={{ "--angle": `${pos.angle}deg` }}>
          <line x1="100" y1="100" x2="100" y2="34" />
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--text)" />
      </svg>

      <div className="gauge__readout">
        <span className="gauge__value mono">{pos.label}</span>
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
