import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BuilderPage } from "./pages/BuilderPage";
import { BatchPage } from "./pages/BatchPage";
import { VerifyPage } from "./pages/VerifyPage";

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const designActive =
    location.pathname === "/" || location.pathname.startsWith("/builder");

  function goHome(event: { preventDefault: () => void }) {
    event.preventDefault();
    navigate("/", { state: { home: true, n: Date.now() } });
  }

  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand" onClick={goHome}>
          The Cert Maker
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" className={() => undefined} end onClick={goHome}>
            Home
          </NavLink>
          <NavLink to="/" className={() => (designActive ? "active" : "")} end>
            Design
          </NavLink>
          <NavLink to="/batch" className={({ isActive }) => (isActive ? "active" : "")}>
            Make many
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<BuilderPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/batch/:templateId" element={<BatchPage />} />
          <Route path="/verify/:certId" element={<VerifyPage />} />
        </Routes>
      </main>

      <footer className="site-footer">The Cert Maker</footer>
    </div>
  );
}
