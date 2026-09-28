import { storage } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function(req,res){
  const file=await storage.get("g10-school-hero.jpg");
  if(!file) return res.status(404).send("Image introuvable");
  res.setHeader("Content-Type",file.contentType||"image/jpeg");
  res.setHeader("Cache-Control","public, max-age=86400");
  res.send(file.buffer);
}