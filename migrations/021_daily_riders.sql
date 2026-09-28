CREATE TABLE IF NOT EXISTS school_daily_rides (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bus_id INTEGER NOT NULL REFERENCES school_buses(id),
  zone_id INTEGER REFERENCES school_zones(id),
  stop_id INTEGER REFERENCES school_stops(id),
  destination_id INTEGER REFERENCES school_destinations(id),
  leg TEXT NOT NULL DEFAULT 'MATIN',
  fare_amount INTEGER NOT NULL DEFAULT 1500,
  status TEXT NOT NULL DEFAULT 'MONTE',
  boarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);