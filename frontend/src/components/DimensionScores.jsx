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
      {DIMENSIONS.map(([key, label]) => (
        <div className="dimensions__item" key={key}>
          <span className="dimensions__label">{label}</span>
          <span className="dimensions__value mono">
            {evaluation[key].toFixed(1)}
            <span className="dimensions__max">/10</span>
          </span>
        </div>
      ))}
    </div>
  );
}
