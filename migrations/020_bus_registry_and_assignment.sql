ALTER TABLE school_buses ADD COLUMN IF NOT EXISTS plate TEXT NOT NULL DEFAULT '';
ALTER TABLE school_buses ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES school_zones(id);
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS scheduled_arrival TEXT;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS current_stop_id INTEGER REFERENCES school_stops(id);
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS current_leg TEXT NOT NULL DEFAULT 'MATIN';
UPDATE school_buses SET route_name='' WHERE route_name IN ('Zone Akanda','Zone Owendo');
UPDATE school_buses SET start_name='',stop_name='',end_name='',scheduled_start='À définir' WHERE id IN (1,2);