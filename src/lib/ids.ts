export function createId(prefix = "id"): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `${prefix}-${rand}`;
}

/** Printable unique certificate id. 64 bits of entropy via crypto.getRandomValues. */
export function createCertId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `CERT-${hex.toUpperCase()}`;
}

/**
 * Pick unique issued_certificates.id values.
 * Uses a requested id only when it is unused in this batch and not already in D1.
 */
export async function allocateCertIds(
  db: D1Database,
  requested: Array<string | undefined | null>,
): Promise<string[]> {
  const used = new Set<string>();
  const wanted = requested
    .map((value) => (value || "").trim())
    .filter(Boolean);
  const uniqueWanted = [...new Set(wanted)];

  const existing = new Set<string>();
  if (uniqueWanted.length > 0) {
    const placeholders = uniqueWanted.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT id FROM issued_certificates WHERE id IN (${placeholders})`,
      )
      .bind(...uniqueWanted)
      .all<{ id: string }>();
    for (const row of rows.results || []) existing.add(row.id);
  }

  return requested.map((value) => {
    const candidate = (value || "").trim();
    if (candidate && !used.has(candidate) && !existing.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let id = createCertId();
    while (used.has(id) || existing.has(id)) id = createCertId();
    used.add(id);
    return id;
  });
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
