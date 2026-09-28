const express=require("express");
const cors=require("cors");
const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");

const {handlePinAuth}=require("./lib/pin-auth");
const {handleState}=require("./lib/state");
const {handleAdminSave}=require("./lib/admin");
const {handleSchoolAction}=require("./lib/school");
const {handleDriverAction}=require("./lib/driver");
const {handleManagementAction}=require("./lib/management");
const {handleParentLogin}=require("./lib/parent");
const {handleReset}=require("./lib/reset");
const {DRIVER_PIN_SECRETS}=require("./lib/seed");

const ADMIN_PIN=defineSecret("ADMIN_PIN");
const OPERATIONS_PIN=defineSecret("OPERATIONS_PIN");
const GUARD_PIN=defineSecret("GUARD_PIN");
const DIRECTION_PIN=defineSecret("DIRECTION_PIN");

const pinApp=express();
pinApp.use(cors({origin:true}));
pinApp.use(express.json({limit:"1mb"}));
pinApp.post("/",async(req,res)=>{
  try{
    await handlePinAuth(req,res,{
      ADMIN:ADMIN_PIN.value(),
      OPERATIONS:OPERATIONS_PIN.value(),
      GUARD:GUARD_PIN.value(),
      DIRECTION:DIRECTION_PIN.value()
    });
  }catch(e){
    console.error("pinAuth",e);
    res.status(e.status||500).json({ok:false,error:e.message||"Erreur d’authentification."});
  }
});
pinApp.all("*",(req,res)=>res.status(405).json({ok:false,error:"Méthode non autorisée."}));

exports.pinAuth=onRequest({
  region:"europe-west1",
  secrets:[ADMIN_PIN,OPERATIONS_PIN,GUARD_PIN,DIRECTION_PIN,...DRIVER_PIN_SECRETS],
  timeoutSeconds:30,
  memory:"256MiB"
},pinApp);

const app=express();
app.use(cors({origin:true}));
app.use(express.json({limit:"2mb"}));

function wrap(handler){
  return async(req,res)=>{
    try{await handler(req,res);}
    catch(e){
      console.error(req.path,e);
      res.status(e.status||500).json({ok:false,error:e.message||"Erreur serveur Firebase."});
    }
  };
}

app.get("/",(req,res)=>res.json({ok:true,service:"G10 Transport Scolaire Firebase API"}));
app.get("/state",wrap(handleState));
app.post("/admin-save",wrap(handleAdminSave));
app.post("/school-action",wrap(handleSchoolAction));
app.post("/driver-action",wrap(handleDriverAction));
app.post("/management-action",wrap(handleManagementAction));
app.post("/parent-login",wrap(handleParentLogin));
app.post("/reset-demo",wrap(handleReset));

app.use((req,res)=>res.status(404).json({ok:false,error:"Route Firebase introuvable."}));

exports.api=onRequest({
  region:"europe-west1",
  secrets:[...DRIVER_PIN_SECRETS],
  timeoutSeconds:60,
  memory:"512MiB"
},app);
