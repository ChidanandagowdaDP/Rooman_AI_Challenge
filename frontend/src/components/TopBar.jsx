import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./TopBar.css";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/setup", label: "New interview" },
];

export default function TopBar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link to="/" className="topbar__brand" onClick={() => setMenuOpen(false)}>
          <span className="topbar__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18V7.5h4a3.25 3.25 0 0 1 0 6.5H8.5V18H6Z"
                fill="#4f46e5"
              />
              <circle cx="16.4" cy="15.6" r="2.1" fill="#4f46e5" opacity="0.55" />
            </svg>
          </span>
          Interview<span className="topbar__brand-accent">AI</span>
        </Link>

        <nav className={`topbar__nav ${menuOpen ? "topbar__nav--open" : ""}`}>
          {LINKS.map((link) =>
            link.to.includes("#") ? (
              <a key={link.label} href={link.to} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.to}
                className={location.pathname === link.to ? "active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <Link to="/setup" className="btn btn--primary btn--sm topbar__cta-mobile" onClick={() => setMenuOpen(false)}>
            Start an interview
          </Link>
        </nav>

        <div className="topbar__actions">
          <Link to="/setup" className="btn btn--primary btn--sm">
            Start an interview
          </Link>
          <button
            className="topbar__burger"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
