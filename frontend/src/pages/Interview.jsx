import { useCallback, useEffect, lazy, Suspense, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DifficultyGauge from "../components/DifficultyGauge.jsx";
import DimensionScores from "../components/DimensionScores.jsx";
import {
  CODE_LANGUAGES,
  normalizeLanguage,
  templateFor,
} from "../components/codeLanguages.js";
import { api, API_URL, ApiError, getToken } from "../api/client.js";
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from "../hooks/useSpeech.js";
import "./Interview.css";

// CodeMirror is heavy (~800 kB) — only fetched when a coding challenge appears.
const CodeEditor = lazy(() => import("../components/CodeEditor.jsx"));

export default function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [question, setQuestion] = useState(location.state?.firstQuestion ?? null);
  const [loading, setLoading] = useState(!location.state?.firstQuestion);
  const [loadError, setLoadError] = useState(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [adaptiveAction, setAdaptiveAction] = useState(null);
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "medium");
  const [progress, setProgress] = useState({ answered: 0, total: question?.total ?? 0 });
  const [phase, setPhase] = useState("answering"); // answering | evaluating | generating | reviewing | finishing
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState("");

  const textareaRef = useRef(null);
  const questionStartRef = useRef(Date.now());

  /* ----- Coding challenges: per-language buffers, language selector, runner ----- */
  const isCoding = Boolean(question?.is_coding);
  const [runnableLangs, setRunnableLangs] = useState(["python", "javascript"]);
  const [codeLang, setCodeLang] = useState("python");
  // One scratch buffer per language so switching languages keeps each
  // solution and seeds untouched ones with idiomatic boilerplate.
  const [codeBuffers, setCodeBuffers] = useState({});
  const [runResult, setRunResult] = useState(null);
  const [runBusy, setRunBusy] = useState(false);

  // Ask the backend which languages it can actually run on this machine.
  const runnableRef = useRef(runnableLangs);
  useEffect(() => {
    api
      .runCodeLanguages()
      .then((res) => {
        if (Array.isArray(res.languages) && res.languages.length) {
          setRunnableLangs(res.languages);
          runnableRef.current = res.languages;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!question?.id || !question.is_coding) return;
    const suggested = normalizeLanguage(question.language);
    const runnable = CODE_LANGUAGES.some(
      (l) => l.id === suggested && runnableRef.current.includes(l.id)
    );
    const initial = runnable ? suggested : "python";
    setCodeLang(initial);
    setCodeBuffers({
      [initial]: question.starter_code || templateFor(initial),
    });
    setRunResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  function switchCodeLang(next) {
    setCodeLang((prev) => {
      if (next !== prev) setRunResult(null);
      return next;
    });
  }
  function updateCurrentBuffer(value) {
    setCodeBuffers((prev) => ({ ...prev, [codeLang]: value }));
  }
  async function handleRun() {
    if (runBusy || phase !== "answering") return;
    setRunBusy(true);
    setError(null);
    try {
      setRunResult(await api.runCode({ language: codeLang, code: currentCode }));
    } catch (err) {
      setRunResult({
        supported: false,
        message: err instanceof ApiError ? err.message : "Could not reach the runner.",
      });
    } finally {
      setRunBusy(false);
    }
  }

  /* ----- Voice mode (browser-native STT/TTS) ----- */
  const appendTranscript = useCallback((text) => {
    setAnswer((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const {
    listening,
    interim,
    sttError,
    sttSupported,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({ onFinal: appendTranscript });
  const { speak, stopSpeaking, speaking, ttsSupported } = useSpeechSynthesis();

  /* ----- Recover state after a browser refresh ----- */
  useEffect(() => {
    if (location.state?.firstQuestion) return;
    let cancelled = false;
    api
      .getInterview(sessionId)
      .then((detail) => {
        if (cancelled) return;
        if (detail.completed) {
          navigate(`/results/${sessionId}`, { replace: true });
        } else if (detail.current_question) {
          setQuestion(detail.current_question);
          setDifficulty(detail.current_question.difficulty);
          setProgress({ answered: detail.answered, total: detail.num_questions });
          setLoading(false);
        } else {
          setLoadError("This session has no live question. Start a new interview.");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load this interview session."
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, location.state, navigate]);

  /* ----- Reset per-question timer whenever the question changes.
     The start time comes from the server, so a refresh mid-question
     restores the true elapsed time instead of restarting at 0. ----- */
  useEffect(() => {
    if (!question || phase !== "answering") return;
    const startMs =
      question.started_at != null
        ? question.started_at * 1000
        : Date.now();
    questionStartRef.current = startMs;
    setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - questionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [question, phase]);

  /* ----- Focus textarea on each new question ----- */
  useEffect(() => {
    if (phase === "answering") textareaRef.current?.focus();
  }, [phase, question]);

  /* ----- Stop voice I/O whenever we leave the answering phase or unmount ----- */
  useEffect(() => {
    if (phase !== "answering") {
      stopListening();
      stopSpeaking();
    }
  }, [phase, stopListening, stopSpeaking]);

  const currentCode = codeBuffers[codeLang] ?? templateFor(codeLang);
  const answerText = isCoding ? currentCode : answer;

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
  const lineCount = answerText ? answerText.split("\n").length : 0;

  function applyEvaluation(result) {
    setEvaluation(result.evaluation);
    setAdaptiveAction(result.adaptive_action);
    setProgress({ answered: result.progress, total: result.total });
    if (result.next_difficulty) setDifficulty(result.next_difficulty);
  }

  async function submitStream() {
    const token = getToken();
    const resp = await fetch(
      `${API_URL}/api/interviews/${sessionId}/answers/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question_id: question.id,
          answer_text: answerText,
          ...(isCoding ? { code_language: codeLang } : {}),
        }),
      }
    );
    if (!resp.ok || !resp.body) {
      let detail = `Request failed (${resp.status})`;
      try {
        const body = await resp.json();
        detail = body.detail || detail;
      } catch { /* no body */ }
      throw new ApiError(detail, resp.status);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) {
        streamDone = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        switch (event.type) {
          case "evaluation":
            applyEvaluation(event);
            setPhase(event.is_complete ? "finishing" : "generating");
            break;
          case "question_delta":
            setPreview((p) => p + event.text);
            break;
          case "next_question":
            setQuestion(event.next_question);
            setPreview("");
            setPhase("reviewing");
            break;
          case "error":
            throw new ApiError(event.message || "Model error.", 502);
          default:
            break;
        }
      }
    }
  }

  async function submitClassic() {
    const result = await api.submitAnswer(sessionId, {
      question_id: question.id,
      answer_text: answerText,
      ...(isCoding ? { code_language: codeLang } : {}),
    });
    applyEvaluation(result);
    if (result.next_question) {
      setDifficulty(result.next_question.difficulty);
    }
    if (result.is_complete) {
      setPhase("finishing");
    } else {
      setQuestion(result.next_question);
      setPhase("reviewing");
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (["evaluating", "generating", "finishing"].includes(phase)) return;
    if (!answerText.trim()) {
      setError(isCoding
        ? "Write or run your solution before submitting."
        : "Write an answer before submitting."
      );
      return;
    }
    setError(null);
    setPhase("evaluating");

    try {
      try {
        await submitStream();
      } catch (streamErr) {
        // Streaming not available or failed mid-way — classic path as fallback.
        await submitClassic();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not evaluate your answer.");
      setPhase("answering");
    }
  }

  const handleContinue = useCallback(() => {
    setAnswer("");
    setEvaluation(null);
    setAdaptiveAction(null);
    setError(null);
    setPreview("");
    setPhase("answering");
  }, []);

  /* ----- Keyboard shortcuts ----- */
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (phase === "answering") handleSubmit();
        else if (phase === "reviewing") handleContinue();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answer, handleContinue]);

  function handleQuit() {
    if (
      window.confirm(
        "Quit this interview? Your progress is saved and you can resume it from the home page."
      )
    ) {
      navigate("/");
    }
  }

  /* ----- Empty / loading / error states ----- */
  if (loading) {
    return (
      <main className="container interview-empty">
        <div className="panel interview-empty__card">
          <span className="spinner" />
          <p>Loading your interview…</p>
        </div>
      </main>
    );
  }

  if (loadError || !question) {
    return (
      <main className="container interview-empty">
        <div className="panel interview-empty__card">
          <h2>No active interview found</h2>
          <p>{loadError ?? "This session's question data isn't available in this browser tab."}</p>
          <button className="btn btn--primary" onClick={() => navigate("/setup")}>
            Start a new interview
          </button>
        </div>
      </main>
    );
  }

  const pct = progress.total
    ? Math.round((progress.answered / progress.total) * 100)
    : 0;

  return (
    <main className="container interview">
      {/* Session strip */}
      <div className="interview__strip fade-up">
        <button className="btn btn--ghost btn--sm" onClick={handleQuit}>
          ← Quit
        </button>
        <span className="interview__timer mono" title="Time on current question">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
          </svg>
          {formatClock(elapsed)}
        </span>
      </div>

      <div className="interview__grid fade-up fade-up-1">
        <section className="panel interview__stage">
          <div className="interview__stage-header">
            <span className="interview__progress-label mono">
              Question {Math.min(progress.answered + 1, progress.total || question.total)} /{" "}
              {progress.total || question.total}
            </span>
            <div className="interview__chips">
              <span className={`badge badge--${difficultyBadge(difficulty)} mono`}>
                {difficulty}
              </span>
              <span className="badge badge--accent">{question.topic}</span>
            </div>
          </div>

          <div className="interview__progress-track">
            <div className="interview__progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {phase !== "finishing" && (
            <>
              <div className="interview__question-row">
                <p className="interview__question">{question.text}</p>
                {ttsSupported && (
                  <button
                    type="button"
                    className={`interview__speak ${speaking ? "interview__speak--on" : ""}`}
                    onClick={() =>
                      speaking ? stopSpeaking() : speak(question.text)
                    }
                    aria-label={speaking ? "Stop reading aloud" : "Read question aloud"}
                    title={speaking ? "Stop reading aloud" : "Read question aloud"}
                  >
                    {speaking ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {(phase === "answering" || phase === "evaluating") && (
                <form onSubmit={handleSubmit} className="interview__form">
                  {isCoding ? (
                    <div className="interview__code">
                      <div className="interview__code-head">
                        <span className="section-label">Your solution</span>
                        <div className="interview__code-tools">
                          <label className="interview__code-lang">
                            Language
                            <select
                              value={runnableLangs.includes(codeLang) ? codeLang : "python"}
                              onChange={(e) => switchCodeLang(e.target.value)}
                              disabled={phase === "evaluating"}
                            >
                              {CODE_LANGUAGES.filter((l) => runnableLangs.includes(l.id)).map(
                                (l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.label}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm interview__run"
                            onClick={handleRun}
                            disabled={phase !== "answering" || runBusy}
                            title="Run this code locally"
                          >
                            {runBusy ? (
                              <>
                                <span className="spinner" /> Running…
                              </>
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                                </svg>
                                Run
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <Suspense fallback={<span className="spinner" />}>
                        <CodeEditor
                          value={currentCode}
                          onChange={updateCurrentBuffer}
                          language={codeLang}
                          readOnly={phase === "evaluating"}
                          placeholder="// Write your solution here…"
                        />
                      </Suspense>
                      {runResult && (
                        <div
                          className={`interview__output mono ${
                            runResult.timed_out || (runResult.exit_code ?? 1) !== 0
                              ? "interview__output--bad"
                              : "interview__output--good"
                          }`}
                        >
                          <div className="interview__output-head">
                            <span>Output</span>
                            {runResult.supported && !runResult.timed_out && (
                              <span
                                className={`badge badge--${
                                  runResult.exit_code === 0 ? "good" : "bad"
                                }`}
                              >
                                exit {runResult.exit_code}
                              </span>
                            )}
                            {runResult.timed_out && (
                              <span className="badge badge--bad">timed out</span>
                            )}
                          </div>
                          {runResult.message && (
                            <p className="interview__output-msg">{runResult.message}</p>
                          )}
                          {runResult.stdout && <pre>{runResult.stdout}</pre>}
                          {runResult.stderr && (
                            <pre className="interview__output-stderr">{runResult.stderr}</pre>
                          )}
                          {!runResult.stdout && !runResult.stderr && !runResult.message && (
                            <p className="interview__output-msg">(no output)</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea
                      ref={textareaRef}
                      rows={9}
                      placeholder="Type your answer here…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={phase === "evaluating"}
                    />
                  )}
                  <div className="interview__form-foot">
                    <span className={`interview__words mono ${wordCount > 0 ? "" : "interview__words--zero"}`}>
                      {isCoding
                        ? `${lineCount} line${lineCount === 1 ? "" : "s"}`
                        : `${wordCount} word${wordCount === 1 ? "" : "s"}`}
                    </span>
                    {!isCoding && sttSupported && phase === "answering" && (
                      <>
                        {listening && interim && (
                          <span className="interview__interim mono">“{interim}”</span>
                        )}
                        <button
                          type="button"
                          className={`interview__mic ${listening ? "interview__mic--live" : ""}`}
                          onClick={() => (listening ? stopListening() : startListening())}
                          disabled={phase !== "answering"}
                          aria-label={listening ? "Stop voice input" : "Answer by voice"}
                          title={listening ? "Stop voice input" : "Answer by voice"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="2.5" width="6" height="11" rx="3" />
                            <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" strokeLinecap="round" />
                          </svg>
                          {listening ? "Listening…" : "Voice"}
                        </button>
                      </>
                    )}
                    <span className="interview__shortcut mono">Ctrl + Enter to submit</span>
                    <button type="submit" className="btn btn--primary" disabled={phase === "evaluating"}>
                      {phase === "evaluating" ? (
                        <>
                          <span className="spinner" /> Evaluating…
                        </>
                      ) : (
                        "Submit answer"
                      )}
                    </button>
                  </div>
                  {(sttError || error) && phase === "answering" && (
                    <div className="error-banner">⚠ {sttError || error}</div>
                  )}
                </form>
              )}

              {phase === "generating" && (
                <div className="interview__typing fade-up">
                  <span className="section-label">Writing your next question</span>
                  <p className="interview__typing-text">
                    {preview || <span className="spinner" />}
                    <span className="interview__caret" aria-hidden="true" />
                  </p>
                </div>
              )}

              {(phase === "reviewing" || phase === "generating") && evaluation && (
                <div className={`interview__result fade-up ${phase === "generating" ? "interview__result--dimmed" : ""}`}>
                  <div className="interview__result-header">
                    <div>
                      <span className="interview__result-score mono">
                        {evaluation.score.toFixed(1)}
                        <span className="interview__result-max">/10</span>
                      </span>
                      <span className="interview__result-label">Question score</span>
                    </div>
                    <span className={`badge badge--${actionTone(adaptiveAction)}`}>
                      {actionLabel(adaptiveAction)}
                    </span>
                  </div>

                  <DimensionScores evaluation={evaluation} />

                  {evaluation.strengths?.length > 0 && (
                    <FeedbackList title="Strengths" items={evaluation.strengths} tone="good" />
                  )}
                  {evaluation.weaknesses?.length > 0 && (
                    <FeedbackList title="Areas to improve" items={evaluation.weaknesses} tone="bad" />
                  )}
                  <p className="interview__result-feedback">{evaluation.feedback}</p>

                  <button
                    className="btn btn--primary interview__continue"
                    onClick={handleContinue}
                    disabled={phase === "generating"}
                  >
                    Continue interview →
                    <kbd className="mono">Ctrl+↵</kbd>
                  </button>
                </div>
              )}
            </>
          )}

          {phase === "finishing" && evaluation && (
            <div className="interview__result fade-up">
              <h2 className="interview__done-title">Interview complete 🎉</h2>
              <div className="interview__result-header">
                <div>
                  <span className="interview__result-score mono">
                    {evaluation.score.toFixed(1)}
                    <span className="interview__result-max">/10</span>
                  </span>
                  <span className="interview__result-label">Final question score</span>
                </div>
              </div>
              <DimensionScores evaluation={evaluation} />
              <p className="interview__result-feedback">{evaluation.feedback}</p>
              <button className="btn btn--primary interview__continue" onClick={() => navigate(`/results/${sessionId}`)}>
                View full report →
              </button>
            </div>
          )}
        </section>

        <aside className="interview__sidebar">
          <div className="panel interview__gauge-card">
            <span className="section-label">Calibration</span>
            <DifficultyGauge difficulty={difficulty} lastAction={adaptiveAction} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function FeedbackList({ title, items, tone }) {
  return (
    <div className={`feedback-list feedback-list--${tone}`}>
      <span className="feedback-list__title">{title}</span>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function difficultyBadge(d) {
  return d === "easy" ? "good" : d === "hard" ? "bad" : "warn";
}

function actionLabel(action) {
  switch (action) {
    case "INCREASE_DIFFICULTY": return "▲ Difficulty raised";
    case "DECREASE_DIFFICULTY": return "▼ Difficulty lowered";
    case "TARGET_WEAK_TOPIC": return "◎ Targeting weak topic";
    default: return "— Holding steady";
  }
}

function actionTone(action) {
  switch (action) {
    case "INCREASE_DIFFICULTY": return "good";
    case "DECREASE_DIFFICULTY": return "warn";
    case "TARGET_WEAK_TOPIC": return "bad";
    default: return "accent";
  }
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
