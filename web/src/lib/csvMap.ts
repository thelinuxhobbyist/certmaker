import { isImageField, isTextField, type FieldConfig } from "./api";

function norm(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Likely header names for each common certificate field */
const ALIASES: Record<string, string[]> = {
  student_name: [
    "student_name",
    "student",
    "name",
    "full_name",
    "fullname",
    "learner",
    "learner_name",
    "participant",
    "participant_name",
    "candidate",
    "candidate_name",
  ],
  issue_date: [
    "issue_date",
    "issued",
    "issued_on",
    "date",
    "date_issued",
    "completion_date",
    "completed",
  ],
  cert_id: [
    "cert_id",
    "certificate_id",
    "certificate",
    "cert",
    "id",
    "certificate_number",
    "cert_no",
    "cert_number",
    "credential_id",
  ],
  course_id: ["course_id", "course", "course_code", "code", "module_id"],
  course_name: [
    "course_name",
    "course_title",
    "title",
    "programme",
    "program",
    "class",
    "class_name",
  ],
  grade: ["grade", "result", "score", "mark", "outcome"],
  modules: ["modules", "module", "units"],
};

function aliasesForField(field: FieldConfig): string[] {
  const key = norm(field.key);
  const label = field.label ? norm(field.label) : "";
  const known = ALIASES[key] || [];
  const extras: string[] = [key];
  if (label) extras.push(label);

  // Fuzzy: if key contains "course" and "name"/"title"
  if (key.includes("course") && (key.includes("name") || key.includes("title"))) {
    extras.push(...ALIASES.course_name);
  } else if (key.includes("course")) {
    extras.push(...ALIASES.course_id, ...ALIASES.course_name);
  }
  if (key.includes("name") && !key.includes("course")) {
    extras.push(...ALIASES.student_name);
  }
  if (key.includes("date")) extras.push(...ALIASES.issue_date);
  if (key.includes("cert") || key === "id") extras.push(...ALIASES.cert_id);
  if (key.includes("grade") || key.includes("result")) extras.push(...ALIASES.grade);

  return [...new Set([...known, ...extras])];
}

function scoreHeader(header: string, field: FieldConfig): number {
  const h = norm(header);
  const aliases = aliasesForField(field);
  if (aliases.includes(h)) return 100;
  if (aliases.some((a) => h === a || h.includes(a) || a.includes(h))) return 70;
  const label = field.label ? norm(field.label) : "";
  if (label && (h.includes(label) || label.includes(h))) return 60;
  return 0;
}

/**
 * Map spreadsheet columns to certificate fields.
 * Works with name-only files, or name + course + id, etc.
 * Static title/logo fields are not mapped from CSV.
 */
export function autoMapColumns(
  headers: string[],
  fields: FieldConfig[],
): Record<string, string> {
  const mappable = fields.filter(
    (f) => isTextField(f) && !f.static && !isImageField(f),
  );
  const cleanHeaders = headers.map((h) => h.trim()).filter(Boolean);
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  // Single-column file → treat as names
  if (cleanHeaders.length === 1) {
    const nameField =
      mappable.find((f) => f.key === "student_name") || mappable[0];
    if (nameField) mapping[nameField.key] = cleanHeaders[0];
    for (const field of mappable) {
      if (!mapping[field.key]) mapping[field.key] = "";
    }
    return mapping;
  }

  // Best match per field, no double-use of the same column
  const ranked = mappable
    .map((field) => {
      let bestHeader = "";
      let bestScore = 0;
      for (const header of cleanHeaders) {
        const score = scoreHeader(header, field);
        if (score > bestScore) {
          bestScore = score;
          bestHeader = header;
        }
      }
      return { field, bestHeader, bestScore };
    })
    .sort((a, b) => b.bestScore - a.bestScore);

  for (const item of ranked) {
    if (item.bestScore >= 60 && item.bestHeader && !used.has(item.bestHeader)) {
      mapping[item.field.key] = item.bestHeader;
      used.add(item.bestHeader);
    } else {
      mapping[item.field.key] = "";
    }
  }

  // If student_name still empty, use first unused column
  if (!mapping.student_name) {
    const leftover = cleanHeaders.find((h) => !used.has(h));
    if (leftover) {
      mapping.student_name = leftover;
      used.add(leftover);
    }
  }

  return mapping;
}

export function unusedHeaders(
  headers: string[],
  mapping: Record<string, string>,
): string[] {
  const used = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((h) => h.trim() && !used.has(h));
}
