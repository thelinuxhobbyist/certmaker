import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type Template } from "../lib/api";

export function HomePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTemplates()
      .then((res) => setTemplates(res.templates))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load your designs"),
      );
  }, []);

  return (
    <>
      <section className="hero">
        <h1>The Cert Maker</h1>
        <p>
          Make certificates without an account. Design once, then create one or many from a list.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/builder">
            Design a certificate
          </Link>
          <Link className="btn btn-secondary" to="/batch">
            Make many from a list
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>Your designs</h2>
        <p className="lede">Saved layouts you can reuse for one certificate or many.</p>
        {error && <div className="status error">{error}</div>}
        {!error && templates.length === 0 && (
          <p className="muted">You have not saved a design yet. Start by designing one.</p>
        )}
        <div className="template-list">
          {templates.map((t) => (
            <Link key={t.id} to={`/batch/${t.id}`}>
              <strong>{t.title}</strong>
              <span className="muted">Make many from a list</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
