import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ApiError } from "../api/client.js";
import "./Login.css";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";

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

  return (
    <main className="container login">
      <div className="login__card fade-up">
        <span className="badge badge--accent">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </span>
        <h1 className="login__title">
          {mode === "login" ? (
            <>
              Sign in to <em className="gradient-text">InterviewAI</em>
            </>
          ) : (
            <>
              Start practicing in <em className="gradient-text">minutes</em>
            </>
          )}
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
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
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

          {error && <p className="login__error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="login__switch">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button type="button" onClick={() => { setMode("register"); setError(null); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(null); }}>
                Sign in
              </button>
            </>
          )}
        </p>
        <p className="login__back">
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
