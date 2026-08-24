import { Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar.jsx";
import Landing from "./pages/Landing.jsx";
import Setup from "./pages/Setup.jsx";
import Interview from "./pages/Interview.jsx";
import Results from "./pages/Results.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <TopBar status="v1.0 · adaptive interview engine" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/interview/:sessionId" element={<Interview />} />
        <Route path="/results/:sessionId" element={<Results />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
