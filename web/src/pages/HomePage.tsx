import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MiniCert } from "../components/MiniCert";
import { api, type Template } from "../lib/api";
import { featuredStarters } from "../lib/starterTemplates";

export function HomePage() {
  const [saved, setSaved] = useState<Template[]>([]);

  useEffect(() => {
    api
      .listTemplates()
      .then((res) => setSaved(res.templates))
      .catch(() => setSaved([]));
  }, []);

  const featured = featuredStarters();

  return (
    <div className="home">
      <section className="home-hero">
        <p className="home-eyebrow">No account · no signup</p>
        <h1>The Cert Maker</h1>
        <p className="home-lead">
          Design a certificate once, then make one — or a whole class — from a list.
          Download immediately. We don&apos;t keep the files.
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

      <section className="home-steps" aria-label="How it works">
        <div className="home-step">
          <span className="home-step-num">1</span>
          <h2>Pick a design</h2>
          <p>Start from a template, or upload your own background.</p>
        </div>
        <div className="home-step">
          <span className="home-step-num">2</span>
          <h2>Place the words</h2>
          <p>Drag titles, names, and dates on the preview until it looks right.</p>
        </div>
        <div className="home-step">
          <span className="home-step-num">3</span>
          <h2>Make one or many</h2>
          <p>Download a single certificate, or fill a spreadsheet for the whole class.</p>
        </div>
      </section>

      <section className="home-designs">
        <div className="home-section-head">
          <div>
            <h2>Start from a design</h2>
            <p className="muted">Four to begin with. Ten slots in total — you can change everything in the editor.</p>
          </div>
          <Link className="see-all-link" to="/builder">
            See all designs →
          </Link>
        </div>
        <div className="template-grid home-template-grid">
          {featured.map((starter) => (
            <Link
              key={starter.id}
              className="template-card home-template-card"
              to={`/builder?tpl=${starter.id}`}
            >
              <MiniCert starter={starter} />
              <div className="template-name">{starter.name}</div>
              <div className="template-tag">{starter.tag}</div>
            </Link>
          ))}
        </div>
      </section>

      {saved.length > 0 && (
        <section className="home-saved">
          <h2>Your saved designs</h2>
          <p className="muted">Reuse a layout for one certificate or many from a list.</p>
          <div className="saved-list">
            {saved.map((t) => (
              <Link key={t.id} className="saved-card" to={`/batch/${t.id}`}>
                <img src={t.background_url} alt="" />
                <span>{t.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
