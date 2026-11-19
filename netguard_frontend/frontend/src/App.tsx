import { useMemo, useRef, useState } from 'react'
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, CloudUpload, Command, Download,
  FileBarChart, FileCheck2, FileSearch, Filter, Gauge, Globe2, LayoutDashboard,
  LockKeyhole, Menu, MoreHorizontal, Network, Radar, Search, Settings, Shield,
  ShieldAlert, ShieldCheck, Sparkles, Upload, X, Zap
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar
} from 'recharts'

type Page = 'Overview' | 'Traffic Analysis' | 'Threat Intelligence' | 'Anomaly Detection' | 'Drift Intelligence' | 'Reports' | 'Settings'
type Alert = { id: string; source: string; destination: string; protocol: string; category: string; severity: string; time: string; status: string; reason: string }
const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const demoAlerts: Alert[] = [
  { id:'NG-2048', source:'192.168.1.104', destination:'185.220.101.42', protocol:'TCP', category:'Unusual outbound traffic', severity:'CRITICAL', time:'10:42:18', status:'Investigating', reason:'Outbound byte rate is substantially higher than the learned baseline.' },
  { id:'NG-2047', source:'10.0.0.28', destination:'172.67.14.21', protocol:'UDP', category:'Traffic spike', severity:'HIGH', time:'10:39:51', status:'Open', reason:'Packet frequency exceeded the expected range for this flow.' },
  { id:'NG-2046', source:'192.168.1.87', destination:'45.33.32.156', protocol:'TCP', category:'Unusual connection pattern', severity:'MEDIUM', time:'10:31:06', status:'Open', reason:'Connection duration and packet ratio differ from normal traffic.' },
  { id:'NG-2045', source:'10.0.0.16', destination:'8.8.8.8', protocol:'UDP', category:'Baseline deviation', severity:'LOW', time:'10:24:33', status:'Resolved', reason:'A small deviation was observed; no confirmed malicious activity.' },
]
const traffic = [
  {time:'09:00',normal:320,anomaly:12},{time:'09:15',normal:410,anomaly:18},{time:'09:30',normal:380,anomaly:14},
  {time:'09:45',normal:520,anomaly:32},{time:'10:00',normal:460,anomaly:21},{time:'10:15',normal:610,anomaly:46},
  {time:'10:30',normal:560,anomaly:28},{time:'10:45',normal:690,anomaly:58},{time:'11:00',normal:640,anomaly:34}
]
const severityData = [{name:'Critical',value:2,color:'#ff647c'},{name:'High',value:5,color:'#ff9b55'},{name:'Medium',value:9,color:'#f5c45e'},{name:'Low',value:14,color:'#35d6a1'}]
const nav: {name:Page; icon:any}[] = [
  {name:'Overview',icon:LayoutDashboard},{name:'Traffic Analysis',icon:Activity},{name:'Threat Intelligence',icon:ShieldAlert},
  {name:'Anomaly Detection',icon:Radar},{name:'Drift Intelligence',icon:Activity},{name:'Reports',icon:FileBarChart},{name:'Settings',icon:Settings}
]
const severityClass = (s:string) => `severity ${s.toLowerCase()}`

function App() {
  const [page,setPage] = useState<Page>('Overview')
  const [mobileOpen,setMobileOpen] = useState(false)
  const [alerts,setAlerts] = useState<Alert[]>(demoAlerts)
  const [selected,setSelected] = useState<Alert|null>(null)
  const [file,setFile] = useState<File|null>(null)
  const [busy,setBusy] = useState(false)
  const [result,setResult] = useState<any>(null)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')
  const [severity,setSeverity] = useState('All')
  const [toast,setToast] = useState('')
  const [connected,setConnected] = useState(false)
  const [referenceFile,setReferenceFile] = useState<File|null>(null)
  const [newDataFile,setNewDataFile] = useState<File|null>(null)
  const [driftResult,setDriftResult] = useState<any>(null)
  const [driftBusy,setDriftBusy] = useState(false)
  const [driftError,setDriftError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredAlerts = useMemo(() => alerts.filter(a =>
    (severity==='All' || a.severity===severity.toUpperCase()) &&
    `${a.source} ${a.destination} ${a.category} ${a.id}`.toLowerCase().includes(query.toLowerCase())
  ),[alerts,severity,query])

  const notify = (message:string) => { setToast(message); window.setTimeout(()=>setToast(''),3200) }
  const chooseFile = (f?:File) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) { setError('Please select a CSV file.'); return }
    setError(''); setFile(f); setResult(null)
  }
  const analyze = async () => {
    if (!file) { setError('Choose a CSV file before starting analysis.'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const body = new FormData(); body.append('file',file)
      const response = await fetch(`${API}/api/analyze`,{method:'POST',body})
      if (!response.ok) throw new Error(`Backend returned ${response.status}`)
      const data = await response.json()
      setResult(data); setConnected(true)
      notify('Analysis completed using the connected backend.')
      if (Array.isArray(data.alerts)) setAlerts(data.alerts)
    } catch (e) {
      setError(`Could not reach the Python API at ${API}. Start your FastAPI server and try again. This interface does not substitute demo predictions for real model results.`)
      setConnected(false)
    } finally { setBusy(false) }
  }
  const runDriftCheck = async () => {
    if (!referenceFile || !newDataFile) {
      setDriftError('Choose both a baseline CSV and a newer CSV.')
      return
    }
    setDriftBusy(true); setDriftError(''); setDriftResult(null)
    try {
      const body = new FormData()
      body.append('reference_file', referenceFile)
      body.append('new_file', newDataFile)
      const response = await fetch(`${API}/api/drift`, { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Backend returned ${response.status}`)
      setDriftResult(data)
      setConnected(true)
      notify('Data drift comparison completed.')
    } catch (e:any) {
      setDriftError(e?.message || 'Could not complete the drift comparison. Check that the backend is running.')
    } finally { setDriftBusy(false) }
  }
  const checkHealth = async () => {
    try { const r=await fetch(`${API}/api/health`); setConnected(r.ok); notify(r.ok?'Backend connection is healthy.':'Backend health check failed.') }
    catch { setConnected(false); notify('Backend is not reachable yet.') }
  }
  const exportAlerts = () => {
    const rows = [['ID','Source IP','Destination IP','Protocol','Category','Severity','Time','Status'],...filteredAlerts.map(a=>[a.id,a.source,a.destination,a.protocol,a.category,a.severity,a.time,a.status])]
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download='netguard-alerts.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const Sidebar = () => <aside className={`sidebar ${mobileOpen?'open':''}`}>
    <div className="brand"><div className="brand-mark"><Shield size={22}/><span className="brand-pulse"/></div><div><b>NETGUARD<span> AI</span></b><small>NETWORK DEFENSE</small></div><button className="mobile-close icon-btn" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
    <div className="workspace-label">WORKSPACE</div>
    <nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.name} className={`nav-item ${page===item.name?'active':''}`} onClick={()=>{setPage(item.name);setMobileOpen(false)}}><Icon size={18}/><span>{item.name}</span>{item.name==='Threat Intelligence'&&<i className="nav-count">4</i>}</button>})}</nav>
    <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Zap size={16}/></div><b>AI engine status</b><span>Model integration ready</span><div className="plan-line"><i/></div><small>Connect your Python API to activate detection.</small></div><button className="nav-item"><CircleHelp size={18}/> <span>Help & documentation</span></button><div className="profile"><div className="avatar">NG</div><div><b>Security Analyst</b><small>Administrator</small></div><MoreHorizontal size={18}/></div></div>
  </aside>

  return <div className="app-shell">
    <Sidebar/>
    {mobileOpen&&<div className="scrim" onClick={()=>setMobileOpen(false)}/>}
    <main className="main">
      <header className="topbar">
        <div className="top-left"><button className="icon-btn menu-btn" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><div className="crumb">Workspace <ChevronRight size={14}/> <b>{page}</b></div></div>
        <div className="top-actions"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search alerts, IPs..." /><kbd>⌘ K</kbd></div><button className="connection" onClick={checkHealth}><span className={connected?'dot green':'dot amber'}/>{connected?'API Connected':'API Offline'}</button><button className="icon-btn notification" onClick={()=>setPage('Threat Intelligence')}><Bell size={18}/><i/></button><div className="top-avatar">SA</div></div>
      </header>
      <div className="content">
        {page==='Overview'&&<Overview setPage={setPage} alerts={alerts} setSelected={setSelected}/>}
        {page==='Traffic Analysis'&&<TrafficAnalysis file={file} chooseFile={chooseFile} inputRef={inputRef} analyze={analyze} busy={busy} error={error} result={result} setFile={setFile}/>}
        {page==='Threat Intelligence'&&<ThreatPage alerts={filteredAlerts} severity={severity} setSeverity={setSeverity} setSelected={setSelected} exportAlerts={exportAlerts}/>}
        {page==='Anomaly Detection'&&<AnomalyPage result={result}/>}
        {page==='Drift Intelligence'&&<DriftPage referenceFile={referenceFile} setReferenceFile={setReferenceFile} newDataFile={newDataFile} setNewDataFile={setNewDataFile} runDriftCheck={runDriftCheck} busy={driftBusy} error={driftError} result={driftResult}/>}
        {page==='Reports'&&<Reports result={result} alerts={alerts} exportAlerts={exportAlerts}/>}
        {page==='Settings'&&<SettingsPage api={API} connected={connected} checkHealth={checkHealth}/>}
      </div>
      <footer className="footer"><span><span className="dot green"/> SYSTEM OPERATIONAL INTERFACE</span><span>NETGUARD AI <i>v1.0.0</i> · Secure by intelligence</span></footer>
    </main>
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><section className="detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">SECURITY EVENT · {selected.id}</span><h2>Alert investigation</h2></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="detail-status"><span className={severityClass(selected.severity)}>{selected.severity}</span><span className="muted">{selected.status}</span></div><div className="detail-grid"><div><small>Source IP</small><b>{selected.source}</b></div><div><small>Destination IP</small><b>{selected.destination}</b></div><div><small>Protocol</small><b>{selected.protocol}</b></div><div><small>Detected at</small><b>{selected.time}</b></div></div><div className="explain"><Sparkles size={17}/><div><b>Why was this flagged?</b><p>{selected.reason}</p><small>Model-generated anomaly explanation. Investigate before treating this as a confirmed attack.</small></div></div><button className="primary-btn full" onClick={()=>{setAlerts(prev=>prev.map(a=>a.id===selected.id?{...a,status:'Investigating'}:a));setSelected(null);notify('Alert marked as investigating.')}}>Mark as investigating <ChevronRight size={16}/></button></section></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:React.ReactNode;subtitle:string;action?:React.ReactNode}) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}
function Overview({setPage,alerts,setSelected}:{setPage:(p:Page)=>void;alerts:Alert[];setSelected:(a:Alert)=>void}) {
  return <>
    <PageHeading eyebrow="SECURITY OVERVIEW / LIVE ENVIRONMENT" title={<>Your network, <em>in focus.</em></>} subtitle="A unified view of network activity, model signals and potential security events." action={<button className="outline-btn" onClick={()=>setPage('Traffic Analysis')}><Upload size={16}/> Analyze traffic</button>}/>
    <div className="hero-strip"><div className="hero-glow"/><div className="hero-copy"><span className="live-label"><i/> SECURITY POSTURE</span><h2>Stay ahead of the <span>unknown.</span></h2><p>Connect your detection engine to turn network telemetry into actionable security intelligence.</p><button className="hero-link" onClick={()=>setPage('Traffic Analysis')}>Start a traffic analysis <ArrowUpRight size={16}/></button></div><NetworkArt/><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/></div>
    <div className="section-head"><div><h3>Network at a glance</h3><p>Detection metrics · Live API data when connected</p></div><span className="period-pill"><Clock3 size={13}/> Current session <ChevronDown size={13}/></span></div>
    <div className="stat-grid">
      <Stat icon={<Activity/>} label="Traffic analyzed" value="—" note="Awaiting dataset" tone="cyan"/>
      <Stat icon={<ShieldCheck/>} label="Normal traffic" value="—" note="No analysis yet" tone="green"/>
      <Stat icon={<Radar/>} label="Anomalies detected" value="—" note="Model results pending" tone="violet"/>
      <Stat icon={<AlertOctagon/>} label="Critical alerts" value="—" note="No confirmed count" tone="red"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel traffic-panel"><div className="panel-head"><div><h3>Network activity</h3><p>Traffic volume over time</p></div><span className="tag"><i/> SAMPLE VISUAL</span></div><div className="chart-legend"><span><i className="legend-cyan"/> Normal traffic</span><span><i className="legend-red"/> Anomalous traffic</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic}><defs><linearGradient id="normalFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00d9ff" stopOpacity={.22}/><stop offset="100%" stopColor="#00d9ff" stopOpacity={0}/></linearGradient><linearGradient id="anomFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff647c" stopOpacity={.24}/><stop offset="100%" stopColor="#ff647c" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1b2a40" vertical={false}/><XAxis dataKey="time" tick={{fill:'#70819c',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#70819c',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#10192a',border:'1px solid #253750',borderRadius:12,color:'#eaf2ff'}}/><Area type="monotone" dataKey="normal" stroke="#00d9ff" strokeWidth={2} fill="url(#normalFill)"/><Area type="monotone" dataKey="anomaly" stroke="#ff647c" strokeWidth={2} fill="url(#anomFill)"/></AreaChart></ResponsiveContainer></div><div className="sample-note"><CircleHelp size={13}/> Illustrative chart only — upload a dataset to view actual model results.</div></section>
      <section className="panel network-panel"><div className="panel-head"><div><h3>Network topology</h3><p>Visual map of connected endpoints</p></div><button className="icon-btn"><MoreHorizontal size={18}/></button></div><NetworkArt large/><div className="network-foot"><span><i className="legend-cyan"/> Endpoints</span><span><i className="legend-violet"/> Connections</span><span className="muted">Illustrative</span></div></section>
    </div>
    <div className="bottom-grid">
      <section className="panel"><div className="panel-head"><div><h3>Threat severity</h3><p>Illustrative distribution</p></div><button className="text-btn" onClick={()=>setPage('Threat Intelligence')}>View alerts <ArrowUpRight size={14}/></button></div><div className="severity-chart"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={severityData} dataKey="value" innerRadius={49} outerRadius={67} paddingAngle={4} stroke="none">{severityData.map(d=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip contentStyle={{background:'#10192a',border:'1px solid #253750',borderRadius:10}}/></PieChart></ResponsiveContainer><div className="donut-center"><b>30</b><small>DEMO</small></div></div><div className="severity-legend">{severityData.map(d=><div key={d.name}><i style={{background:d.color}}/><span>{d.name}</span><b>{d.value}</b></div>)}</div></div><div className="sample-note"><CircleHelp size={13}/> Sample visualization, not live detections.</div></section>
      <section className="panel"><div className="panel-head"><div><h3>Recent security events</h3><p>Review potential anomalies</p></div><button className="text-btn" onClick={()=>setPage('Threat Intelligence')}>All events <ArrowUpRight size={14}/></button></div><div className="mini-alerts">{alerts.slice(0,3).map(a=><button className="mini-alert" key={a.id} onClick={()=>setSelected(a)}><span className={`alert-symbol ${a.severity.toLowerCase()}`}><AlertTriangle size={15}/></span><span className="mini-alert-text"><b>{a.category}</b><small>{a.source} · {a.time}</small></span><span className={severityClass(a.severity)}>{a.severity}</span></button>)}</div><div className="sample-note"><CircleHelp size={13}/> Sample alert records — replace with backend results.</div></section>
    </div>
  </>
}
function Stat({icon,label,value,note,tone}:{icon:React.ReactNode;label:string;value:string;note:string;tone:string}) {
  return <div className={`stat-card ${tone}`}><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-more"><MoreHorizontal size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></div>
}

function NetworkArt({large=false}:{large?:boolean}) {
  const nodes = large
    ? [[50,50],[24,28],[76,25],[80,70],[25,76],[50,17],[49,84],[12,51],[89,48]]
    : [[50,50],[25,27],[75,25],[78,72],[25,76],[50,15],[50,85]]

  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,5],[2,5],[3,6],[4,6],[1,7],[2,8],[7,4],[8,3]]

  // Only use edges that connect existing nodes
  const validEdges = edges.filter(([a,b]) => a < nodes.length && b < nodes.length)

  return (
    <div className={`network-art ${large?'large':''}`}>
      <div className="network-grid-bg"/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {validEdges.map(([a,b],i)=>(
          <line key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className="network-edge"
          />
        ))}
        {nodes.map((n,i)=>(
          <g key={i}>
            <circle cx={n[0]} cy={n[1]} r={i===0?5:2.7}
              className={i===0?'core-node':'outer-node'}/>
            <circle cx={n[0]} cy={n[1]} r={i===0?8:5}
              className="node-halo"/>
          </g>
        ))}
      </svg>
      <div className="network-center">
        <ShieldCheck size={large?26:20}/>
      </div>
      {large&&<>
        <span className="node-label label-a">GATEWAY 01</span>
        <span className="node-label label-b">ENDPOINT 08</span>
        <span className="node-label label-c">FIREWALL</span>
      </>}
    </div>
  )
}

function TrafficAnalysis({file,chooseFile,inputRef,analyze,busy,error,result,setFile}:any) {
  const [drag,setDrag]=useState(false)
  return <><PageHeading eyebrow="NETWORK INTELLIGENCE / DATA INGESTION" title={<>Traffic <em>analysis.</em></>} subtitle="Upload network flow data and run it through your anomaly detection pipeline." action={<span className="tag"><span className="dot amber"/> CSV INPUT</span>}/>
    <div className="analysis-layout"><section className="panel upload-panel"><div className="panel-head"><div><h3>Upload network dataset</h3><p>Import a CSV file containing network flow records.</p></div><span className="step-count">01 / 04</span></div><div className={`dropzone ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);chooseFile(e.dataTransfer.files?.[0])}}><div className="upload-icon"><CloudUpload size={27}/></div><h3>Drop your dataset here</h3><p>or choose a file from your computer</p><button className="primary-btn" onClick={()=>inputRef.current?.click()}><Upload size={16}/> Browse CSV files</button><input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e=>chooseFile(e.target.files?.[0])}/><small>CSV format · Maximum size depends on your backend configuration</small></div>
      {file&&<div className="file-preview"><div className="file-icon"><FileCheck2 size={20}/></div><div className="file-info"><b>{file.name}</b><small>{(file.size/1024).toFixed(1)} KB · Ready for analysis</small></div><button className="icon-btn" onClick={()=>{setFile(null)}}><X size={17}/></button></div>}
      {error&&<div className="error-box"><AlertTriangle size={16}/>{error}</div>}
      <button className="primary-btn analyze-btn" disabled={!file||busy} onClick={analyze}>{busy?<><span className="spinner"/> Analyzing traffic...</>:<><Sparkles size={16}/> Run AI analysis <ArrowUpRight size={16}/></>}</button>
      {busy&&<div className="progress-steps"><span className="done">01 Upload</span><i/><span className="current">02 Processing</span><i/><span>03 Detection</span><i/><span>04 Results</span></div>}
    </section><aside className="panel pipeline-panel"><div className="panel-head"><div><h3>Analysis pipeline</h3><p>How your data is processed</p></div><div className="pipeline-icon"><Zap size={16}/></div></div><div className="pipeline">{[{n:'01',t:'Dataset ingestion',d:'Read and validate uploaded CSV',icon:Upload},{n:'02',t:'Feature preprocessing',d:'Prepare numerical flow features',icon:Gauge},{n:'03',t:'AI anomaly detection',d:'Evaluate traffic with ML model',icon:Radar},{n:'04',t:'Threat intelligence',d:'Summarize and explain flagged flows',icon:ShieldCheck}].map((s,i)=>{const I=s.icon;return <div className="pipeline-step" key={s.n}><div className="pipeline-step-icon"><I size={17}/></div><div><b>{s.t}</b><small>{s.d}</small></div><span>{s.n}</span></div>})}</div><div className="pipeline-note"><LockKeyhole size={15}/><span>Your uploaded dataset is sent to your configured Python API for analysis.</span></div></aside></div>
    {result&&<section className="panel results-panel"><div className="panel-head"><div><h3>Analysis results</h3><p>Returned by connected Python backend</p></div><span className="tag success"><Check size={12}/> BACKEND RESULT</span></div><div className="result-grid">{Object.entries(result).filter(([k,v])=>typeof v==='number'||typeof v==='string').slice(0,8).map(([k,v])=><div className="result-metric" key={k}><small>{k.replaceAll('_',' ')}</small><b>{String(v)}</b></div>)}</div><pre className="json-result">{JSON.stringify(result,null,2)}</pre></section>}
  </>}
function ThreatPage({alerts,severity,setSeverity,setSelected,exportAlerts}:any) {
  return <><PageHeading eyebrow="SECURITY OPERATIONS / EVENT QUEUE" title={<>Threat <em>intelligence.</em></>} subtitle="Investigate suspicious network activity and prioritize potential threats." action={<button className="outline-btn" onClick={exportAlerts}><Download size={16}/> Export CSV</button>}/><div className="threat-summary"><div><span className="summary-dot red"/><b>{alerts.filter((a:Alert)=>a.severity==='CRITICAL').length}</b><small>Critical</small></div><div><span className="summary-dot orange"/><b>{alerts.filter((a:Alert)=>a.severity==='HIGH').length}</b><small>High</small></div><div><span className="summary-dot yellow"/><b>{alerts.filter((a:Alert)=>a.severity==='MEDIUM').length}</b><small>Medium</small></div><div><span className="summary-dot green"/><b>{alerts.filter((a:Alert)=>a.severity==='LOW').length}</b><small>Low</small></div></div><section className="panel table-panel"><div className="panel-head"><div><h3>Security events</h3><p>{alerts.length} records shown · sample records until API is connected</p></div><div className="filter-control"><Filter size={15}/><select value={severity} onChange={e=>setSeverity(e.target.value)}><option>All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></div></div><div className="table-scroll"><table><thead><tr><th>EVENT</th><th>SOURCE → DESTINATION</th><th>PROTOCOL</th><th>SEVERITY</th><th>TIME</th><th>STATUS</th><th/></tr></thead><tbody>{alerts.map((a:Alert)=><tr key={a.id} onClick={()=>setSelected(a)}><td><b>{a.id}</b><small>{a.category}</small></td><td><span className="ip">{a.source}</span><small>→ {a.destination}</small></td><td>{a.protocol}</td><td><span className={severityClass(a.severity)}>{a.severity}</span></td><td>{a.time}</td><td><span className="status-text">{a.status}</span></td><td><ChevronRight size={16}/></td></tr>)}</tbody></table>{alerts.length===0&&<div className="empty-state">No alerts match your filters.</div>}</div></section><div className="disclaimer"><Shield size={16}/><span>These are potential anomalies, not confirmed attacks. Validate each event with additional context before taking action.</span></div></>
}
function AnomalyPage({result}:any) {
  return <><PageHeading eyebrow="MACHINE LEARNING / MODEL EXPLAINABILITY" title={<>Anomaly <em>detection.</em></>} subtitle="Understand how the detection model evaluates network flow behaviour."/><div className="model-banner"><div className="model-symbol"><Radar size={25}/></div><div><span className="eyebrow">DETECTION ENGINE</span><h2>Isolation Forest <span className="model-status">● API-DEPENDENT</span></h2><p>Unsupervised machine learning model for identifying unusual network patterns.</p></div><div className="model-chip">SCIKIT-LEARN</div></div><div className="anomaly-grid"><section className="panel"><div className="panel-head"><div><h3>Model output</h3><p>Most recent analysis</p></div><span className="tag">{result?'CONNECTED RESULT':'AWAITING DATA'}</span></div>{result?<pre className="json-result">{JSON.stringify(result,null,2)}</pre>:<div className="empty-visual"><div className="empty-radar"><Radar size={38}/></div><h3>No analysis available</h3><p>Upload a network traffic CSV to view actual anomaly scores and classifications.</p></div>}</section><section className="panel"><div className="panel-head"><div><h3>Detection methodology</h3><p>How anomalies are identified</p></div></div><div className="method-list"><div><span>01</span><div><b>Feature extraction</b><p>Network flow duration, packet counts, byte rates and protocol attributes.</p></div></div><div><span>02</span><div><b>Baseline learning</b><p>The model learns patterns that are common across the supplied traffic records.</p></div></div><div><span>03</span><div><b>Outlier scoring</b><p>Records that differ from learned patterns receive anomaly scores.</p></div></div><div><span>04</span><div><b>Analyst review</b><p>Flagged records are prioritized for investigation, not treated as confirmed attacks.</p></div></div></div></section></div></>
}

function DriftPage({referenceFile,setReferenceFile,newDataFile,setNewDataFile,runDriftCheck,busy,error,result}:any) {
  return <>
    <PageHeading eyebrow="ADAPTIVE SECURITY / DISTRIBUTION MONITORING" title={<>Drift <em>intelligence.</em></>} subtitle="Compare a baseline network dataset with newer traffic to identify significant feature-distribution changes." action={<span className="tag"><Activity size={13}/> DATA DRIFT</span>}/>
    <div className="analysis-layout">
      <section className="panel upload-panel">
        <div className="panel-head"><div><h3>Compare two datasets</h3><p>Use compatible CSV exports with matching numerical feature names.</p></div><span className="step-count">BASELINE → NEW</span></div>
        <div className="drift-file-row">
          <label className="drift-file-card"><span className="eyebrow">01 · REFERENCE / BASELINE</span><b>{referenceFile?.name || 'Choose baseline CSV'}</b><small>{referenceFile ? `${(referenceFile.size/1024).toFixed(1)} KB selected` : 'Your earlier or trusted traffic dataset'}</small><input type="file" accept=".csv,text/csv" onChange={(e:any)=>setReferenceFile(e.target.files?.[0] || null)}/></label>
          <label className="drift-file-card"><span className="eyebrow">02 · NEW DATA</span><b>{newDataFile?.name || 'Choose newer CSV'}</b><small>{newDataFile ? `${(newDataFile.size/1024).toFixed(1)} KB selected` : 'Traffic you want to compare'}</small><input type="file" accept=".csv,text/csv" onChange={(e:any)=>setNewDataFile(e.target.files?.[0] || null)}/></label>
        </div>
        {error&&<div className="error-box"><AlertTriangle size={16}/>{error}</div>}
        <button className="primary-btn analyze-btn" disabled={!referenceFile||!newDataFile||busy} onClick={runDriftCheck}>{busy?<><span className="spinner"/> Comparing distributions...</>:<><Radar size={16}/> Detect data drift <ArrowUpRight size={16}/></>}</button>
        <div className="pipeline-note"><CircleHelp size={15}/><span>This comparison does not change or retrain your existing Isolation Forest model.</span></div>
      </section>
      <aside className="panel pipeline-panel">
        <div className="panel-head"><div><h3>Detection method</h3><p>Two complementary statistical measures</p></div></div>
        <div className="method-list">
          <div><span>01</span><div><b>Kolmogorov–Smirnov test</b><p>Checks whether two numerical feature distributions differ statistically.</p></div></div>
          <div><span>02</span><div><b>Population Stability Index</b><p>Measures the magnitude of distribution shift using baseline quantile bins.</p></div></div>
          <div><span>03</span><div><b>Feature-level results</b><p>Ranks comparable features and reports drift flags with the underlying scores.</p></div></div>
        </div>
      </aside>
    </div>
    {result&&<section className="panel results-panel">
      <div className="panel-head"><div><h3>Drift comparison results</h3><p>{result.reference_filename} compared with {result.new_filename}</p></div><span className={`tag ${result.drifted_features>0?'warning':'success'}`}>{result.drift_status}</span></div>
      <div className="result-grid">
        <div className="result-metric"><small>Baseline records</small><b>{result.reference_records}</b></div>
        <div className="result-metric"><small>New records</small><b>{result.new_records}</b></div>
        <div className="result-metric"><small>Features compared</small><b>{result.common_features_compared}</b></div>
        <div className="result-metric"><small>Drifted features</small><b>{result.drifted_features}</b></div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>FEATURE</th><th>BASELINE MEAN</th><th>NEW MEAN</th><th>PSI</th><th>KS P-VALUE</th><th>STATUS</th></tr></thead><tbody>{(result.features||[]).map((f:any)=><tr key={f.feature}><td><b>{f.feature}</b></td><td>{f.reference_mean}</td><td>{f.new_mean}</td><td>{f.psi}</td><td>{f.p_value}</td><td><span className={`tag ${f.drift_detected?'warning':'success'}`}>{f.drift_detected?'DRIFT':'STABLE'}</span></td></tr>)}</tbody></table></div>
      <div className="disclaimer"><Shield size={16}/><span>{result.note}</span></div>
      <button className="outline-btn" onClick={()=>downloadJson(result)}><Download size={15}/> Download drift report JSON</button>
    </section>}
  </>
}

function Reports({result,alerts,exportAlerts}:any) {
  return <><PageHeading eyebrow="SECURITY OPERATIONS / REPORTING" title={<>Security <em>reports.</em></>} subtitle="Export analysis records and maintain a clear audit trail." action={<button className="outline-btn" onClick={exportAlerts}><Download size={16}/> Download alerts CSV</button>}/><div className="report-grid"><div className="report-card featured"><div className="report-icon"><FileBarChart size={21}/></div><span className="eyebrow">NETWORK ANALYSIS</span><h3>Traffic analysis report</h3><p>{result?'A backend analysis result is available.':'Run an analysis to generate a report from real model output.'}</p><button className="primary-btn" onClick={()=>result?downloadJson(result):notifyReport()}> <Download size={15}/> {result?'Download JSON result':'Awaiting analysis'}</button></div><div className="report-card"><div className="report-icon violet"><FileSearch size={21}/></div><span className="eyebrow">EVENT SUMMARY</span><h3>Security alert export</h3><p>Export the currently available event list as a CSV file.</p><button className="outline-btn" onClick={exportAlerts}><Download size={15}/> Export CSV</button></div></div><section className="panel report-history"><div className="panel-head"><div><h3>Report activity</h3><p>Available report sources</p></div></div><div className="history-row"><FileCheck2 size={18}/><div><b>Security alert dataset</b><small>{alerts.length} alert records currently in the interface · sample data unless API-sourced</small></div><span className="tag">CSV READY</span></div><div className="history-row"><FileBarChart size={18}/><div><b>Latest model analysis</b><small>{result?'Backend response available':'No backend analysis has been run yet'}</small></div><span className={`tag ${result?'success':''}`}>{result?'AVAILABLE':'PENDING'}</span></div></section></>
}
function downloadJson(data:any) { const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='netguard-analysis.json';a.click();URL.revokeObjectURL(url) }
function notifyReport() { alert('Run a real backend analysis first to create a report.') }
function SettingsPage({api,connected,checkHealth}:any) {
  return <><PageHeading eyebrow="CONFIGURATION / PLATFORM" title={<>System <em>settings.</em></>} subtitle="Review the integration configuration for your detection environment."/><section className="panel settings-panel"><div className="settings-row"><div className="settings-icon"><Network size={19}/></div><div><b>Python FastAPI backend</b><p>Base URL configured through VITE_API_BASE_URL.</p><code>{api}</code></div><span className={`tag ${connected?'success':''}`}>{connected?'CONNECTED':'OFFLINE'}</span></div><div className="settings-row"><div className="settings-icon"><ShieldCheck size={19}/></div><div><b>Machine learning engine</b><p>Isolation Forest model · predictions are provided by the backend.</p></div><span className="tag">API DEPENDENT</span></div><div className="settings-row"><div className="settings-icon"><FileCheck2 size={19}/></div><div><b>Data handling</b><p>CSV files are submitted to your configured backend for analysis.</p></div><span className="tag success">HTTPS RECOMMENDED</span></div><button className="primary-btn" onClick={checkHealth}>Test backend connection <ArrowUpRight size={15}/></button></section></>
}

export default App
