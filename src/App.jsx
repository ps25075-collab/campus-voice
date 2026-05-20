import { useState, useEffect } from "react";
import { Search, Menu, X, TrendingUp, Instagram, Facebook, Youtube, ArrowLeft, Bold, Italic, List, LogIn, LogOut, Edit2, Trash2, Save, Eye, AlertTriangle, ShieldCheck, Clock, CheckCircle, XCircle, FileText, PenLine, MessageSquarePlus, RefreshCw, Send, Inbox, MessageCircle } from "lucide-react";

/* ── 날짜 헬퍼 ── */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
};

const CATEGORIES  = ["전체","경제","문화","기술"];
const catColor    = { 경제:"bg-blue-600", 문화:"bg-pink-500", 기술:"bg-emerald-600" };
const typeColor   = { 기사:"bg-slate-600", 칼럼:"bg-amber-500" };
const catGradient = {
  경제:"linear-gradient(135deg,#1e3a8a,#3b82f6)",
  문화:"linear-gradient(135deg,#831843,#ec4899)",
  기술:"linear-gradient(135deg,#064e3b,#10b981)",
};
const SC  = "#1a6b3c";
const SCD = "#145530";

const USERS = [
  { id:"admin",      pw:"admin1234",  name:"관리자",  role:"admin"     },
  { id:"editor1",    pw:"press1234",  name:"김편집",  role:"editor"    },
  { id:"editor2",    pw:"press5678",  name:"이기자",  role:"editor"    },
  { id:"columnist1", pw:"column1234", name:"박칼럼",  role:"columnist" },
  { id:"columnist2", pw:"column5678", name:"최기고",  role:"columnist" },
];
const canWrite    = r => ["admin","editor","columnist"].includes(r);
const canReadBox  = r => ["admin","editor"].includes(r);
const canDelComment = r => ["admin","editor"].includes(r);
const allowedTypes  = r => r==="columnist" ? ["칼럼"] : ["기사","칼럼"];

const DUMMY_ARTICLES = [
  { id:1, category:"경제", type:"기사", date:"2026.04.03", views:4821, hero:true, status:"published",
    title:"총학생회, 2026학년도 등록금 동결 협의 결과 발표",
    summary:"총학생회가 학교 본부와의 협의 끝에 올해 등록금이 동결되었음을 공식 발표했다.",
    body:"총학생회가 학교 본부와의 협의 끝에 올해 등록금이 동결되었음을 공식 발표했다.\n\n총학생회 의장은 '2년 연속 등록금 동결은 전례 없는 성과'라며 앞으로도 학생 복지를 위해 최선을 다하겠다고 밝혔다.", image:"" },
  { id:2, category:"문화", type:"기사", date:"2026.04.02", views:3102, status:"published",
    title:"봄 축제 '벚꽃런' 참가 신청 오늘부터 시작",
    summary:"매년 봄마다 진행되는 교내 벚꽃런 행사 참가 신청이 오늘부터 시작됐다.",
    body:"봄 축제 벚꽃런 참가 신청이 오늘부터 시작됐다.", image:"" },
  { id:3, category:"기술", type:"칼럼", date:"2026.04.01", views:2890, status:"published", author:"박칼럼",
    title:"[칼럼] AI 시대, 대학 교육이 바뀌어야 할 이유",
    summary:"인공지능이 산업 전반을 재편하는 지금, 대학 교육 역시 변화를 피할 수 없다.",
    body:"인공지능이 산업 전반을 재편하는 지금, 대학 교육 역시 변화를 피할 수 없다.", image:"" },
  { id:4, category:"경제", type:"기사", date:"2026.03.31", views:2541, status:"published",
    title:"청년 창업 지원금 확대…대학생 스타트업 급증",
    summary:"정부의 청년 창업 지원금이 올해 두 배로 늘어났다.",
    body:"정부의 청년 창업 지원금이 올해 두 배로 늘어나면서 대학생 스타트업 창업 건수가 크게 늘고 있다.", image:"" },
  { id:5, category:"기술", type:"기사", date:"2026.03.30", views:1983, status:"published",
    title:"교내 스마트 도서관 시스템 도입…AI가 책 추천",
    summary:"중앙도서관이 AI 기반 도서 추천 시스템을 도입했다.",
    body:"중앙도서관이 AI 기반 도서 추천 시스템을 도입했다.", image:"" },
  { id:6, category:"문화", type:"칼럼", date:"2026.03.29", views:1756, status:"published", author:"최기고",
    title:"[칼럼] 졸업작품전을 앞두고 — 예술의 의미를 묻다",
    summary:"미술대학 졸업반 학생 32명의 작품이 모이는 졸업작품전을 앞두고 예술의 의미를 되짚어본다.",
    body:"미술대학 졸업반 학생 32명의 작품이 모이는 졸업작품전을 앞두고 예술의 의미를 되짚어본다.", image:"" },
  { id:7, category:"경제", type:"기사", date:"2026.03.28", views:1432, status:"published",
    title:"물가 상승 속 대학생 알바 시급 실태 보고서",
    summary:"최근 물가 상승으로 생활비 부담이 커진 대학생들의 아르바이트 현황을 취재했다.",
    body:"최근 물가 상승으로 생활비 부담이 커진 대학생들의 아르바이트 현황을 취재했다.", image:"" },
];

const ART_KEY  = "segal_articles_v9";
const DARK_KEY = "campus_voice_dark";
const BOX_KEY  = "segal_suggestions_v2";
const CMT_KEY  = (id) => `segal_comments_${id}`;

const statusLabel = { published:"게재됨", pending:"승인 대기", rejected:"반려됨" };
const statusStyle = { published:"bg-green-100 text-green-700", pending:"bg-yellow-100 text-yellow-700", rejected:"bg-red-100 text-red-600" };
const roleLabel   = { admin:"👑 관리자", editor:"📰 기자", columnist:"✒️ 칼럼니스트" };

/* ── 이미지 컴포넌트 ── */
function ArticleImage({ image, category, className="", style={} }) {
  const [failed, setFailed] = useState(false);
  const show = image && !failed;
  return (
    <div className={`relative overflow-hidden ${className}`}
      style={{ background: catGradient[category]||"linear-gradient(135deg,#374151,#6b7280)", ...style }}>
      {show
        ? <img src={image} alt="" className="w-full h-full object-cover absolute inset-0" onError={()=>setFailed(true)}/>
        : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/40">
            <FileText size={22}/><span className="text-xs">이미지 없음</span>
          </div>}
    </div>
  );
}

/* ── 실시간 금융 ── */
function FinanceTicker({ dark }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const fetchData = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:400,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          system:`You are a financial data assistant. Search for the LATEST real-time values and respond ONLY with a valid JSON object, no markdown, no extra text.
Format: {"kospi":"숫자","kospi_change":"+0.00%","nasdaq":"숫자","nasdaq_change":"+0.00%","usdkrw":"숫자","rate":"숫자%"}`,
          messages:[{role:"user",content:"Search current KOSPI, NASDAQ, USD/KRW exchange rate, Korea base interest rate. Return ONLY JSON."}]
        })
      });
      const json = await res.json();
      const tb = json.content?.find(b=>b.type==="text");
      if(!tb) throw new Error();
      setData(JSON.parse(tb.text.trim().replace(/```json|```/g,"").trim()));
    } catch { setError(true); }
    setLoading(false);
  };

  useEffect(()=>{ fetchData(); },[]);

  const items = data ? [
    {label:"코스피",  value:data.kospi,       change:data.kospi_change,  up: data.kospi_change?.startsWith("+")},
    {label:"NASDAQ", value:data.nasdaq,      change:data.nasdaq_change, up: data.nasdaq_change?.startsWith("+")},
    {label:"원/달러", value:data.usdkrw+"원", change:null},
    {label:"기준금리", value:data.rate,        change:null},
  ] : [];

  return (
    <div className={`border-b shadow-sm ${dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200"}`}>
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-sm font-bold flex items-center gap-1.5 ${dark?"text-gray-400":"text-gray-500"}`}>
            <RefreshCw size={14}/> 실시간 금융 지표
          </span>
          <button onClick={fetchData} className={`transition-colors ${dark?"text-gray-600 hover:text-gray-300":"text-gray-300 hover:text-gray-600"}`} title="새로고침">
            <RefreshCw size={15}/>
          </button>
        </div>
        {loading && (
          <div className={`flex items-center gap-2 py-2 ${dark?"text-gray-500":"text-gray-400"}`}>
            <RefreshCw size={15} className="animate-spin"/> <span className="text-sm">데이터 불러오는 중...</span>
          </div>
        )}
        {error && <span className="text-sm text-red-400">데이터 로드 실패 — 새로고침을 눌러주세요</span>}
        {!loading&&!error&&(
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map(it=>(
              <div key={it.label} className={`rounded-xl border px-4 py-3 ${dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-100"}`}>
                <p className={`text-xs font-medium mb-1 ${dark?"text-gray-400":"text-gray-400"}`}>{it.label}</p>
                <p className={`text-2xl font-extrabold leading-tight ${dark?"text-gray-100":"text-gray-800"}`}>{it.value}</p>
                {it.change && (
                  <p className={`text-sm font-semibold mt-0.5 ${it.up?"text-red-500":"text-blue-500"}`}>
                    {it.change}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 공감(하트) 버튼 ── */
function LikeButton({ articleId, dark }) {
  const [liked, setLiked]   = useState(false);
  const [count, setCount]   = useState(0);
  const [bounce, setBounce] = useState(false);
  const LIKE_KEY = `segal_likes_${articleId}`;

  useEffect(()=>{
    (async()=>{
      try{
        const r = await window.storage.get(LIKE_KEY, true);
        if(r?.value){ const d=JSON.parse(r.value); setCount(d.count||0); }
      }catch{}
      try{
        const r = await window.storage.get(LIKE_KEY+"_me");
        if(r?.value) setLiked(JSON.parse(r.value));
      }catch{}
    })();
  },[articleId]);

  const toggle = async () => {
    const newLiked = !liked;
    const newCount = newLiked ? count+1 : Math.max(0,count-1);
    setLiked(newLiked); setCount(newCount);
    if(newLiked){ setBounce(true); setTimeout(()=>setBounce(false),400); }
    try{ await window.storage.set(LIKE_KEY, JSON.stringify({count:newCount}), true); }catch{}
    try{ await window.storage.set(LIKE_KEY+"_me", JSON.stringify(newLiked)); }catch{}
  };

  return (
    <div className="flex justify-center my-8">
      <button onClick={toggle}
        className={`flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl border-2 transition-all duration-200 ${liked?"border-red-400 bg-red-50":"border-gray-200 hover:border-red-300 hover:bg-red-50"} ${dark&&!liked?"bg-gray-800 border-gray-700 hover:bg-gray-700":""}`}
        style={{transform: bounce?"scale(1.25)":"scale(1)", transition:"transform 0.2s cubic-bezier(.36,.07,.19,.97)"}}>
        <span style={{fontSize:32, lineHeight:1, filter: liked?"drop-shadow(0 0 6px #f87171)":"none"}}>
          {liked?"❤️":"🤍"}
        </span>
        <span className={`text-sm font-bold ${liked?"text-red-500":"text-gray-400"}`}>{count}</span>
        <span className={`text-xs ${liked?"text-red-400":"text-gray-400"}`}>{liked?"공감했어요":"공감하기"}</span>
      </button>
    </div>
  );
}

/* ── 댓글 섹션 ── */
function CommentSection({ articleId, user, dark }) {
  const [comments, setComments] = useState([]);
  const [name, setName]         = useState("");
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(true);
  const card = dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-200";
  const inp  = dark?"bg-gray-700 border-gray-600 text-white placeholder-gray-400":"bg-white border-gray-300 placeholder-gray-400";

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r = await window.storage.get(CMT_KEY(articleId), true);
        if(r?.value) setComments(JSON.parse(r.value));
        else setComments([]);
      }catch{ setComments([]); }
      setLoading(false);
    })();
  },[articleId]);

  const submit = async () => {
    if(!text.trim()) return;
    const newC = { id:Date.now(), name:name.trim()||"익명", text:text.trim(), date:today() };
    const updated = [...comments, newC];
    try{ await window.storage.set(CMT_KEY(articleId), JSON.stringify(updated), true); }catch{}
    setComments(updated); setName(""); setText("");
  };

  const del = async (id) => {
    const updated = comments.filter(c=>c.id!==id);
    try{ await window.storage.set(CMT_KEY(articleId), JSON.stringify(updated), true); }catch{}
    setComments(updated);
  };

  return (
    <div className="mt-8">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <MessageCircle size={17} style={{color:SC}}/> 댓글 <span className="text-sm font-normal text-gray-400">({comments.length})</span>
      </h3>

      <div className={`rounded-xl border p-4 mb-4 space-y-2 ${dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200"}`}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="이름 (선택, 미입력 시 익명)"
          className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="댓글을 입력하세요..."
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none ${inp}`}/>
        <button onClick={submit} style={{backgroundColor:SC}}
          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Send size={13}/> 댓글 달기
        </button>
      </div>

      {loading && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
      {!loading && comments.length===0 && <p className="text-xs text-gray-400 text-center py-6">첫 번째 댓글을 남겨보세요!</p>}
      <div className="space-y-3">
        {comments.map(c=>(
          <div key={c.id} className={`rounded-xl border p-3 ${card}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{c.name}</span>
                <span className="text-xs text-gray-400">{c.date}</span>
              </div>
              {canDelComment(user?.role) && (
                <button onClick={()=>del(c.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors">
                  <Trash2 size={11}/> 삭제
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 건의함 ── */
function SuggestionBox({ user, dark }) {
  const [open, setOpen]         = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm]         = useState({ name:"", content:"" });
  const [sent, setSent]         = useState(false);
  const card = dark?"bg-gray-900 border-gray-800 text-gray-100":"bg-white border-gray-200 text-gray-900";
  const inp  = dark?"bg-gray-800 border-gray-700 text-white placeholder-gray-500":"bg-white border-gray-300 placeholder-gray-400";

  const loadSuggestions = async () => {
    try{
      const r = await window.storage.get(BOX_KEY, true);
      if(r?.value) setSuggestions(JSON.parse(r.value));
    }catch{}
  };

  useEffect(()=>{ if(viewOpen) loadSuggestions(); },[viewOpen]);

  const submit = async () => {
    if(!form.content.trim()) return;
    const newItem = { id:Date.now(), name:form.name.trim()||"익명", content:form.content.trim(), date:today() };
    let prev = [];
    try{ const r=await window.storage.get(BOX_KEY,true); if(r?.value) prev=JSON.parse(r.value); }catch{}
    const updated=[...prev,newItem];
    try{ await window.storage.set(BOX_KEY,JSON.stringify(updated),true); }catch{}
    setSuggestions(updated); setForm({name:"",content:""});
    setSent(true); setTimeout(()=>{ setSent(false); setOpen(false); },2000);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        {canReadBox(user?.role)&&(
          <button onClick={()=>setViewOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-white text-xs font-medium shadow-lg hover:scale-105 transition-transform"
            style={{backgroundColor:SC}}>
            <Inbox size={14}/> 건의함 열람
          </button>
        )}
        <button onClick={()=>setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg hover:scale-105 transition-transform bg-amber-500 hover:bg-amber-600">
          <MessageSquarePlus size={16}/> 기사 건의하기
        </button>
      </div>

      {open&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={()=>setOpen(false)}>
          <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-sm ${card}`} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base flex items-center gap-2"><MessageSquarePlus size={18} className="text-amber-500"/> 기사 건의하기</h3>
              <button onClick={()=>setOpen(false)}><X size={18}/></button>
            </div>
            {sent?(
              <div className="text-center py-6">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-2"/>
                <p className="font-medium text-green-600">건의가 접수됐습니다!</p>
              </div>
            ):(
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-500">이름 (선택)</label>
                  <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                    placeholder="홍길동" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${inp}`}/>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-500">건의 내용 *</label>
                  <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})}
                    rows={4} placeholder="어떤 기사를 원하시나요?"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none ${inp}`}/>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Eye size={11}/> 건의 내용은 편집부만 열람할 수 있습니다.</p>
                <button onClick={submit} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <Send size={14}/> 건의 보내기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {viewOpen&&canReadBox(user?.role)&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={()=>setViewOpen(false)}>
          <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col ${card}`} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2"><Inbox size={18} style={{color:SC}}/> 기사 건의함</h3>
              <button onClick={()=>setViewOpen(false)}><X size={18}/></button>
            </div>
            {suggestions.length===0
              ?<div className="text-center py-10 text-gray-400 text-sm">아직 건의된 내용이 없습니다.</div>
              :<div className="space-y-3 overflow-y-auto pr-1">
                {[...suggestions].reverse().map(s=>(
                  <div key={s.id} className={`rounded-xl border p-4 ${dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-amber-600">✍️ {s.name}</span>
                      <span className="text-xs text-gray-400">{s.date}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      )}
    </>
  );
}

/* ── 메인 앱 ── */
export default function App() {
  const [dark,setDark]               = useState(false);
  const [menuOpen,setMenuOpen]       = useState(false);
  const [activeCategory,setActiveCat]= useState("전체");
  const [activeType,setActiveType]   = useState("전체");
  const [selected,setSelected]       = useState(null);
  const [page,setPage]               = useState("home");
  const [search,setSearch]           = useState("");
  const [searchOpen,setSearchOpen]   = useState(false);
  const [email,setEmail]             = useState("");
  const [subscribed,setSubscribed]   = useState(false);
  const [articles,setArticles]       = useState(DUMMY_ARTICLES);
  const [form,setForm]               = useState({title:"",category:"경제",type:"기사",body:"",image:""});
  const [editId,setEditId]           = useState(null);
  const [confirmDel,setConfirmDel]   = useState(null);
  const [user,setUser]               = useState(null);
  const [showLogin,setShowLogin]     = useState(false);
  const [loginForm,setLoginForm]     = useState({id:"",pw:""});
  const [loginError,setLoginError]   = useState("");
  const [adminTab,setAdminTab]       = useState("pending");

  useEffect(()=>{
    (async()=>{
      try{ const r=await window.storage.get(ART_KEY);  if(r?.value) setArticles(JSON.parse(r.value)); }catch{}
      try{ const d=await window.storage.get(DARK_KEY); if(d?.value) setDark(JSON.parse(d.value)); }catch{}
    })();
  },[]);

  const save=async d=>{ try{ await window.storage.set(ART_KEY,JSON.stringify(d)); }catch{} };
  const toggleDark=()=>setDark(d=>{ const n=!d; (async()=>{ try{ await window.storage.set(DARK_KEY,JSON.stringify(n)); }catch{} })(); return n; });

  const handleLogin=()=>{
    const found=USERS.find(u=>u.id===loginForm.id&&u.pw===loginForm.pw);
    if(found){ setUser(found); setShowLogin(false); setLoginError(""); setLoginForm({id:"",pw:""}); }
    else setLoginError("아이디 또는 비밀번호가 올바르지 않습니다.");
  };
  const handleLogout=()=>{ setUser(null); setPage("home"); };

  const submitArticle=async()=>{
    if(!form.title||!form.body) return;
    const eid=editId, ns=user?.role==="admin"?"published":"pending";
    let updated;
    if(eid!==null){
      updated=articles.map(a=>a.id===eid
        ?{...a,title:form.title,category:form.category,type:form.type,body:form.body,image:form.image,
          summary:form.body.slice(0,80)+"...",status:user?.role==="admin"?a.status:"pending",
          author:form.type==="칼럼"?user?.name:undefined}:a);
      setSelected(prev=>prev?.id===eid?updated.find(a=>a.id===eid)||null:prev);
    } else {
      const newA={id:Date.now(),category:form.category,type:form.type,date:today(),
        views:0,title:form.title,summary:form.body.slice(0,80)+"...",
        body:form.body,image:form.image||"",,status:ns,
        author:form.type==="칼럼"?user?.name:undefined};
      updated=[newA,...articles];
    }
    setEditId(null); setArticles(updated); await save(updated);
    setForm({title:"",category:"경제",type:allowedTypes(user?.role)[0]||"기사",body:"",image:""});
    setPage(user?.role==="admin"?"admin":"home");
  };

  const startEdit=a=>{ setForm({title:a.title,category:a.category,type:a.type||"기사",body:a.body,image:a.image||""}); setEditId(a.id); setSelected(null); setPage("write"); };
  const doDelete=async()=>{
    const updated=articles.filter(a=>a.id!==confirmDel);
    setArticles(updated); await save(updated); setConfirmDel(null); setSelected(null); setPage("home");
  };
  const updateStatus=async(id,status)=>{ const u=articles.map(a=>a.id===id?{...a,status}:a); setArticles(u); await save(u); };

  const published=articles.filter(a=>a.status==="published");
  const hero=published.find(a=>a.hero);
  const filtered=published.filter(a=>{
    const mc=activeCategory==="전체"||a.category===activeCategory;
    const mt=activeType==="전체"||a.type===activeType;
    const ms=!search||a.title.includes(search)||a.summary?.includes(search);
    return mc&&mt&&ms&&!a.hero;
  });
  const topViewed=[...published].sort((a,b)=>b.views-a.views).slice(0,5);
  const pendingCount=articles.filter(a=>a.status==="pending").length;

  const bg  =dark?"bg-gray-950 text-gray-100":"bg-gray-50 text-gray-900";
  const card=dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200";
  const inp =dark?"bg-gray-800 border-gray-700 text-white placeholder-gray-500":"bg-white border-gray-300 placeholder-gray-400";

  const SNS=[
    {icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.265 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>,label:"X (트위터)",color:"text-gray-800",href:"https://twitter.com/intent/follow?screen_name=se_al_official_"},
    {icon:<Instagram size={14}/>,label:"인스타그램",color:"text-pink-500",href:"#"},
    {icon:<Facebook size={14}/>,label:"페이스북",color:"text-blue-600",href:"#"},
    {icon:<Youtube size={14}/>,label:"유튜브",color:"text-red-600",href:"#"},
  ];

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>

      {/* TOP BAR */}
      <div className={`w-full flex justify-end items-center px-4 py-1.5 text-xs gap-3 flex-wrap ${dark?"bg-gray-900 border-b border-gray-800 text-gray-400":"bg-gray-100 border-b border-gray-200 text-gray-900"}`}>
        <span>{dark?"🌙 다크 모드":"☀️ 라이트 모드"}</span>
        <button onClick={toggleDark} style={{position:"relative",width:40,height:20,borderRadius:999,background:dark?"#2563eb":"#d1d5db",transition:"background 0.3s",flexShrink:0,border:"none",cursor:"pointer",padding:0}}>
          <span style={{position:"absolute",top:2,left:2,width:16,height:16,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"transform 0.3s",transform:dark?"translateX(20px)":"translateX(0)",display:"block"}}/>
        </button>
        {user?(
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{color:SC}} className="font-medium">{roleLabel[user.role]} {user.name}</span>
            {user.role==="admin"&&(
              <button onClick={()=>setPage("admin")} className="flex items-center gap-1 hover:text-green-700">
                <ShieldCheck size={12}/> 관리자 메뉴
                {pendingCount>0&&<span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs">{pendingCount}</span>}
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1 hover:text-red-500"><LogOut size={12}/> 로그아웃</button>
          </div>
        ):(
          <button onClick={()=>setShowLogin(true)} className="flex items-center gap-1 hover:text-green-700"><LogIn size={12}/> 로그인</button>
        )}
      </div>

      {/* HEADER */}
      <header style={{backgroundColor:SC}} className="sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-white" onClick={()=>setMenuOpen(!menuOpen)}>
              {menuOpen?<X size={22}/>:<Menu size={22}/>}
            </button>
            <button onClick={()=>{setPage("home");setSelected(null);}} className="text-white font-bold text-xl tracking-tight">📰 세계를 알리다</button>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {CATEGORIES.map(c=>(
              <button key={c} onClick={()=>{setActiveCat(c);setPage("home");setSelected(null);}}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeCategory===c&&page==="home"?"bg-white/25 text-white":"text-green-100 hover:bg-white/15 hover:text-white"}`}>{c}</button>
            ))}
            {user&&canWrite(user.role)&&(
              <button onClick={()=>{setEditId(null);setForm({title:"",category:"경제",type:allowedTypes(user.role)[0],body:"",image:""});setPage("write");}}
                className="ml-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded text-sm font-medium border border-white/30">✏️ 글 작성</button>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {searchOpen&&<input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..." className="px-3 py-1 rounded text-sm text-gray-900 w-36 focus:outline-none"/>}
            <button onClick={()=>setSearchOpen(s=>!s)} className="text-white hover:text-green-200"><Search size={20}/></button>
          </div>
        </div>
        {menuOpen&&(
          <div style={{backgroundColor:SCD}} className="md:hidden border-t border-green-900 px-4 pb-3 pt-2 flex flex-col gap-2">
            {CATEGORIES.map(c=>(
              <button key={c} onClick={()=>{setActiveCat(c);setMenuOpen(false);setPage("home");}} className="text-green-100 hover:text-white text-sm py-1 text-left">{c}</button>
            ))}
            {user&&canWrite(user.role)&&<button onClick={()=>{setPage("write");setMenuOpen(false);}} className="text-green-200 text-sm py-1 text-left">✏️ 글 작성</button>}
            {user?.role==="admin"&&<button onClick={()=>{setPage("admin");setMenuOpen(false);}} className="text-yellow-300 text-sm py-1 text-left">👑 관리자 메뉴</button>}
          </div>
        )}
      </header>

      {/* LOGIN MODAL */}
      {showLogin&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>setShowLogin(false)}>
          <div className={`rounded-2xl shadow-2xl p-8 w-80 ${dark?"bg-gray-900 text-gray-100":"bg-white text-gray-900"}`} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-lg">로그인</h2>
              <button onClick={()=>setShowLogin(false)}><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <input value={loginForm.id} onChange={e=>setLoginForm({...loginForm,id:e.target.value})} placeholder="아이디" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
              <input type="password" value={loginForm.pw} onChange={e=>setLoginForm({...loginForm,pw:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="비밀번호" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
              {loginError&&<p className="text-red-500 text-xs">{loginError}</p>}
              <button onClick={handleLogin} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">로그인</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDel!==null&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`rounded-2xl shadow-2xl p-7 w-72 text-center ${dark?"bg-gray-900 text-gray-100":"bg-white text-gray-900"}`}>
            <AlertTriangle size={36} className="text-red-500 mx-auto mb-3"/>
            <h3 className="font-bold mb-1">기사를 삭제할까요?</h3>
            <p className="text-xs text-gray-400 mb-5">삭제한 기사는 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmDel(null)} className={`flex-1 py-2 rounded-lg text-sm border ${dark?"border-gray-700 text-gray-300":"border-gray-300 text-gray-600"}`}>취소</button>
              <button onClick={doDelete} className="flex-1 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-medium">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 금융 */}
      <FinanceTicker dark={dark}/>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ADMIN */}
        {page==="admin"&&user?.role==="admin"&&(
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} style={{color:SC}}/> 관리자 메뉴</h2>
              <button onClick={()=>setPage("home")} className="text-sm hover:underline flex items-center gap-1" style={{color:SC}}><ArrowLeft size={14}/> 홈으로</button>
            </div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {[{key:"pending",label:"승인 대기",icon:<Clock size={13}/>},{key:"published",label:"게재된 글",icon:<CheckCircle size={13}/>},{key:"rejected",label:"반려된 글",icon:<XCircle size={13}/>}].map(t=>{
                const cnt=articles.filter(a=>a.status===t.key).length;
                return (
                  <button key={t.key} onClick={()=>setAdminTab(t.key)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                    style={adminTab===t.key?{backgroundColor:SC,color:"white",borderColor:SC}:{}}>
                    {t.icon}<span className={adminTab!==t.key?(dark?"text-gray-300":"text-gray-600"):""}>{t.label}</span>
                    {cnt>0&&<span className={`rounded-full px-1.5 text-xs py-0.5 ${adminTab===t.key?"bg-white/25 text-white":"bg-gray-200 text-gray-600"}`}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
            {articles.filter(a=>a.status===adminTab).length===0
              ?<div className={`rounded-xl border p-10 text-center text-gray-400 text-sm ${card}`}>해당 글이 없습니다.</div>
              :<div className="space-y-3">
                {articles.filter(a=>a.status===adminTab).map(a=>(
                  <div key={a.id} className={`rounded-xl border p-4 ${card}`}>
                    <div className="flex items-start gap-4">
                      <ArticleImage image={a.image} category={a.category} className="rounded-lg flex-shrink-0" style={{width:80,height:64,minWidth:80}}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                          <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[a.status]}`}>{statusLabel[a.status]}</span>
                          <span className="text-xs text-gray-400">{a.date}</span>
                          {a.author&&<span className="text-xs text-amber-600">✒️ {a.author}</span>}
                        </div>
                        <h3 className="font-semibold text-sm line-clamp-1">{a.title}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{a.summary}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={()=>{setSelected(a);setPage("home");}} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${dark?"border-gray-700 text-gray-300":"border-gray-300 text-gray-600"}`}><Eye size={12}/> 미리보기</button>
                      {a.status!=="published"&&<button onClick={()=>updateStatus(a.id,"published")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white"><CheckCircle size={12}/> 승인 게재</button>}
                      {a.status!=="rejected"&&<button onClick={()=>updateStatus(a.id,"rejected")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white"><XCircle size={12}/> 반려</button>}
                      <button onClick={()=>startEdit(a)} style={{backgroundColor:SC}} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90"><Edit2 size={12}/> 수정</button>
                      <button onClick={()=>setConfirmDel(a.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white"><Trash2 size={12}/> 삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* WRITE */}
        {page==="write"&&user&&canWrite(user.role)&&(
          <div className="max-w-2xl mx-auto">
            <button onClick={()=>{setPage(user.role==="admin"?"admin":"home");setEditId(null);}} className="flex items-center gap-1 text-sm hover:underline mb-4" style={{color:SC}}>
              <ArrowLeft size={15}/> {user.role==="admin"?"관리자 메뉴로":"홈으로"}
            </button>
            <h2 className="text-2xl font-bold mb-1">{editId!==null?"✏️ 글 수정":"✏️ 새 글 작성"}</h2>
            {user.role!=="admin"&&<p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-1"><Clock size={12}/> 작성한 글은 관리자 승인 후 게재됩니다.</p>}
            <div className={`rounded-xl border p-6 space-y-4 ${card}`}>
              <div>
                <label className="text-sm font-medium mb-2 block">글 종류 *</label>
                <div className="flex gap-2">
                  {allowedTypes(user.role).map(t=>(
                    <button key={t} onClick={()=>setForm(f=>({...f,type:t}))}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                      style={form.type===t?{backgroundColor:t==="칼럼"?"#d97706":SC,color:"white",borderColor:"transparent"}:{}}>
                      <span className={form.type!==t?(dark?"text-gray-300":"text-gray-600"):""}>
                        {t==="기사"?<span className="flex items-center gap-1"><FileText size={13}/>기사</span>:<span className="flex items-center gap-1"><PenLine size={13}/>칼럼</span>}
                      </span>
                    </button>
                  ))}
                </div>
                {form.type==="칼럼"&&<p className="text-xs text-amber-600 mt-1.5">✒️ 칼럼에는 작성자 이름({user.name})이 표시됩니다.</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">제목 *</label>
                <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="제목을 입력하세요" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">카테고리</label>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${inp}`}>
                  {CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">이미지 업로드 (선택)</label>
                <label className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm ${inp}`} style={{borderStyle:"dashed"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-gray-400">{form.image?"✅ 이미지 업로드됨":"클릭해서 이미지 파일 선택"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    const r=new FileReader(); r.onload=ev=>setForm(fm=>({...fm,image:ev.target.result})); r.readAsDataURL(f);
                  }}/>
                </label>
                {form.image&&<div className="mt-2 relative"><img src={form.image} alt="" className="w-full h-36 object-cover rounded-lg"/><button onClick={()=>setForm(f=>({...f,image:""}))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={14}/></button></div>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">본문 *</label>
                <div className={`flex gap-1 mb-1 p-1 rounded border ${dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-200"}`}>
                  {[<Bold size={14}/>,<Italic size={14}/>,<List size={14}/>].map((ic,i)=>(
                    <button key={i} className={`p-1.5 rounded transition-colors ${dark?"text-gray-300 hover:bg-gray-700":"text-gray-600 hover:bg-gray-200"}`}>{ic}</button>
                  ))}
                </div>
                <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} rows={8} placeholder="본문을 입력하세요..." className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none ${inp}`}/>
              </div>
              <button onClick={submitArticle} style={{backgroundColor:form.type==="칼럼"?"#d97706":SC}}
                className="w-full py-2.5 text-white rounded-lg font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2">
                <Save size={15}/>{user.role==="admin"?(editId!==null?"수정 완료":"게재하기"):(editId!==null?"수정 후 승인 요청":"승인 요청하기")}
              </button>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {page==="home"&&selected&&(
          <div className="max-w-2xl mx-auto">
            <button onClick={()=>{ setSelected(null); if(user?.role==="admin"&&selected.status!=="published") setPage("admin"); }}
              className="flex items-center gap-1 text-sm hover:underline mb-4" style={{color:SC}}>
              <ArrowLeft size={15}/> {user?.role==="admin"&&selected.status!=="published"?"관리자 메뉴로":"목록으로"}
            </button>
            {selected.status!=="published"&&<div className={`text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-1 ${statusStyle[selected.status]}`}>{selected.status==="pending"?<Clock size={12}/>:<XCircle size={12}/>} 미리보기 — {statusLabel[selected.status]} 상태입니다.</div>}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[selected.type]||"bg-gray-500"}`}>{selected.type||"기사"}</span>
              <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[selected.category]||"bg-gray-500"}`}>{selected.category}</span>
            </div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-2xl font-bold leading-tight">{selected.title}</h1>
              {user&&<div className="flex gap-2 flex-shrink-0 mt-1">
                <button onClick={()=>startEdit(selected)} style={{backgroundColor:SC}} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90"><Edit2 size={12}/> 수정</button>
                {user.role==="admin"&&<button onClick={()=>setConfirmDel(selected.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600"><Trash2 size={12}/> 삭제</button>}
              </div>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
              <span>{selected.date}</span>
              {selected.author&&<span className="text-amber-600 font-medium flex items-center gap-1"><PenLine size={11}/> {selected.author}</span>}
              <span className="flex items-center gap-1"><Eye size={11}/> {selected.views.toLocaleString()}</span>
            </div>
            <ArticleImage image={selected.image} category={selected.category} className="w-full rounded-xl mb-5" style={{height:280}}/>
            {selected.type==="칼럼"&&<div className="border-l-4 border-amber-400 pl-4 mb-4 py-1"><p className="text-xs text-amber-600 font-medium">칼럼 — {selected.author||"익명"} 기고</p></div>}
            <div className="text-sm leading-relaxed whitespace-pre-line">{selected.body}</div>

            <LikeButton articleId={selected.id} dark={dark}/>

            <div className={`border-t mt-8 pt-2 ${dark?"border-gray-800":"border-gray-200"}`}>
              <CommentSection articleId={selected.id} user={user} dark={dark}/>
            </div>
          </div>
        )}

        {/* HOME */}
        {page==="home"&&!selected&&(
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {CATEGORIES.map(c=>(
                <button key={c} onClick={()=>setActiveCat(c)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors"
                  style={activeCategory===c?{backgroundColor:SC,color:"white",borderColor:SC}:{}}>
                  <span className={activeCategory!==c?(dark?"text-gray-300":"text-gray-600"):""}>{c}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-5">
              {["전체","기사","칼럼"].map(t=>(
                <button key={t} onClick={()=>setActiveType(t)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={activeType===t?{backgroundColor:t==="칼럼"?"#d97706":t==="기사"?"#475569":SC,color:"white",borderColor:"transparent"}:{}}>
                  <span className={activeType!==t?(dark?"text-gray-400":"text-gray-500"):""}>{t==="기사"?"📄 기사":t==="칼럼"?"✒️ 칼럼":"전체"}</span>
                </button>
              ))}
            </div>

            {hero&&activeCategory==="전체"&&activeType==="전체"&&!search&&(
              <div onClick={()=>setSelected(hero)} className="cursor-pointer rounded-2xl overflow-hidden mb-8 relative group" style={{height:320}}>
                <ArticleImage image={hero.image} category={hero.category} className="w-full h-full group-hover:scale-105 transition-transform duration-500"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"/>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex gap-2 mb-2">
                    <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[hero.type]||"bg-slate-600"}`}>{hero.type||"기사"}</span>
                    <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[hero.category]}`}>{hero.category}</span>
                  </div>
                  <h2 className="text-white text-xl md:text-2xl font-bold mb-1 leading-tight">{hero.title}</h2>
                  <p className="text-gray-300 text-sm line-clamp-2 hidden md:block">{hero.summary}</p>
                  <span className="text-gray-400 text-xs mt-1 block">{hero.date}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                {search&&<p className="text-sm text-gray-500 mb-4">'{search}' 검색 결과 {filtered.length}건</p>}
                {filtered.length===0&&<p className="text-gray-400 text-sm py-10 text-center">게재된 글이 없습니다.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filtered.map(a=>(
                    <div key={a.id} onClick={()=>setSelected(a)}
                      className={`cursor-pointer rounded-xl border overflow-hidden hover:shadow-lg transition-shadow group ${card} ${a.type==="칼럼"?"border-l-4 border-l-amber-400":""}`}>
                      <ArticleImage image={a.image} category={a.category} className="w-full group-hover:scale-105 transition-transform duration-500" style={{height:160}}/>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <div className="flex gap-1">
                            <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                            <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
                          </div>
                          <span className="text-xs text-gray-400">{a.date}</span>
                        </div>
                        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{a.title}</h3>
                        {a.author&&<p className="text-xs text-amber-600 mb-0.5">✒️ {a.author}</p>}
                        <p className="text-xs text-gray-500 line-clamp-2">{a.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="md:w-64 space-y-4">
                <div className={`rounded-xl border p-4 ${card}`}>
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-1"><TrendingUp size={15} className="text-red-500"/> 가장 많이 본 뉴스</h3>
                  <ol className="space-y-2">
                    {topViewed.map((a,i)=>(
                      <li key={a.id} onClick={()=>setSelected(a)} className="cursor-pointer flex gap-2 items-start group">
                        <span className={`font-bold text-sm w-5 flex-shrink-0 ${i===0?"text-red-500":i===1?"text-orange-400":i===2?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                        <div><span className="text-xs leading-snug group-hover:underline line-clamp-2">{a.title}</span>
                        {a.type==="칼럼"&&<span className="text-xs text-amber-500 block">✒️ 칼럼</span>}</div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={`rounded-xl border p-4 ${card}`}>
                  <h3 className="font-bold text-sm mb-3">세계를 알리다 SNS</h3>
                  <div className="space-y-2">
                    {SNS.map(s=>(
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 text-xs hover:underline ${s.color}`}>{s.icon}{s.label} 팔로우</a>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {page==="home"&&!selected&&(
        <section className="mt-10" style={{backgroundColor:SCD}}>
          <div className="max-w-6xl mx-auto px-4 py-10 text-center">
            <h3 className="text-white text-xl font-bold mb-1">📬 세계를 알리다 뉴스레터 구독</h3>
            <p className="text-green-200 text-sm mb-4">매주 월요일 아침, 캠퍼스 주요 소식을 이메일로 받아보세요.</p>
            {subscribed
              ?<p className="text-green-300 font-medium text-sm">✅ 구독이 완료되었습니다!</p>
              :<div className="flex flex-col sm:flex-row justify-center gap-2 max-w-sm mx-auto">
                <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="이메일 주소를 입력하세요" className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-900 focus:outline-none"/>
                <button onClick={()=>email&&setSubscribed(true)} style={{backgroundColor:SC}} className="px-5 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 border border-green-400">구독하기</button>
              </div>
            }
          </div>
        </section>
      )}

      <footer className={`border-t text-center py-5 text-xs text-gray-500 ${dark?"border-gray-800 bg-gray-950":"border-gray-200 bg-white"}`}>
        © 2026 세계를 알리다 · 표선고등학교 학생 언론사 | 문의: psnewspaper01@gmail.com
      </footer>

      <SuggestionBox user={user} dark={dark}/>
    </div>
  );
}
