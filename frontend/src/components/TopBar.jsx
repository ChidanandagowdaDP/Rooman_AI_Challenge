import { Link } from "react-router-dom";
import "./TopBar.css";

export default function TopBar({ status }) {
  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link to="/" className="topbar__brand">
          <span className="topbar__mark" aria-hidden="true" />
          InterviewAI
        </Link>
        {status && <span className="topbar__status mono">{status}</span>}
      </div>
    </header>
  );
}
