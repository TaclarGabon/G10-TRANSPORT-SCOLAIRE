CREATE TABLE IF NOT EXISTS school_cash_closures (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bus_id INTEGER NOT NULL REFERENCES school_buses(id),
  expected_amount INTEGER NOT NULL DEFAULT 0,
  counted_amount INTEGER NOT NULL DEFAULT 0,
  handed_to TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_date,bus_id)
);