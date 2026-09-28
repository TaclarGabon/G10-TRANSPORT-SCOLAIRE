DELETE FROM school_daily_rides WHERE service_date=CURRENT_DATE;
DELETE FROM school_cash_closures WHERE service_date=CURRENT_DATE;

UPDATE school_runs
SET boarded=0,
    current_stop_id=NULL,
    current_location_label=NULL
WHERE bus_id IN (SELECT id FROM school_buses WHERE active=true);

UPDATE school_runs
SET morning_arrival_planned='08:00'
WHERE morning_arrival_planned IS NULL
   OR morning_arrival_planned='À définir'
   OR morning_arrival_planned>='12:00';

UPDATE school_runs
SET return_departure_planned='15:00'
WHERE return_departure_planned IS NULL OR return_departure_planned='À définir';

UPDATE school_runs
SET return_arrival_planned='18:30'
WHERE return_arrival_planned IS NULL OR return_arrival_planned='À définir';