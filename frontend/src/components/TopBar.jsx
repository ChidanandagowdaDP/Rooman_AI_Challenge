import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getTheme, toggleTheme } from "../theme.js";
import "./TopBar.css";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/setup", label: "New interview" },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme);

  function handleToggleTheme() {
    setTheme(toggleTheme());
  }

  function handleLogout() {
    setAccountOpen(false);
    setMenuOpen(false);
    logout();
    navigate("/");
  }

  function initials(email) {
    return email ? email.slice(0, 2).toUpperCase() : "?";
  }

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link
          to="/"
          className="topbar__brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="topbar__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18V7.5h4a3.25 3.25 0 0 1 0 6.5H8.5V18H6Z"
                fill="url(#brand-grad)"
              />
              <circle cx="16.4" cy="15.6" r="2.1" fill="#22d3ee" />
              <defs>
                <linearGradient id="brand-grad" x1="6" y1="7" x2="12" y2="18">
                  <stop stopColor="#818cf8" />
                  <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          Interview<span className="topbar__brand-accent">AI</span>
        </Link>

        <nav className={`topbar__nav ${menuOpen ? "topbar__nav--open" : ""}`}>
          {LINKS.map((link) =>
            link.to.includes("#") ? (
              <a
                key={link.label}
                href={link.to}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.to}
                className={
                  location.pathname === link.to && link.to !== "/#how-it-works"
                    ? "active"
                    : ""
                }
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="topbar__actions">
          <button
            className="topbar__theme-toggle"
            onClick={handleToggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path
                  d="M12 2.5v2.4m0 14.2v2.4M2.5 12h2.4m14.2 0h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M20.6 14.2A8.8 8.8 0 0 1 9.8 3.4a8.8 8.8 0 1 0 10.8 10.8Z"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          <Link
            to="/setup"
            className="btn btn--primary btn--sm topbar__cta-desktop"
          >
            Start an interview
          </Link>

          {isAuthenticated ? (
            <div className="topbar__account">
              <button
                className="topbar__avatar"
                aria-label="Account menu"
                onClick={() => setAccountOpen((v) => !v)}
              >
                {initials(user?.email)}
              </button>
              {accountOpen && (
                <div className="topbar__account-menu">
                  <div className="topbar__account-email">{user?.email}</div>
                  <button type="button" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn--ghost btn--sm topbar__signin">
              Sign in
            </Link>
          )}

          <button
            className="topbar__burger"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
