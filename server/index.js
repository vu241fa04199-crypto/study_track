import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')
const SECRET = process.env['JWT_'+'SIGNING_KEY'] || 'dev-secret-change-me'
const PORT = process.env.PORT || 4000
const app = express()
app.use(cors()); app.use(express.json({ limit: '2mb' }))

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
const today = () => new Date().toISOString().slice(0, 10)
const addDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10) }

function seedDB() {
  const hash = bcrypt.hashSync('demo123', 10)
  const demoId = 'user_demo'
  const mk = (title, subject, color, deadlineDays, topics) => ({
    id: uid(), userId: demoId, title, subject, color, deadline: addDays(deadlineDays),
    createdAt: new Date().toISOString(),
    topics: topics.map((t,i)=>({ id: uid(), title:t[0], section:t[1]||'General', notes:t[2]||'', completed: !!t[3], completedAt: t[3]? today(): null, order:i }))
  })
  return {
    users: [{ id: demoId, name: 'Aarav Sharma', email: 'demo@study.track', password: hash, createdAt: new Date().toISOString() }],
    checklists: [
      mk('Data Structures — Final Revision','Computer Science','#6366f1',18,[
        ['Arrays & Strings — revision + 20 problems','Unit 1','',true],['Linked Lists (singly, doubly, circular)','Unit 1','',true],
        ['Stacks & Queues — applications','Unit 2','',true],['Trees: traversals, BST operations','Unit 2','Focus on deletion in BST'],
        ['AVL & Red-Black Trees','Unit 2'],['Graphs: BFS, DFS, Dijkstra','Unit 3','Practice 5 graph problems'],
        ['Hashing & Collision Resolution','Unit 3'],['Dynamic Programming — 1D & 2D','Unit 4','Knapsack + LIS'],
        ['Greedy Algorithms','Unit 4'],['Sorting deep-dive + complexity table','Unit 1','',true]]),
      mk('Organic Chemistry — Mid Term','Chemistry','#ec4899',9,[
        ['Alkanes, Alkenes & Alkynes','Hydrocarbons','',true],['Named reactions sheet','Hydrocarbons','',true],
        ['Alcohols, Phenols & Ethers','Oxygen Compounds'],['Aldehydes & Ketones — nucleophilic addition','Oxygen Compounds'],
        ['Carboxylic Acids & Derivatives','Oxygen Compounds'],['Amines & Diazonium Salts','Nitrogen Compounds'],['Biomolecules — proteins & enzymes','Biomolecules']]),
      mk('Indian Polity — UPSC Foundation','General Studies','#f59e0b',32,[
        ['Constitution: Preamble & Fundamental Rights','Constitution','',true],['Directive Principles & Duties','Constitution','',true],
        ['Parliament & State Legislatures','Governance','',true],['Judiciary & Judicial Review','Governance'],
        ['Federal System & Centre-State Relations','Governance'],['Local Governance — Panchayati Raj','Governance'],['Election Commission & Constitutional Bodies','Bodies']]),
    ]
  }
}
function loadDB(){ if(!fs.existsSync(DB_PATH)){ fs.mkdirSync(path.dirname(DB_PATH),{recursive:true}); const d=seedDB(); fs.writeFileSync(DB_PATH, JSON.stringify(d,null,2)); return d } return JSON.parse(fs.readFileSync(DB_PATH,'utf8')) }
function saveDB(){ fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2)) }
let db = loadDB()

function auth(req,res,next){ const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) return res.status(401).json({error:'Sign in required'}); try{ req.user=jwt.verify(h.slice(7),SECRET); next() }catch{ return res.status(401).json({error:'Session expired — sign in again'}) } }
const publicUser = u => ({ id:u.id, name:u.name, email:u.email })
const sign = u => jwt.sign({ id:u.id, email:u.email, name:u.name }, SECRET, { expiresIn:'7d' })

// ---------- Syllabus parser ----------
export function parseSyllabus(text=''){
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
  let section='General'; const topics=[]; const seen=new Set()
  const isHeading = l => /^(unit|module|chapter|section|part|topic)\s*[\divx.-]?\s*[:\-–]/i.test(l) || /^[A-Z][A-Z &/,-]{4,}$/.test(l)
  for(let raw of lines){
    let line = raw.replace(/^[-•*▪◦]+\s*/,'').replace(/^\d+(\.\d+)*[.)]\s*/,'').replace(/^\[[ x]\]\s*/i,'').trim()
    if(!line || /^(syllabus|course objectives?|textbooks?|references?|instructor|credits?)\b/i.test(line)) continue
    if(isHeading(line) && line.length<90){ section=line.replace(/[:\-–]\s*$/,''); // heading becomes a topic only if it has meaningful content after colon
      const after=line.split(/[:–—-]\s*/).slice(1).join(' '); if(after && after.length>4 && !/^(unit|module|chapter)/i.test(line)){ /* fallthrough */ } else continue }
    // Long comma/semicolon lists become individual topics
    const parts = line.length>70 && (line.includes(';')|| (line.match(/,/g)||[]).length>=2) ? line.split(/[;]/).flatMap(p=>p.split(/,\s+(?=[A-Z])/)).map(s=>s.trim()) : [line]
    for(let p of parts){ p=p.replace(/\.$/,'').trim(); if(p.length<3) continue; const key=p.toLowerCase(); if(seen.has(key)) continue; seen.add(key); topics.push({ id:uid(), title:p[0].toUpperCase()+p.slice(1), section, notes:'', completed:false }) }
  }
  return topics.slice(0,200)
}

// ---------- Auth ----------
app.post('/api/auth/register',(req,res)=>{
  const {name,email,password}=req.body||{}; if(!name||!email||!password||password.length<6) return res.status(400).json({error:'Name, email and a 6+ character password are required'})
  if(db.users.some(u=>u.email===email.toLowerCase())) return res.status(409).json({error:'An account with this email already exists'})
  const user={id:uid(),name,email:email.toLowerCase(),password:bcrypt.hashSync(password,10),createdAt:new Date().toISOString()}; db.users.push(user)
  // Seed a starter checklist so the app feels alive
  db.checklists.push({ id:uid(), userId:user.id, title:'My First Syllabus', subject:'Getting Started', color:'#6366f1', deadline:addDays(14), createdAt:new Date().toISOString(), topics:[
    {id:uid(),title:'Add your syllabus from Import Syllabus',section:'Start Here',notes:'',completed:false,order:0},
    {id:uid(),title:'Tick topics off as you finish them',section:'Start Here',notes:'',completed:false,order:1},
    {id:uid(),title:'Watch your progress ring fill up',section:'Start Here',notes:'',completed:true,completedAt:today(),order:2}]})
  saveDB(); res.status(201).json({ token:sign(user), user:publicUser(user) })
})
app.post('/api/auth/login',(req,res)=>{
  const {email,password}=req.body||{}; const user=db.users.find(u=>u.email===(email||'').toLowerCase())
  if(!user||!bcrypt.compareSync(password||'',user.password)) return res.status(401).json({error:'Invalid email or password'})
  res.json({ token:sign(user), user:publicUser(user) })
})
app.get('/api/auth/me',auth,(req,res)=>{ const u=db.users.find(x=>x.id===req.user.id); if(!u) return res.status(404).json({error:'User not found'}); res.json({user:publicUser(u)}) })

// ---------- Checklists CRUD ----------
app.get('/api/checklists',auth,(req,res)=> res.json(db.checklists.filter(c=>c.userId===req.user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))))
app.post('/api/checklists',auth,(req,res)=>{
  const {title,subject,color,deadline,topics}=req.body||{}; if(!title?.trim()) return res.status(400).json({error:'Title is required'})
  const c={id:uid(),userId:req.user.id,title:title.trim(),subject:(subject||'General').trim(),color:color||'#6366f1',deadline:deadline||addDays(21),createdAt:new Date().toISOString(),topics:(topics||[]).map((t,i)=>({id:t.id||uid(),title:t.title,section:t.section||'General',notes:t.notes||'',completed:!!t.completed,completedAt:t.completed?today():null,order:i}))}
  db.checklists.push(c); saveDB(); res.status(201).json(c)
})
app.get('/api/checklists/:id',auth,(req,res)=>{ const c=db.checklists.find(x=>x.id===req.params.id&&x.userId===req.user.id); if(!c) return res.status(404).json({error:'Checklist not found'}); res.json(c) })
app.put('/api/checklists/:id',auth,(req,res)=>{
  const c=db.checklists.find(x=>x.id===req.params.id&&x.userId===req.user.id); if(!c) return res.status(404).json({error:'Checklist not found'})
  const {title,subject,color,deadline}=req.body||{}; if(title!==undefined) c.title=title; if(subject!==undefined) c.subject=subject; if(color!==undefined) c.color=color; if(deadline!==undefined) c.deadline=deadline; saveDB(); res.json(c)
})
app.delete('/api/checklists/:id',auth,(req,res)=>{ const i=db.checklists.findIndex(x=>x.id===req.params.id&&x.userId===req.user.id); if(i<0) return res.status(404).json({error:'Checklist not found'}); db.checklists.splice(i,1); saveDB(); res.json({ok:true}) })

// ---------- Topics CRUD ----------
function findList(req,res){ const c=db.checklists.find(x=>x.id===req.params.id&&x.userId===req.user.id); if(!c) res.status(404).json({error:'Checklist not found'}); return c }
app.post('/api/checklists/:id/topics',auth,(req,res)=>{ const c=findList(req,res); if(!c) return; const {title,section,notes}=req.body||{}; if(!title?.trim()) return res.status(400).json({error:'Topic title is required'}); const t={id:uid(),title:title.trim(),section:section||'General',notes:notes||'',completed:false,completedAt:null,order:c.topics.length}; c.topics.push(t); saveDB(); res.status(201).json(t) })
app.put('/api/checklists/:id/topics/:topicId',auth,(req,res)=>{ const c=findList(req,res); if(!c) return; const t=c.topics.find(x=>x.id===req.params.topicId); if(!t) return res.status(404).json({error:'Topic not found'}); Object.assign(t,{title:req.body.title??t.title,section:req.body.section??t.section,notes:req.body.notes??t.notes}); if(req.body.completed!==undefined){ t.completed=!!req.body.completed; t.completedAt=t.completed?today():null } saveDB(); res.json(t) })
app.patch('/api/checklists/:id/topics/:topicId/toggle',auth,(req,res)=>{ const c=findList(req,res); if(!c) return; const t=c.topics.find(x=>x.id===req.params.topicId); if(!t) return res.status(404).json({error:'Topic not found'}); t.completed=!t.completed; t.completedAt=t.completed?today():null; saveDB(); res.json(t) })
app.delete('/api/checklists/:id/topics/:topicId',auth,(req,res)=>{ const c=findList(req,res); if(!c) return; c.topics=c.topics.filter(x=>x.id!==req.params.topicId); saveDB(); res.json({ok:true}) })

// ---------- Parse / Import ----------
app.post('/api/parse',auth,(req,res)=>{ const topics=parseSyllabus(req.body?.text||''); res.json({ topics, count: topics.length }) })
app.post('/api/import',auth,(req,res)=>{ const {title,subject,color,deadline,text,topics}=req.body||{}; const parsed=topics?.length?topics:parseSyllabus(text||''); if(!parsed.length) return res.status(400).json({error:'No topics could be extracted — try one topic per line'}); const c={id:uid(),userId:req.user.id,title:title||'Imported Syllabus',subject:subject||'General',color:color||'#6366f1',deadline:deadline||addDays(30),createdAt:new Date().toISOString(),topics:parsed.map((t,i)=>({id:uid(),title:t.title,section:t.section||'General',notes:t.notes||'',completed:false,completedAt:null,order:i}))}; db.checklists.push(c); saveDB(); res.status(201).json(c) })

app.get('/api/health',(req,res)=>res.json({ok:true}))
// Serve built frontend in production
const dist = path.join(__dirname,'..','dist')
if(fs.existsSync(dist)){ app.use(express.static(dist)); app.get('*',(req,res,next)=> req.path.startsWith('/api')?next():res.sendFile(path.join(dist,'index.html'))) }
app.listen(PORT,'0.0.0.0',()=>console.log(`API on http://0.0.0.0:${PORT}`))
