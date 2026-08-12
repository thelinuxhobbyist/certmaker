-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  background_r2_key TEXT NOT NULL,
  -- JSON array storing field configs: [{key, x, y, fontSize, fontColor, textAlign}]
  fields_config TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 850,
  -- Auth prep: nullable / anonymous until login ships
  user_id TEXT DEFAULT 'anonymous',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Issued Certificates Table
-- Phase 1: generated PNG/PDF are not retained in R2 (png/pdf keys stay NULL).
CREATE TABLE IF NOT EXISTS issued_certificates (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT DEFAULT 'anonymous',
  student_name TEXT NOT NULL,
  -- JSON object storing dynamic KV pairs: {"course_id": "AI-101", "grade": "Pass"}
  custom_data TEXT,
  png_r2_key TEXT,
  pdf_r2_key TEXT,
  storage_policy TEXT NOT NULL DEFAULT 'ephemeral',
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE INDEX IF NOT EXISTS idx_issued_template ON issued_certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_issued_at ON issued_certificates(issued_at);
CREATE INDEX IF NOT EXISTS idx_issued_user ON issued_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);
