import { isImageField, isTextField, type FieldConfig } from "./api";

export const STUDENT_LAST_KEY = "student_name_last";

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

const FIRST_NAME_ALIASES = [
  "first_name",
  "firstname",
  "first",
  "given_name",
  "givenname",
  "given",
  "forename",
];

const LAST_NAME_ALIASES = [
  "last_name",
  "lastname",
  "last",
  "surname",
  "family_name",
  "familyname",
  "family",
];

function aliasesForField(field: FieldConfig): string[] {
  const key = norm(field.key);
  const label = field.label ? norm(field.label) : "";
  const known = ALIASES[key] || [];
  const extras: string[] = [key];
  if (label) extras.push(label);

  if (key.includes("course") && (key.includes("name") || key.includes("title"))) {
    extras.push(...ALIASES.course_name);
  } else if (key.includes("course")) {
    extras.push(...ALIASES.course_id, ...ALIASES.course_name);
  }
  if (key.includes("name") && !key.includes("course") && key !== "first_name" && key !== "last_name") {
    extras.push(...ALIASES.student_name);
  }
  if (key.includes("date")) extras.push(...ALIASES.issue_date);
  if (key === "cert_id" || key.includes("cert_id") || key.includes("certificate_id")) {
    extras.push(...ALIASES.cert_id);
  }
  if (key.includes("grade") || key.includes("result")) extras.push(...ALIASES.grade);

  return [...new Set([...known, ...extras])];
}

function headerMatchesAlias(header: string, aliases: string[]): boolean {
  const h = norm(header);
  return aliases.some((a) => h === a);
}

export function isFirstNameHeader(header: string): boolean {
  return headerMatchesAlias(header, FIRST_NAME_ALIASES);
}

export function isLastNameHeader(header: string): boolean {
  return headerMatchesAlias(header, LAST_NAME_ALIASES);
}

function findHeader(headers: string[], aliases: string[]): string {
  return headers.find((h) => headerMatchesAlias(h, aliases)) || "";
}

function scoreHeader(header: string, field: FieldConfig): number {
  const h = norm(header);
  if (field.key === "student_name" && (isFirstNameHeader(header) || isLastNameHeader(header))) {
    return 0;
  }
  const aliases = aliasesForField(field);
  if (aliases.includes(h)) return 100;
  if (aliases.some((a) => a.length >= 4 && (h === a || h.includes(a) || a.includes(h)))) return 70;
  const label = field.label ? norm(field.label) : "";
  if (label && label.length >= 4 && (h.includes(label) || label.includes(h))) return 60;
  return 0;
}

/**
 * Map spreadsheet columns to certificate fields.
 * Works with name-only files, first+last name columns, or name + course + id.
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

  const firstCol = findHeader(cleanHeaders, FIRST_NAME_ALIASES);
  const lastCol = findHeader(cleanHeaders, LAST_NAME_ALIASES);

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

  const hasFullName =
    Boolean(mapping.student_name) &&
    !isFirstNameHeader(mapping.student_name) &&
    !isLastNameHeader(mapping.student_name);

  if (firstCol && lastCol && !hasFullName) {
    mapping.student_name = firstCol;
    mapping[STUDENT_LAST_KEY] = lastCol;
    used.add(firstCol);
    used.add(lastCol);
  } else if (!mapping.student_name && firstCol) {
    mapping.student_name = firstCol;
    used.add(firstCol);
  } else if (!mapping.student_name && lastCol) {
    mapping.student_name = lastCol;
    used.add(lastCol);
  } else if (!mapping.student_name) {
    const leftover = cleanHeaders.find((h) => !used.has(h));
    if (leftover) {
      mapping.student_name = leftover;
      used.add(leftover);
    }
  }

  return mapping;
}

export function combineStudentName(
  row: Record<string, string>,
  mapping: Record<string, string>,
): string {
  const firstHeader = mapping.student_name;
  const lastHeader = mapping[STUDENT_LAST_KEY];
  const first = (firstHeader ? row[firstHeader] : "")?.trim() || "";
  const last =
    lastHeader && lastHeader !== firstHeader
      ? (row[lastHeader] || "").trim()
      : "";
  return [first, last].filter(Boolean).join(" ");
}

export function unusedHeaders(
  headers: string[],
  mapping: Record<string, string>,
): string[] {
  const used = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((h) => h.trim() && !used.has(h));
}
