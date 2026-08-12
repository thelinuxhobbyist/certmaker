import type { Context } from "hono";
import type { FieldConfig, TemplateRecord } from "../lib/types";
import { createId } from "../lib/ids";
import { dbUserId, type AppVariables } from "../lib/auth";

type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

const MAX_BG_BYTES = 10 * 1024 * 1024;

const BACKGROUND_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function resolveBackgroundMime(file: File): string | null {
  const type = file.type.toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (Object.values(BACKGROUND_MIME_BY_EXT).includes(type)) return type;

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && BACKGROUND_MIME_BY_EXT[ext]) return BACKGROUND_MIME_BY_EXT[ext];

  return null;
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export async function listTemplates(c: Context<AppEnv>) {
  const userId = dbUserId(c.get("userId"));
  // Phase 1: show anonymous templates; when auth lands, filter by user_id.
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, background_r2_key, fields_config, width, height, created_at, user_id
     FROM templates
     WHERE user_id = ? OR user_id = 'anonymous'
     ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<TemplateRecord>();

  return c.json({
    templates: (results ?? []).map((t) => ({
      ...t,
      fields_config: JSON.parse(t.fields_config) as FieldConfig[],
      background_url: `/api/assets/${t.background_r2_key}`,
    })),
  });
}

export async function getTemplate(c: Context<AppEnv>) {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, title, background_r2_key, fields_config, width, height, created_at, user_id
     FROM templates WHERE id = ?`,
  )
    .bind(id)
    .first<TemplateRecord>();

  if (!row) return c.json({ error: "Template not found" }, 404);

  return c.json({
    ...row,
    fields_config: JSON.parse(row.fields_config) as FieldConfig[],
    background_url: `/api/assets/${row.background_r2_key}`,
  });
}

async function putImageUpload(
  c: Context<AppEnv>,
  opts: { prefix: string; idPrefix: string },
) {
  const form = await c.req.parseBody();
  const file = form.file;
  const userId = dbUserId(c.get("userId"));

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Expected multipart field 'file'" }, 400);
  }

  const mime = resolveBackgroundMime(file);
  if (!mime) {
    return c.json({ error: "Image must be a PNG, JPEG, or WebP" }, 400);
  }

  if (file.size > MAX_BG_BYTES) {
    return c.json({ error: "Image must be 10MB or smaller" }, 400);
  }

  const ext = extensionForMime(mime);
  const key = `${opts.prefix}/${userId}/${createId(opts.idPrefix)}.${ext}`;
  await c.env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
  });

  return { key, url: `/api/assets/${key}` };
}

export async function uploadBackground(c: Context<AppEnv>) {
  // Backgrounds stay in R2 for the design session; generated certs do not.
  const result = await putImageUpload(c, { prefix: "backgrounds", idPrefix: "bg" });
  if (result instanceof Response) return result;
  return c.json({ background_r2_key: result.key, background_url: result.url });
}

export async function uploadLogo(c: Context<AppEnv>) {
  const result = await putImageUpload(c, { prefix: "logos", idPrefix: "logo" });
  if (result instanceof Response) return result;
  return c.json({ logo_r2_key: result.key, logo_url: result.url });
}

export async function createTemplate(c: Context<AppEnv>) {
  const body = await c.req.json<{
    title: string;
    background_r2_key: string;
    fields_config: FieldConfig[];
    width?: number;
    height?: number;
  }>();

  if (!body.title?.trim()) return c.json({ error: "title is required" }, 400);
  if (!body.background_r2_key) {
    return c.json({ error: "background_r2_key is required" }, 400);
  }
  if (!Array.isArray(body.fields_config)) {
    return c.json({ error: "fields_config must be an array" }, 400);
  }

  const id = createId("tpl");
  const width = body.width ?? 1200;
  const height = body.height ?? 850;
  const userId = dbUserId(c.get("userId"));

  await c.env.DB.prepare(
    `INSERT INTO templates (id, title, background_r2_key, fields_config, width, height, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.title.trim(),
      body.background_r2_key,
      JSON.stringify(body.fields_config),
      width,
      height,
      userId,
    )
    .run();

  return c.json(
    {
      id,
      title: body.title.trim(),
      background_r2_key: body.background_r2_key,
      fields_config: body.fields_config,
      width,
      height,
      user_id: userId,
      background_url: `/api/assets/${body.background_r2_key}`,
    },
    201,
  );
}
