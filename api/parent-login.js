import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

export default async function(req,res){
  const name=String(req.body?.guardianName||"").trim().toLowerCase();
  const pin=String(req.body?.pin||"").trim();
  if(!name||!pin) return res.status(400).json({ok:false,error:"Nom du parent et mot de passe requis."});

  const q=await db.query(`
    SELECT s.id,s.name,s.guardian_name,s.zone,s.pickup,s.school,s.bus_id,s.monthly_amount,s.status,s.absence_today,
           s.morning_pickup_planned,s.school_start_time,s.return_pickup_planned,s.return_arrival_planned,
           b.label AS bus_label,b.plate,
           r.status AS bus_status,r.current_leg,r.current_location_label,
           r.morning_departure_planned,r.morning_arrival_planned,r.return_departure_planned,r.return_arrival_planned,
           r.morning_departed_at,r.morning_arrived_at,r.return_departed_at,r.return_arrived_at
    FROM school_students s
    LEFT JOIN school_buses b ON b.id=s.bus_id
    LEFT JOIN school_runs r ON r.bus_id=s.bus_id
    WHERE lower(trim(s.guardian_name))=$1 AND s.guardian_pin=$2
    ORDER BY s.name
  `,[name,pin]);

  if(!q.rows.length) return res.status(401).json({ok:false,error:"Nom du parent ou mot de passe incorrect."});

  const children=[];
  for(const s of q.rows){
    const bd=await db.query("SELECT leg,status,boarded_at,dropped_at FROM school_boardings WHERE student_id=$1 AND service_date=CURRENT_DATE ORDER BY leg",[s.id]);
    children.push({...s,boardings:bd.rows});
  }
  res.json({ok:true,guardianName:q.rows[0].guardian_name,children});
}