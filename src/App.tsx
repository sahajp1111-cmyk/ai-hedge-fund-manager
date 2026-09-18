import {Bell,Bot,BriefcaseBusiness,ChevronDown,CircleDollarSign,Gauge,LayoutDashboard,LockKeyhole,Menu,Newspaper,Search,ShieldCheck,Sparkles,TrendingDown,TrendingUp,Users,X} from 'lucide-react';
import {useState} from 'react';

const nav=[[LayoutDashboard,'Overview'],[BriefcaseBusiness,'Portfolio'],[Gauge,'Market radar'],[Bot,'AI research'],[Newspaper,'News intelligence'],[Users,'Institutional flow']] as const;
const positions=[['ALFA','Sample Growth Co.','$46.24','+2.84%','28%',true],['WATR','Sample Infrastructure','$24.18','-1.12%','19%',false],['ATOM','Sample Energy Co.','$61.32','+4.07%','17%',true],['DIVX','Sample Income Fund','$58.96','+0.31%','14%',true]] as const;

export default function App(){
 const [open,setOpen]=useState(false); const [active,setActive]=useState('Overview');
 return <div className="shell">
  <aside className={open?'sidebar open':'sidebar'}>
   <div className="brand"><span><TrendingUp size={20}/></span>SignalDesk</div><button className="close" onClick={()=>setOpen(false)} aria-label="Close menu"><X/></button>
   <p className="eyebrow">Workspace</p><nav>{nav.map(([Icon,label])=><button key={label} className={active===label?'nav active':'nav'} onClick={()=>{setActive(label);setOpen(false)}}><Icon size={18}/>{label}{label==='AI research'&&<b>AI</b>}</button>)}</nav>
   <div className="security"><ShieldCheck/><div><strong>Security status</strong><small>Protected session</small></div></div>
   <div className="profile"><i>DI</i><div><strong>Demo Investor</strong><small>Sample workspace</small></div><ChevronDown size={16}/></div>
  </aside>
  <main><header><button className="menu" onClick={()=>setOpen(true)} aria-label="Open menu"><Menu/></button><label className="search"><Search size={18}/><input placeholder="Search a company, ticker or theme…"/><kbd>⌘ K</kbd></label><button className="icon" aria-label="Notifications"><Bell size={19}/><i/></button><button className="primary"><Sparkles size={17}/>Ask research agent</button></header>
  <section className="content"><div className="title"><div><p className="eyebrow">Illustrative dashboard · sample data</p><h1>Good morning, Investor.</h1><p>The sample portfolio is outperforming its benchmark by 1.8% this month.</p></div><span className="live"><i/>Demo mode</span></div>
   <div className="metrics"><Metric label="Portfolio value" value="$2,146.80" note="+$82.34 today" good/><Metric label="Total return" value="+$214.62" note="+11.11% all time" good/><Metric label="Available cash" value="$500.00" note="23.3% buying power"/><Metric label="Risk score" value="72 / 100" note="Growth focused · High"/></div>
   <div className="grid">
    <article className="panel performance"><div className="head"><div><span>Portfolio performance</span><h2>$2,146.80</h2></div><div className="ranges"><button>1D</button><button>1W</button><button className="selected">1M</button><button>1Y</button></div></div><div className="chart"><svg viewBox="0 0 700 210" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4de1aa" stopOpacity=".35"/><stop offset="1" stopColor="#4de1aa" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 175 C45 170 58 151 105 155 S160 115 206 129 S280 119 327 91 S391 109 431 75 S500 89 543 48 S610 63 700 21 L700 210 L0 210 Z"/><path className="line" d="M0 175 C45 170 58 151 105 155 S160 115 206 129 S280 119 327 91 S391 109 431 75 S500 89 543 48 S610 63 700 21"/></svg><div><span>Aug 18</span><span>Aug 26</span><span>Sep 3</span><span>Sep 11</span><span>Sep 18</span></div></div></article>
    <article className="panel signal"><div className="head"><div><span>Illustrative AI signal</span><h3>WATR</h3></div><strong className="score">84</strong></div><p>A fictional infrastructure scenario demonstrates how a research summary and risk/reward setup will appear.</p><Row a="Conviction" b="Demo: High"/><Row a="Entry zone" b="$22.80–$24.20"/><button className="secondary">View sample analysis <span>→</span></button></article>
    <article className="panel holdings"><div className="head"><div><span>Top positions</span><h3>Portfolio holdings</h3></div><button className="text">View all</button></div>{positions.map(p=><div className="position" key={p[0]}><i>{p[0].slice(0,2)}</i><div><strong>{p[0]}</strong><small>{p[1]}</small></div><div><strong>{p[2]}</strong><small className={p[5]?'positive':'negative'}>{p[5]?<TrendingUp/>:<TrendingDown/>}{p[3]}</small></div><div><strong>{p[4]}</strong><small>Allocation</small></div></div>)}</article>
    <article className="panel pulse"><div className="head"><div><span>Market pulse</span><h3>Risk appetite is improving</h3></div><CircleDollarSign/></div><div className="meter"><i/></div><div className="labels"><span>Risk-off</span><strong>62 · Constructive</strong><span>Risk-on</span></div><div className="brief"><LockKeyhole/><p><strong>AI daily brief</strong><br/>Small caps gained as rate expectations eased. Nuclear and infrastructure remain high-momentum themes.</p></div></article>
   </div>
  </section></main>
 </div>
}
function Metric({label,value,note,good}:{label:string,value:string,note:string,good?:boolean}){return <article><span>{label}</span><h2>{value}</h2><small className={good?'positive':''}>{good&&<TrendingUp/>}{note}</small></article>}
function Row({a,b}:{a:string,b:string}){return <div className="row"><span>{a}</span><strong>{b}</strong></div>}
