export type TextAlign = "left" | "center" | "right";
export type FieldType = "text" | "image";

export interface FieldConfig {
  key: string;
  label?: string;
  /** Defaults to "text". */
  type?: FieldType;
  /**
   * Fixed for every certificate (title, org name, logo).
   * Not mapped from CSV; value comes from defaultValue / builder sample.
   */
  static?: boolean;
  /** Printed value for static text fields. */
  defaultValue?: string;
  x: number;
  y: number;
  // Text fields
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  textAlign?: TextAlign;
  fontWeight?: "normal" | "bold";
  // Image fields (logo)
  image_r2_key?: string;
  width?: number;
  height?: number;
}

export interface TemplateRecord {
  id: string;
  title: string;
  background_r2_key: string;
  fields_config: string;
  width: number;
  height: number;
  created_at: string;
  user_id?: string | null;
}

export interface CertificateRecord {
  id: string;
  template_id: string;
  student_name: string;
  custom_data: string | null;
  png_r2_key: string | null;
  pdf_r2_key: string | null;
  issued_at: string;
  user_id?: string | null;
  storage_policy?: string | null;
}

export type CustomData = Record<string, string>;

export function isTextField(field: FieldConfig): boolean {
  return (field.type ?? "text") === "text";
}

export function isImageField(field: FieldConfig): boolean {
  return field.type === "image";
}
