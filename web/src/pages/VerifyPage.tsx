import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CustomData } from "../lib/api";

function niceKey(key: string) {
  return key
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function VerifyPage() {
  const { certId } = useParams();
  const [data, setData] = useState<{
    id: string;
    student_name: string;
    custom_data: CustomData;
    issued_at: string;
    png_url: string | null;
    pdf_url: string | null;
    assets_available: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certId) return;
    api
      .verify(certId)
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "We could not find this certificate.",
        ),
      );
  }, [certId]);

  if (error) {
    return (
      <section className="panel verify-card">
        <h2>Certificate not available</h2>
        <p className="lede">{error}</p>
        <p className="muted">
          In this version, certificates are downloaded as a zip and are not kept online for later viewing.
        </p>
        <Link className="btn btn-secondary" to="/">
          Design a certificate
        </Link>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="panel verify-card">
        <h2>Checking…</h2>
        <p className="lede">Looking up this certificate.</p>
      </section>
    );
  }

  const details = Object.entries(data.custom_data).filter(
    ([k, v]) => v && k !== "student_name",
  );

  return (
    <section className="panel verify-card">
      <h2>{data.assets_available ? "This certificate is valid" : "Record found"}</h2>
      <p className="lede">
        {data.student_name}
        {data.issued_at
          ? ` · ${new Date(data.issued_at).toLocaleDateString()}`
          : ""}
      </p>
      {data.message && <p className="muted">{data.message}</p>}
      {data.assets_available && data.png_url && data.pdf_url ? (
        <>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <a className="btn btn-primary" href={data.png_url} target="_blank" rel="noreferrer">
              View image
            </a>
            <a className="btn btn-secondary" href={data.pdf_url} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          </div>
          <img src={data.png_url} alt={`Certificate for ${data.student_name}`} />
        </>
      ) : (
        <p className="muted">
          The file was only available in the zip download at generation time.
        </p>
      )}
      {details.length > 0 && (
        <table className="table" style={{ marginTop: "1.25rem", textAlign: "left" }}>
          <tbody>
            {details.map(([k, v]) => (
              <tr key={k}>
                <th>{niceKey(k)}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
