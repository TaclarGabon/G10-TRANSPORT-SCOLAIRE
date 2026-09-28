CREATE TABLE IF NOT EXISTS school_runs (
  bus_id INTEGER PRIMARY KEY REFERENCES school_buses(id),
  driver_id INTEGER REFERENCES school_drivers(id),
  status TEXT NOT NULL DEFAULT 'NON_ASSIGNE',
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  boarded INTEGER NOT NULL DEFAULT 0,
  stage INTEGER NOT NULL DEFAULT 0,
  departed_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)