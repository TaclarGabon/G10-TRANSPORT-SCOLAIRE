CREATE TABLE IF NOT EXISTS school_stops (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES school_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone_id,name)
);
INSERT INTO school_stops(zone_id,name,sort_order)
SELECT z.id,x.name,x.ord FROM school_zones z
JOIN (VALUES ('Amissa',1),('Carrefour Jiji',2),('Okala',3),('Cité des Ailes',4)) AS x(name,ord) ON true
WHERE z.name='Akanda'
ON CONFLICT(zone_id,name) DO UPDATE SET sort_order=EXCLUDED.sort_order,active=true;