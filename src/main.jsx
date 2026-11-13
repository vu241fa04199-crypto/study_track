import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = '/api'
const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#0ea5e9','#8b5cf6']
const SAMPLE = `Unit 1: Foundations
Introduction to the subject and key terminology
Core concepts and basic problem solving
Unit 2: Core Topics
- Main theories and frameworks
- Important formulas and derivations
- Previous year questions practice
Unit 3: Advanced Applications
Case studies and real-world examples
Revision, mock test and doubt clearing`

async function api(path, opts={}) {
  const token = localStorage.getItem('st_token')
  const res = await fetch(API+path, { ...opts, headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...(opts.headers||{}) } })
  const data = await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(data.error||'Something went wrong')
  return data
}
const stats = c => { const total=c.topics.length, done=c.topics.filter(t=>t.completed).length; return { total, done, left: total-done, pct: total? Math.round(done/total*100):0 } }
const daysLeft = d => Math.ceil((new Date(d+'T23:59:59') - new Date())/86400000)
const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})

function Ring({pct,color,size=92}){ const r=38,c=2*Math.PI*r; return <div className="ring" style={{width:size,height:size}}><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r={r} className="ring-bg"/><circle cx="46" cy="46" r={r} className="ring-fg" stroke={color} strokeDasharray={c} strokeDashoffset={c-(pct/100)*c}/></svg><b>{pct}%</b></div> }
function Skeleton(){ return <div className="grid">{[1,2,3].map(i=><div key={i} className="card skel"><div className="sk w40"/><div className="sk w80"/><div className="sk w60"/><div className="sk bar"/></div>)}</div> }
function Empty({icon,title,text,action}){ return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div> }
function Modal({children,onClose}){ return <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>{children}</div></div> }

function Auth({onAuth}){
  const [mode,setMode]=useState('login'),[form,setForm]=useState({name:'Aarav Sharma',email:'demo@study.track',password:'demo123'}),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const submit=async e=>{ e.preventDefault(); setBusy(true); setErr(''); try{ const d=await api(`/auth/${mode==='login'?'login':'register'}`,{method:'POST',body:JSON.stringify(form)}); localStorage.setItem('st_token',d.token); onAuth(d.user) }catch(ex){ setErr(ex.message) } finally{ setBusy(false) } }
  return <div className="auth-wrap"><div className="auth-hero"><div className="logo big">✓ StudyTrack</div><h1>Turn any syllabus<br/>into a plan you<br/><span>actually finish.</span></h1><p>Paste a syllabus copy, get an instant topic checklist, tick topics off, and always know exactly how much is left before your deadline.</p><div className="hero-stats"><div><b>100%</b><small>clarity on coverage</small></div><div><b>Live</b><small>progress %</small></div><div><b>Daily</b><small>pace guidance</small></div></div></div>
  <form className="auth-card" onSubmit={submit}><h2>{mode==='login'?'Welcome back':'Create your account'}</h2><p className="muted">{mode==='login'?'Demo is pre-filled — just hit sign in.':'Start tracking your first syllabus in a minute.'}</p>
  {mode==='register'&&<label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>}
  <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
  <label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label>
  {err&&<div className="error">{err}</div>}<button className="btn primary full" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in →':'Create account →'}</button>
  <button type="button" className="link" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'New here? Create an account':'Already have an account? Sign in'}</button></form></div>
}

function App(){
  const [user,setUser]=useState(null),[lists,setLists]=useState([]),[loading,setLoading]=useState(true),[view,setView]=useState('dashboard'),[activeId,setActiveId]=useState(null),[toast,setToast]=useState(''),[query,setQuery]=useState(''),[sidebar,setSidebar]=useState(false)
  const notify=m=>{ setToast(m); setTimeout(()=>setToast(''),2600) }
  const load=async()=>{ setLoading(true); try{ const [me,data]=await Promise.all([api('/auth/me'),api('/checklists')]); setUser(me.user); setLists(data) }catch{ localStorage.removeItem('st_token'); setUser(null) } finally{ setTimeout(()=>setLoading(false),350) } }
  useEffect(()=>{ localStorage.getItem('st_token')? load() : setLoading(false) },[])
  const active = lists.find(l=>l.id===activeId)
  const totals = useMemo(()=>{ const t=lists.reduce((a,c)=>{ const s=stats(c); a.total+=s.total; a.done+=s.done; return a },{total:0,done:0}); return {...t,left:t.total-t.done,pct:t.total?Math.round(t.done/t.total*100):0} },[lists])

  // optimistic toggle with rollback
  const toggle=async(list,topic)=>{ const prev=lists; setLists(ls=>ls.map(l=>l.id===list.id?{...l,topics:l.topics.map(t=>t.id===topic.id?{...t,completed:!t.completed}:t)}:l)); try{ await api(`/checklists/${list.id}/topics/${topic.id}/toggle`,{method:'PATCH'}) }catch(e){ setLists(prev); notify('Could not save — change reverted') } }
  const removeList=async id=>{ const prev=lists; setLists(ls=>ls.filter(l=>l.id!==id)); setView('checklists'); try{ await api(`/checklists/${id}`,{method:'DELETE'}); notify('Checklist deleted') }catch{ setLists(prev); notify('Delete failed') } }
  const updateList=(updated)=> setLists(ls=>ls.map(l=>l.id===updated.id?updated:l))

  if(loading && !user) return <div className="center"><div className="spinner"/><p>Loading StudyTrack…</p></div>
  if(!user) return <Auth onAuth={u=>{ setUser(u); load() }}/>

  const nav=[['dashboard','▦','Dashboard'],['checklists','☑','My Checklists'],['import','⇪','Import Syllabus'],['completed','★','Completed']]
  return <div className="shell">
    <aside className={sidebar?'sidebar open':'sidebar'}><div className="logo">✓ StudyTrack</div><div className="user-chip"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{user.email}</small></div></div>
      <nav>{nav.map(([k,icon,label])=><button key={k} className={view===k?'nav active':'nav'} onClick={()=>{setView(k);setActiveId(null);setSidebar(false)}}><span>{icon}</span>{label}</button>)}</nav>
      <div className="side-progress"><span>Overall progress</span><div className="progress"><i style={{width:totals.pct+'%'}}/></div><b>{totals.pct}%</b><small>{totals.done} of {totals.total} topics done</small></div>
      <button className="nav logout" onClick={()=>{localStorage.removeItem('st_token');setUser(null);setLists([])}}>↩ Sign out</button></aside>
    {sidebar&&<div className="scrim" onClick={()=>setSidebar(false)}/>}
    <main>
      <header className="topbar"><button className="icon-btn menu" onClick={()=>setSidebar(true)}>☰</button><div className="search">⌕<input placeholder="Search checklists or topics…" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="btn primary" onClick={()=>setView('import')}>+ Import syllabus</button></header>

      {loading? <Skeleton/> : active? <Detail list={active} back={()=>setActiveId(null)} toggle={toggle} updateList={updateList} onDelete={removeList} notify={notify}/> :
      view==='dashboard'? <Dashboard lists={lists} totals={totals} open={id=>setActiveId(id)} go={setView} query={query}/> :
      view==='import'? <Import onDone={c=>{ setLists(ls=>[c,...ls]); setActiveId(c.id); notify('Syllabus converted into a checklist 🎉') }} notify={notify}/> :
      view==='completed'? <Completed lists={lists} open={id=>setActiveId(id)} toggle={toggle}/> :
      <Checklists lists={lists} query={query} open={id=>setActiveId(id)} go={setView} onCreated={c=>{setLists(ls=>[c,...ls]);setActiveId(c.id)}} notify={notify}/>}
    </main>{toast&&<div className="toast">{toast}</div>}
  </div>
}

function Dashboard({lists,totals,open,go,query}){
  const upcoming=[...lists].sort((a,b)=>new Date(a.deadline)-new Date(b.deadline))
  const filtered = query? lists.filter(l=>(l.title+l.subject+l.topics.map(t=>t.title).join(' ')).toLowerCase().includes(query.toLowerCase())) : lists
  return <><div className="page-head"><div><h1>Good day! 👋</h1><p className="muted">Here is where your preparation stands right now.</p></div><button className="btn ghost" onClick={()=>go('import')}>+ New checklist</button></div>
  <div className="stat-grid"><div className="stat"><span>Overall completion</span><b>{totals.pct}%</b><div className="progress"><i style={{width:totals.pct+'%'}}/></div><small>{totals.done}/{totals.total} topics</small></div><div className="stat"><span>Topics completed</span><b>{totals.done}</b><small>Keep the streak going 🔥</small></div><div className="stat"><span>Still to cover</span><b>{totals.left}</b><small>topics across {lists.length} checklists</small></div><div className="stat"><span>Active checklists</span><b>{lists.length}</b><small>{upcoming[0]?`Next deadline: ${fmtDate(upcoming[0].deadline)}`:'No deadlines yet'}</small></div></div>
  <h2 className="section-title">{query?'Search results':'Your checklists'}</h2>
  {filtered.length===0? <Empty icon="📚" title={query?'No matches found':'No checklists yet'} text={query?'Try a different search term.':'Import a syllabus copy and we will turn it into a checklist instantly.'} action={<button className="btn primary" onClick={()=>go('import')}>Import a syllabus</button>}/> :
  <div className="grid">{filtered.map(c=><ListCard key={c.id} c={c} open={()=>open(c.id)}/>)}</div>}</>
}
function ListCard({c,open}){ const s=stats(c),d=daysLeft(c.deadline); return <article className="card clickable" onClick={open}><div className="card-top"><span className="tag" style={{background:c.color+'22',color:c.color}}>{c.subject}</span><span className={d<0?'due overdue':d<=7?'due soon':'due'}>{d<0?`${-d}d overdue`:d===0?'Due today':`${d} days left`}</span></div><h3>{c.title}</h3><div className="card-mid"><Ring pct={s.pct} color={c.color} size={76}/><div><b>{s.done}/{s.total} topics done</b><p className="muted">{s.left} still to cover<br/>Deadline · {fmtDate(c.deadline)}</p></div></div><div className="progress"><i style={{width:s.pct+'%',background:c.color}}/></div><span className="open-link">Open checklist →</span></article> }

function Checklists({lists,query,open,go,onCreated,notify}){
  const [show,setShow]=useState(false),[form,setForm]=useState({title:'',subject:'',deadline:'',color:COLORS[0]})
  const filtered=lists.filter(l=>(l.title+l.subject).toLowerCase().includes(query.toLowerCase()))
  const create=async e=>{ e.preventDefault(); try{ const c=await api('/checklists',{method:'POST',body:JSON.stringify(form)}); onCreated(c); notify('Checklist created') }catch(err){ notify(err.message) } }
  return <><div className="page-head"><div><h1>My Checklists</h1><p className="muted">Create, open and manage every syllabus you are tracking.</p></div><div className="row"><button className="btn ghost" onClick={()=>setShow(true)}>+ Blank checklist</button><button className="btn primary" onClick={()=>go('import')}>Import syllabus</button></div></div>
  {filtered.length===0? <Empty icon="🗂️" title="Nothing here yet" text="Create a blank checklist or import a syllabus to get started." action={<button className="btn primary" onClick={()=>go('import')}>Import syllabus</button>}/> : <div className="grid">{filtered.map(c=><ListCard key={c.id} c={c} open={()=>open(c.id)}/>)}</div>}
  {show&&<Modal onClose={()=>setShow(false)}><h2>New blank checklist</h2><form onSubmit={create} className="form"><label>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Physics — Term 1" required/></label><label>Subject<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Physics"/></label><label>Deadline<input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label><label>Colour<div className="colors">{COLORS.map(col=><button type="button" key={col} className={form.color===col?'swatch sel':'swatch'} style={{background:col}} onClick={()=>setForm({...form,color:col})}/>)}</div></label><button className="btn primary full">Create checklist</button></form></Modal>}</>
}

function Detail({list,back,toggle,updateList,onDelete,notify}){
  const s=stats(list), d=daysLeft(list.deadline), [filter,setFilter]=useState('all'),[topicForm,setTopicForm]=useState({title:'',section:'',notes:''}),[editing,setEditing]=useState(null),[editMeta,setEditMeta]=useState(false)
  const pace = s.left===0? 'All done 🎉' : d<0? `${s.left} topics overdue — revise your deadline or sprint today` : d===0? `${s.left} topics due today` : `${Math.ceil(s.left/Math.max(d,1)*10)/10} topics/day needed to finish on time`
  const shown=list.topics.filter(t=>filter==='all'||(filter==='done'?t.completed:!t.completed))
  const sections=[...new Set(shown.map(t=>t.section||'General'))]
  const addTopic=async e=>{ e.preventDefault(); try{ const t=await api(`/checklists/${list.id}/topics`,{method:'POST',body:JSON.stringify(topicForm)}); updateList({...list,topics:[...list.topics,t]}); setTopicForm({title:'',section:'',notes:''}); notify('Topic added') }catch(err){ notify(err.message) } }
  const saveTopic=async()=>{ try{ const t=await api(`/checklists/${list.id}/topics/${editing.id}`,{method:'PUT',body:JSON.stringify(editing)}); updateList({...list,topics:list.topics.map(x=>x.id===t.id?t:x)}); setEditing(null) }catch(err){ notify(err.message) } }
  const delTopic=async t=>{ updateList({...list,topics:list.topics.filter(x=>x.id!==t.id)}); try{ await api(`/checklists/${list.id}/topics/${t.id}`,{method:'DELETE'}) }catch{ notify('Delete failed') } }
  const saveMeta=async e=>{ e.preventDefault(); const fd=new FormData(e.target); const body=Object.fromEntries(fd); try{ const c=await api(`/checklists/${list.id}`,{method:'PUT',body:JSON.stringify(body)}); updateList(c); setEditMeta(false); notify('Checklist updated') }catch(err){ notify(err.message) } }
  return <><button className="link back" onClick={back}>← All checklists</button>
  <div className="detail-head card"><div className="detail-info"><span className="tag" style={{background:list.color+'22',color:list.color}}>{list.subject}</span><h1>{list.title}</h1><p className="muted">📅 Deadline {fmtDate(list.deadline)} · {d<0?`${-d} days overdue`:d===0?'Due today':`${d} days left`} · {pace}</p><div className="row"><button className="btn ghost sm" onClick={()=>setEditMeta(true)}>✎ Edit details</button><button className="btn danger sm" onClick={()=>confirm('Delete this checklist and all its topics?')&&onDelete(list.id)}>Delete</button></div></div><div className="detail-ring"><Ring pct={s.pct} color={list.color} size={120}/><div><b>{s.done} done</b><span>{s.left} to cover · {s.pct}% complete</span></div></div></div>
  <div className="toolbar"><div className="tabs">{['all','pending','done'].map(f=><button key={f} className={filter===f?'tab active':'tab'} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)} {f==='all'?`(${s.total})`:f==='done'?`(${s.done})`:`(${s.left})`}</button>)}</div></div>
  <form className="add-topic card" onSubmit={addTopic}><input placeholder="Add a topic… e.g. Photosynthesis — light reactions" value={topicForm.title} onChange={e=>setTopicForm({...topicForm,title:e.target.value})} required/><input placeholder="Section / Unit" value={topicForm.section} onChange={e=>setTopicForm({...topicForm,section:e.target.value})}/><button className="btn primary">+ Add</button></form>
  {shown.length===0? <Empty icon={filter==='done'?'🏁':'✨'} title={filter==='done'?'No completed topics yet':'All caught up!'} text={filter==='all'?'Add your first topic above.':'Topics you tick off will appear here.'}/> :
  sections.map(sec=><div key={sec}><h3 className="section-label">{sec}</h3><div className="topic-list">{shown.filter(t=>(t.section||'General')===sec).map(t=><div key={t.id} className={t.completed?'topic done':'topic'}><button className={t.completed?'check checked':'check'} style={t.completed?{background:list.color,borderColor:list.color}:{}} onClick={()=>toggle(list,t)}>{t.completed?'✓':''}</button><div className="topic-body"><b>{t.title}</b>{t.notes&&<small>{t.notes}</small>}{t.completed&&t.completedAt&&<small className="done-date">Completed {t.completedAt}</small>}</div><button className="icon-btn" onClick={()=>setEditing({...t})}>✎</button><button className="icon-btn" onClick={()=>delTopic(t)}>🗑</button></div>)}</div></div>)}
  {editing&&<Modal onClose={()=>setEditing(null)}><h2>Edit topic</h2><div className="form"><label>Title<input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label><label>Section<input value={editing.section||''} onChange={e=>setEditing({...editing,section:e.target.value})}/></label><label>Notes<textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})} placeholder="Resources, page numbers, doubts…"/></label><button className="btn primary full" onClick={saveTopic}>Save changes</button></div></Modal>}
  {editMeta&&<Modal onClose={()=>setEditMeta(false)}><h2>Edit checklist</h2><form className="form" onSubmit={saveMeta}><label>Title<input name="title" defaultValue={list.title}/></label><label>Subject<input name="subject" defaultValue={list.subject}/></label><label>Deadline<input name="deadline" type="date" defaultValue={list.deadline}/></label><button className="btn primary full">Save changes</button></form></Modal>}</>
}

function Import({onDone,notify}){
  const [text,setText]=useState(SAMPLE),[topics,setTopics]=useState([]),[busy,setBusy]=useState(false),[form,setForm]=useState({title:'',subject:'',deadline:'',color:COLORS[0]})
  const parse=async src=>{ setBusy(true); try{ const d=await api('/parse',{method:'POST',body:JSON.stringify({text:src})}); setTopics(d.topics); if(!d.topics.length) notify('No topics found — try one topic per line') }catch(e){ notify(e.message) } finally{ setBusy(false) } }
  useEffect(()=>{ parse(SAMPLE) },[])
  const onFile=async e=>{ const f=e.target.files[0]; if(!f) return; const t=await f.text(); setText(t); parse(t) }
  const create=async()=>{ try{ const c=await api('/import',{method:'POST',body:JSON.stringify({...form,topics})}); onDone(c) }catch(e){ notify(e.message) } }
  return <><div className="page-head"><div><h1>Import Syllabus 📄</h1><p className="muted">Paste a syllabus copy (or drop a .txt file) — we split it into topics automatically. Unit / Module / Chapter lines become sections.</p></div></div>
  <div className="import-grid"><div className="card"><h3>1 · Paste your syllabus</h3><textarea className="syllabus" value={text} onChange={e=>setText(e.target.value)} rows={16}/><div className="row"><label className="btn ghost file">⇪ Upload .txt / .md<input type="file" accept=".txt,.md" hidden onChange={onFile}/></label><button className="btn primary" onClick={()=>parse(text)} disabled={busy}>{busy?'Parsing…':'Parse into topics →'}</button></div></div>
  <div className="card"><h3>2 · Review topics ({topics.length})</h3>{topics.length===0?<Empty icon="🔍" title="No topics yet" text="Paste a syllabus on the left and hit Parse."/>:<div className="preview">{topics.map((t,i)=><div key={t.id||i} className="preview-row"><span className="num">{i+1}</span><div><b>{t.title}</b><small>{t.section}</small></div><button className="icon-btn" onClick={()=>setTopics(ts=>ts.filter((_,x)=>x!==i))}>✕</button></div>)}</div>}
  <h3 style={{marginTop:20}}>3 · Checklist details</h3><div className="form"><label>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Biology — Full Syllabus"/></label><div className="row2"><label>Subject<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Biology"/></label><label>Deadline<input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label></div><button className="btn primary full" disabled={!topics.length||!form.title} onClick={create}>Create checklist with {topics.length} topics ✓</button></div></div></div></>
}

function Completed({lists,open,toggle}){
  const done=lists.flatMap(l=>l.topics.filter(t=>t.completed).map(t=>({list:l,topic:t})))
  return <><div className="page-head"><div><h1>Completed ★</h1><p className="muted">{done.length} topics finished so far. Nice work!</p></div></div>
  {done.length===0?<Empty icon="🌱" title="Nothing completed yet" text="Tick off your first topic and it will show up here."/>:<div className="topic-list">{done.map(({list,topic})=><div key={topic.id} className="topic done"><button className="check checked" style={{background:list.color,borderColor:list.color}} onClick={()=>toggle(list,topic)}>✓</button><div className="topic-body"><b>{topic.title}</b><small>{list.title} · {topic.section}</small></div><button className="btn ghost sm" onClick={()=>open(list.id)}>Open →</button></div>)}</div>}</>
}

createRoot(document.getElementById('root')).render(<App/>)
