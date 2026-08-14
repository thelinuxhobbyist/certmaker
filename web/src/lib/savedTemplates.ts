import type { Template } from "./api";

const EDITING_KEY = "certifyfast.editingTemplateId";

export function loadEditingTemplateId(): string | null {
  try {
    return sessionStorage.getItem(EDITING_KEY);
  } catch {
    return null;
  }
}

export function saveEditingTemplateId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(EDITING_KEY, id);
    else sessionStorage.removeItem(EDITING_KEY);
  } catch {
    // ignore
  }
}

/** One card per look: same title or same background counts as a duplicate. */
export function uniqueSavedTemplates(templates: Template[], keepId?: string): Template[] {
  const kept = keepId ? templates.find((t) => t.id === keepId) : undefined;
  const seenTitle = new Set<string>();
  const seenBg = new Set<string>();
  const out: Template[] = [];

  function take(template: Template) {
    const titleKey = template.title.trim().toLowerCase();
    const bgKey = template.background_r2_key;
    if (titleKey && seenTitle.has(titleKey)) return;
    if (bgKey && seenBg.has(bgKey)) return;
    if (titleKey) seenTitle.add(titleKey);
    if (bgKey) seenBg.add(bgKey);
    out.push(template);
  }

  if (kept) take(kept);
  for (const template of templates) {
    if (kept && template.id === kept.id) continue;
    take(template);
  }

  return out;
}

export function savedDesignName(template: Template): string {
  const heading = template.fields_config
    .find((field) => field.key === "cert_title")
    ?.defaultValue?.trim();
  const title = template.title.trim();
  if (heading && heading.toLowerCase() !== "certificate of achievement") return heading;
  return title || heading || "Design";
}
