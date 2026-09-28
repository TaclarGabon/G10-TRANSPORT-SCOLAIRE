CREATE TABLE IF NOT EXISTS school_buses (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 24,
  route_name TEXT NOT NULL,
  start_name TEXT NOT NULL,
  stop_name TEXT NOT NULL,
  end_name TEXT NOT NULL,
  scheduled_start TEXT NOT NULL
)