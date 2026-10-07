require("dotenv").config();
const express=require("express"), path=require("path"), crypto=require("crypto"), Database=require("better-sqlite3");
const multer=require("multer");
const app=express(), db=new Database("amour.db");
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});
app.use(express.json({limit:"2mb"})); app.use(express.static(path.join(__dirname,"public")));
db.exec(`CREATE TABLE IF NOT EXISTS invitations(
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, answer TEXT, created_at TEXT NOT NULL, answered_at TEXT
)`);
function id(){return crypto.randomBytes(5).toString("base64url")}
async function tg(text){
 const token=process.env.TELEGRAM_BOT_TOKEN, chat=process.env.TELEGRAM_CHAT_ID;
 if(!token||!chat)return;
 await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chat,text})});
}
app.post("/api/invitations",upload.single("photo"),async(req,res)=>{
 try{
  const p={...req.body};
  if(req.file)p.photo="data:"+req.file.mimetype+";base64,"+req.file.buffer.toString("base64");
  const key=id(); db.prepare("INSERT INTO invitations VALUES(?,?,?,?,?)").run(key,JSON.stringify(p),null,new Date().toISOString(),null);
  res.json({id:key,url:`${process.env.BASE_URL||"http://localhost:3000"}/i/${key}`});
 }catch(e){res.status(500).json({error:"Не удалось создать приглашение"})}
});
app.get("/api/invitations/:id",(req,res)=>{
 const r=db.prepare("SELECT id,payload,answer,created_at,answered_at FROM invitations WHERE id=?").get(req.params.id);
 if(!r)return res.status(404).json({error:"Приглашение не найдено"});
 res.json({...r,payload:JSON.parse(r.payload)});
});
app.post("/api/invitations/:id/answer",async(req,res)=>{
 const answer=req.body.answer;
 if(!["yes","later"].includes(answer))return res.status(400).json({error:"Неверный ответ"});
 const r=db.prepare("SELECT payload FROM invitations WHERE id=?").get(req.params.id);
 if(!r)return res.status(404).json({error:"Не найдено"});
 const now=new Date().toISOString();
 db.prepare("UPDATE invitations SET answer=?,answered_at=? WHERE id=?").run(answer,now,req.params.id);
 const p=JSON.parse(r.payload);
 await tg(`💌 AMOUR — новый ответ\n\n${p.name||"Получатель"}: ${answer==="yes"?"❤️ ДА, конечно!":"🕐 Давай позже"}\n📅 ${p.date||"-"} ${p.time||""}\n📍 ${p.place||"-"}\n\nПриглашение: ${process.env.BASE_URL||""}/i/${req.params.id}`);
 res.json({ok:true});
});
app.get("/api/admin/invitations",(req,res)=>{
 const rows=db.prepare("SELECT id,payload,answer,created_at,answered_at FROM invitations ORDER BY created_at DESC").all();
 res.json(rows.map(x=>({...x,payload:JSON.parse(x.payload)})));
});
app.get("/i/:id",(req,res)=>res.sendFile(path.join(__dirname,"public","invite.html")));
app.get("/health",(req,res)=>res.json({ok:true}));
app.listen(process.env.PORT||3000,()=>console.log("AMOUR running"));
