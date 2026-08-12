export type TextAlign = "left" | "center" | "right";

export interface FieldConfig {
  key: string;
  label?: string;
  x: number;
  y: number;
  fontSize: number;
  fontColor: string;
  fontFamily?: string;
  textAlign: TextAlign;
  fontWeight?: "normal" | "bold";
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
