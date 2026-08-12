import type { Context } from "hono";
import {
  arrayBufferToDataUrl,
  buildCertificateSvg,
  pngToPdf,
  renderPngFromSvg,
} from "../lib/render";
import { createCertId } from "../lib/ids";
import { dbUserId, type AppVariables } from "../lib/auth";
import {
  handleStoragePolicy,
  logEphemeralIssuance,
  type RenderedCertificate,
} from "../lib/storagePolicy";
import type { CustomData, FieldConfig, TemplateRecord } from "../lib/types";

type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

interface GenerateInput {
  template_id: string;
  student_name: string;
  custom_data?: CustomData;
}

async function loadTemplate(
  db: D1Database,
  id: string,
): Promise<TemplateRecord | null> {
  return db
    .prepare(
      `SELECT id, title, background_r2_key, fields_config, width, height, created_at, user_id
       FROM templates WHERE id = ?`,
    )
    .bind(id)
    .first<TemplateRecord>();
}

async function renderCertificate(
  env: Env,
  template: TemplateRecord,
  studentName: string,
  customData: CustomData,
): Promise<RenderedCertificate> {
  const bgObj = await env.BUCKET.get(template.background_r2_key);
  if (!bgObj) throw new Error("Background image missing from storage");

  const bgBuf = await bgObj.arrayBuffer();
  const contentType = bgObj.httpMetadata?.contentType || "image/png";
  const backgroundDataUrl = arrayBufferToDataUrl(bgBuf, contentType);

  const fields = JSON.parse(template.fields_config) as FieldConfig[];
  const providedCertId = (customData.cert_id || "").trim();
  const recordId = providedCertId || createCertId();

  const data: CustomData = {
    ...customData,
    student_name: studentName,
  };
  if (providedCertId) {
    data.cert_id = providedCertId;
  } else {
    delete data.cert_id;
  }

  const svg = buildCertificateSvg({
    width: template.width,
    height: template.height,
    backgroundDataUrl,
    fields,
    data,
  });

  const pngBytes = await renderPngFromSvg(svg);
  const pdfBytes = await pngToPdf(pngBytes, template.width, template.height);

  return {
    id: recordId,
    template_id: template.id,
    student_name: studentName,
    custom_data: data,
    pngBytes,
    pdfBytes,
  };
}

function zipResponse(
  c: Context<AppEnv>,
  opts: {
    zipBytes: Uint8Array;
    filename: string;
    policy: string;
    count: number;
    failed: number;
    elapsed_ms: number;
  },
) {
  const bytes = opts.zipBytes;
  return c.body(bytes, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${opts.filename}"`,
    "X-Certify-Policy": opts.policy,
    "X-Certify-Count": String(opts.count),
    "X-Certify-Failed": String(opts.failed),
    "X-Certify-Elapsed-Ms": String(opts.elapsed_ms),
    "Cache-Control": "no-store",
  });
}

export async function generateSingle(c: Context<AppEnv>) {
  const body = await c.req.json<GenerateInput>();
  if (!body.template_id) return c.json({ error: "template_id is required" }, 400);
  if (!body.student_name?.trim()) {
    return c.json({ error: "student_name is required" }, 400);
  }

  const template = await loadTemplate(c.env.DB, body.template_id);
  if (!template) return c.json({ error: "Template not found" }, 404);

  const userId = c.get("userId");
  const started = Date.now();

  try {
    const rendered = await renderCertificate(
      c.env,
      template,
      body.student_name.trim(),
      body.custom_data || {},
    );

    const stored = await handleStoragePolicy(c.env, {
      userId,
      certificates: [rendered],
    });

    // Metadata-only log (no R2 asset keys in Phase 1 ephemeral mode)
    await logEphemeralIssuance(c.env.DB, {
      userId: dbUserId(userId),
      certificates: [rendered],
    });

    return zipResponse(c, {
      zipBytes: stored.zipBytes,
      filename: stored.filename,
      policy: stored.policy,
      count: 1,
      failed: 0,
      elapsed_ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return c.json({ error: message }, 500);
  }
}

export async function generateBatch(c: Context<AppEnv>) {
  const body = await c.req.json<{
    template_id: string;
    rows: Array<{ student_name: string; custom_data?: CustomData }>;
  }>();

  if (!body.template_id) return c.json({ error: "template_id is required" }, 400);
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return c.json({ error: "rows must be a non-empty array" }, 400);
  }
  if (body.rows.length > 100) {
    return c.json({ error: "Maximum 100 rows per batch" }, 400);
  }

  const template = await loadTemplate(c.env.DB, body.template_id);
  if (!template) return c.json({ error: "Template not found" }, 404);

  const userId = c.get("userId");
  const started = Date.now();

  const settled = await Promise.all(
    body.rows.map(async (row) => {
      try {
        if (!row.student_name?.trim()) {
          return { ok: false as const, error: "student_name is required" };
        }
        const rendered = await renderCertificate(
          c.env,
          template,
          row.student_name.trim(),
          row.custom_data || {},
        );
        return { ok: true as const, rendered };
      } catch (err) {
        return {
          ok: false as const,
          student_name: row.student_name,
          error: err instanceof Error ? err.message : "Generation failed",
        };
      }
    }),
  );

  const rendered = settled
    .filter((r): r is { ok: true; rendered: RenderedCertificate } => r.ok)
    .map((r) => r.rendered);
  const errors = settled.filter((r) => !r.ok);
  const failed = errors.length;

  if (rendered.length === 0) {
    return c.json(
      {
        error: "No certificates could be generated",
        errors,
      },
      400,
    );
  }

  try {
    const stored = await handleStoragePolicy(c.env, {
      userId,
      certificates: rendered,
    });

    await logEphemeralIssuance(c.env.DB, {
      userId: dbUserId(userId),
      certificates: rendered,
    });

    return zipResponse(c, {
      zipBytes: stored.zipBytes,
      filename: stored.filename,
      policy: stored.policy,
      count: rendered.length,
      failed,
      elapsed_ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Packaging failed";
    return c.json({ error: message }, 500);
  }
}
