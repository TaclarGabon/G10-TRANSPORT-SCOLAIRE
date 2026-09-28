CREATE TABLE IF NOT EXISTS school_destination_zones (
  destination_id INTEGER NOT NULL REFERENCES school_destinations(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES school_zones(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(destination_id, zone_id)
);

INSERT INTO school_destination_zones(destination_id,zone_id,sort_order,active,updated_at)
SELECT d.id,z.id,
       ROW_NUMBER() OVER (PARTITION BY z.id ORDER BY d.id)::int,
       true,now()
FROM school_destinations d
JOIN school_zones z ON lower(trim(z.name))=lower(trim(d.demo_zone))
WHERE d.active=true AND z.active=true
ON CONFLICT(destination_id,zone_id) DO UPDATE
SET active=true,updated_at=now();