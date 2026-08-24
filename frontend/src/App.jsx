import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar.jsx";
import Footer from "./components/Footer.jsx";
import Landing from "./pages/Landing.jsx";
import Setup from "./pages/Setup.jsx";
import Interview from "./pages/Interview.jsx";
import Results from "./pages/Results.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./auth.jsx";

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/setup"
          element={
            <RequireAuth>
              <Setup />
            </RequireAuth>
          }
        />
        <Route
          path="/interview/:sessionId"
          element={
            <RequireAuth>
              <Interview />
            </RequireAuth>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <RequireAuth>
              <Results />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Footer />
    </div>
  );
}
