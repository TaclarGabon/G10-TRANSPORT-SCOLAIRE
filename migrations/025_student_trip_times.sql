ALTER TABLE school_students ADD COLUMN IF NOT EXISTS morning_pickup_planned TEXT;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS school_start_time TEXT;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS return_pickup_planned TEXT;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS return_arrival_planned TEXT;