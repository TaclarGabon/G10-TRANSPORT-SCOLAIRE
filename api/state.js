import { db } from "hatchable";

export const access = "public";
export const methods = ["GET"];

async function ensureBase(){
  await db.query("INSERT INTO school_drivers (id,name,pin,employment_status,active_status,access_status,session_version) SELECT 1,$1,$2,$3,$4,'AUTORISE',1 WHERE NOT EXISTS (SELECT 1 FROM school_drivers WHERE id=1)",["","1201","ACTIF","ACTIF"]);
  await db.query("INSERT INTO school_drivers (id,name,pin,employment_status,active_status,access_status,session_version) SELECT 2,$1,$2,$3,$4,'AUTORISE',1 WHERE NOT EXISTS (SELECT 1 FROM school_drivers WHERE id=2)",["","1202","ACTIF","ACTIF"]);

  await db.query("INSERT INTO school_buses (id,label,capacity,route_name,start_name,stop_name,end_name,scheduled_start,plate,active) SELECT 1,$1,$2,'','','','',$3,'',true WHERE NOT EXISTS (SELECT 1 FROM school_buses WHERE id=1)",["Bus 1",23,"À définir"]);
  await db.query("INSERT INTO school_buses (id,label,capacity,route_name,start_name,stop_name,end_name,scheduled_start,plate,active) SELECT 2,$1,$2,'','','','',$3,'',true WHERE NOT EXISTS (SELECT 1 FROM school_buses WHERE id=2)",["Bus 2",23,"À définir"]);

  await db.query("INSERT INTO school_runs (bus_id,status,checklist,boarded,stage,current_leg,morning_departure_planned,morning_arrival_planned,return_departure_planned,return_arrival_planned) SELECT 1,$1,$2::jsonb,0,0,'MATIN','06:30','08:00','15:00','18:30' WHERE NOT EXISTS (SELECT 1 FROM school_runs WHERE bus_id=1)",["NON_ASSIGNE","{}"]);
  await db.query("INSERT INTO school_runs (bus_id,status,checklist,boarded,stage,current_leg,morning_departure_planned,morning_arrival_planned,return_departure_planned,return_arrival_planned) SELECT 2,$1,$2::jsonb,0,0,'MATIN','06:30','08:00','15:00','18:30' WHERE NOT EXISTS (SELECT 1 FROM school_runs WHERE bus_id=2)",["NON_ASSIGNE","{}"]);
}

async function ensureFareMatrix(){
  await db.query(`
    INSERT INTO school_fares
      (zone,pickup,school,monthly_amount,active,stop_id,destination_id,daily_amount,updated_at)
    SELECT z.name,s.name,d.name,0,true,s.id,d.id,1500,now()
    FROM school_zones z
    JOIN school_stops s ON s.zone_id=z.id AND s.active=true
    JOIN school_destination_zones dz ON dz.zone_id=z.id AND dz.active=true
    JOIN school_destinations d ON d.id=dz.destination_id AND d.active=true
    WHERE z.active=true
      AND NOT EXISTS (
        SELECT 1 FROM school_fares f
        WHERE f.active=true
          AND f.stop_id=s.id
          AND f.destination_id=d.id
      )
  `);
  await db.query("UPDATE school_fares SET daily_amount=COALESCE(daily_amount,1500) WHERE active=true");
}

export default async function(req,res){
  await ensureBase();
  await ensureFareMatrix();

  const drivers = await db.query("SELECT id,name,employment_status,active_status,access_status,session_version,archived_at,updated_at FROM school_drivers ORDER BY id");
  const buses = await db.query("SELECT id,label,capacity,plate,active FROM school_buses ORDER BY id");
  const zones = await db.query("SELECT id,name,active,updated_at FROM school_zones WHERE active=true ORDER BY id");
  const stops = await db.query("SELECT id,zone_id,name,sort_order,active,updated_at FROM school_stops WHERE active=true ORDER BY zone_id,sort_order,id");
  const destinations = await db.query("SELECT id,name,demo_zone,active,updated_at FROM school_destinations WHERE active=true ORDER BY name");
  const destinationZones = await db.query("SELECT destination_id,zone_id,sort_order,active,updated_at FROM school_destination_zones WHERE active=true ORDER BY zone_id,sort_order,destination_id");
  const runs = await db.query(`
    SELECT r.bus_id,r.driver_id,r.zone_id,r.status,r.checklist,r.boarded,r.stage,
           r.current_stop_id,r.current_leg,r.current_location_label,
           r.morning_departure_planned,r.morning_arrival_planned,r.return_departure_planned,r.return_arrival_planned,
           r.morning_departed_at,r.morning_arrived_at,r.return_departed_at,r.return_arrived_at,
           r.departed_at,r.arrived_at,r.updated_at,
           d.name AS driver_name,
           z.name AS zone_name
    FROM school_runs r
    LEFT JOIN school_drivers d ON d.id=r.driver_id
    LEFT JOIN school_zones z ON z.id=r.zone_id
    ORDER BY r.bus_id
  `);
  const students = await db.query(`
    SELECT id,name,guardian_name,guardian_phone,zone,pickup,school,bus_id,monthly_amount,status,absence_today,
           morning_pickup_planned,school_start_time,return_pickup_planned,return_arrival_planned,
           created_at,updated_at
    FROM school_students
    ORDER BY name
  `);
  const fares = await db.query("SELECT id,zone,pickup,school,stop_id,destination_id,daily_amount,active,updated_at FROM school_fares WHERE active=true ORDER BY zone,pickup,school");
  const boardings = await db.query("SELECT id,student_id,service_date,leg,status,boarded_at,dropped_at,updated_at FROM school_boardings WHERE service_date=CURRENT_DATE ORDER BY student_id,leg");
  const dailyRides = await db.query(`
    SELECT dr.id,dr.service_date,dr.bus_id,dr.zone_id,dr.stop_id,dr.destination_id,dr.leg,dr.fare_amount,dr.status,dr.boarded_at,dr.dropped_at,
           s.name AS stop_name,d.name AS destination_name
    FROM school_daily_rides dr
    LEFT JOIN school_stops s ON s.id=dr.stop_id
    LEFT JOIN school_destinations d ON d.id=dr.destination_id
    WHERE dr.service_date=CURRENT_DATE
    ORDER BY dr.boarded_at
  `);
  const cashClosures = await db.query("SELECT id,service_date,bus_id,expected_amount,counted_amount,handed_to,transfer_method,destination_phone,transaction_reference,note,closed_at FROM school_cash_closures WHERE service_date=CURRENT_DATE ORDER BY bus_id");
  const driverWarnings = await db.query("SELECT id,driver_id,complaint_date,reason,details,recorded_by,status,acknowledged_at,created_at,updated_at FROM school_driver_warnings ORDER BY complaint_date DESC,id DESC");
  const driverActivity = await db.query("SELECT id,driver_id,bus_id,service_date,leg,passengers_transported,capacity,planned_end,actual_end,checklist_ok,created_at FROM school_driver_activity ORDER BY service_date DESC,id DESC");
  const driverMonthAwards = await db.query("SELECT month_key,driver_id,validated_by,validated_at FROM school_driver_month_awards ORDER BY month_key DESC");

  res.json({
    drivers:drivers.rows,
    buses:buses.rows,
    zones:zones.rows,
    stops:stops.rows,
    destinations:destinations.rows,
    destinationZones:destinationZones.rows,
    runs:runs.rows,
    students:students.rows,
    fares:fares.rows,
    boardings:boardings.rows,
    dailyRides:dailyRides.rows,
    cashClosures:cashClosures.rows,
    driverWarnings:driverWarnings.rows,
    driverActivity:driverActivity.rows,
    driverMonthAwards:driverMonthAwards.rows,
    server_time:new Date().toISOString()
  });
}