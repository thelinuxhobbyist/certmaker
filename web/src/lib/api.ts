export type TextAlign = "left" | "center" | "right";
export type FieldType = "text" | "image";

export interface FieldConfig {
  key: string;
  label?: string;
  type?: FieldType;
  static?: boolean;
  defaultValue?: string;
  x: number;
  y: number;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  textAlign?: TextAlign;
  fontWeight?: "normal" | "bold";
  multiline?: boolean;
  maxWidth?: number;
  image_r2_key?: string;
  width?: number;
  height?: number;
}

export interface Template {
  id: string;
  title: string;
  background_r2_key: string;
  background_url: string;
  fields_config: FieldConfig[];
  width: number;
  height: number;
  created_at?: string;
  user_id?: string;
}

export type CustomData = Record<string, string>;

export type ZipDownloadResult = {
  count: number;
  failed: number;
  elapsed_ms: number;
  filename: string;
  policy: string;
};

export function isTextField(field: FieldConfig): boolean {
  return (field.type ?? "text") === "text";
}

export function isImageField(field: FieldConfig): boolean {
  return field.type === "image";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

function filenameFromDisposition(header: string | null): string {
  if (!header) return "certificates.zip";
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] || "certificates.zip";
}

async function downloadZip(path: string, body: unknown): Promise<ZipDownloadResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || res.statusText);
  }

  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition"));
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return {
    count: Number(res.headers.get("X-Certify-Count") || 0),
    failed: Number(res.headers.get("X-Certify-Failed") || 0),
    elapsed_ms: Number(res.headers.get("X-Certify-Elapsed-Ms") || 0),
    filename,
    policy: res.headers.get("X-Certify-Policy") || "ephemeral",
  };
}

export const api = {
  listTemplates: () => requestJson<{ templates: Template[] }>("/api/templates"),
  getTemplate: (id: string) => requestJson<Template>(`/api/templates/${id}`),
  uploadBackground: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestJson<{ background_r2_key: string; background_url: string }>(
      "/api/templates/upload-bg",
      { method: "POST", body: form },
    );
  },
  uploadLogo: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestJson<{ logo_r2_key: string; logo_url: string }>(
      "/api/templates/upload-logo",
      { method: "POST", body: form },
    );
  },
  createTemplate: (body: {
    title: string;
    background_r2_key: string;
    fields_config: FieldConfig[];
    width: number;
    height: number;
  }) =>
    requestJson<Template>("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  generateSingle: (body: {
    template_id: string;
    student_name: string;
    custom_data?: CustomData;
  }) => downloadZip("/api/certificates/generate-single", body),
  generateBatch: (body: {
    template_id: string;
    rows: Array<{ student_name: string; custom_data?: CustomData }>;
  }) => downloadZip("/api/certificates/batch", body),
  verify: (certId: string) =>
    requestJson<{
      id: string;
      student_name: string;
      custom_data: CustomData;
      issued_at: string;
      png_url: string | null;
      pdf_url: string | null;
      assets_available: boolean;
      storage_policy?: string;
      message?: string;
    }>(`/api/verify/${certId}`),
};
