import type { DateOrder } from "./issueDate";

const STORAGE_KEY = "certifyfast.batchDraft";

export type BatchDraft = {
  selectedId: string;
  csvName: string | null;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  dateOrder: DateOrder;
  allowMissingFields: boolean;
};

export function loadBatchDraft(): BatchDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<BatchDraft>;
    if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) return null;
    return {
      selectedId: typeof data.selectedId === "string" ? data.selectedId : "",
      csvName: typeof data.csvName === "string" ? data.csvName : null,
      headers: data.headers.filter((h): h is string => typeof h === "string"),
      rows: data.rows.filter(
        (row): row is Record<string, string> => Boolean(row) && typeof row === "object",
      ),
      mapping:
        data.mapping && typeof data.mapping === "object"
          ? (data.mapping as Record<string, string>)
          : {},
      dateOrder: data.dateOrder === "us" || data.dateOrder === "uk" ? data.dateOrder : "uk",
      allowMissingFields: Boolean(data.allowMissingFields),
    };
  } catch {
    return null;
  }
}

export function saveBatchDraft(draft: BatchDraft): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Quota or private mode — Make many still works without persistence.
  }
}
