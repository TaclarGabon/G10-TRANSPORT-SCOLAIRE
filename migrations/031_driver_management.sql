ALTER TABLE school_drivers ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'AUTORISE';
ALTER TABLE school_drivers ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE school_drivers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE school_drivers SET pin='1201' WHERE id=1 AND (pin IS NULL OR pin='' OR pin='1111');
UPDATE school_drivers SET pin='1202' WHERE id=2 AND (pin IS NULL OR pin='' OR pin='2222');

CREATE TABLE IF NOT EXISTS school_driver_warnings (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES school_drivers(id),
  complaint_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'A_VERIFIER',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_driver_activity (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES school_drivers(id),
  bus_id INTEGER NOT NULL REFERENCES school_buses(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  leg TEXT NOT NULL,
  passengers_transported INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 23,
  planned_end TEXT,
  actual_end TIMESTAMPTZ,
  checklist_ok BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id,service_date,leg)
);

CREATE TABLE IF NOT EXISTS school_driver_month_awards (
  month_key TEXT PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES school_drivers(id),
  validated_by TEXT NOT NULL DEFAULT 'Direction',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_management_sessions (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);