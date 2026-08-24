import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="footer__logo">Interview<span>AI</span></span>
          <p>
            An adaptive interviewer that recalibrates after every answer —
            powered entirely by open-source models running locally.
          </p>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Product</span>
          <Link to="/">Home</Link>
          <Link to="/setup">Start an interview</Link>
          <a href="/#how-it-works">How it works</a>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Under the hood</span>
          <span>FastAPI · SQLite</span>
          <span>Ollama · Qwen 2.5</span>
          <span>React · Vite</span>
        </div>
      </div>

      <div className="container footer__bottom">
        <span>© {new Date().getFullYear()} InterviewAI — adaptive interview engine.</span>
        <span className="mono">v2.0 · local-first · no data leaves this machine</span>
      </div>
    </footer>
  );
}
