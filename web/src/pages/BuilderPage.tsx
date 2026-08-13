import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CanvasEditor, fieldLabel } from "../components/CanvasEditor";
import { DateOrderToggle } from "../components/DateOrderToggle";
import { TemplateChooser } from "../components/TemplateChooser";
import {
  api,
  isImageField,
  isTextField,
  type FieldConfig,
  type Template,
} from "../lib/api";
import {
  CERT_FONTS,
  DEFAULT_FONT_FAMILY,
  TITLE_FONT_FAMILY,
  ensureCertFontsLoaded,
} from "../lib/fonts";
import { normalizeBackgroundImage, readImageSize } from "../lib/image";
import {
  dateHelpText,
  datePlaceholder,
  issueDateError,
  loadDateOrder,
  normalizeIssueDate,
  saveDateOrder,
  type DateOrder,
} from "../lib/issueDate";
import { resolveStarterBackgroundFile } from "../lib/starterBackground";
import {
  STARTER_CANVAS,
  getStarterTemplate,
  type StarterTemplate,
} from "../lib/starterTemplates";

const STANDARD_FIELDS: Array<{
  key: string;
  label: string;
  optional?: boolean;
  static?: boolean;
  defaultValue?: string;
}> = [
  {
    key: "cert_title",
    label: "Certificate title",
    static: true,
    defaultValue: "Certificate of Achievement",
  },
  { key: "student_name", label: "Student name" },
  { key: "issue_date", label: "Issue date", optional: true },
  { key: "cert_id", label: "Certificate ID", optional: true },
];

function defaultFontSize(key: string): number {
  if (key === "cert_title") return 56;
  if (key === "student_name") return 64;
  if (key === "issue_date") return 28;
  if (key === "cert_id") return 22;
  return 40;
}

function defaultFontFamily(key: string): string {
  if (key === "cert_title") return TITLE_FONT_FAMILY;
  if (key === "student_name") return "Cormorant Garamond Light";
  return DEFAULT_FONT_FAMILY;
}

function defaultField(
  key: string,
  label: string,
  index: number,
  extras?: Partial<FieldConfig>,
): FieldConfig {
  const fontSize = defaultFontSize(key);
  return {
    key,
    label,
    type: "text",
    x: 600,
    y: key === "cert_title" ? 220 : 340 + Math.max(0, index - 1) * 90,
    fontSize,
    fontColor: "#171717",
    fontFamily: defaultFontFamily(key),
    textAlign: "center",
    fontWeight: key === "student_name" || key === "cert_title" ? "bold" : "normal",
    ...extras,
  };
}

function emptyValues(fields: FieldConfig[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (!isTextField(field)) continue;
    values[field.key] = field.defaultValue || "";
  }
  return values;
}

function initialFields(): FieldConfig[] {
  return STANDARD_FIELDS.map((f, i) =>
    defaultField(f.key, f.label, i, {
      static: f.static,
      defaultValue: f.defaultValue,
    }),
  );
}

function mergeValues(
  fields: FieldConfig[],
  previous: Record<string, string>,
): Record<string, string> {
  const next = emptyValues(fields);
  for (const key of Object.keys(next)) {
    const prev = (previous[key] || "").trim();
    if (prev && !fields.find((f) => f.key === key)?.static) {
      next[key] = prev;
    } else if (prev && key === "student_name") {
      next[key] = prev;
    }
  }
  return next;
}

export function BuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appliedQuery = useRef(false);
  const [view, setView] = useState<"chooser" | "editor">("chooser");
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [designLabel, setDesignLabel] = useState<string | null>(null);
  const [backgroundFill, setBackgroundFill] = useState("#ffffff");
  const [zoomLevel, setZoomLevel] = useState(1);

  const [title, setTitle] = useState("Certificate");
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(STARTER_CANVAS.width);
  const [height, setHeight] = useState<number>(STARTER_CANVAS.height);
  const [fields, setFields] = useState<FieldConfig[]>(initialFields);
  const [values, setValues] = useState<Record<string, string>>(() =>
    emptyValues(initialFields()),
  );
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>("cert_title");
  const [customLabel, setCustomLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [result, setResult] = useState<{
    count: number;
    filename: string;
    elapsed_ms: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<File | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [dateOrder, setDateOrder] = useState<DateOrder>(() => loadDateOrder());
  const [dateTouched, setDateTouched] = useState(false);

  const previewUrl = localPreviewUrl || backgroundUrl;
  const hasBackground = Boolean(localPreviewUrl || backgroundKey);
  const studentName = (values.student_name || "").trim();
  const logoField = fields.find((f) => isImageField(f) && f.key === "logo");
  const hasLogo = Boolean(logoField?.image_r2_key);
  const issueDateRaw = (values.issue_date || "").trim();
  const issueDateInvalid = Boolean(issueDateError(issueDateRaw, dateOrder));
  const ready =
    hasBackground && studentName.length > 0 && !uploading && !issueDateInvalid;

  const previewValues = useMemo(() => {
    const next = { ...values };
    if (!issueDateRaw) {
      next.issue_date = "";
      return next;
    }
    next.issue_date = normalizeIssueDate(issueDateRaw, dateOrder) || "";
    return next;
  }, [values, issueDateRaw, dateOrder]);

  useEffect(() => {
    let cancelled = false;
    ensureCertFontsLoaded()
      .then(() => {
        if (!cancelled) setFontsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFontsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: string, patch: Partial<FieldConfig>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSelectedKey(key);
    const field = fields.find((f) => f.key === key);
    if (field?.static) {
      updateField(key, { defaultValue: value });
    }
  }

  function changeDateOrder(order: DateOrder) {
    setDateOrder(order);
    saveDateOrder(order);
    if (issueDateRaw) setDateTouched(true);
  }

  async function uploadBackgroundFile(file: File): Promise<string> {
    const res = await api.uploadBackground(file);
    setBackgroundKey(res.background_r2_key);
    setBackgroundUrl(res.background_url);
    return res.background_r2_key;
  }

  async function applyBackgroundFile(
    file: File,
    opts?: { label?: string; skipNormalize?: boolean },
  ) {
    setError(null);
    setResult(null);
    setDownloadDone(false);
    setStatus("Preparing image…");
    let normalized: File;
    try {
      normalized = opts?.skipNormalize ? file : await normalizeBackgroundImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this image");
      setStatus(null);
      return;
    }
    bgFileRef.current = normalized;
    setBgFileName(opts?.label ?? normalized.name);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objectUrl = URL.createObjectURL(normalized);
    setLocalPreviewUrl(objectUrl);
    setBackgroundKey(null);
    setBackgroundUrl(null);
    try {
      const dims = await readImageSize(normalized);
      setWidth(dims.width);
      setHeight(dims.height);
    } catch {
      // keep current canvas size
    }
    setStatus("Uploading background…");
    setUploading(true);
    try {
      await uploadBackgroundFile(normalized);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("Preview ready. We'll upload the background when you download.");
    } finally {
      setUploading(false);
    }
  }

  async function applyStarter(starter: StarterTemplate) {
    setSelectedStarterId(starter.id);
    setDesignLabel(starter.name);
    setTitle(starter.title);
    setWidth(starter.width);
    setHeight(starter.height);
    setBackgroundFill(starter.backgroundColor);
    setFields(starter.fields.map((f) => ({ ...f })));
    setValues((prev) => mergeValues(starter.fields, prev));
    setSelectedKey("cert_title");
    setZoomLevel(1);
    setView("editor");
    try {
      const file = await resolveStarterBackgroundFile(starter);
      await applyBackgroundFile(file, {
        label: `${starter.name} design`,
        skipNormalize: file.type === "image/png",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this design");
    }
  }

  function onChooseStarter(starter: StarterTemplate) {
    setSelectedStarterId(starter.id);
    window.setTimeout(() => {
      void applyStarter(starter);
    }, 160);
  }

  useEffect(() => {
    if (appliedQuery.current) return;
    const id = searchParams.get("tpl");
    if (!id) return;
    const starter = getStarterTemplate(id);
    if (!starter) return;
    appliedQuery.current = true;
    void applyStarter(starter);
  }, [searchParams]);

  async function onChooseOwnFile(file: File) {
    setSelectedStarterId(null);
    setDesignLabel(null);
    setTitle("Custom design");
    setBackgroundFill("#ffffff");
    setFields(initialFields());
    setValues((prev) => mergeValues(initialFields(), prev));
    setSelectedKey("cert_title");
    setZoomLevel(1);
    setView("editor");
    await applyBackgroundFile(file);
  }

  function onChooseSaved(template: Template) {
    setSelectedStarterId(null);
    setDesignLabel(template.title);
    setTitle(template.title);
    setWidth(template.width);
    setHeight(template.height);
    setFields(template.fields_config.map((f) => ({ ...f })));
    setValues((prev) => mergeValues(template.fields_config, prev));
    setBackgroundKey(template.background_r2_key);
    setBackgroundUrl(template.background_url);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    bgFileRef.current = null;
    setBgFileName(template.title);
    setBackgroundFill("#ffffff");
    setSelectedKey("cert_title");
    setZoomLevel(1);
    setView("editor");
    setStatus(null);
    setError(null);
  }

  async function onLogoUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setStatus("Preparing logo…");
    let normalized: File;
    try {
      normalized = await normalizeBackgroundImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this logo");
      setStatus(null);
      return;
    }

    const objectUrl = URL.createObjectURL(normalized);
    let logoW = 180;
    let logoH = 90;
    try {
      const dims = await readImageSize(normalized);
      const maxW = 220;
      const scale = Math.min(1, maxW / dims.width);
      logoW = Math.round(dims.width * scale);
      logoH = Math.round(dims.height * scale);
    } catch {
      // defaults
    }

    setUploading(true);
    setStatus("Uploading logo…");
    try {
      const res = await api.uploadLogo(normalized);
      const existing = fields.find((f) => f.key === "logo");
      const nextLogo: FieldConfig = {
        key: "logo",
        label: "Organisation logo",
        type: "image",
        static: true,
        x: existing?.x ?? 60,
        y: existing?.y ?? 50,
        width: existing?.width ?? logoW,
        height: existing?.height ?? logoH,
        image_r2_key: res.logo_r2_key,
      };
      setFields((prev) => {
        if (prev.some((f) => f.key === "logo")) {
          return prev.map((f) => (f.key === "logo" ? { ...f, ...nextLogo } : f));
        }
        return [nextLogo, ...prev];
      });
      setImageUrls((prev) => {
        const old = prev.logo;
        if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
        return { ...prev, logo: objectUrl };
      });
      setSelectedKey("logo");
      setStatus("Logo added — drag or resize it on the preview.");
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setError(err instanceof Error ? err.message : "Logo upload failed");
      setStatus(null);
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    setFields((prev) => prev.filter((f) => f.key !== "logo"));
    setImageUrls((prev) => {
      const old = prev.logo;
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      const next = { ...prev };
      delete next.logo;
      return next;
    });
    if (selectedKey === "logo") setSelectedKey("cert_title");
  }

  function addCustomField() {
    const label = customLabel.trim();
    if (!label) return;
    const key = label.replace(/\s+/g, "_").toLowerCase();
    if (fields.some((f) => f.key === key)) {
      setError(`Field "${label}" already exists`);
      return;
    }
    const next = defaultField(key, label, fields.filter(isTextField).length);
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

  function fieldsForSave(): FieldConfig[] {
    return fields.map((f) => {
      if (!isTextField(f)) return f;
      if (f.static) {
        return {
          ...f,
          defaultValue: (values[f.key] || f.defaultValue || "").trim(),
        };
      }
      return f;
    });
  }

  async function ensureTemplate(): Promise<string> {
    const key = await ensureBackgroundUploaded();
    const tpl = await api.createTemplate({
      title,
      background_r2_key: key,
      fields_config: fieldsForSave(),
      width,
      height,
    });
    return tpl.id;
  }

  async function createOneCertificate() {
    if (!hasBackground) {
      setError("Choose a design or upload a background first");
      setView("chooser");
      return;
    }
    if (!studentName) {
      setError("Enter the student name to create a certificate");
      setSelectedKey("student_name");
      document.getElementById("val-student_name")?.focus();
      return;
    }
    if (issueDateInvalid) {
      setError(
        issueDateError(issueDateRaw, dateOrder) || "Enter a valid issue date, or leave it blank.",
      );
      setSelectedKey("issue_date");
      document.getElementById("val-issue_date")?.focus();
      return;
    }
    setGenerating(true);
    setDownloadDone(false);
    setError(null);
    setStatus("Saving layout and rendering certificate…");
    try {
      const templateId = await ensureTemplate();
      const custom_data: Record<string, string> = {};
      for (const field of fieldsForSave()) {
        if (!isTextField(field)) continue;
        if (field.key === "student_name") continue;
        let value = field.static
          ? (field.defaultValue || "").trim()
          : (values[field.key] || "").trim();
        if (field.key === "issue_date") {
          value = value ? normalizeIssueDate(value, dateOrder) || "" : "";
        }
        if (value) custom_data[field.key] = value;
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
      setDownloadDone(true);
      window.setTimeout(() => setDownloadDone(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus(null);
    } finally {
      setGenerating(false);
    }
  }

  async function goBulkCsv() {
    if (!hasBackground) {
      setError("Choose a design or upload a background first");
      setView("chooser");
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

  const readyLabel = !hasBackground
    ? "Choose a design or upload a background to get started."
    : !studentName
      ? "Add a student name to finish this certificate."
      : issueDateInvalid
        ? "Fix the issue date, or leave it blank."
        : uploading
          ? "Uploading…"
          : downloadDone
            ? "Your certificate downloaded."
            : "Your certificate is ready.";

  const downloadLabel = generating
    ? "Preparing certificate…"
    : downloadDone
      ? "Downloaded ✓"
      : "Download certificate";

  if (view === "chooser") {
    return (
      <TemplateChooser
        selectedId={selectedStarterId}
        onChooseStarter={onChooseStarter}
        onChooseOwnFile={(file) => void onChooseOwnFile(file)}
        onChooseSaved={onChooseSaved}
      />
    );
  }

  return (
    <div className="editor-view">
      <div className="editor-head">
        <p className="editor-title">
          Design your certificate
          {designLabel ? ` — ${designLabel}` : ""}
        </p>
        <button type="button" className="change-design" onClick={() => setView("chooser")}>
          ← Change design
        </button>
      </div>

      <div className="workspace">
        <div className="controls">
          <div className="field-group">
            <p className="group-label">Background</p>
            <div className="bg-row">
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Change background
              </button>
              <span className="bg-file-name">{bgFileName ?? "Using selected design"}</span>
              <input
                ref={fileInputRef}
                className="file-input-hidden"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void applyBackgroundFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="field-group">
            <p className="group-label">Logo</p>
            <div className="logo-row">
              <div className="logo-placeholder">
                {imageUrls.logo ? <img src={imageUrls.logo} alt="" /> : "＋"}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => logoInputRef.current?.click()}
              >
                {hasLogo ? "Change logo" : "Add logo"}
              </button>
              <input
                ref={logoInputRef}
                className="file-input-hidden"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void onLogoUpload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {hasLogo ? (
                <button type="button" className="btn-text" onClick={removeLogo}>
                  Remove
                </button>
              ) : (
                <span className="help-inline">Optional</span>
              )}
            </div>
          </div>

          <div className="field-group">
            <p className="group-label">Certificate fields</p>

            {fields.filter(isTextField).map((f) => {
              const isStandard = STANDARD_FIELDS.some((s) => s.key === f.key);
              const markedOptional = STANDARD_FIELDS.find((s) => s.key === f.key)?.optional;
              const optional =
                Boolean(markedOptional) || (!f.static && f.key !== "student_name");
              const required = f.key === "student_name";
              const active = selectedKey === f.key;
              const placeholder = (() => {
                if (f.key === "cert_title") return "e.g. Certificate of Achievement";
                if (f.key === "cert_id") return "e.g. CERT-2026-001";
                if (f.key === "issue_date") return datePlaceholder(dateOrder);
                if (optional) return `Optional — leave blank to hide`;
                return `Enter ${fieldLabel(f.key, f.label).toLowerCase()}`;
              })();
              const dateError =
                f.key === "issue_date" && dateTouched
                  ? issueDateError(values[f.key] || "", dateOrder)
                  : null;

              return (
                <div
                  key={f.key}
                  className={`field-row${active ? " selected" : ""}`}
                  onClick={() => setSelectedKey(f.key)}
                >
                  <div className="field-row-head">
                    <span className="field-name">{fieldLabel(f.key, f.label)}</span>
                    <span className="field-tag">
                      {f.static
                        ? "On every certificate"
                        : required
                          ? "Required"
                          : "Optional"}
                    </span>
                    {!isStandard && (
                      <button
                        type="button"
                        className="btn-text"
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
                    className="field-input"
                    placeholder={placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) => updateValue(f.key, e.target.value)}
                    onFocus={() => setSelectedKey(f.key)}
                    onBlur={() => {
                      if (f.key === "issue_date") setDateTouched(true);
                    }}
                    style={{ fontFamily: f.fontFamily || DEFAULT_FONT_FAMILY }}
                  />
                  {f.key === "issue_date" && (
                    <>
                      <DateOrderToggle value={dateOrder} onChange={changeDateOrder} />
                      {dateError ? (
                        <p className="field-error">{dateError}</p>
                      ) : (
                        <p className="field-help">{dateHelpText(dateOrder)}</p>
                      )}
                    </>
                  )}
                  {f.key !== "issue_date" && optional && !(values[f.key] || "").trim() && (
                    <p className="field-help">Left blank, it won&apos;t appear on the certificate.</p>
                  )}
                  <div className="mini-typography" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label htmlFor={`font-${f.key}`}>Font</label>
                      <select
                        id={`font-${f.key}`}
                        value={f.fontFamily || DEFAULT_FONT_FAMILY}
                        onChange={(e) => updateField(f.key, { fontFamily: e.target.value })}
                      >
                        {CERT_FONTS.map((font) => (
                          <option key={font.id} value={font.family}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`size-${f.key}`}>Size</label>
                      <input
                        id={`size-${f.key}`}
                        type="number"
                        min={14}
                        max={140}
                        value={f.fontSize ?? 40}
                        onChange={(e) =>
                          updateField(f.key, { fontSize: Number(e.target.value) || 18 })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`color-${f.key}`}>Colour</label>
                      <input
                        id={`color-${f.key}`}
                        type="color"
                        value={f.fontColor || "#171717"}
                        onChange={(e) => updateField(f.key, { fontColor: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor={`align-${f.key}`}>Align</label>
                      <select
                        id={`align-${f.key}`}
                        value={f.textAlign || "center"}
                        onChange={(e) =>
                          updateField(f.key, {
                            textAlign: e.target.value as FieldConfig["textAlign"],
                          })
                        }
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="add-field-row">
              <input
                placeholder="Add another field, e.g. Course name"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomField();
                }}
                aria-label="New field name"
              />
              <button type="button" className="btn" onClick={addCustomField}>
                Add field
              </button>
            </div>
          </div>
        </div>

        <div className="canvas-pane">
          <div className="zoom-bar">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="zoom-pct">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
              aria-label="Zoom in"
            >
              +
            </button>
            <span className="zoom-sep">|</span>
            <button type="button" className="zoom-fit" onClick={() => setZoomLevel(1)}>
              Fit
            </button>
            {!fontsLoaded && <span className="help-inline">Loading fonts…</span>}
          </div>
          <div className="cert-stage">
            <CanvasEditor
              width={width}
              height={height}
              backgroundUrl={previewUrl}
              backgroundFill={backgroundFill}
              fields={fields}
              values={previewValues}
              imageUrls={imageUrls}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onChangeField={updateField}
              zoom={zoomLevel}
            />
          </div>
        </div>

        <div className="action-bar">
          <div className="ready-row">
            <span className={`ready-label${ready && !downloadDone ? "" : " not-ready"}`}>
              {readyLabel}
            </span>
            <button
              type="button"
              className="btn primary"
              disabled={!ready || generating}
              onClick={() => void createOneCertificate()}
            >
              {downloadLabel}
            </button>
          </div>
          <div className="bulk-hint">
            <p>
              Need to create certificates for a whole class?
              <br />
              <strong>Upload a CSV and create them all at once.</strong>
            </p>
            <button
              type="button"
              className="btn-text"
              disabled={saving || uploading}
              onClick={() => void goBulkCsv()}
            >
              {saving ? "Saving…" : "Make many from CSV →"}
            </button>
          </div>
          {status && <div className="status">{status}</div>}
          {error && <div className="status error">{error}</div>}
          {result && (
            <p className="muted" style={{ margin: "12px 0 0" }}>
              {result.filename} · {result.count} certificate
              {result.count === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
