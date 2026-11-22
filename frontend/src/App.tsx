import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import { api, token } from "./api";
import { GraduationCap, LayoutDashboard, UserRound, Compass, Scale, GitBranch, SlidersHorizontal, BriefcaseBusiness, Network, MessageCircle, Bookmark, ShieldCheck, Sun, Moon, Search, LogOut } from "lucide-react";

type Profile = { qualification?: string; aggregate_marks?: number; subject_marks: Record<string, number>; entrance_scores: Record<string, number>; interests: string[]; aptitude: Record<string, number>; skills: string[]; preferred_location?: string; annual_budget?: number };
type Programme = { id: number; name: string; discipline: string; annual_fee: number; duration_years: number; minimum_percentage: number; required_subjects: string[]; entrance_exams: string[]; data_status: string; source: string; university: { name: string; location: string } };

const nav = [
  ["dashboard", "Dashboard", LayoutDashboard], ["profile", "Academic Profile", UserRound], ["search", "Programme Search", Search],
  ["eligibility", "Eligibility", Scale], ["recommendations", "Recommendations", Compass], ["what-if", "What-if Simulator", SlidersHorizontal],
  ["careers", "Career Explorer", BriefcaseBusiness], ["compare", "Compare", Scale], ["graph", "Knowledge Graph", Network],
  ["chat", "AI Counsellor", MessageCircle], ["saved", "Saved Programmes", Bookmark], ["admin", "Admin", ShieldCheck],
] as const;

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("student@admitwise.demo");
  const [password, setPassword] = useState("Student123!");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.login(email, password);
      localStorage.setItem("admitwise_token", r.access_token);
      onDone();
    } catch {
      setError("Sign-in failed. Check your credentials.");
    }
  };
  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}><div className="brand"><GraduationCap /> <b>AdmitWise AI</b></div><h1>Welcome back</h1><p>Continue with your guided admission plan.</p>{error && <div className="alert">{error}</div>}<label>Email<input value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="primary" type="submit">Sign in</button><div className="demo">Demo student: student@admitwise.demo / Student123!</div></form></div>;
}

function Status({ status }: { status: string }) { return <span className={`status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>; }

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!token());
  const [view, setView] = useState("dashboard");
  const [dark, setDark] = useState(false);
  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;
  return <div className={dark ? "app dark" : "app"}><aside><div className="brand"><GraduationCap /><b>AdmitWise</b></div><nav>{nav.map(([id, label, Icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={18}/><span>{label}</span></button>)}</nav><button className="logout" onClick={() => { localStorage.removeItem("admitwise_token"); setLoggedIn(false); }}><LogOut size={18}/>Sign out</button></aside><main><header><div><span className="eyebrow">Student workspace</span><h2>{nav.find(n => n[0] === view)?.[1]}</h2></div><button className="icon-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></header><section className="content">{view === "dashboard" && <Dashboard/>}{view === "profile" && <ProfilePage/>}{view === "search" && <SearchPage/>}{view === "eligibility" && <Eligibility/>}{view === "recommendations" && <Recommendations/>}{view === "what-if" && <WhatIf/>}{view === "careers" && <Careers/>}{view === "compare" && <Compare/>}{view === "graph" && <Graph/>}{view === "chat" && <Chat/>}{view === "saved" && <Saved/>}{view === "admin" && <Admin/>}</section></main></div>;
}

function Dashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.dashboard().then(setData).catch(() => setData(null)); }, []);
  if (!data) return <Loading />;
  const chart = (data.recommendations || []).slice(0, 5).map((r: any) => ({ name: r.programme.name.replace("B.Tech ", "BTech "), score: r.suitability.score }));
  return <><div className="hero"><div><span className="eyebrow">Your guidance overview</span><h1>Build a clear path to the right programme.</h1><p>Recommendations are grounded in your profile and evaluated with inspectable rules.</p></div><div className="progress-ring"><strong>{data.recommendations?.length || 0}</strong><span>eligible matches</span></div></div><div className="stats"><div><span>Profile status</span><strong>{data.profile.aggregate_marks ? "Complete" : "Needs details"}</strong></div><div><span>Saved programmes</span><strong>{data.shortlist_count}</strong></div><div><span>Average match</span><strong>{chart.length ? Math.round(chart.reduce((a: number, b: any) => a + b.score, 0) / chart.length) : 0}%</strong></div></div><div className="grid-2"><article className="panel"><div className="panel-title"><div><span>Top matches</span><h3>Recommended programmes</h3></div></div>{chart.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={chart}><XAxis dataKey="name" hide/><YAxis/><Tooltip/><Bar dataKey="score" fill="#4f46e5" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer> : <Empty text="Complete your profile to see matches."/>}</article><article className="panel"><div className="panel-title"><h3>Profile highlights</h3></div><div className="chips">{(data.profile.interests || []).map((x: string) => <span key={x}>{x}</span>)}</div><dl className="facts"><dt>Qualification</dt><dd>{data.profile.qualification || "Not set"}</dd><dt>Aggregate</dt><dd>{data.profile.aggregate_marks ? `${data.profile.aggregate_marks}%` : "Not set"}</dd><dt>Annual budget</dt><dd>{data.profile.annual_budget ? `₹${data.profile.annual_budget.toLocaleString("en-IN")}` : "Not set"}</dd></dl></article></div></>;
}

function ProfilePage() {
  const [p, setP] = useState<Profile>({ subject_marks: {}, entrance_scores: {}, interests: [], aptitude: {}, skills: [] });
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.profile().then(setP); }, []);
  const save = async () => { await api.saveProfile(p); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const setMarks = (kind: "subject_marks"|"entrance_scores", key: string, value: string) => setP({ ...p, [kind]: { ...p[kind], [key]: Number(value) } });
  return <div className="grid-2"><article className="panel form-panel"><h3>Academic profile</h3><label>Qualification<select value={p.qualification || ""} onChange={e => setP({...p, qualification: e.target.value})}><option value="">Select qualification</option><option>12th Grade</option><option>10th Grade</option><option>Diploma</option></select></label><label>Aggregate percentage<input type="number" value={p.aggregate_marks || ""} onChange={e => setP({...p, aggregate_marks: Number(e.target.value)})}/></label><div className="form-row"><label>Physics<input type="number" value={p.subject_marks.Physics || ""} onChange={e => setMarks("subject_marks","Physics",e.target.value)}/></label><label>Mathematics<input type="number" value={p.subject_marks.Mathematics || ""} onChange={e => setMarks("subject_marks","Mathematics",e.target.value)}/></label><label>Chemistry<input type="number" value={p.subject_marks.Chemistry || ""} onChange={e => setMarks("subject_marks","Chemistry",e.target.value)}/></label></div></article><article className="panel form-panel"><h3>Preferences & aptitude</h3><label>Preferred location<input value={p.preferred_location || ""} onChange={e => setP({...p, preferred_location:e.target.value})}/></label><label>Annual budget (₹)<input type="number" value={p.annual_budget || ""} onChange={e => setP({...p, annual_budget:Number(e.target.value)})}/></label><label>JEE Main score<input type="number" value={p.entrance_scores["JEE Main"] || ""} onChange={e => setMarks("entrance_scores","JEE Main",e.target.value)}/></label><label>CUET score<input type="number" value={p.entrance_scores.CUET || ""} onChange={e => setMarks("entrance_scores","CUET",e.target.value)}/></label><label>Interests<textarea value={(p.interests || []).join(", ")} onChange={e => setP({...p, interests:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label><button className="primary" onClick={save}>{saved ? "Saved" : "Save profile"}</button></article></div>;
}

function SearchPage() { const [items,setItems]=useState<Programme[]>([]); const [q,setQ]=useState(""); useEffect(()=>{api.programmes().then(setItems)},[]); const shown=items.filter(p=>`${p.name} ${p.discipline}`.toLowerCase().includes(q.toLowerCase()) ); return <><div className="toolbar"><div className="searchbox"><Search size={16}/><input placeholder="Search programmes or disciplines" value={q} onChange={e=>setQ(e.target.value)}/></div></div><div className="cards">{shown.map(p=> <article className="programme-card" key={p.id}><div className="card-top"><span className="icon"><GraduationCap size={20}/></span><span className={`data ${p.data_status}`}>{p.data_status}</span></div><h3>{p.name}</h3><p>{p.university?.name}</p><div className="card-meta"><span>{p.duration_years} years</span><span>₹{p.annual_fee?.toLocaleString("en-IN")}/yr</span></div><button className="secondary" onClick={()=>api.save(p.id)}>Save programme</button></article>)}</div></>; }

function Eligibility() { const [items,setItems]=useState<any[]>([]); useEffect(()=>{api.eligibility().then(setItems)},[]); return <div className="timeline">{items.map(r=><article className="panel eligibility" key={r.programme.id}><div><h3>{r.programme.name}</h3><p>{r.programme.university?.name}</p></div><Status status={r.status}/><div className="reason-grid"><div><b>Satisfied</b>{r.satisfied.map((x:string)=><p key={x}>{x}</p>)}</div><div><b>Not satisfied</b>{r.unsatisfied.map((x:string)=><p key={x}>{x}</p>)}</div><div><b>Missing</b>{r.missing.map((x:string)=><p key={x}>{x}</p>)}</div></div></article>)}</div>; }

function Recommendations() { const [items,setItems]=useState<any[]>([]); useEffect(()=>{api.recommendations().then(setItems)},[]); return <div className="cards">{items.map((r:any)=><article className="programme-card" key={r.programme.id}><div className="card-top"><span className="icon"><Compass size={20}/></span><strong className="score">{r.suitability.score}%</strong></div><h3>{r.programme.name}</h3><p>{r.programme.university?.name}</p><Status status={r.status}/><div className="factors">{Object.entries(r.suitability.factors).map(([k,v])=><div key={k}><span>{k}</span><div><i style={{width:`${v}%`}}/></div></div>)}</div><button className="secondary" onClick={()=>api.save(r.programme.id)}>Save programme</button></article>)}</div>; }

function WhatIf() { const [aggregate,setAggregate]=useState(82); const [budget,setBudget]=useState(150000); const [location,setLocation]=useState("Maharashtra"); const [result,setResult]=useState<any>(null); const run=()=>api.whatIf({aggregate_marks:aggregate,annual_budget:budget,preferred_location:location}).then(setResult); return <><article className="panel form-panel"><h3>Simulate a profile change</h3><div className="form-row"><label>Aggregate %<input type="number" value={aggregate} onChange={e=>setAggregate(Number(e.target.value))}/></label><label>Annual budget<input type="number" value={budget} onChange={e=>setBudget(Number(e.target.value))}/></label><label>Location<input value={location} onChange={e=>setLocation(e.target.value)}/></label></div><button className="primary" onClick={run}>Recalculate</button></article>{result&&<div className="grid-2"><article className="panel"><h3>Newly eligible</h3>{result.newly_eligible.map((r:any)=><p key={r.programme.id}>{r.programme.name} — <Status status={r.status}/></p>)}</article><article className="panel"><h3>No longer eligible</h3>{result.no_longer_eligible.length ? result.no_longer_eligible.map((p:any)=><p key={p.id}>{p.name}</p>) : <Empty text="No programmes lost eligibility."/>}</article></div>}</>; }

function Careers() { const [careers,setCareers]=useState<any[]>([]); useEffect(()=>{api.careers().then(setCareers)},[]); return <div className="cards">{careers.map(c=><article className="programme-card" key={c.id}><span className="icon"><BriefcaseBusiness size={20}/></span><h3>{c.name}</h3><p>{c.description}</p><h4>Technical skills</h4><div className="chips">{c.technical_skills.map((s:string)=><span key={s}>{s}</span>)}</div><h4>Learning roadmap</h4>{c.roadmap.map((x:string)=><p key={x} className="roadmap">• {x}</p>)}</article>)}</div>; }

function Graph() { const [data,setData]=useState<any>(null); useEffect(()=>{api.graph().then(setData)},[]); if(!data) return <Loading/>; if(!data.available) return <article className="panel"><h3>Knowledge graph</h3><Empty text={data.message}/></article>; const nodes:Node[]=(data.nodes||[]).map((n:any,i:number)=>({id:n.id,data:{label:n.name},position:{x:(i%4)*220,y:Math.floor(i/4)*140},style:{border:"1px solid #c7d2fe",borderRadius:10,padding:10,background:"#fff"}})); const edges:Edge[]=(data.edges||[]).map((e:any,i:number)=>({id:String(i),source:e.source,target:e.target,label:e.label})); return <div className="graph"><ReactFlow nodes={nodes} edges={edges} fitView><Background/><Controls/></ReactFlow></div>; }

function Chat() { const [message,setMessage]=useState(""); const [messages,setMessages]=useState<{role:string;text:string}[]>([{role:"assistant",text:"Ask me about suitable programmes, eligibility, budget or career paths."}]); const send=async()=>{if(!message.trim())return;const text=message;setMessage("");setMessages(m=>[...m,{role:"user",text}]);const r=await api.counsellor(text);setMessages(m=>[...m,{role:"assistant",text:r.answer}]);}; return <div className="chat-panel"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}</div><div className="chat-input"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about eligible programmes..."/><button className="primary" onClick={send}>Send</button></div></div>; }

function Saved() { const [items,setItems]=useState<Programme[]>([]); const load=()=>api.shortlist().then(setItems); useEffect(()=>{void load()},[]); return <div className="cards">{items.length?items.map(p=><article className="programme-card" key={p.id}><h3>{p.name}</h3><p>{p.university?.name}</p><button className="danger" onClick={async()=>{await api.removeShortlist(p.id);void load();}}>Remove</button></article>):<Empty text="No saved programmes yet."/>}</div>; }

function Compare() { const [items,setItems]=useState<Programme[]>([]); const [selected,setSelected]=useState<number[]>([]); useEffect(()=>{api.programmes().then(setItems)},[]); const run=()=>api.compare(selected); return <><div className="chips selectable">{items.map(p=><button key={p.id} className={selected.includes(p.id)?"selected":""} onClick={()=>setSelected(s=>s.includes(p.id)?s.filter(x=>x!==p.id):[...s,p.id])}>{p.name}</button>)}</div><button className="primary" onClick={()=>run().then(setItems)}>Compare selected</button></>; }

function Admin() { const [data,setData]=useState<any>(null); useEffect(()=>{api.admin().then(setData).catch(()=>setData({restricted:true}))},[]); if(!data) return <Loading/>; if(data.restricted) return <article className="panel"><h3>Administrator access</h3><Empty text="The demo student account does not have administrator privileges."/></article>; return <div className="stats"><div><span>Universities</span><strong>{data.universities}</strong></div><div><span>Programmes</span><strong>{data.programmes}</strong></div><div><span>Rules</span><strong>{data.rules}</strong></div><div><span>Students</span><strong>{data.students}</strong></div></div>; }

function Loading(){return <div className="loading">Loading knowledge workspace...</div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
