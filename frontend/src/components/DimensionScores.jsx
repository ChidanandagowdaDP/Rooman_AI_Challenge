import "./DimensionScores.css";

const DIMENSIONS = [
  ["accuracy", "Accuracy"],
  ["relevance", "Relevance"],
  ["completeness", "Completeness"],
  ["clarity", "Clarity"],
  ["depth", "Depth"],
];

export default function DimensionScores({ evaluation }) {
  return (
    <div className="dimensions">
      {DIMENSIONS.map(([key, label], i) => (
        <div className="dimensions__item" key={key} style={{ animationDelay: `${i * 70}ms` }}>
          <div className="dimensions__head">
            <span className="dimensions__label">{label}</span>
            <span className="dimensions__value mono">
              {evaluation[key].toFixed(1)}
              <span className="dimensions__max">/10</span>
            </span>
          </div>
          <div className="dimensions__track">
            <div
              className="dimensions__fill"
              style={{ width: `${Math.min(100, evaluation[key] * 10)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
