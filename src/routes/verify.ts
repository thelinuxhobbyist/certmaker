import type { Context } from "hono";
import type { CertificateRecord, CustomData } from "../lib/types";
import type { AppVariables } from "../lib/auth";

type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

/**
 * Public verify endpoint kept for future retained certificates.
 * Phase 1 ephemeral certs have no PNG/PDF in R2.
 */
export async function verifyCertificate(c: Context<AppEnv>) {
  const certId = c.req.param("cert_id");
  const row = await c.env.DB.prepare(
    `SELECT id, template_id, student_name, custom_data, png_r2_key, pdf_r2_key, issued_at, user_id, storage_policy
     FROM issued_certificates WHERE id = ?`,
  )
    .bind(certId)
    .first<CertificateRecord & { storage_policy?: string }>();

  if (!row) {
    return c.json(
      {
        error: "Certificate not found",
        detail:
          "Phase 1 downloads certificates as a zip and does not keep files on our servers.",
      },
      404,
    );
  }

  const custom = row.custom_data
    ? (JSON.parse(row.custom_data) as CustomData)
    : {};

  const hasAssets = Boolean(row.png_r2_key && row.pdf_r2_key);

  return c.json({
    id: row.id,
    template_id: row.template_id,
    student_name: row.student_name,
    custom_data: custom,
    issued_at: row.issued_at,
    storage_policy: row.storage_policy || "ephemeral",
    assets_available: hasAssets,
    png_url: hasAssets ? `/api/assets/${row.png_r2_key}` : null,
    pdf_url: hasAssets ? `/api/assets/${row.pdf_r2_key}` : null,
    message: hasAssets
      ? undefined
      : "This certificate was generated for immediate download and is not stored as a file.",
  });
}
