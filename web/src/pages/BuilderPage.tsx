import { useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CanvasEditor, fieldLabel } from "../components/CanvasEditor";
import { api, type FieldConfig } from "../lib/api";
import { normalizeBackgroundImage, readImageSize } from "../lib/image";

const STANDARD_FIELDS: Array<{ key: string; label: string; optional?: boolean }> = [
  { key: "student_name", label: "Student name" },
  { key: "issue_date", label: "Issue date", optional: true },
  { key: "cert_id", label: "Certificate ID", optional: true },
];

function defaultFontSize(key: string): number {
  if (key === "student_name") return 72;
  if (key === "issue_date") return 36;
  if (key === "cert_id") return 26;
  return 40;
}

function defaultField(key: string, label: string, index: number): FieldConfig {
  const fontSize = defaultFontSize(key);
  return {
    key,
    label,
    x: 600,
    y: 340 + index * 90,
    fontSize,
    fontColor: "#0b0b0b",
    textAlign: "center",
    fontWeight: key === "student_name" ? "bold" : "normal",
  };
}

function emptyValues(fields: FieldConfig[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) values[field.key] = "";
  return values;
}

export function BuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("Course Completion Certificate");
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(850);
  const [fields, setFields] = useState<FieldConfig[]>(
    STANDARD_FIELDS.map((f, i) => defaultField(f.key, f.label, i)),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    emptyValues(STANDARD_FIELDS.map((f, i) => defaultField(f.key, f.label, i))),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>("student_name");
  const [globalColor, setGlobalColor] = useState("#0b0b0b");
  const [customLabel, setCustomLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    count: number;
    filename: string;
    elapsed_ms: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<File | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl = localPreviewUrl || backgroundUrl;
  const hasBackground = Boolean(localPreviewUrl || backgroundKey);
  const studentName = (values.student_name || "").trim();

  function updateField(key: string, patch: Partial<FieldConfig>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSelectedKey(key);
  }

  function applyGlobalColor(color: string) {
    setGlobalColor(color);
    setFields((prev) => prev.map((f) => ({ ...f, fontColor: color })));
  }

  function bumpAllSizes(delta: number) {
    setFields((prev) =>
      prev.map((f) => ({
        ...f,
        fontSize: Math.max(18, Math.min(140, f.fontSize + delta)),
      })),
    );
  }

  async function uploadBackgroundFile(file: File): Promise<string> {
    const res = await api.uploadBackground(file);
    setBackgroundKey(res.background_r2_key);
    setBackgroundUrl(res.background_url);
    return res.background_r2_key;
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    setStatus("Preparing image…");
    let normalized: File;
    try {
      normalized = await normalizeBackgroundImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this image");
      setStatus(null);
      return;
    }
    bgFileRef.current = normalized;
    setBgFileName(normalized.name);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objectUrl = URL.createObjectURL(normalized);
    setLocalPreviewUrl(objectUrl);
    try {
      const dims = await readImageSize(normalized);
      setWidth(dims.width);
      setHeight(dims.height);
    } catch {
      // keep defaults; preview still uses the file
    }
    setStatus("Uploading background…");
    setUploading(true);
    try {
      await uploadBackgroundFile(normalized);
      setStatus("Background ready. Type in the fields — the preview updates as you type.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus(
        "Preview ready. Fill in the student name — we'll upload the background when you download.",
      );
    } finally {
      setUploading(false);
    }
  }

  function openBackgroundPicker() {
    fileInputRef.current?.click();
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!hasBackground) {
      openBackgroundPicker();
      return;
    }
    document.getElementById("val-student_name")?.focus();
  }

  function addCustomField() {
    const label = customLabel.trim();
    if (!label) return;
    const key = label.replace(/\s+/g, "_").toLowerCase();
    if (fields.some((f) => f.key === key)) {
      setError(`Field "${label}" already exists`);
      return;
    }
    const next = defaultField(key, label, fields.length);
    next.fontColor = globalColor;
    setFields((prev) => [...prev, next]);
    setValues((prev) => ({ ...prev, [key]: "" }));
    setSelectedKey(key);
    setCustomLabel("");
    setError(null);
  }

  async function ensureBackgroundUploaded(): Promise<string> {
    if (backgroundKey) return backgroundKey;
    const file = bgFileRef.current;
    if (!file) throw new Error("Choose a background image first");
    setUploading(true);
    try {
      return await uploadBackgroundFile(file);
    } finally {
      setUploading(false);
    }
  }

  async function ensureTemplate(): Promise<string> {
    const key = await ensureBackgroundUploaded();
    const tpl = await api.createTemplate({
      title,
      background_r2_key: key,
      fields_config: fields,
      width,
      height,
    });
    return tpl.id;
  }

  async function createOneCertificate() {
    if (!hasBackground) {
      setError("Choose a background image first");
      openBackgroundPicker();
      return;
    }
    if (!studentName) {
      setError("Enter the student name to create a certificate");
      setSelectedKey("student_name");
      document.getElementById("val-student_name")?.focus();
      return;
    }
    setGenerating(true);
    setError(null);
    setStatus("Saving layout and rendering certificate…");
    try {
      const templateId = await ensureTemplate();
      const custom_data: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (key === "student_name") continue;
        if (value.trim()) custom_data[key] = value.trim();
      }
      const zip = await api.generateSingle({
        template_id: templateId,
        student_name: studentName,
        custom_data,
      });
      setResult({
        count: zip.count,
        filename: zip.filename,
        elapsed_ms: zip.elapsed_ms,
      });
      setStatus(`Download started: ${zip.filename}. We do not keep a copy on our servers.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus(null);
    } finally {
      setGenerating(false);
    }
  }

  async function goBulkCsv() {
    if (!hasBackground) {
      setError("Choose a background image first");
      openBackgroundPicker();
      return;
    }
    setSaving(true);
    setError(null);
    setStatus("Saving template for bulk CSV…");
    try {
      const templateId = await ensureTemplate();
      navigate(`/batch/${templateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template");
      setStatus(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel designer-panel">
      <h2>Design a certificate</h2>
      <p className="lede">
        Upload a background image, place the text, and type sample details to preview.
        When it looks right, download one certificate or make many from a CSV list.
      </p>

      <div className="designer-setup">
        <div className="field">
          <label htmlFor="title">Name of this design</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onTitleKeyDown}
            placeholder="e.g. Linux in AI Systems"
          />
        </div>
        <div className="field">
          <label htmlFor="bg">Background image (max 10MB)</label>
          <div className="file-picker">
            <input
              id="bg"
              ref={fileInputRef}
              className="file-input-hidden"
              type="file"
              accept="image/*"
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
            <button type="button" className="btn btn-secondary" onClick={openBackgroundPicker}>
              {bgFileName ? "Change image" : "Choose image"}
            </button>
            <span className="file-picker-name" title={bgFileName ?? undefined}>
              {bgFileName ?? "No file chosen"}
            </span>
          </div>
        </div>
      </div>

      <div className="preview-label">Preview</div>
      <CanvasEditor
        width={width}
        height={height}
        backgroundUrl={previewUrl}
        fields={fields}
        values={values}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onChangeField={updateField}
      />
      <p className="muted preview-hint">
        Drag text on the preview to place it. Fill in the details below to see them appear.
      </p>

      <div className="designer-controls">
        <div className="designer-toolbar" role="group" aria-label="Text for all fields">
          <span className="toolbar-label">All text</span>
          <label className="toolbar-control" htmlFor="globalColor">
            <span>Colour</span>
            <input
              id="globalColor"
              type="color"
              value={globalColor}
              onChange={(e) => applyGlobalColor(e.target.value)}
            />
          </label>
          <div className="toolbar-divider" aria-hidden="true" />
          <div className="toolbar-control toolbar-sizes">
            <span>Size</span>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => bumpAllSizes(-8)}
              aria-label="Make all text smaller"
            >
              −
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => bumpAllSizes(8)}
              aria-label="Make all text larger"
            >
              +
            </button>
          </div>
        </div>

        <div className="field-stack">
          {fields.map((f) => {
            const isStandard = STANDARD_FIELDS.some((s) => s.key === f.key);
            const optional = STANDARD_FIELDS.find((s) => s.key === f.key)?.optional;
            const active = selectedKey === f.key;
            return (
              <div
                key={f.key}
                className={`field-row ${active ? "is-active" : ""}`}
                onClick={() => setSelectedKey(f.key)}
              >
                <div className="field-row-top">
                  <label htmlFor={`val-${f.key}`}>
                    {fieldLabel(f.key, f.label)}
                    {optional ? <span className="optional-tag">Optional</span> : null}
                  </label>
                  {!isStandard && (
                    <button
                      type="button"
                      className="linkish"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFields((prev) => prev.filter((x) => x.key !== f.key));
                        setValues((prev) => {
                          const next = { ...prev };
                          delete next[f.key];
                          return next;
                        });
                        setSelectedKey(null);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  id={`val-${f.key}`}
                  placeholder={
                    f.key === "cert_id"
                      ? "Only if you want an ID printed"
                      : f.key === "issue_date"
                        ? "e.g. 11 Aug 2026"
                        : `Enter ${fieldLabel(f.key, f.label).toLowerCase()}`
                  }
                  value={values[f.key] || ""}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  onFocus={() => setSelectedKey(f.key)}
                />
                {active && (
                  <div className="field-row-style" onClick={(e) => e.stopPropagation()}>
                    <label className="style-chip">
                      <span>Size</span>
                      <input
                        type="number"
                        min={18}
                        max={140}
                        value={f.fontSize}
                        onChange={(e) =>
                          updateField(f.key, { fontSize: Number(e.target.value) || 18 })
                        }
                      />
                    </label>
                    <label className="style-chip">
                      <span>Colour</span>
                      <input
                        type="color"
                        value={f.fontColor}
                        onChange={(e) => updateField(f.key, { fontColor: e.target.value })}
                      />
                    </label>
                    <label className="style-chip style-chip-grow">
                      <span>Align</span>
                      <select
                        value={f.textAlign}
                        onChange={(e) =>
                          updateField(f.key, {
                            textAlign: e.target.value as FieldConfig["textAlign"],
                          })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="field-add-bar">
          <input
            id="customLabel"
            placeholder="Add another field, e.g. Course name"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustomField();
            }}
            aria-label="New field name"
          />
          <button type="button" className="btn btn-secondary" onClick={addCustomField}>
            Add field
          </button>
        </div>

        <div className="designer-footer">
          <div>
            <h3 className="side-title">Ready to create?</h3>
            <p className="muted">
              {!hasBackground
                ? "Choose a background image to get started."
                : !studentName
                  ? "Enter the student name. Other fields are optional."
                  : uploading
                    ? "Uploading background…"
                    : "Download one certificate now, or save this design for a CSV batch."}
            </p>
          </div>
          <div className="issue-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={generating || uploading}
              onClick={() => void createOneCertificate()}
            >
              {generating ? "Creating…" : "Download certificate"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving || uploading}
              onClick={() => void goBulkCsv()}
            >
              {saving ? "Saving…" : "Make many from a list"}
            </button>
          </div>
        </div>
      </div>

      {status && <div className="status">{status}</div>}
      {error && <div className="status error">{error}</div>}

      {result && (
        <div className="result-card">
          <h3>Download ready</h3>
          <p className="muted">
            Your certificate zip ({result.filename}) should have downloaded.
            Files are not stored on our servers after generation.
          </p>
        </div>
      )}
    </section>
  );
}
