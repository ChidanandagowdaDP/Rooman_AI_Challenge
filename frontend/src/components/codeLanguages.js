export const CODE_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "sql", label: "SQL" },
  { id: "text", label: "Plain text" },
];

const ALIASES = {
  py: "python",
  python3: "python",
  js: "javascript",
  node: "javascript",
  ts: "typescript",
  "c++": "cpp",
  cplusplus: "cpp",
  golang: "go",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
};

export function normalizeLanguage(raw) {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!id) return null;
  return ALIASES[id] || id;
}
