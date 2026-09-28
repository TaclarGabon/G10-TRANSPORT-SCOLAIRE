import { db } from "hatchable";

export const access="public";
export const methods=["POST"];

const HASHES={
  ADMIN:"c5866e93cab1776890fe343c9e7063fb",
  OPERATIONS:"e45823afe1e5120cec11fc4c379a0c67",
  GUARD:"2b45c629e577731c4df84fc34f936a89",
  DIRECTION:"959ef477884b6ac2241b19ee4fb776ae"
};

export default async function(req,res){
  const code=String(req.body?.code||"").trim();
  const requested=String(req.body?.requestedRole||"").trim().toUpperCase();
  const h=await db.query("SELECT md5($1) AS h",[code]);
  const digest=h.rows[0]?.h||"";
  const role=Object.keys(HASHES).find(k=>HASHES[k]===digest);

  if(!role) return res.status(401).json({ok:false,error:"Code d’accès incorrect."});
  if(requested&&requested!=="ADMIN_OR_DIRECTION"&&role!==requested){
    return res.status(403).json({ok:false,error:"Ce code ne donne pas accès à cette fonction."});
  }
  if(requested==="ADMIN_OR_DIRECTION"&&!["ADMIN","DIRECTION"].includes(role)){
    return res.status(403).json({ok:false,error:"Accès réservé à l’Administration ou à la Direction."});
  }

  const q=await db.query("SELECT md5(random()::text || clock_timestamp()::text || $1) AS token",[role]);
  const token=q.rows[0].token;
  await db.query("DELETE FROM school_management_sessions WHERE expires_at<now()");
  await db.query("INSERT INTO school_management_sessions(token,role,expires_at) VALUES ($1,$2,now()+interval '12 hours')",[token,role]);
  res.json({ok:true,role,token});
}