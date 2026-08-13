import { Link, NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { BuilderPage } from "./pages/BuilderPage";
import { BatchPage } from "./pages/BatchPage";
import { VerifyPage } from "./pages/VerifyPage";

export function App() {
  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          The Cert Maker
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/builder" className={({ isActive }) => (isActive ? "active" : "")}>
            Design
          </NavLink>
          <NavLink to="/batch" className={({ isActive }) => (isActive ? "active" : "")}>
            Make many
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/batch/:templateId" element={<BatchPage />} />
          <Route path="/verify/:certId" element={<VerifyPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <Link to="/" className="footer-brand">
            The Cert Maker
          </Link>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/builder">Design a certificate</Link>
            <Link to="/batch">Make many from a list</Link>
          </nav>
          <p className="footer-note">Design once, make hundreds.</p>
        </div>
      </footer>
    </div>
  );
}
