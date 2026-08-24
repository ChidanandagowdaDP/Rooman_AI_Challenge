import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { getTheme } from "../theme.js";
import "./CodeEditor.css";

function extensionFor(languageId) {
  switch (languageId) {
    case "python":
      return [python()];
    case "javascript":
      return [javascript()];
    default:
      return [];
  }
}

/**
 * Thin wrapper around CodeMirror used for coding-challenge answers.
 * `language` is a CODE_LANGUAGES id (see codeLanguages.js); unknown ids
 * fall back to plain text. Loaded lazily — CodeMirror only reaches the
 * browser when a coding question actually appears.
 */
export default function CodeEditor({
  value,
  onChange,
  language = "text",
  readOnly = false,
  placeholder,
}) {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const onThemeChange = (e) => setTheme(e.detail || getTheme());
    window.addEventListener("ia-theme-change", onThemeChange);
    return () => window.removeEventListener("ia-theme-change", onThemeChange);
  }, []);

  return (
    <div className="code-editor">
      <CodeMirror
        value={value}
        height="320px"
        theme={theme === "dark" ? "dark" : "light"}
        extensions={extensionFor(language)}
        editable={!readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: false,
          autocompletion: false,
        }}
        onChange={onChange}
      />
    </div>
  );
}
