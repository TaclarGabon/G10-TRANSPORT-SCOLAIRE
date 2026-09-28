import { events } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function(req,res){
  res.json(await events.grant(["g10-school-live"]));
}