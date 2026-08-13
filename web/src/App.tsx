import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BuilderPage } from "./pages/BuilderPage";
import { BatchPage } from "./pages/BatchPage";
import { VerifyPage } from "./pages/VerifyPage";

export function App() {
  const location = useLocation();
  const designActive =
    location.pathname === "/" || location.pathname.startsWith("/builder");

  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          The Cert Maker
        </Link>
        <nav className="nav-links" aria-label="Main">
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

      <footer className="site-footer">
        The Cert Maker — design once, make hundreds.
      </footer>
    </div>
  );
}
