// Only languages the local runner can execute (backend /api/run-code/languages).
export const CODE_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
];

const ALIASES = {
  py: "python",
  python3: "python",
  js: "javascript",
  node: "javascript",
};

export function normalizeLanguage(raw) {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!id) return null;
  return ALIASES[id] || id;
}

// Idiomatic starting point shown whenever a language has no code yet —
// switching languages swaps in the right boilerplate automatically.
const STARTER_TEMPLATES = {
  python: "def solution():\n    # TODO: implement\n    pass\n",
  javascript: "function solution() {\n  // TODO: implement\n}\n",
};

export function templateFor(languageId) {
  return STARTER_TEMPLATES[languageId] ?? "";
}
