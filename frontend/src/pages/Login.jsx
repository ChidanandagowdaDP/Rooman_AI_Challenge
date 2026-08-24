import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ApiError } from "../api/client.js";
import "./Login.css";

const HIGHLIGHTS = [
  {
    icon: "M13 2 3 14h7l-1 8 11-13h-7l1-7H13Z",
    title: "Adaptive questioning",
    body: "Difficulty recalibrates after every answer.",
  },
  {
    icon: "M4 4h16v2H4V4Zm0 5h10v2H4V9Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z",
    title: "Five-dimension scoring",
    body: "Accuracy, relevance, depth and more — per answer.",
  },
  {
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z",
    title: "Hiring-ready reports",
    body: "Downloadable PDFs a panel can actually use.",
  },
];

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/setup";

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <main className="container login">
      <div className="login__card fade-up">
        {/* Brand side */}
        <aside className="login__brand">
          <Link to="/" className="login__brand-mark">
            <span className="topbar__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18V7.5h4a3.25 3.25 0 0 1 0 6.5H8.5V18H6Z"
                  fill="url(#login-grad)"
                />
                <circle cx="16.4" cy="15.6" r="2.1" fill="#22d3ee" />
                <defs>
                  <linearGradient id="login-grad" x1="6" y1="7" x2="12" y2="18">
                    <stop stopColor="#818cf8" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            Interview<span className="login__brand-accent">AI</span>
          </Link>

          <h2 className="login__brand-title">
            An interviewer that recalibrates{" "}
            <em className="gradient-text">after every answer.</em>
          </h2>
          <p className="login__brand-lede">
            Role-specific questions, five-dimension scoring and a structured
            report at the end.
          </p>

          <ul className="login__highlights">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title}>
                <span className="login__highlight-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d={h.icon} />
                  </svg>
                </span>
                <div>
                  <strong>{h.title}</strong>
                  <span>{h.body}</span>
                </div>
              </li>
            ))}
          </ul>

          <p className="login__brand-foot mono">100% local · open-source models</p>
        </aside>

        {/* Form side */}
        <section className="login__form-side">
          <span className="badge badge--accent">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </span>
          <h1 className="login__title">
            {mode === "login" ? "Sign in to continue" : "Start practicing in minutes"}
          </h1>
          <p className="login__lede">
            Your interview history and reports are tied to your account.
          </p>

          <form onSubmit={handleSubmit} className="login__form" noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "register" ? "At least 8 characters" : "Your password"
                }
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                minLength={8}
                required
              />
            </div>

            {mode === "register" && (
              <div className="field">
                <label htmlFor="login-confirm">Confirm password</label>
                <input
                  id="login-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            )}

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              {!busy && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </form>

          <p className="login__switch">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button type="button" onClick={() => switchMode("register")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </p>
          <p className="login__back">
            <Link to="/">← Back to home</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
