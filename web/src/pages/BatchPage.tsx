import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Papa from "papaparse";
import { DateOrderToggle } from "../components/DateOrderToggle";
import { MiniCert } from "../components/MiniCert";
import { api, isImageField, isTextField, type CustomData, type Template } from "../lib/api";
import { loadBatchDraft, saveBatchDraft } from "../lib/batchDraft";
import { savedDesignName, uniqueSavedTemplates } from "../lib/savedTemplates";
import { STARTER_TEMPLATES } from "../lib/starterTemplates";
import {
  STUDENT_LAST_KEY,
  combineStudentName,
  isPersonalizedField,
  mergeColumnMapping,
  newFieldFromHeader,
  unmatchedPersonalizedFields,
  unusedHeaders,
} from "../lib/csvMap";
import {
  dateHelpText,
  loadDateOrder,
  normalizeIssueDate,
  saveDateOrder,
  type DateOrder,
} from "../lib/issueDate";

function niceLabel(field: { key: string; label?: string }) {
  if (field.label?.trim()) return field.label.trim();
  if (field.key.startsWith("custom_")) return "Unnamed field";
  return field.key
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function BatchPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [selectedId, setSelectedId] = useState(templateId || "");
  const [csvName, setCsvName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    count: number;
    failed: number;
    elapsed_ms: number;
    filename: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dateOrder, setDateOrder] = useState<DateOrder>(() => loadDateOrder());
  const [allowMissingFields, setAllowMissingFields] = useState(false);

  useEffect(() => {
    const draft = loadBatchDraft();
    if (draft) {
      if (draft.csvName) setCsvName(draft.csvName);
      if (draft.headers.length) setHeaders(draft.headers);
      if (draft.rows.length) {
        setRows(draft.rows);
        setStatus(
          `Your spreadsheet is still here — ${draft.rows.length} ${
            draft.rows.length === 1 ? "person" : "people"
          }.`,
        );
      }
      setMapping(draft.mapping);
      setDateOrder(draft.dateOrder);
      setAllowMissingFields(draft.allowMissingFields);
      if (!templateId && draft.selectedId) setSelectedId(draft.selectedId);
    }
    setDraftReady(true);
  }, [templateId]);

  useEffect(() => {
    setLoading(true);
    api
      .listTemplates()
      .then((res) => {
        const unique = uniqueSavedTemplates(res.templates, templateId);
        setTemplates(unique);
        setSelectedId((current) => {
          if (templateId && unique.some((t) => t.id === templateId)) return templateId;
          if (current && unique.some((t) => t.id === current)) return current;
          return unique[0]?.id || "";
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load your designs"),
      )
      .finally(() => setLoading(false));
  }, [templateId]);

  const template = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId],
  );

  const leftoverColumns = useMemo(
    () => unusedHeaders(headers, mapping),
    [headers, mapping],
  );

  const designChoices = useMemo(() => {
    const unique = uniqueSavedTemplates(templates, selectedId || templateId);
    const current = unique.find((t) => t.id === selectedId) || unique[0] || null;
    const otherSaved = unique.filter((t) => t.id !== current?.id);
    const takenNames = new Set(unique.map((t) => t.title.trim().toLowerCase()));
    const starters = STARTER_TEMPLATES.filter(
      (starter) => !takenNames.has(starter.name.toLowerCase()),
    );
    return { current, otherSaved, starters };
  }, [templates, selectedId, templateId]);

  useEffect(() => {
    if (!template || headers.length === 0) return;
    setMapping((prev) => mergeColumnMapping(headers, template.fields_config, prev));
  }, [template, headers]);

  useEffect(() => {
    if (!draftReady) return;
    saveBatchDraft({
      selectedId,
      csvName,
      headers,
      rows,
      mapping,
      dateOrder,
      allowMissingFields,
    });
  }, [draftReady, selectedId, csvName, headers, rows, mapping, dateOrder, allowMissingFields]);

  function persistDraft() {
    saveBatchDraft({
      selectedId,
      csvName,
      headers,
      rows,
      mapping,
      dateOrder,
      allowMissingFields,
    });
  }

  function goEditDesign() {
    if (!selectedId) return;
    persistDraft();
    navigate(`/builder?tpl=${encodeURIComponent(selectedId)}&from=batch`);
  }

  function goPickStarter(starterId: string) {
    persistDraft();
    navigate(`/builder?tpl=${encodeURIComponent(starterId)}&from=batch`);
  }

  async function addLeftoverColumn(header: string) {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const field = newFieldFromHeader(header, template.fields_config);
      const updated = await api.updateTemplate(template.id, {
        title: template.title,
        background_r2_key: template.background_r2_key,
        fields_config: [...template.fields_config, field],
        width: template.width,
        height: template.height,
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setMapping((prev) => ({ ...prev, [field.key]: header }));
      setStatus(
        `Added “${header}” to this design. Edit the layout to drag it into place.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that column to the design.");
    } finally {
      setBusy(false);
    }
  }

  function onCsv(file: File | null) {
    if (!file) return;
    setError(null);
    setResults(null);
    setCsvName(file.name);
    setMapping({});
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (parsed) => {
        let cols = (parsed.meta.fields || []).map((h) => h.trim()).filter(Boolean);
        let data = parsed.data;

        // Name-only file with no header row (single column of values)
        if (cols.length === 0 || (cols.length === 1 && data.every((r) => !r[cols[0]]))) {
          Papa.parse<string[]>(file, {
            header: false,
            skipEmptyLines: true,
            complete: (raw) => {
              const values = raw.data
                .map((row) => (row[0] || "").trim())
                .filter(Boolean);
              cols = ["name"];
              data = values.map((name) => ({ name }));
              setHeaders(cols);
              setRows(data);
              setStatus(
                `Found ${values.length} name${values.length === 1 ? "" : "s"}. That is enough to get started.`,
              );
            },
          });
          return;
        }

        setHeaders(cols);
        setRows(data);
        const count = data.length;
        setStatus(
          cols.length === 1
            ? `Found ${count} name${count === 1 ? "" : "s"}. We will use this column for the recipient name.`
            : `Found ${count} row${count === 1 ? "" : "s"} and ${cols.length} columns.`,
        );
      },
      error: (err) => setError(err.message),
    });
  }

  async function runBatch() {
    if (!template) {
      setError("Choose a certificate design first.");
      return;
    }
    if (!mapping.student_name) {
      setError("Choose which column has each person’s name.");
      return;
    }
    if (rows.length === 0) {
      setError("Upload a spreadsheet first.");
      return;
    }

    const payloadRows = rows
      .slice(0, 100)
      .map((row) => {
        const custom_data: CustomData = {};
        for (const [fieldKey, csvHeader] of Object.entries(mapping)) {
          if (!csvHeader || fieldKey === "student_name") continue;
          const value = (row[csvHeader] ?? "").trim();
          if (!value) continue;
          if (fieldKey === "issue_date") {
            const normalised = normalizeIssueDate(value, dateOrder);
            if (normalised) custom_data[fieldKey] = normalised;
            continue;
          }
          custom_data[fieldKey] = value;
        }
        return {
          student_name: combineStudentName(row, mapping),
          custom_data,
        };
      })
      .filter((r) => r.student_name);

    if (payloadRows.length === 0) {
      setError("No names found in the column you chose.");
      return;
    }

    const unmatched = unmatchedPersonalizedFields(template.fields_config, mapping);
    if (unmatched.length > 0 && !allowMissingFields) {
      setError(
        `This CSV has no column for ${unmatched
          .map((f) => niceLabel(f))
          .join(", ")}. Add those columns, match them below, or confirm you want to leave them blank.`,
      );
      return;
    }

    const dateHeader = mapping.issue_date;
    const invalidDates = dateHeader
      ? rows.filter((row) => {
          const value = (row[dateHeader] ?? "").trim();
          return value && !normalizeIssueDate(value, dateOrder);
        }).length
      : 0;

    setBusy(true);
    setError(null);
    setStatus("Creating certificates…");
    try {
      const res = await api.generateBatch({
        template_id: template.id,
        rows: payloadRows,
      });
      setResults(res);
      const dateNote = invalidDates
        ? ` ${invalidDates} issue date${invalidDates === 1 ? " was" : "s were"} invalid and left blank.`
        : "";
      setStatus(
        res.failed
          ? `Downloaded ${res.filename} with ${res.count} certificate${res.count === 1 ? "" : "s"} (${res.failed} row${res.failed === 1 ? "" : "s"} failed).${dateNote}`
          : `Downloaded ${res.filename} with ${res.count} certificate${res.count === 1 ? "" : "s"}. We do not keep copies on our servers.${dateNote}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <h2>Make many certificates</h2>
        <p className="lede">Loading…</p>
      </section>
    );
  }

  if (templates.length === 0) {
    return (
      <section className="panel">
        <h2>Make many certificates</h2>
        <p className="lede">
          Design a certificate first. Then you can fill it for many people from a spreadsheet.
        </p>
        <Link className="btn btn-primary" to="/builder">
          Design a certificate
        </Link>
      </section>
    );
  }

  const ready = Boolean(template && rows.length > 0 && mapping.student_name);
  const previewRows = rows.slice(0, 3);
  const fromDesigner = Boolean(templateId && template);
  const unmatchedPersonal = template
    ? unmatchedPersonalizedFields(template.fields_config, mapping)
    : [];
  const matchedFills = template
    ? template.fields_config.filter(
        (field) =>
          isTextField(field) &&
          !field.static &&
          !isImageField(field) &&
          mapping[field.key],
      )
    : [];

  return (
    <section className="panel">
      <h2>Make many certificates</h2>
      <p className="lede">
        {fromDesigner && template ? (
          <>
            Using <strong>{savedDesignName(template)}</strong> — the design you were just working on.
            Upload a CSV and we&apos;ll fill this layout for each person.
          </>
        ) : (
          <>
            Pick a design, upload a list of people, and we fill in the certificates.
            A list of names alone is fine. If you also have course titles or IDs, we will use those too.
          </>
        )}
      </p>

      <div className="bulk-step">
        <h3 className="side-title">1. Choose a design</h3>
        <p className="muted" style={{ margin: "0 0 0.65rem" }}>
          {fromDesigner
            ? "This is the design you just made. Pick another look if you want to switch."
            : "Pick the certificate look to fill from your spreadsheet."}
        </p>
        <div className="design-picks">
          {designChoices.current && (
            <button
              type="button"
              className={`design-pick is-selected`}
              onClick={() => setSelectedId(designChoices.current!.id)}
            >
              <img src={designChoices.current.background_url} alt="" />
              <span>{savedDesignName(designChoices.current)}</span>
              <em className="design-pick-using">Using this</em>
            </button>
          )}
          {designChoices.otherSaved.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`design-pick ${selectedId === t.id ? "is-selected" : ""}`}
              onClick={() => {
                setSelectedId(t.id);
                setResults(null);
              }}
            >
              <img src={t.background_url} alt="" />
              <span>{savedDesignName(t)}</span>
            </button>
          ))}
          {designChoices.starters.map((starter) => (
            <button
              key={starter.id}
              type="button"
              className="design-pick"
              onClick={() => goPickStarter(starter.id)}
            >
              <MiniCert starter={starter} />
              <span>{starter.name}</span>
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: "0.65rem" }}>
          Need to move text or change the look?{" "}
          <button type="button" className="linkish" onClick={goEditDesign} disabled={!selectedId}>
            Edit this design
          </button>
          {" — "}your spreadsheet stays here.{" "}
          <Link className="linkish" to="/builder" style={{ display: "inline" }}>
            Start a new one
          </Link>
        </p>
      </div>

      <div className="bulk-step">
        <h3 className="side-title">2. Upload your list</h3>
        <p className="muted">
          Use a CSV file. One row per person. Name the columns the same as your personalized
          fields — for example Name, Course, Grade, Instructor. Dates like 10/07/26 are fine.
        </p>
        <div className="field">
          <label htmlFor="csv">CSV file</label>
          <input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onCsv(e.target.files?.[0] ?? null)}
          />
        </div>
        {csvName && (
          <p className="muted">
            {csvName}
            {rows.length > 0
              ? ` · ${rows.length} people`
              : ""}
          </p>
        )}
      </div>

      {template && headers.length > 0 && (
        <div className="bulk-step">
          <h3 className="side-title">3. Check the match</h3>
          <p className="muted">
            Columns named the same as your personalized fields are filled automatically.
            Change a match only if we got it wrong.
          </p>
          {matchedFills.length > 0 && (
            <div className="csv-match-list">
              {matchedFills.map((field) => (
                <span key={field.key} className="csv-match-chip">
                  {niceLabel(field)} ← {mapping[field.key]}
                </span>
              ))}
            </div>
          )}
          <div className="section-grid">
            {template.fields_config
              .filter((field) => isTextField(field) && !field.static && !isImageField(field))
              .map((field) => (
              <div key={field.key} className="field-item" style={{ cursor: "default" }}>
                <label htmlFor={`map-${field.key}`}>
                  {niceLabel(field)}
                  {field.key === "student_name" ? (
                    <span className="optional-tag"> name column</span>
                  ) : isPersonalizedField(field) ? (
                    <span className="optional-tag"> matches CSV column name</span>
                  ) : (
                    <span className="optional-tag"> optional</span>
                  )}
                </label>
                <select
                  id={`map-${field.key}`}
                  value={mapping[field.key] || ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                >
                  <option value="">
                    {field.key === "student_name" ? "Choose a column…" : "Skip"}
                  </option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {field.key === "student_name" && (
                  <>
                    <label htmlFor="map-student_name_last" style={{ marginTop: "0.65rem" }}>
                      Last name
                      <span className="optional-tag"> optional — joined with a space</span>
                    </label>
                    <select
                      id="map-student_name_last"
                      value={mapping[STUDENT_LAST_KEY] || ""}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [STUDENT_LAST_KEY]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Skip — full name is in one column</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ))}
          </div>

          {mapping.issue_date && (
            <div className="date-order-block">
              <p className="muted" style={{ marginBottom: "0.5rem" }}>
                Issue dates in your spreadsheet
              </p>
              <DateOrderToggle
                value={dateOrder}
                onChange={(order) => {
                  setDateOrder(order);
                  saveDateOrder(order);
                }}
              />
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {dateHelpText(dateOrder)} Invalid dates will be left off the certificate.
              </p>
            </div>
          )}

          {unmatchedPersonal.length > 0 && (
            <div className="csv-missing">
              <p>
                <strong>
                  This CSV doesn&apos;t include{" "}
                  {unmatchedPersonal.map((f) => niceLabel(f)).join(", ")}.
                </strong>{" "}
                Those parts of the certificate will be blank unless you add matching column
                names (for example Course, Grade) or match them above.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={allowMissingFields}
                  onChange={(e) => setAllowMissingFields(e.target.checked)}
                />
                <span>
                  Create certificates anyway, leaving{" "}
                  {unmatchedPersonal.map((f) => niceLabel(f)).join(", ")} blank
                </span>
              </label>
            </div>
          )}

          {leftoverColumns.length > 0 && (
            <div className="csv-leftover">
              <p className="muted" style={{ margin: 0 }}>
                Not used from your file: {leftoverColumns.join(", ")}. Add a column to this
                design to print it, then drag it into place.
              </p>
              <div className="csv-leftover-actions">
                {leftoverColumns.map((header) => (
                  <button
                    key={header}
                    type="button"
                    className="csv-leftover-add"
                    disabled={busy}
                    onClick={() => void addLeftoverColumn(header)}
                  >
                    Add “{header}”
                  </button>
                ))}
              </div>
            </div>
          )}

          {previewRows.length > 0 && mapping.student_name && (
            <div className="csv-preview">
              <p className="muted">Sample from your file:</p>
              <ul>
                {previewRows.map((row, i) => (
                  <li key={i}>
                    {combineStudentName(row, mapping) || "(empty name)"}
                    {Object.entries(mapping)
                      .filter(
                        ([k, h]) =>
                          k !== "student_name" && k !== STUDENT_LAST_KEY && h && row[h],
                      )
                      .map(([, h]) => ` · ${row[h]}`)
                      .join("")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted" style={{ marginTop: "0.75rem" }}>
            {rows.length > 100
              ? `We will create the first 100 of ${rows.length} certificates.`
              : `We will create ${rows.length} certificate${rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      )}

      <div className="issue-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            busy ||
            !ready ||
            (unmatchedPersonal.length > 0 && !allowMissingFields)
          }
          onClick={() => void runBatch()}
        >
          {busy ? "Creating…" : "Create certificates"}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
      {error && <div className="status error">{error}</div>}

      {results && (
        <div className="bulk-step results-block">
          <h3 className="side-title">Download</h3>
          <p className="muted">
            {results.filename} · {results.count} certificate
            {results.count === 1 ? "" : "s"}
            {results.failed ? ` · ${results.failed} failed` : ""} · {results.elapsed_ms}ms
          </p>
          <p className="muted">
            Check your downloads folder for the zip. Generated files are not stored on our servers.
          </p>
        </div>
      )}
    </section>
  );
}
