import { zipSync, strToU8 } from "fflate";
import type { CustomData } from "./types";

export type StoragePolicy = "ephemeral" | "retained_24h";

export type RenderedCertificate = {
  id: string;
  template_id: string;
  student_name: string;
  custom_data: CustomData;
  pngBytes: Uint8Array;
  pdfBytes: Uint8Array;
};

export type StoragePolicyResult = {
  policy: StoragePolicy;
  zipBytes: Uint8Array;
  filename: string;
  /** Present only when assets were retained in R2 (future logged-in path). */
  retained?: Array<{
    id: string;
    student_name: string;
    png_url: string;
    pdf_url: string;
    verify_url: string;
  }>;
};

function safeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60) || "certificate";
}

function buildZip(certificates: RenderedCertificate[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const cert of certificates) {
    let base = `${safeFilePart(cert.student_name)}_${safeFilePart(cert.id)}`;
    if (used.has(base)) base = `${base}_${used.size}`;
    used.add(base);
    files[`${base}.png`] = cert.pngBytes;
    files[`${base}.pdf`] = cert.pdfBytes;
  }

  files["README.txt"] = strToU8(
    [
      "The Cert Maker export",
      "",
      "These files were generated for immediate download.",
      "Phase 1 does not keep copies on our servers after download.",
      "",
      `Certificates in this zip: ${certificates.length}`,
    ].join("\n"),
  );

  return zipSync(files, { level: 6 });
}

/**
 * Post-generation storage policy.
 *
 * Phase 1 (anonymous / no login): never write PNG/PDF to R2; return a zip for
 * immediate download.
 *
 * Future (logged-in): branch on userId to retain assets in R2 for ~24 hours.
 * Update this function only — route handlers stay the same.
 */
export async function handleStoragePolicy(
  env: Env,
  opts: {
    userId: string | null;
    certificates: RenderedCertificate[];
  },
): Promise<StoragePolicyResult> {
  const { userId, certificates } = opts;
  if (certificates.length === 0) {
    throw new Error("No certificates to package");
  }

  const zipBytes = buildZip(certificates);
  const filename =
    certificates.length === 1
      ? `${safeFilePart(certificates[0].student_name)}.zip`
      : `certificates-${certificates.length}.zip`;

  // Logged-in retention path (hook for future auth). Not active in Phase 1.
  if (userId) {
    // Example future behavior:
    // 1) put PNG/PDF in R2 under users/{userId}/certificates/...
    // 2) insert issued_certificates with keys + storage_policy = 'retained_24h'
    // 3) schedule delete after 24h (Queues / cron)
    // For now we still return an ephemeral zip so Phase 1 stays cost-free.
    void env;
    return {
      policy: "ephemeral",
      zipBytes,
      filename,
    };
  }

  // Anonymous Phase 1: bypass R2 entirely for generated assets.
  return {
    policy: "ephemeral",
    zipBytes,
    filename,
  };
}

/**
 * Optional lightweight issuance log without asset retention.
 * Useful later for analytics; safe for Phase 1 because no R2 keys are stored.
 */
export async function logEphemeralIssuance(
  db: D1Database,
  opts: {
    userId: string;
    certificates: RenderedCertificate[];
  },
): Promise<void> {
  if (opts.certificates.length === 0) return;

  const statements = opts.certificates.map((cert) =>
    db
      .prepare(
        `INSERT INTO issued_certificates
         (id, template_id, user_id, student_name, custom_data, png_r2_key, pdf_r2_key, storage_policy)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, 'ephemeral')`,
      )
      .bind(
        cert.id,
        cert.template_id,
        opts.userId,
        cert.student_name,
        JSON.stringify(cert.custom_data),
      ),
  );

  await db.batch(statements);
}
