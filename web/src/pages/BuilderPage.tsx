import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
  multiline?: boolean;
  defaultValue?: string;
}> = [
  {
    key: "cert_title",
    label: "Certificate title",
    static: true,
    defaultValue: "Certificate of Achievement",
  },
  { key: "student_name", label: "Recipient / student name" },
  {
    key: "awarded_for",
    label: "Awarded for",
    optional: true,
    static: true,
    multiline: true,
  },
  {
    key: "additional_message",
    label: "Additional message",
    optional: true,
    static: true,
    multiline: true,
  },
  { key: "issue_date", label: "Issue date", optional: true },
  { key: "cert_id", label: "Certificate ID", optional: true },
];

const STANDARD_KEYS = new Set(STANDARD_FIELDS.map((f) => f.key));
const DEFAULT_TEXT_WRAP = 840;

function defaultFontSize(key: string): number {
  if (key === "cert_title") return 56;
  if (key === "student_name") return 64;
  if (key === "issue_date") return 28;
  if (key === "cert_id") return 22;
  if (key === "awarded_for") return 28;
  if (key === "additional_message") return 22;
  return 32;
}

function defaultFontFamily(key: string): string {
  if (key === "cert_title") return TITLE_FONT_FAMILY;
  if (key === "student_name") return "Cormorant Garamond Light";
  return DEFAULT_FONT_FAMILY;
}

function defaultY(key: string, index: number): number {
  if (key === "cert_title") return 200;
  if (key === "student_name") return 340;
  if (key === "awarded_for") return 430;
  if (key === "additional_message") return 520;
  if (key === "issue_date") return 680;
  if (key === "cert_id") return 750;
  return 430 + Math.max(0, index) * 70;
}

function defaultField(
  key: string,
  label: string,
  index: number,
  extras?: Partial<FieldConfig>,
): FieldConfig {
  const fontSize = defaultFontSize(key);
  const multiline = extras?.multiline ?? (key === "awarded_for" || key === "additional_message");
  return {
    key,
    label,
    type: "text",
    x: 600,
    y: defaultY(key, index),
    fontSize,
    fontColor: "#171717",
    fontFamily: defaultFontFamily(key),
    textAlign: "center",
    fontWeight: key === "student_name" || key === "cert_title" ? "bold" : "normal",
    ...(multiline ? { multiline: true, maxWidth: DEFAULT_TEXT_WRAP } : {}),
    ...extras,
  };
}

function isStandardField(field: FieldConfig): boolean {
  return STANDARD_KEYS.has(field.key);
}

function isCustomTextField(field: FieldConfig): boolean {
  return isTextField(field) && !isStandardField(field);
}

function isMultilineField(field: FieldConfig): boolean {
  return Boolean(field.multiline) || field.key === "awarded_for" || field.key === "additional_message";
}

function ensureStandardFields(fields: FieldConfig[]): FieldConfig[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const next: FieldConfig[] = fields.filter((f) => isImageField(f));
  STANDARD_FIELDS.forEach((spec, i) => {
    const existing = byKey.get(spec.key);
    if (existing) {
      next.push({
        ...existing,
        label: existing.label || spec.label,
        static: spec.static ?? existing.static,
        multiline: spec.multiline || existing.multiline,
        maxWidth: spec.multiline ? existing.maxWidth ?? DEFAULT_TEXT_WRAP : existing.maxWidth,
      });
    } else {
      next.push(
        defaultField(spec.key, spec.label, i, {
          static: spec.static,
          defaultValue: spec.defaultValue,
          multiline: spec.multiline,
        }),
      );
    }
  });
  for (const field of fields) {
    if (isImageField(field) || STANDARD_KEYS.has(field.key)) continue;
    next.push({
      ...field,
      multiline: field.multiline ?? true,
      maxWidth: field.maxWidth ?? DEFAULT_TEXT_WRAP,
    });
  }
  return next;
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
  return ensureStandardFields(
    STANDARD_FIELDS.map((f, i) =>
      defaultField(f.key, f.label, i, {
        static: f.static,
        defaultValue: f.defaultValue,
        multiline: f.multiline,
      }),
    ),
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

function FieldStyleControls({
  field,
  onChange,
}: {
  field: FieldConfig;
  onChange: (key: string, patch: Partial<FieldConfig>) => void;
}) {
  return (
    <details className="appearance-details" onClick={(e) => e.stopPropagation()}>
      <summary>Appearance</summary>
      <div className="mini-typography">
        <div>
          <label htmlFor={`font-${field.key}`}>Font</label>
          <select
            id={`font-${field.key}`}
            value={field.fontFamily || DEFAULT_FONT_FAMILY}
            onChange={(e) => onChange(field.key, { fontFamily: e.target.value })}
          >
            {CERT_FONTS.map((font) => (
              <option key={font.id} value={font.family}>
                {font.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`size-${field.key}`}>Size</label>
          <input
            id={`size-${field.key}`}
            type="number"
            min={14}
            max={140}
            value={field.fontSize ?? 40}
            onChange={(e) => onChange(field.key, { fontSize: Number(e.target.value) || 18 })}
          />
        </div>
        <div>
          <label htmlFor={`color-${field.key}`}>Colour</label>
          <input
            id={`color-${field.key}`}
            type="color"
            value={field.fontColor || "#171717"}
            onChange={(e) => onChange(field.key, { fontColor: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`align-${field.key}`}>Align</label>
          <select
            id={`align-${field.key}`}
            value={field.textAlign || "center"}
            onChange={(e) =>
              onChange(field.key, {
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
    </details>
  );
}

export function BuilderPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const pendingFocusKey = useRef<string | null>(null);

  function enterEditor() {
    setView("editor");
  }

  useEffect(() => {
    if ((location.state as { home?: boolean } | null)?.home) {
      setView("chooser");
    }
  }, [location]);

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
    setFields((prev) =>
      prev.map((f) => (f.key === key && f.static ? { ...f, defaultValue: value } : f)),
    );
  }

  function selectField(key: string | null, opts?: { focus?: boolean }) {
    setSelectedKey(key);
    if (key && opts?.focus) pendingFocusKey.current = key;
  }

  useLayoutEffect(() => {
    const key = pendingFocusKey.current;
    if (!key || key !== selectedKey) return;
    pendingFocusKey.current = null;
    const field = fields.find((f) => f.key === key);
    const unlabeled = Boolean(field && isCustomTextField(field) && !(field.label || "").trim());
    const el = document.getElementById(unlabeled ? `label-${key}` : `val-${key}`);
    el?.focus();
  }, [selectedKey, fields]);

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
    const nextFields = ensureStandardFields(starter.fields.map((f) => ({ ...f })));
    setFields(nextFields);
    setValues((prev) => mergeValues(nextFields, prev));
    setSelectedKey("cert_title");
    setZoomLevel(1);
    enterEditor();
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
    const nextFields = ensureStandardFields(initialFields());
    setFields(nextFields);
    setValues((prev) => mergeValues(nextFields, prev));
    setSelectedKey("cert_title");
    setZoomLevel(1);
    enterEditor();
    await applyBackgroundFile(file);
  }

  function onChooseSaved(template: Template) {
    setSelectedStarterId(null);
    setDesignLabel(template.title);
    setTitle(template.title);
    setWidth(template.width);
    setHeight(template.height);
    const nextFields = ensureStandardFields(template.fields_config.map((f) => ({ ...f })));
    setFields(nextFields);
    setValues((prev) => mergeValues(nextFields, prev));
    setBackgroundKey(template.background_r2_key);
    setBackgroundUrl(template.background_url);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    bgFileRef.current = null;
    setBgFileName(template.title);
    setBackgroundFill("#ffffff");
    setSelectedKey("cert_title");
    setZoomLevel(1);
    enterEditor();
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
    const key = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const nameField = fields.find((f) => f.key === "student_name");
    const existingCustom = fields.filter(isCustomTextField).length;
    const y = Math.min(760, (nameField?.y ?? 340) + 90 + existingCustom * 52);
    const next = defaultField(key, "", existingCustom, {
      y,
      multiline: true,
      maxWidth: DEFAULT_TEXT_WRAP,
      fontSize: 32,
      fontWeight: "normal",
    });
    setFields((prev) => [...prev, next]);
    setValues((prev) => ({ ...prev, [key]: "" }));
    setSelectedKey(key);
    setError(null);
    setStatus("New field added on the preview — drag it into place, then name it to match your CSV column.");
    pendingFocusKey.current = key;
  }

  function removeCustomField(key: string) {
    setFields((prev) => prev.filter((x) => x.key !== key));
    setValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedKey((current) => (current === key ? "cert_title" : current));
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
      const label = (f.label || "").trim();
      if (f.static) {
        return {
          ...f,
          ...(label ? { label } : {}),
          defaultValue: (values[f.key] || f.defaultValue || "").trim(),
        };
      }
      return {
        ...f,
        ...(label ? { label } : {}),
      };
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
      setError("Enter the recipient name to create a certificate");
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
      ? "Add a recipient name to finish this certificate."
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

  const textByKey = new Map(fields.filter(isTextField).map((f) => [f.key, f]));
  const standardRows = STANDARD_FIELDS.map((spec) => textByKey.get(spec.key)).filter(
    (f): f is FieldConfig => Boolean(f),
  );
  const customRows = fields.filter(isCustomTextField);
  const dateDisplay =
    issueDateRaw && !issueDateInvalid ? normalizeIssueDate(issueDateRaw, dateOrder) : null;

  function renderStandardRow(f: FieldConfig) {
    const spec = STANDARD_FIELDS.find((s) => s.key === f.key);
    const optional = Boolean(spec?.optional);
    const required = f.key === "student_name";
    const active = selectedKey === f.key;
    const multiline = isMultilineField(f);
    const placeholder = (() => {
      if (f.key === "cert_title") return "e.g. Certificate of Achievement";
      if (f.key === "student_name") return "e.g. Alex Morgan";
      if (f.key === "awarded_for")
        return "e.g. 100% attendance throughout the full year of study";
      if (f.key === "additional_message")
        return "e.g. In recognition of outstanding commitment throughout the programme.";
      if (f.key === "cert_id") return "e.g. CERT-2026-001";
      if (f.key === "issue_date") return datePlaceholder(dateOrder);
      return `Enter ${fieldLabel(f.key, f.label).toLowerCase()}`;
    })();
    const dateError =
      f.key === "issue_date" && dateTouched
        ? issueDateError(values[f.key] || "", dateOrder)
        : null;
    const inputStyle = { fontFamily: f.fontFamily || DEFAULT_FONT_FAMILY };

    return (
      <div
        key={f.key}
        className={`field-row${active ? " selected" : ""}`}
        onClick={() => setSelectedKey(f.key)}
      >
        <div className="field-row-head">
          <label className="field-name" htmlFor={`val-${f.key}`}>
            {fieldLabel(f.key, f.label || spec?.label)}
          </label>
          {required ? <span className="field-tag">Required</span> : null}
        </div>
        {multiline ? (
          <textarea
            id={`val-${f.key}`}
            className="field-input field-textarea"
            rows={f.key === "additional_message" ? 3 : 2}
            placeholder={placeholder}
            value={values[f.key] || ""}
            onChange={(e) => updateValue(f.key, e.target.value)}
            onFocus={() => setSelectedKey(f.key)}
            style={inputStyle}
          />
        ) : (
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
            style={inputStyle}
          />
        )}
        {f.key === "issue_date" && (
          <>
            <DateOrderToggle value={dateOrder} onChange={changeDateOrder} />
            {dateError ? (
              <p className="field-error">{dateError}</p>
            ) : dateDisplay ? (
              <p className="field-confirm">
                Displays as: <strong>{dateDisplay}</strong>
              </p>
            ) : (
              <p className="field-help">{dateHelpText(dateOrder)}</p>
            )}
          </>
        )}
        {f.key !== "issue_date" && optional && !(values[f.key] || "").trim() && (
          <p className="field-help">Left blank, it won&apos;t appear on the certificate.</p>
        )}
        {active ? <FieldStyleControls field={f} onChange={updateField} /> : null}
      </div>
    );
  }

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
            <p className="group-label">Certificate information</p>
            <p className="field-help" style={{ marginTop: 0, marginBottom: 12 }}>
              Type here — the preview updates as you go. Drag anything on the certificate to
              move it.
            </p>

            {standardRows.map((f) => renderStandardRow(f))}
          </div>

          <div className="field-group">
            <p className="group-label">Personalized information</p>
            <p className="field-help" style={{ marginTop: 0, marginBottom: 12 }}>
              Add information that changes between certificates, such as a course, grade,
              instructor or award. Name each field to match your spreadsheet column — then
              Make many can fill it automatically from a CSV.
            </p>

            {customRows.map((f) => {
              const active = selectedKey === f.key;
              const collapsed = customRows.length > 1 && !active;
              const preview = (values[f.key] || "").trim();
              const name = f.label?.trim() || "New field";
              return (
                <div
                  key={f.key}
                  className={`field-row custom-field-row${active ? " selected" : ""}${collapsed ? " is-collapsed" : ""}`}
                  onClick={() => selectField(f.key, { focus: collapsed })}
                >
                  <div className="field-row-head">
                    <span className="field-name">{name}</span>
                    {collapsed && (
                      <span className="field-preview-snip">
                        {preview
                          ? preview.split("\n")[0]
                          : "Click to edit"}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomField(f.key);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {!collapsed && (
                    <>
                      <label className="nested-label" htmlFor={`label-${f.key}`}>
                        Field name
                      </label>
                      <input
                        id={`label-${f.key}`}
                        className="field-input"
                        placeholder="e.g. Course"
                        value={f.label || ""}
                        onChange={(e) => updateField(f.key, { label: e.target.value })}
                        onFocus={() => setSelectedKey(f.key)}
                      />
                      <label className="nested-label" htmlFor={`val-${f.key}`}>
                        Preview value
                      </label>
                      <textarea
                        id={`val-${f.key}`}
                        className="field-input field-textarea"
                        rows={2}
                        placeholder="e.g. Computer Science"
                        value={values[f.key] || ""}
                        onChange={(e) => updateValue(f.key, e.target.value)}
                        onFocus={() => setSelectedKey(f.key)}
                        style={{ fontFamily: f.fontFamily || DEFAULT_FONT_FAMILY }}
                      />
                      <p className="field-help">
                        Drag this on the preview to place it. Make many fills it from a CSV
                        column named {name === "New field" ? "the same as this field" : `“${name}”`}.
                      </p>
                      {active ? <FieldStyleControls field={f} onChange={updateField} /> : null}
                    </>
                  )}
                </div>
              );
            })}

            <button type="button" className="btn add-personal-btn" onClick={addCustomField}>
              + Add personalized field
            </button>
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
          <p className="canvas-drag-hint">Click text to edit it here. Drag it on the certificate to move it.</p>
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
              onSelect={(key) => selectField(key, { focus: true })}
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
          <div className={`bulk-hint${downloadDone || result ? " is-emphasis" : ""}`}>
            <p>
              {downloadDone || result ? (
                <>
                  Like this design?
                  <br />
                  <strong>Use it to create more from a CSV list.</strong>
                </>
              ) : (
                <>
                  Like this design? You can use it again for a whole class.
                  <br />
                  <strong>Make many from a CSV — we&apos;ll keep this layout.</strong>
                </>
              )}
            </p>
            <button
              type="button"
              className={downloadDone || result ? "btn primary" : "btn-text"}
              disabled={saving || uploading || !hasBackground}
              onClick={() => void goBulkCsv()}
            >
              {saving ? "Saving…" : "Use this design for many →"}
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
