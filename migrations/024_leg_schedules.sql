ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS morning_departure_planned TEXT;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS morning_arrival_planned TEXT;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS return_departure_planned TEXT;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS return_arrival_planned TEXT;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS morning_departed_at TIMESTAMPTZ;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS morning_arrived_at TIMESTAMPTZ;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS return_departed_at TIMESTAMPTZ;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS return_arrived_at TIMESTAMPTZ;
ALTER TABLE school_runs ADD COLUMN IF NOT EXISTS current_location_label TEXT;

UPDATE school_runs r
SET morning_departure_planned = COALESCE(NULLIF(b.scheduled_start,'À définir'),'06:30'),
    morning_arrival_planned = COALESCE(NULLIF(r.scheduled_arrival,'À définir'),'08:00'),
    return_departure_planned = COALESCE(return_departure_planned,'15:00'),
    return_arrival_planned = COALESCE(return_arrival_planned,'18:30')
FROM school_buses b
WHERE b.id=r.bus_id;