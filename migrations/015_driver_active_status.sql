ALTER TABLE school_drivers ADD COLUMN IF NOT EXISTS active_status TEXT NOT NULL DEFAULT 'ACTIF';
UPDATE school_drivers SET active_status='ACTIF' WHERE active_status IS NULL;