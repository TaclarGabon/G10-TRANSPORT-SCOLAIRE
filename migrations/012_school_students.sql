CREATE TABLE IF NOT EXISTS school_students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  guardian_name TEXT NOT NULL DEFAULT '',
  guardian_phone TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT 'Akanda',
  pickup TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  bus_id INTEGER REFERENCES school_buses(id),
  monthly_amount INTEGER NOT NULL DEFAULT 60000,
  status TEXT NOT NULL DEFAULT 'ACTIF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)