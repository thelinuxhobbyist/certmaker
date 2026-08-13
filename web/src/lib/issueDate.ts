/** UK = day/month/year, US = month/day/year */
export type DateOrder = "uk" | "us";

const STORAGE_KEY = "certmaker.dateOrder";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function loadDateOrder(): DateOrder {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "uk" || value === "us") return value;
  } catch {
    // ignore
  }
  return "uk";
}

export function saveDateOrder(order: DateOrder) {
  try {
    localStorage.setItem(STORAGE_KEY, order);
  } catch {
    // ignore
  }
}

export function dateOrderLabel(order: DateOrder): string {
  return order === "uk" ? "UK · day/month/year" : "US · month/day/year";
}

export function datePlaceholder(order: DateOrder): string {
  return order === "uk" ? "e.g. 13/08/2026 or 13 Aug 2026" : "e.g. 08/13/2026 or Aug 13, 2026";
}

export function dateHelpText(order: DateOrder): string {
  return order === "uk"
    ? "UK format: day/month/year, e.g. 13/08/2026 or 13 Aug 2026. Leave blank to hide."
    : "US format: month/day/year, e.g. 08/13/2026 or Aug 13, 2026. Leave blank to hide.";
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function expandYear(year: number, digits: number): number | null {
  if (digits === 4) return year;
  return null;
}

/** Parse a typed or spreadsheet date. Returns null if it is not a real date. */
export function parseIssueDate(input: string, order: DateOrder): Date | null {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const ymd = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(raw);
  if (ymd) return utcDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(raw);
  if (numeric) {
    const year = expandYear(Number(numeric[3]), numeric[3].length);
    if (year == null) return null;
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const day = order === "uk" ? first : second;
    const month = order === "uk" ? second : first;
    return utcDate(year, month, day);
  }

  const dayMonthYear =
    /^(\d{1,2})\s+([A-Za-z]+)\.?\,?\s+(\d{4})$/.exec(raw);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    if (!month) return null;
    return utcDate(Number(dayMonthYear[3]), month, Number(dayMonthYear[1]));
  }

  const monthDayYear =
    /^([A-Za-z]+)\.?\,?\s+(\d{1,2})(?:st|nd|rd|th)?\,?\s+(\d{4})$/.exec(raw);
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()];
    if (!month) return null;
    return utcDate(Number(monthDayYear[3]), month, Number(monthDayYear[2]));
  }

  return null;
}

export function formatIssueDate(date: Date, order: DateOrder): string {
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  if (order === "uk") return `${day} ${month} ${year}`;
  return `${month} ${day}, ${year}`;
}

export function normalizeIssueDate(input: string, order: DateOrder): string | null {
  const parsed = parseIssueDate(input, order);
  if (!parsed) return null;
  return formatIssueDate(parsed, order);
}

export function issueDateError(input: string, order: DateOrder): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (parseIssueDate(raw, order)) return null;

  const other: DateOrder = order === "uk" ? "us" : "uk";
  if (parseIssueDate(raw, other)) {
    return order === "uk"
      ? "That looks like a US date (month/day/year). Switch to US, or write day/month/year like 13/08/2026."
      : "That looks like a UK date (day/month/year). Switch to UK, or write month/day/year like 08/13/2026.";
  }

  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2}$/.test(raw)) {
    return "Use a 4-digit year, e.g. 2026.";
  }

  return order === "uk"
    ? "That isn’t a valid date. Use day/month/year, e.g. 13/08/2026 or 13 Aug 2026."
    : "That isn’t a valid date. Use month/day/year, e.g. 08/13/2026 or Aug 13, 2026.";
}
