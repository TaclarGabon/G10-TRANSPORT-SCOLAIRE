CREATE TABLE IF NOT EXISTS school_boardings (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  leg TEXT NOT NULL DEFAULT 'MATIN',
  status TEXT NOT NULL DEFAULT 'ATTENDU',
  boarded_at TIMESTAMPTZ,
  dropped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, service_date, leg)
)