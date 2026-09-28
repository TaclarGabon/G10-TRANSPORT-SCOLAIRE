ALTER TABLE school_fares ADD COLUMN IF NOT EXISTS stop_id INTEGER REFERENCES school_stops(id) ON DELETE CASCADE;
ALTER TABLE school_fares ADD COLUMN IF NOT EXISTS destination_id INTEGER REFERENCES school_destinations(id) ON DELETE CASCADE;
ALTER TABLE school_fares ADD COLUMN IF NOT EXISTS daily_amount INTEGER;
UPDATE school_fares SET daily_amount=COALESCE(daily_amount,1500) WHERE daily_amount IS NULL;