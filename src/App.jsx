import { useState, useEffect, useRef, createContext, useContext } from "react";
import { supabase } from './lib/supabase';
import { Search, X, TrendingUp, Instagram, Facebook, Youtube, ArrowLeft, Bold, Italic, List, LogIn, LogOut, Edit2, Trash2, Save, Eye, AlertTriangle, ShieldCheck, Clock, CheckCircle, XCircle, FileText, PenLine, MessageSquarePlus, RefreshCw, Send, Inbox, MessageCircle, ChevronLeft, ChevronRight, Share2, Copy, Link, Mail, Bookmark, BookmarkCheck } from "lucide-react";

/* ── 날짜 헬퍼 ── */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
};

const CATEGORIES  = ["전체","긴급","경제","문화","기술"];
const catColor    = { 긴급:"bg-red-600", 경제:"bg-blue-600", 문화:"bg-pink-500", 기술:"bg-emerald-600" };
const typeColor   = { 기사:"bg-slate-600", 칼럼:"bg-amber-500" };
const catGradient = {
  경제:"linear-gradient(135deg,#1e3a8a,#3b82f6)",
  문화:"linear-gradient(135deg,#831843,#ec4899)",
  기술:"linear-gradient(135deg,#064e3b,#10b981)",
  긴급:"linear-gradient(135deg,#7f1d1d,#ef4444)",
};
const SC  = "#1a6b3c";
const SC_DARK = "#4ade80";
const SCContext = createContext(SC);
const SCD = "#145530";

function renderInlineMarkdown(text){
  const tokens = [];
  let i = 0, buf = "", key = 0;
  const flush = () => { if(buf){ tokens.push(buf); buf = ""; } };
  while(i < text.length){
    if(text[i]==="*" && text[i+1]==="*"){
      const end = text.indexOf("**", i+2);
      if(end > i+2){ flush(); tokens.push(<strong key={`b${key++}`}>{text.slice(i+2,end)}</strong>); i = end+2; continue; }
    }
    if(text[i]==="_"){
      const end = text.indexOf("_", i+1);
      if(end > i+1){ flush(); tokens.push(<em key={`i${key++}`}>{text.slice(i+1,end)}</em>); i = end+1; continue; }
    }
    buf += text[i]; i++;
  }
  flush();
  return tokens;
}

function renderArticleBody(text){
  if(!text) return null;
  const lines = text.split("\n");
  const out = [];
  let list = [];
  let key = 0;
  const flushList = () => {
    if(list.length){
      out.push(<ul key={`ul${key++}`} className="list-disc pl-6 my-2 space-y-1">{list.map((it,idx)=><li key={idx}>{renderInlineMarkdown(it)}</li>)}</ul>);
      list = [];
    }
  };
  lines.forEach((line)=>{
    if(/^- /.test(line)){ list.push(line.slice(2)); }
    else{
      flushList();
      if(line.trim()===""){ out.push(<div key={`sp${key++}`} className="h-3"/>); }
      else{ out.push(<p key={`p${key++}`} className="mb-2">{renderInlineMarkdown(line)}</p>); }
    }
  });
  flushList();
  return out;
}

const canWrite    = r => ["admin","editor","columnist","reporter"].includes(r);
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
const roleLabel   = { admin:"👑 관리자", editor:"📰 기자", reporter:"📰 기자 회원", columnist:"✒️ 칼럼니스트", pending:"⏳ 승인 대기", rejected:"❌ 미승인" };
const memberRoleLabel = { pending:"승인 대기", reporter:"기자 승인됨", columnist:"칼럼니스트 승인됨", rejected:"가입 거절" };
const memberRoleStyle = { pending:"bg-yellow-100 text-yellow-700", reporter:"bg-blue-100 text-blue-700", columnist:"bg-green-100 text-green-700", rejected:"bg-red-100 text-red-600" };

/* ── 이미지 컴포넌트 ── */
const CAT_EMOJI = { 긴급:"⚠️", 경제:"💰", 문화:"🎨", 기술:"💡" };
function ArticleImage({ image, category, title, priority=false, className="", style={} }) {
  const [failed, setFailed] = useState(false);
  const show = image && !failed;
  const emoji = CAT_EMOJI[category];
  const initial = (title||"").trim()[0]||"";
  return (
    <div className={`relative overflow-hidden ${className}`}
      style={{ background: catGradient[category]||"linear-gradient(135deg,#374151,#6b7280)", ...style }}>
      {show
        ? <img src={image} alt={title||""}
            loading={priority?"eager":"lazy"}
            fetchpriority={priority?"high":"auto"}
            decoding="async"
            className="w-full h-full object-cover absolute inset-0" onError={()=>setFailed(true)}/>
        : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/80 select-none">
            {emoji && <span className="text-4xl md:text-5xl drop-shadow-md leading-none">{emoji}</span>}
            {initial && <span className="text-white/90 font-bold text-base md:text-lg tracking-wide line-clamp-1 px-3 text-center drop-shadow">{initial}</span>}
            {!emoji && !initial && <><FileText size={22}/><span className="text-xs">이미지 없음</span></>}
          </div>}
    </div>
  );
}

/* ── 북마크 토글 버튼 ── */
function BookmarkButton({ articleId, user, bookmarks, onToggle, dark }) {
  const active = bookmarks.includes(articleId);
  if (!user) return null;
  return (
    <button onClick={()=>onToggle(articleId, !active)}
      aria-label={active?"북마크 해제":"북마크 추가"}
      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${active?"bg-amber-500 border-amber-500 text-white hover:bg-amber-600":(dark?"border-gray-700 text-gray-300 hover:bg-gray-800":"border-gray-300 text-gray-600 hover:bg-gray-50")}`}>
      {active ? <BookmarkCheck size={13}/> : <Bookmark size={13}/>}
      {active ? "저장됨" : "저장"}
    </button>
  );
}

/* ── 관련 기사 추천 ── */
function RelatedArticles({ current, articles, onOpen, dark }) {
  const SC = useContext(SCContext);
  const card = dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";
  const related = articles
    .filter(a => a.id !== current.id && a.status === "published" && a.category === current.category)
    .slice(0, 4);
  if (related.length === 0) return null;
  return (
    <div className="mt-10 md:mt-12">
      <h3 className="font-bold text-base md:text-lg mb-4 flex items-center gap-2"><FileText size={17} style={{color:SC}}/> 이 기사와 관련된 글</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {related.map(a => (
          <div key={a.id} onClick={()=>onOpen(a)}
            className={`cursor-pointer rounded-xl border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group ${card} ${a.type==="칼럼"?"border-l-4 border-l-amber-400":""}`}>
            <ArticleImage image={a.image} category={a.category} title={a.title} className="w-full h-24 sm:h-28"/>
            <div className="p-3">
              <div className="flex gap-1 mb-1.5">
                <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
              </div>
              <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">{a.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 읽기 진도바 ── */
function ReadingProgress() {
  const SC = useContext(SCContext);
  const [pct, setPct] = useState(0);
  useEffect(()=>{
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setPct(total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return ()=>{ window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  },[]);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 pointer-events-none">
      <div className="h-full transition-[width] duration-150 ease-out" style={{width:`${pct}%`, backgroundColor:SC, boxShadow:`0 0 8px ${SC}80`}}/>
    </div>
  );
}

/* ── 카드 스켈레톤 ── */
function SkeletonCard({ dark, count=4 }) {
  const base = dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";
  const bar  = dark ? "bg-gray-800" : "bg-gray-200";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
      {Array.from({length:count}).map((_,i)=>(
        <div key={i} className={`rounded-xl border overflow-hidden ${base} animate-pulse`}>
          <div className={`w-full h-36 sm:h-40 md:h-44 lg:h-48 ${bar}`}/>
          <div className="p-3 md:p-4 space-y-2">
            <div className="flex gap-1.5">
              <div className={`h-4 w-12 rounded-full ${bar}`}/>
              <div className={`h-4 w-12 rounded-full ${bar}`}/>
            </div>
            <div className={`h-4 w-full rounded ${bar}`}/>
            <div className={`h-4 w-4/5 rounded ${bar}`}/>
            <div className={`h-3 w-3/5 rounded ${bar}`}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 실시간 금융 패널 ── */
function FinancePanel({ dark }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const fetchData = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/finance');
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.error) throw new Error();
      setData(json);
    } catch { setError(true); }
    setLoading(false);
  };

  useEffect(()=>{ fetchData(); },[]);

  const card = dark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100";
  const sub  = dark ? "text-gray-400" : "text-gray-500";

  const renderCard = (label, value, change) => {
    const up = change?.startsWith("+");
    return (
      <div key={label} className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${card}`}>
        <p className="text-[11px] md:text-xs font-medium mb-0.5 md:mb-1 text-gray-400">{label}</p>
        <p className={`text-lg md:text-2xl font-extrabold leading-tight ${dark?"text-gray-100":"text-gray-800"}`}>{value}</p>
        {change && (
          <p className={`text-xs md:text-sm font-semibold mt-0.5 ${up?"text-red-500":"text-blue-500"}`}>{change}</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <span className={`text-xs md:text-sm font-bold flex items-center gap-1.5 ${sub}`}>
          <RefreshCw size={13}/> 실시간 금융 지표
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
      {!loading&&!error&&data&&(
        <div className="space-y-3">
          <div>
            <p className={`text-[11px] md:text-xs font-bold mb-1.5 md:mb-2 ${sub}`}>📈 주가 지수</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {renderCard("코스피",   data.kospi,   data.kospi_change)}
              {renderCard("NASDAQ",  data.nasdaq,  data.nasdaq_change)}
              {renderCard("S&P 500", data.sp500,   data.sp500_change)}
              {renderCard("다우존스", "$"+data.dow, data.dow_change)}
            </div>
          </div>
          <div>
            <p className={`text-[11px] md:text-xs font-bold mb-1.5 md:mb-2 ${sub}`}>💱 환율 · 금리 · 원자재</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              {renderCard("원/달러",  data.usdkrw+"원", null)}
              {renderCard("기준금리", data.rate,         null)}
              {renderCard("WTI 원유", "$"+data.oil,      data.oil_change)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ── 날씨 패널 (제주 표선 기준, Open-Meteo 무료 API) ── */
function WeatherPanel({ dark }) {
  const [weather, setWeather] = useState(null);
  const [daily,   setDaily]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const WMO_LABEL = {0:"맑음",1:"대체로 맑음",2:"구름 조금",3:"흐림",45:"안개",48:"안개",51:"이슬비",53:"이슬비",55:"이슬비",61:"비",63:"비",65:"강한 비",71:"눈",73:"눈",75:"강한 눈",80:"소나기",81:"소나기",82:"강한 소나기",95:"뇌우",96:"뇌우",99:"뇌우"};
  const WMO_ICON  = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"❄️",73:"❄️",75:"❄️",80:"🌦️",81:"🌦️",82:"🌧️",95:"⛈️",96:"⛈️",99:"⛈️"};

  const TEMP_LEVELS = [
    { max: 0,        emoji: "🥶", label: "매우 추움", color: "text-blue-600",   bar: "bg-blue-600" },
    { max: 10,       emoji: "🧥", label: "추움",     color: "text-sky-400",    bar: "bg-sky-400" },
    { max: 22,       emoji: "😊", label: "쾌적",     color: "text-green-500",  bar: "bg-green-400" },
    { max: 30,       emoji: "☀️", label: "더움",     color: "text-orange-500", bar: "bg-orange-500" },
    { max: Infinity, emoji: "🥵", label: "폭염",     color: "text-red-600",    bar: "bg-red-600" },
  ];

  const HUMIDITY_LEVELS = [
    { max: 20,       emoji: "💀", label: "매우 건조", color: "text-red-500",    bar: "bg-red-400" },
    { max: 40,       emoji: "🏜️", label: "건조",     color: "text-orange-400", bar: "bg-orange-400" },
    { max: 60,       emoji: "😊", label: "쾌적",     color: "text-green-500",  bar: "bg-green-400" },
    { max: 80,       emoji: "💧", label: "습함",     color: "text-blue-400",   bar: "bg-blue-400" },
    { max: Infinity, emoji: "🌊", label: "매우 습함", color: "text-blue-600",   bar: "bg-blue-600" },
  ];

  const WIND_LEVELS = [
    { max: 10,       emoji: "🍃", label: "고요",   color: "text-green-400",  bar: "bg-green-400" },
    { max: 20,       emoji: "🌬️", label: "약풍",   color: "text-teal-400",   bar: "bg-teal-400" },
    { max: 40,       emoji: "💨", label: "보통",   color: "text-yellow-400", bar: "bg-yellow-400" },
    { max: 60,       emoji: "🌪️", label: "강풍",   color: "text-orange-500", bar: "bg-orange-500" },
    { max: Infinity, emoji: "⛈️", label: "폭풍",   color: "text-red-600",    bar: "bg-red-600" },
  ];

  const getLevelIdx = (levels, v) => {
    const i = levels.findIndex(l => v <= l.max);
    return i === -1 ? levels.length - 1 : i;
  };

  const DAY_NAMES = ["일","월","화","수","목","금","토"];

  useEffect(()=>{
    (async()=>{
      setLoading(true); setError(false);
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=33.32&longitude=126.84" +
          "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" +
          "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
          "&forecast_days=7&timezone=Asia/Seoul"
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        setWeather(json.current);
        setDaily(json.daily);
      } catch { setError(true); }
      setLoading(false);
    })();
  },[]);

  const code     = weather?.weather_code ?? -1;
  const card     = dark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100";
  const val      = dark ? "text-gray-100" : "text-gray-800";
  const sub      = dark ? "text-gray-400" : "text-gray-500";
  const emptyBar = dark ? "bg-gray-700" : "bg-gray-200";
  const tIdx     = weather != null ? getLevelIdx(TEMP_LEVELS, weather.temperature_2m) : -1;
  const hIdx     = weather != null ? getLevelIdx(HUMIDITY_LEVELS, weather.relative_humidity_2m) : -1;
  const wIdx     = weather != null ? getLevelIdx(WIND_LEVELS, weather.wind_speed_10m) : -1;
  const tLevel   = tIdx >= 0 ? TEMP_LEVELS[tIdx] : null;
  const hLevel   = hIdx >= 0 ? HUMIDITY_LEVELS[hIdx] : null;
  const wLevel   = wIdx >= 0 ? WIND_LEVELS[wIdx] : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 md:mb-4 flex-wrap">
        <span className={`text-xs md:text-sm font-bold flex items-center gap-1.5 ${dark?"text-gray-400":"text-gray-500"}`}>
          🌤️ 현재 날씨
        </span>
        <span className={`text-[11px] md:text-xs ${dark?"text-gray-600":"text-gray-400"}`}>제주 표선 기준</span>
      </div>
      {loading && (
        <div className={`flex items-center gap-2 py-2 ${dark?"text-gray-500":"text-gray-400"}`}>
          <RefreshCw size={15} className="animate-spin"/> <span className="text-sm">날씨 불러오는 중...</span>
        </div>
      )}
      {error && <span className="text-sm text-red-400">날씨 데이터 로드 실패</span>}
      {!loading&&!error&&weather&&(
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-5">
            <div className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${card}`}>
              <p className="text-[11px] md:text-xs font-medium mb-0.5 md:mb-1 text-gray-400">날씨</p>
              <p className="text-2xl md:text-3xl leading-tight">{WMO_ICON[code]??"🌡️"}</p>
              <p className={`text-xs md:text-sm font-semibold mt-0.5 md:mt-1 ${dark?"text-gray-300":"text-gray-600"}`}>{WMO_LABEL[code]??"알 수 없음"}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${card}`}>
              <p className="text-[11px] md:text-xs font-medium mb-0.5 md:mb-1 text-gray-400">기온</p>
              <p className={`text-lg md:text-2xl font-extrabold leading-tight ${val}`}>{weather.temperature_2m}°C</p>
              {tLevel && (
                <>
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${tLevel.color}`}>
                    <span>{tLevel.emoji}</span><span>{tLevel.label}</span>
                  </div>
                  <div className="flex gap-0.5 mt-1.5">
                    {TEMP_LEVELS.map((l,i)=>(
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i<=tIdx ? l.bar : emptyBar}`}/>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${card}`}>
              <p className="text-[11px] md:text-xs font-medium mb-0.5 md:mb-1 text-gray-400">습도</p>
              <p className={`text-lg md:text-2xl font-extrabold leading-tight ${val}`}>{weather.relative_humidity_2m}%</p>
              {hLevel && (
                <>
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${hLevel.color}`}>
                    <span>{hLevel.emoji}</span><span>{hLevel.label}</span>
                  </div>
                  <div className="flex gap-0.5 mt-1.5">
                    {HUMIDITY_LEVELS.map((l,i)=>(
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i<=hIdx ? l.bar : emptyBar}`}/>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className={`rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${card}`}>
              <p className="text-[11px] md:text-xs font-medium mb-0.5 md:mb-1 text-gray-400">풍속</p>
              <p className={`text-lg md:text-2xl font-extrabold leading-tight ${val}`}>{weather.wind_speed_10m}<span className="text-xs md:text-sm font-medium"> km/h</span></p>
              {wLevel && (
                <>
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${wLevel.color}`}>
                    <span>{wLevel.emoji}</span><span>{wLevel.label}</span>
                  </div>
                  <div className="flex gap-0.5 mt-1.5">
                    {WIND_LEVELS.map((l,i)=>(
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i<=wIdx ? l.bar : emptyBar}`}/>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {daily && (
            <div>
              <p className={`text-xs font-bold mb-2 ${sub}`}>📅 일주일 예보</p>
              <div className="grid grid-cols-7 gap-1">
                {daily.time.map((dateStr,i)=>{
                  const d  = new Date(dateStr);
                  const dc = daily.weather_code[i];
                  return (
                    <div key={i} className={`rounded-xl border px-1 py-2 text-center ${card} ${i===0?"ring-2 ring-green-500":""}`}>
                      <p className={`text-xs font-bold mb-1 ${i===0?"text-green-500":sub}`}>{i===0?"오늘":DAY_NAMES[d.getDay()]}</p>
                      <p className="text-lg leading-tight">{WMO_ICON[dc]??"🌡️"}</p>
                      <p className={`text-xs font-bold mt-1 ${val}`}>{daily.temperature_2m_max[i]}°</p>
                      <p className="text-xs text-blue-400">{daily.temperature_2m_min[i]}°</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
/* ── 정보 캐러셀 (금융 지표 ↔ 날씨) ── */
function InfoCarousel({ dark }) {
  const SC = useContext(SCContext);
  const [slide, setSlide] = useState(0);
  const TOTAL = 2;
  const intervalRef = useRef(null);

  const startAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSlide(prev => (prev + 1) % TOTAL);
    }, 10000);
  };

  useEffect(() => {
    startAutoPlay();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleGoTo = (idx) => {
    setSlide(idx);
    startAutoPlay();
  };

  const arrowBtn = `flex items-center justify-center w-8 h-8 rounded-full border transition-colors flex-shrink-0 ${dark?"border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-100":"border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`;

  return (
    <div className={`border-b shadow-sm ${dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200"}`}>
      <div className="max-w-6xl mx-auto px-3 py-3 md:px-6 md:py-5">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={()=>handleGoTo((slide-1+TOTAL)%TOTAL)} className={arrowBtn}>
            <ChevronLeft size={16}/>
          </button>
          <div className="flex-1 min-w-0 grid">
            <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${slide===0?"opacity-100":"opacity-0 pointer-events-none"}`}>
              <FinancePanel dark={dark}/>
            </div>
            <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${slide===1?"opacity-100":"opacity-0 pointer-events-none"}`} aria-hidden={slide!==1}>
              <WeatherPanel dark={dark}/>
            </div>
          </div>
          <button onClick={()=>handleGoTo((slide+1)%TOTAL)} className={arrowBtn}>
            <ChevronRight size={16}/>
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-3 md:mt-4">
          {Array.from({length:TOTAL}).map((_,i)=>(
            <button key={i} onClick={()=>handleGoTo(i)}
              className={`rounded-full transition-all duration-300 ${slide===i?"w-5 h-2":"w-2 h-2"}`}
              style={{backgroundColor: slide===i?SC: dark?"#374151":"#d1d5db"}}/>
          ))}
        </div>
      </div>
    </div>
  );
}
function LikeButton({ articleId, dark }) {
  const [liked, setLiked]   = useState(false);
  const [count, setCount]   = useState(0);
  const [bounce, setBounce] = useState(false);
  const LS_KEY = `cv_liked_${articleId}`;

  useEffect(()=>{
    (async()=>{
      try{
        const { data } = await supabase.from('articles').select('like_count').eq('id', articleId).single();
        if(data) setCount(data.like_count || 0);
      }catch{}
      try{
        const saved = localStorage.getItem(LS_KEY);
        if(saved) setLiked(JSON.parse(saved));
      }catch{}
    })();
  },[articleId]);

  const toggle = async () => {
    const newLiked = !liked;
    const newCount = newLiked ? count+1 : Math.max(0, count-1);
    setLiked(newLiked); setCount(newCount);
    if(newLiked){ setBounce(true); setTimeout(()=>setBounce(false),400); }
    try{ await supabase.from('articles').update({ like_count: newCount }).eq('id', articleId); }catch{}
    localStorage.setItem(LS_KEY, JSON.stringify(newLiked));
  };

  return (
    <div className="flex justify-center my-6 md:my-8">
      <button onClick={toggle}
        className={`flex flex-col items-center gap-1 md:gap-1.5 px-6 py-3 md:px-8 md:py-4 rounded-2xl border-2 transition-all duration-200 ${liked?"border-red-400 bg-red-50":"border-gray-200 hover:border-red-300 hover:bg-red-50"} ${dark&&!liked?"bg-gray-800 border-gray-700 hover:bg-gray-700":""}`}
        style={{transform: bounce?"scale(1.25)":"scale(1)", transition:"transform 0.2s cubic-bezier(.36,.07,.19,.97)"}}>
        <span style={{lineHeight:1, filter: liked?"drop-shadow(0 0 6px #f87171)":"none"}} className="text-2xl md:text-3xl">
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
  const SC = useContext(SCContext);
  const [comments,  setComments]  = useState([]);
  const [name,      setName]      = useState("");
  const [text,      setText]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [replyTo,   setReplyTo]   = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyName, setReplyName] = useState("");
  const [likedIds,  setLikedIds]  = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("cv_cmt_likes_"+articleId)||"[]"); }catch{ return []; }
  });

  const card = dark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200";
  const inp  = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 placeholder-gray-400";
  const sub  = dark ? "text-gray-400" : "text-gray-500";

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const { data } = await supabase.from("comments").select("*")
          .eq("article_id", articleId).order("created_at",{ascending:true});
        setComments(data||[]);
      }catch{ setComments([]); }
      setLoading(false);
    })();
  },[articleId]);

  const saveLikes = (ids) => {
    setLikedIds(ids);
    try{ localStorage.setItem("cv_cmt_likes_"+articleId, JSON.stringify(ids)); }catch{}
  };

  const toggleLike = async (cmt) => {
    const already = likedIds.includes(cmt.id);
    const newLikes = already ? (cmt.likes||0) - 1 : (cmt.likes||0) + 1;
    const newIds   = already ? likedIds.filter(i=>i!==cmt.id) : [...likedIds, cmt.id];
    setComments(prev => prev.map(c => c.id===cmt.id ? {...c, likes:newLikes} : c));
    saveLikes(newIds);
    try{ await supabase.from("comments").update({likes:newLikes}).eq("id",cmt.id); }catch{}
  };

  const submitComment = async () => {
    if(!text.trim()) return;
    const newC = { article_id:articleId, name:name.trim()||"익명", text:text.trim(), date:today(), parent_id:null, likes:0 };
    const { data } = await supabase.from("comments").insert(newC).select().single();
    if(data) setComments(prev=>[...prev, data]);
    setName(""); setText("");
  };

  const submitReply = async () => {
    if(!replyText.trim()||!replyTo) return;
    const newC = { article_id:articleId, name:replyName.trim()||"익명", text:replyText.trim(), date:today(), parent_id:replyTo.id, likes:0 };
    const { data } = await supabase.from("comments").insert(newC).select().single();
    if(data) setComments(prev=>[...prev, data]);
    setReplyTo(null); setReplyText(""); setReplyName("");
  };

  const del = async (id) => {
    await supabase.from("comments").delete().eq("id", id);
    setComments(prev => prev.filter(c => c.id!==id && c.parent_id!==id));
  };

  const roots      = comments.filter(c=>!c.parent_id);
  const getReplies = (pid) => comments.filter(c=>c.parent_id===pid);

  const CommentCard = ({ c, isReply=false }) => {
    const liked = likedIds.includes(c.id);
    const replyCls = isReply
      ? (dark ? "bg-gray-900 border-gray-700 ml-6" : "bg-white border-gray-200 ml-6")
      : card;
    return (
      <div className={"rounded-xl border p-3 " + replyCls}>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
          <div className="flex items-center gap-2">
            {isReply && <span className={"text-xs " + sub}>↳</span>}
            <span className="text-xs font-semibold">{c.name}</span>
            <span className={"text-xs " + sub}>{c.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>toggleLike(c)}
              className={"flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors " + (liked?(dark?"border-green-500 text-green-400 bg-green-900/30":"border-green-500 text-green-600 bg-green-50"):(dark?"border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-400":"border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500"))}>
              👍 {c.likes||0}
            </button>
            {!isReply && (
              <button onClick={()=>{ setReplyTo(c); setReplyText(""); setReplyName(""); }}
                className={"flex items-center gap-0.5 text-xs transition-colors " + (dark?"text-gray-500 hover:text-blue-400":"text-gray-400 hover:text-blue-500")}>
                <MessageSquarePlus size={12}/> 답글
              </button>
            )}
            {canDelComment(user?.role) && (
              <button onClick={()=>del(c.id)} className="flex items-center gap-0.5 text-xs text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={11}/> 삭제
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed">{c.text}</p>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <MessageCircle size={17} style={{color:SC}}/> 댓글
        <span className="text-sm font-normal text-gray-400">({comments.length})</span>
      </h3>
      <div className={"rounded-xl border p-4 mb-4 space-y-2 " + (dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200")}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="이름 (선택, 미입력 시 익명)"
          className={"w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 " + inp}/>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="댓글을 입력하세요..."
          className={"w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none " + inp}/>
        <button onClick={submitComment} style={{backgroundColor:SC}}
          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Send size={13}/> 댓글 달기
        </button>
      </div>
      {loading && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
      {!loading && comments.length===0 && <p className="text-xs text-gray-400 text-center py-6">첫 번째 댓글을 남겨보세요!</p>}
      <div className="space-y-3">
        {roots.map(c=>(
          <div key={c.id}>
            <CommentCard c={c}/>
            {getReplies(c.id).length > 0 && (
              <div className="mt-2 space-y-2">
                {getReplies(c.id).map(r=><CommentCard key={r.id} c={r} isReply/>)}
              </div>
            )}
            {replyTo?.id===c.id && (
              <div className={"ml-6 mt-2 rounded-xl border p-3 space-y-2 " + (dark?"bg-gray-900 border-gray-700":"bg-white border-gray-200")}>
                <p className={"text-xs font-medium " + (dark?"text-blue-400":"text-blue-500")}>
                  ↳ <span className="font-semibold">{replyTo.name}</span> 님에게 답글
                </p>
                <input value={replyName} onChange={e=>setReplyName(e.target.value)} placeholder="이름 (선택, 미입력 시 익명)"
                  className={"w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 " + inp}/>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={2} placeholder="답글을 입력하세요..."
                  className={"w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none " + inp}/>
                <div className="flex gap-2">
                  <button onClick={submitReply}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
                    <Send size={12}/> 답글 달기
                  </button>
                  <button onClick={()=>setReplyTo(null)}
                    className={"px-3 py-1.5 rounded-lg text-xs border transition-colors " + (dark?"border-gray-600 text-gray-400":"border-gray-300 text-gray-500")}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 건의함 ── */
function SuggestionBox({ user, dark }) {
  const SC = useContext(SCContext);
  const [open, setOpen]         = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm]         = useState({ name:"", content:"" });
  const [sent, setSent]         = useState(false);
  const card = dark?"bg-gray-900 border-gray-800 text-gray-100":"bg-white border-gray-200 text-gray-900";
  const inp  = dark?"bg-gray-800 border-gray-700 text-white placeholder-gray-500":"bg-white border-gray-300 placeholder-gray-400";

  const loadSuggestions = async () => {
    try{
      const { data } = await supabase.from('suggestions').select('*').order('created_at', {ascending:false});
      setSuggestions(data || []);
    }catch{}
  };

  useEffect(()=>{ if(viewOpen) loadSuggestions(); },[viewOpen]);

  const submit = async () => {
    if(!form.content.trim()) return;
    const newItem = { name: form.name.trim()||"익명", content: form.content.trim(), date: today() };
    const { data } = await supabase.from('suggestions').insert(newItem).select().single();
    if(data) setSuggestions(prev => [data, ...prev]);
    setForm({name:"",content:""});
    setSent(true); setTimeout(()=>{ setSent(false); setOpen(false); },2000);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 flex flex-col gap-2 items-end">
        {canReadBox(user?.role)&&(
          <button onClick={()=>setViewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-medium shadow-lg hover:scale-105 transition-transform"
            style={{backgroundColor:SC}}>
            <Inbox size={14}/> <span className="hidden sm:inline">건의함 열람</span><span className="sm:hidden">열람</span>
          </button>
        )}
        <button onClick={()=>setOpen(true)}
          aria-label="기사 건의하기"
          className="flex items-center gap-2 px-3.5 py-2.5 md:px-4 rounded-full text-white text-sm font-medium shadow-lg hover:scale-105 transition-transform bg-amber-500 hover:bg-amber-600">
          <MessageSquarePlus size={16}/> <span className="hidden sm:inline">기사 건의하기</span><span className="sm:hidden">건의</span>
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
                {suggestions.map(s=>(
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
/* ── 공유 모달 ── */
/* ── 검색 드롭다운 ── */
/* ── 약관 전문 모달 ── */
const TERMS_TEXT = {
  service: {
    title: "서비스 이용약관",
    content: `제1조 (목적)
이 약관은 표선고등학교 학생 언론사 '세계를 알리다'(이하 "서비스")가 제공하는 웹사이트 이용에 관한 조건 및 절차, 이용자와 서비스의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.

제2조 (이용 대상)
본 서비스는 표선고등학교 학생, 교직원 및 서비스에 관심 있는 일반 이용자를 대상으로 합니다. 회원 가입은 만 14세 이상이어야 하며, 14세 미만의 경우 법정 대리인의 동의가 필요합니다.

제3조 (회원 의무)
① 회원은 가입 시 정확한 정보를 입력해야 합니다.
② 회원은 자신의 계정 정보를 타인에게 공유하거나 양도할 수 없습니다.
③ 회원은 타인의 명예를 훼손하거나 불쾌감을 주는 내용을 게시하지 않아야 합니다.

제4조 (금지 행위)
다음 각 호의 행위는 금지됩니다.
① 타인의 개인정보 무단 수집·이용
② 허위 사실 유포 및 명예훼손
③ 저작권 등 지식재산권 침해
④ 서비스 운영 방해 행위
⑤ 욕설·비방·혐오 표현 등 부적절한 콘텐츠 게시

제5조 (게시물 관리)
① 회원이 작성한 기사·칼럼은 관리자 검토 후 게재됩니다.
② 서비스는 법령 위반 또는 약관 위반 게시물을 사전 통보 없이 삭제할 수 있습니다.
③ 게시물의 저작권은 작성자에게 귀속되며, 작성자는 서비스 내 게재를 허락한 것으로 간주합니다.

제6조 (서비스 변경 및 중단)
서비스는 운영상 필요에 따라 서비스 내용을 변경하거나 중단할 수 있으며, 이에 대해 별도의 보상을 하지 않습니다.

제7조 (약관 변경)
서비스는 약관을 변경할 경우 최소 7일 전에 공지하며, 변경 후 계속 이용 시 변경된 약관에 동의한 것으로 간주합니다.

시행일: 2026년 5월 1일`,
  },
  privacy: {
    title: "개인정보 처리방침",
    content: `표선고등학교 학생 언론사 '세계를 알리다'(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」을 준수합니다.

제1조 (수집하는 개인정보 항목)
서비스는 회원가입 및 서비스 제공을 위해 다음 정보를 수집합니다.
· 필수: 이름, 이메일 주소
· 자동 수집: 서비스 이용 기록, 접속 로그

제2조 (개인정보 수집·이용 목적)
① 회원 식별 및 본인 확인
② 서비스 제공 (기사 작성, 댓글, 공감 기능 이용)
③ 부정 이용 방지 및 서비스 개선
④ 공지사항 전달

제3조 (개인정보 보유 및 이용 기간)
회원 탈퇴 시 또는 수집·이용 목적 달성 시 즉시 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

제4조 (개인정보 제3자 제공)
서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 의거하거나 이용자의 동의가 있는 경우에는 예외로 합니다.

제5조 (개인정보 처리 위탁)
서비스는 원활한 운영을 위해 다음과 같이 개인정보 처리를 위탁합니다.
· 수탁업체: Supabase Inc. (데이터베이스 및 인증 서비스)
· 위탁 업무: 회원 인증, 데이터 저장

제6조 (이용자의 권리)
이용자는 언제든지 자신의 개인정보 조회·수정·삭제를 요청할 수 있으며, 관리자에게 문의하시기 바랍니다.

제7조 (개인정보 보호책임자)
· 소속: 표선고등학교 학생 언론사 '세계를 알리다'
· 문의: 서비스 내 건의함을 통해 접수

시행일: 2026년 5월 1일`,
  },
};

function TermsViewModal({ type, onClose, dark }) {
  const SC = useContext(SCContext);
  const t = TERMS_TEXT[type];
  if (!t) return null;
  const bg = dark ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className={"rounded-2xl border shadow-2xl w-full max-w-lg flex flex-col " + bg} style={{maxHeight:"80vh"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:dark?"#374151":"#e5e7eb"}}>
          <h3 className="font-bold text-base">{t.title}</h3>
          <button onClick={onClose} className={"p-1 rounded-full " + (dark?"hover:bg-gray-800":"hover:bg-gray-100")}><X size={18}/></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          <pre className={"text-xs leading-relaxed whitespace-pre-wrap font-sans " + sub}>{t.content}</pre>
        </div>
        <div className="px-5 py-3 border-t" style={{borderColor:dark?"#374151":"#e5e7eb"}}>
          <button onClick={onClose} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">확인</button>
        </div>
      </div>
    </div>
  );
}

function SearchDropdown({ results, query, onSelect, onViewAll, dark }) {
  if (!query.trim() || results.length === 0) return null;

  const hl = (text, q) => {
    if (!text || !q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text;
    return (
      <span>
        {text.slice(0, i)}
        <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic">{text.slice(i, i + q.length)}</mark>
        {text.slice(i + q.length)}
      </span>
    );
  };

  const exerpt = (text, q) => {
    if (!text) return "";
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text.slice(0, 60) + (text.length > 60 ? "…" : "");
    const s = Math.max(0, i - 20);
    const e = Math.min(text.length, i + q.length + 40);
    return (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
  };

  const bg  = dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200";
  const itm = dark ? "hover:bg-gray-800" : "hover:bg-gray-50";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  const catColor = { 긴급:"bg-red-600", 경제:"bg-blue-600", 문화:"bg-pink-500", 기술:"bg-emerald-600" };

  return (
    <div className={"absolute top-full left-0 right-0 z-50 border-b shadow-xl " + bg}>
      <div className="max-w-6xl mx-auto px-4 py-2">
        <p className={"text-xs mb-2 " + sub}><span className="font-semibold text-green-600">{results.length}건</span> 검색됨</p>
        <div className="divide-y" style={{borderColor: dark?"#374151":"#f3f4f6"}}>
          {results.slice(0, 5).map(a => (
            <button key={a.id} onClick={()=>onSelect(a)}
              className={"w-full text-left px-2 py-2.5 flex items-start gap-3 rounded-lg transition-colors " + itm}>
              <span className={"text-xs text-white px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 " + (catColor[a.category]||"bg-gray-500")}>{a.category}</span>
              <div className="flex-1 min-w-0">
                <p className={"text-sm font-medium leading-snug line-clamp-1 " + (dark?"text-gray-100":"text-gray-800")}>{hl(a.title, query)}</p>
                <p className={"text-xs mt-0.5 line-clamp-1 " + sub}>{hl(exerpt(a.body||a.summary||"", query), query)}</p>
              </div>
              <span className={"text-xs flex-shrink-0 " + sub}>{a.date}</span>
            </button>
          ))}
        </div>
        {results.length > 5 && (
          <button onClick={onViewAll}
            className={"w-full text-center text-xs py-2 mt-1 font-medium " + (dark?"text-green-400 hover:text-green-300":"text-green-600 hover:text-green-700")}>
            전체 결과 {results.length}건 보기 →
          </button>
        )}
      </div>
    </div>
  );
}

function ShareModal({ article, onClose, dark }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/article/${article.id}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); } catch { }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareKakao = () => {
    if (navigator.share) {
      navigator.share({ title: article.title, text: article.summary || article.body?.slice(0,80) || '', url });
    } else {
      const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/easylink?app_id=KAKAO_APP_ID&amp;link_ver=4.0&text=${encodeURIComponent(article.title)}&amp;url=${encodeURIComponent(url)}`;
      copyLink();
      alert('링크가 복사됐습니다. 카카오톡에서 붙여넣기 해주세요.');
    }
  };

  const shareGmail = () => {
    const su = encodeURIComponent(`[세계를 알리다] ${article.title}`);
    const body = encodeURIComponent(`${article.title}\n\n${article.summary||article.body?.slice(0,100)||''}\n\n기사 읽기: ${url}`);
    window.open(`https://mail.google.com/mail/?view=cm&su=${su}&body=${body}`, '_blank');
  };

  const shareEmail = () => {
    const su = encodeURIComponent(`[세계를 알리다] ${article.title}`);
    const body = encodeURIComponent(`${article.title}\n\n${article.summary||article.body?.slice(0,100)||''}\n\n기사 읽기: ${url}`);
    window.location.href = `mailto:?subject=${su}&body=${body}`;
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`[세계를 알리다] ${article.title}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const overlay = dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200";
  const btnHover = dark ? "hover:bg-gray-800" : "hover:bg-gray-50";
  const labelCls = dark ? "text-gray-300" : "text-gray-600";
  const urlBarCls = dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500";

  const Btn = ({ onClick, bg, icon, label }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${btnHover}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg}`}>{icon}</div>
      <span className={`text-xs font-medium ${labelCls}`}>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor:'rgba(0,0,0,0.55)'}} onClick={onClose}>
      <div className={`rounded-2xl border p-6 w-full max-w-sm shadow-2xl ${overlay}`}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-bold text-base ${dark?"text-gray-100":"text-gray-800"}`}>기사 공유하기</h3>
          <button onClick={onClose} className={`p-1 rounded-full ${btnHover}`}><X size={18}/></button>
        </div>
        <p className={`text-xs mb-4 line-clamp-2 ${dark?"text-gray-400":"text-gray-500"}`}>{article.title}</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Btn onClick={copyLink}
            bg={copied ? "bg-green-500" : "bg-gray-200"}
            icon={copied ? <CheckCircle size={22} className="text-white"/> : <Link size={22} className="text-gray-600"/>}
            label={copied ? "복사됨!" : "링크 복사"}/>
          <Btn onClick={shareKakao}
            bg="bg-yellow-400"
            icon={<span className="text-xl font-black text-yellow-900">K</span>}
            label="카카오톡"/>
          <Btn onClick={shareGmail}
            bg="bg-red-500"
            icon={<Mail size={22} className="text-white"/>}
            label="Gmail"/>
          <Btn onClick={shareEmail}
            bg="bg-blue-500"
            icon={<Send size={22} className="text-white"/>}
            label="이메일"/>
          <Btn onClick={shareTwitter}
            bg="bg-black"
            icon={<span className="text-white font-black text-lg">𝕏</span>}
            label="X(트위터)"/>
          <Btn onClick={shareFacebook}
            bg="bg-blue-600"
            icon={<Facebook size={22} className="text-white"/>}
            label="페이스북"/>
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${urlBarCls}`}>
          <span className="flex-1 truncate">{url}</span>
          <button onClick={copyLink} className="flex-shrink-0 hover:opacity-70"><Copy size={13}/></button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [dark,setDark]               = useState(false);
  const SC = dark ? SC_DARK : "#1a6b3c";
  const [activeCategory,setActiveCat]= useState("전체");
  const [activeType,setActiveType]   = useState("전체");
  const [selected,setSelected]       = useState(null);
  const [page,setPage]               = useState("home");
  const [search,setSearch]           = useState("");
  const [searchOpen,setSearchOpen]   = useState(false);
  const [recentSearches,setRecentSearches] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("cv_recent_q")||"[]"); }catch{ return []; } });
  const [showDrop,setShowDrop]             = useState(false);
  const searchRef                          = useRef(null);
  const [email,setEmail]             = useState("");
  const [subscribed,setSubscribed]   = useState(false);
  const [subscribeErr,setSubscribeErr] = useState("");
  const [articles,setArticles]       = useState([]);
  const [articlesLoading,setArticlesLoading] = useState(true);
  const [bookmarks,setBookmarks]     = useState([]);
  const [bookmarkedArticles,setBookmarkedArticles] = useState([]);
  const [readProgress,setReadProgress] = useState(0);
  const [form,setForm]               = useState({title:"",category:"경제",type:"기사",body:"",image:""});
  const bodyRef                      = useRef(null);
  const applyFormat = (type) => {
    const ta = bodyRef.current;
    if(!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const body = form.body;
    const before = body.slice(0,start), sel = body.slice(start,end), after = body.slice(end);
    let newBody, newStart, newEnd;
    if(type==="bold"){
      const inner = sel || "굵게";
      newBody = before + "**" + inner + "**" + after;
      newStart = start + 2; newEnd = newStart + inner.length;
    } else if(type==="italic"){
      const inner = sel || "기울임";
      newBody = before + "_" + inner + "_" + after;
      newStart = start + 1; newEnd = newStart + inner.length;
    } else {
      const baseSel = sel || "항목";
      const listed = baseSel.split("\n").map(l => /^- /.test(l) ? l : "- " + l).join("\n");
      const needsNL = start > 0 && body[start-1] !== "\n";
      const prefix = needsNL ? "\n" : "";
      newBody = before + prefix + listed + after;
      newStart = start + prefix.length; newEnd = newStart + listed.length;
    }
    setForm(f=>({...f, body:newBody}));
    setTimeout(()=>{ ta.focus(); ta.setSelectionRange(newStart, newEnd); }, 0);
  };
  const [editId,setEditId]           = useState(null);
  const [confirmDel,setConfirmDel]   = useState(null);
  const [user,setUser]               = useState(null);
  const [showLogin,setShowLogin]     = useState(false);
  const [loginForm,setLoginForm]     = useState({id:"",pw:""});
  const [loginError,setLoginError]   = useState("");
  const [adminTab,setAdminTab]       = useState("pending");
  const [loginTab,setLoginTab]       = useState("member");
  const [memberForm,setMemberForm]   = useState({email:"",pw:""});
  const [showSignup,setShowSignup]   = useState(false);
  const [signupForm,setSignupForm]   = useState({name:"",email:"",pw:"",pwConfirm:""});
  const [signupErr,setSignupErr]     = useState("");
  const [signupDone,setSignupDone]   = useState(false);
  const [termsView,setTermsView]         = useState("");         // "service"|"privacy"|""
  const [showTermsAgree,setShowTermsAgree] = useState(false);   // Google 신규 가입 약관 동의
  const [showWithdraw,setShowWithdraw]     = useState(false);   // 탈퇴 확인 모달
  const [pendingAuthUser,setPendingAuthUser] = useState(null);  // Google 인증 대기 유저
  const [termsCheck,setTermsCheck]       = useState({service:false,privacy:false});
  const [submitting,setSubmitting] = useState(false);
  const [submitErr,setSubmitErr]   = useState("");
  const [showShare,setShowShare]   = useState(false);
  const [members,setMembers]         = useState([]);
  const [myArticles,setMyArticles]   = useState([]);
  const [mypageTab,setMypageTab]     = useState("written");

  useEffect(()=>{
    (async()=>{
      try{
        const { data } = await supabase.from('articles').select('*').order('created_at',{ascending:false});
        setArticles(data && data.length > 0 ? data : DUMMY_ARTICLES);
      }catch{ setArticles(DUMMY_ARTICLES); }
      setArticlesLoading(false);
      try{ const d=localStorage.getItem(DARK_KEY); if(d) setDark(JSON.parse(d)); }catch{}
      let staffLoaded=false;
      try{
        const saved=localStorage.getItem("cv_user");
        if(saved){
          const u=JSON.parse(saved);
          setUser(u); staffLoaded=true;
          loadBookmarks(u.id, false);
        }
      }catch{}
      if(!staffLoaded){
        try{
          const { data:{ session } } = await supabase.auth.getSession();
          if(session?.user) await loadMemberProfile(session.user);
        }catch{}
      }
    })();
    const { data:{ subscription } } = supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_IN"&&session?.user) await loadMemberProfile(session.user);
      else if(event==="SIGNED_OUT") setUser(null);
    });
    return ()=> subscription.unsubscribe();
  },[]);


  // path/hash → article 매핑 (초기 진입 + 뒤로가기/앞으로가기)
  useEffect(()=>{
    if(!articles.length) return;
    const openFromUrl = () => {
      const path=window.location.pathname;
      const m=path.match(/^\/article\/(\d+)/);
      let id=null;
      if(m){ id=parseInt(m[1]); }
      else{
        const hash=window.location.hash;
        if(hash.startsWith('#article-')) id=parseInt(hash.replace('#article-',''));
      }
      if(id){
        const article=articles.find(a=>a.id===id&&a.status==='published');
        setSelected(article || null);
      } else {
        setSelected(null);
      }
    };
    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return ()=> window.removeEventListener('popstate', openFromUrl);
  },[articles]);

  const toggleDark=()=>setDark(d=>{ const n=!d; try{ localStorage.setItem(DARK_KEY,JSON.stringify(n)); }catch{} return n; });

  const loadMemberProfile = async (authUser, termsAccepted=false) => {
    const { data:profile } = await supabase.from('profiles').select('*').eq('id',authUser.id).single();
    if(!profile){
      if(!termsAccepted){
        setPendingAuthUser(authUser);
        setShowTermsAgree(true);
        setShowLogin(false);
        return;
      }
      const name = authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email?.split('@')[0]||'회원';
      const now  = new Date().toISOString();
      await supabase.from('profiles').upsert({id:authUser.id,display_name:name,role:'pending',email:authUser.email,terms_agreed:true,privacy_agreed:true,terms_agreed_at:now});
      setUser({id:authUser.id,name,role:'pending',email:authUser.email,isMember:true});
    } else {
      setUser({id:authUser.id,name:profile.display_name,role:profile.role,email:profile.email||authUser.email,isMember:true});
    }
    loadBookmarks(authUser.id, true);
  };

  const handleLogin=async()=>{
    setLoginError("");
    try{
      const res=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:loginForm.id,password:loginForm.pw})});
      if(!res.ok){ setLoginError("아이디 또는 비밀번호가 올바르지 않습니다."); return; }
      const userObj=await res.json();
      setUser(userObj);
      localStorage.setItem("cv_user",JSON.stringify(userObj));
      loadBookmarks(userObj.id, false);
      setShowLogin(false); setLoginForm({id:"",pw:""});
    }catch{ setLoginError("로그인 중 오류가 발생했습니다."); }
  };

  const handleMemberLogin=async()=>{
    setLoginError("");
    const {data,error}=await supabase.auth.signInWithPassword({email:memberForm.email,password:memberForm.pw});
    if(error){ setLoginError("이메일 또는 비밀번호가 올바르지 않습니다."); return; }
    await loadMemberProfile(data.user);
    setShowLogin(false); setMemberForm({email:"",pw:""});
  };

  const handleGoogleLogin=async()=>{
    await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
  };

  const handleSignup=async()=>{
    setSignupErr("");
    if(!signupForm.name.trim()){ setSignupErr("이름을 입력해주세요."); return; }
    if(!signupForm.email||!signupForm.pw){ setSignupErr("이메일과 비밀번호를 입력해주세요."); return; }
    if(signupForm.pw!==signupForm.pwConfirm){ setSignupErr("비밀번호가 일치하지 않습니다."); return; }
    if(!termsCheck.service){ setSignupErr("서비스 이용약관에 동의해주세요."); return; }
    if(!termsCheck.privacy){ setSignupErr("개인정보 처리방침에 동의해주세요."); return; }
    const {data,error}=await supabase.auth.signUp({email:signupForm.email,password:signupForm.pw});
    if(error){ setSignupErr(error.message); return; }
    const now = new Date().toISOString();
    if(data.user){
      await supabase.from('profiles').upsert({id:data.user.id,display_name:signupForm.name,role:'pending',email:signupForm.email,terms_agreed:true,privacy_agreed:true,terms_agreed_at:now});
    }
    setSignupDone(true);
  };


  const loadMembers=async()=>{
    const {data}=await supabase.from('profiles').select('*')
      .not('role','in','(admin,editor)');
    setMembers(data||[]);
  };

  const approveMember=async(id,role)=>{
    await supabase.from('profiles').update({role}).eq('id',id);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,role}:m));
  };

  const rejectMember=async(id)=>{
    await supabase.from('profiles').update({role:'rejected'}).eq('id',id);
    setMembers(prev=>prev.map(m=>m.id===id?{...m,role:'rejected'}:m));
  };

  const loadMyArticles=async(name)=>{
    const {data}=await supabase.from('articles').select('*').eq('author',name).order('created_at',{ascending:false});
    setMyArticles(data||[]);
  };

  // user_id 포맷: 회원은 auth.uid, 직원은 'staff:' + login id
  const bookmarkKey = (uid, isMember) => isMember ? uid : `staff:${uid}`;

  const loadBookmarks=async(uid, isMember)=>{
    const key = bookmarkKey(uid, isMember);
    try{
      const {data}=await supabase.from('bookmarks').select('article_id, created_at, articles(*)').eq('user_id',key).order('created_at',{ascending:false});
      const ids=(data||[]).map(b=>b.article_id);
      const arts=(data||[]).map(b=>b.articles).filter(Boolean);
      setBookmarks(ids);
      setBookmarkedArticles(arts);
    }catch{}
  };

  const toggleBookmark=async(articleId, willActivate)=>{
    if(!user) return;
    const key = bookmarkKey(user.id, !!user.isMember);
    if(willActivate){
      setBookmarks(prev=>prev.includes(articleId)?prev:[...prev,articleId]);
      const a=articles.find(x=>x.id===articleId);
      if(a) setBookmarkedArticles(prev=>prev.some(x=>x.id===articleId)?prev:[a,...prev]);
      try{ await supabase.from('bookmarks').insert({user_id:key, article_id:articleId}); }catch{}
    } else {
      setBookmarks(prev=>prev.filter(id=>id!==articleId));
      setBookmarkedArticles(prev=>prev.filter(a=>a.id!==articleId));
      try{ await supabase.from('bookmarks').delete().eq('user_id',key).eq('article_id',articleId); }catch{}
    }
  };

  const handleWithdraw=async()=>{
    try{
      await supabase.rpc('delete_own_account');
    }catch{
      // 함수 실패 시 프로필만 삭제
      await supabase.from('profiles').delete().eq('id',user.id);
    }
    await supabase.auth.signOut();
    setUser(null); setPage("home"); setShowWithdraw(false);
  };

  const requestReApproval=async()=>{
    await supabase.from('profiles').update({role:'pending'}).eq('id',user.id);
    setUser(prev=>({...prev,role:'pending'}));
  };

  const handleLogout=async()=>{
    if(user?.isMember) await supabase.auth.signOut();
    else localStorage.removeItem("cv_user");
    setUser(null); setPage("home");
    setBookmarks([]); setBookmarkedArticles([]);
  };

  const submitArticle=async()=>{
    if(!form.title.trim()||!form.body.trim()||!user?.name) return;
    if(submitting) return;
    setSubmitting(true);
    setSubmitErr("");
    const eid=editId;
    const fields={
      title:form.title.trim(), category:form.category, type:form.type,
      body:form.body, image:form.image||"",
      summary:form.body.slice(0,80)+"...", status:"pending",
      author: user?.name,
    };
    try {
      if(eid!==null){
        const { error } = await supabase.from('articles').update(fields).eq('id',eid);
        if(error) throw error;
        setArticles(prev=>prev.map(a=>a.id===eid?{...a,...fields}:a));
        setSelected(prev=>prev?.id===eid?{...prev,...fields}:prev);
      } else {
        const newA={...fields, date:today(), views:0, hero:false};
        const { data, error } = await supabase.from('articles').insert(newA).select().single();
        if(error) throw error;
        if(data) setArticles(prev=>[data,...prev]);
      }
      setEditId(null);
      setForm({title:"",category:"경제",type:allowedTypes(user?.role)[0]||"기사",body:"",image:""});
      setPage(user?.role==="admin"?"admin":"home");
    } catch(e) {
      setSubmitErr("전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };
  const startEdit=a=>{ setForm({title:a.title,category:a.category,type:a.type||"기사",body:a.body,image:a.image||""}); setEditId(a.id); setSelected(null); setPage("write"); };
  const openArticle=async(article)=>{
    if(!article) return;
    const newViews=(article.views||0)+1;
    const updated={...article,views:newViews};
    setSelected(updated);
    setArticles(prev=>prev.map(a=>a.id===article.id?{...a,views:newViews}:a));
    const targetPath=`/article/${article.id}`;
    if(window.location.pathname!==targetPath){
      window.history.pushState({articleId:article.id}, '', targetPath);
    }
    try{ await supabase.from('articles').update({views:newViews}).eq('id',article.id); }catch{}
  };
  const doDelete=async()=>{
    await supabase.from('articles').delete().eq('id',confirmDel);
    setArticles(prev=>prev.filter(a=>a.id!==confirmDel));
    setConfirmDel(null); setSelected(null); setPage("home");
  };
  const updateStatus=async(id,status)=>{
    await supabase.from('articles').update({status}).eq('id',id);
    setArticles(prev=>prev.map(a=>a.id===id?{...a,status}:a));
  };

  const published=articles.filter(a=>a.status==="published");
  const hero=published.find(a=>a.hero);
  const urgent=published.filter(a=>a.category==="긴급");
  const filtered=published.filter(a=>{
    const mc=activeCategory==="전체"||a.category===activeCategory;
    const mt=activeType==="전체"||a.type===activeType;
    const q=search.toLowerCase();
    const ms=!search||[a.title,a.summary,a.body,a.author,a.category].some(f=>f?.toLowerCase().includes(q));
    return mc&&mt&&ms&&(!a.hero||!!search);
  });
  const searchResults=search.trim()?published.filter(a=>{ const q=search.toLowerCase(); return a.title.toLowerCase().includes(q)||a.body?.toLowerCase().includes(q)||a.summary?.toLowerCase().includes(q)||a.author?.toLowerCase().includes(q)||a.category?.toLowerCase().includes(q); }):[];
  const topViewed=[...published].sort((a,b)=>b.views-a.views).slice(0,5);
  const pendingCount=articles.filter(a=>a.status==="pending").length;
  const pendingMemberCount=members.filter(m=>m.role==="pending").length;

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
    <SCContext.Provider value={SC}>
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>

      {/* TOP BAR */}
      <div className={`w-full flex justify-end items-center px-3 md:px-4 py-1.5 text-xs gap-2 md:gap-3 ${dark?"bg-gray-900 border-b border-gray-800 text-gray-400":"bg-gray-100 border-b border-gray-200 text-gray-900"}`}>
        <span className="hidden sm:inline">{dark?"🌙 다크 모드":"☀️ 라이트 모드"}</span>
        <button onClick={toggleDark} aria-label="다크 모드 전환" style={{position:"relative",width:40,height:20,borderRadius:999,background:dark?"#2563eb":"#d1d5db",transition:"background 0.3s",flexShrink:0,border:"none",cursor:"pointer",padding:0}}>
          <span style={{position:"absolute",top:2,left:2,width:16,height:16,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"transform 0.3s",transform:dark?"translateX(20px)":"translateX(0)",display:"block"}}/>
        </button>
        {user?(
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
            <span style={{color:SC}} className="font-medium truncate max-w-[110px] sm:max-w-none">{roleLabel[user.role]} {user.name}</span>
            {user&&(
              <button onClick={()=>{setPage("mypage");loadMyArticles(user.name);loadBookmarks(user.id, !!user.isMember);}} className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-xs md:text-sm font-medium whitespace-nowrap">
                <span className="hidden sm:inline">마이페이지</span><span className="sm:hidden">MY</span>
              </button>
            )}
            {user.role==="admin"&&(
              <button onClick={()=>{setPage("admin");loadMembers();}} className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-xs md:text-sm font-medium whitespace-nowrap">
                <ShieldCheck size={13}/> <span className="hidden sm:inline">관리자 메뉴</span><span className="sm:hidden">관리</span>
                {(pendingCount+pendingMemberCount)>0&&<span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] md:text-xs">{pendingCount+pendingMemberCount}</span>}
              </button>
            )}
            <button onClick={handleLogout} aria-label="로그아웃" className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-red-400 text-red-400 hover:bg-red-400 hover:text-white transition-colors text-xs md:text-sm font-medium whitespace-nowrap">
              <LogOut size={13}/> <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        ):(
          <button onClick={()=>setShowLogin(true)} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-xs md:text-sm font-medium whitespace-nowrap"><LogIn size={13}/> 로그인</button>
        )}
      </div>

      {/* HEADER */}
      <header style={{backgroundColor:SC}} className="sticky top-0 z-40 shadow-md backdrop-blur supports-[backdrop-filter]:bg-opacity-95">
        <div className="max-w-6xl mx-auto px-3 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2 md:gap-6">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-shrink-0">
            <button onClick={()=>{setPage("home");setSelected(null);setActiveCat("전체");setActiveType("전체");setSearch("");setSearchOpen(false);}} className="text-white font-bold text-lg md:text-[22px] tracking-tight truncate hover:opacity-90 transition-opacity">📰 세계를 알리다</button>
          </div>
          <nav className="flex items-center gap-0.5 lg:gap-1 flex-1 justify-center flex-wrap">
            {CATEGORIES.map(c=>{
              const active = activeCategory===c&&page==="home"&&!selected;
              return (
                <button key={c} onClick={()=>{setActiveCat(c);setPage("home");setSelected(null);}}
                  className={`relative px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-all ${active?"text-white":"text-green-100 hover:bg-white/10 hover:text-white"}`}>
                  {c}
                  {active&&<span className="absolute left-2 right-2 lg:left-3 lg:right-3 -bottom-0.5 h-0.5 bg-white rounded-full"/>}
                </button>
              );
            })}
            {user&&canWrite(user.role)&&(
              <button onClick={()=>{setEditId(null);setForm({title:"",category:"경제",type:allowedTypes(user.role)[0],body:"",image:""});setPage("write");}}
                className="ml-2 px-3 lg:px-4 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-medium border border-white/30 transition-colors">✏️ 글 작성</button>
            )}
          </nav>
          <div className="flex items-center gap-2 relative flex-shrink-0">
            {searchOpen && (
              <div className="flex items-center gap-1 bg-white rounded-lg overflow-hidden shadow-sm">
                <input ref={searchRef} autoFocus value={search}
                  onChange={e=>{ setSearch(e.target.value); setShowDrop(true); }}
                  onKeyDown={e=>{ if(e.key==="Escape"){ setSearch(""); setSearchOpen(false); setShowDrop(false); } if(e.key==="Enter"&&search.trim()){ setShowDrop(false); const q=search.trim(); setRecentSearches(prev=>{ const n=[q,...prev.filter(x=>x!==q)].slice(0,5); try{localStorage.setItem("cv_recent_q",JSON.stringify(n));}catch{}; return n; }); } }}
                  onFocus={()=>setShowDrop(true)}
                  placeholder="제목, 내용, 작성자 검색..."
                  className="px-3 py-1.5 text-sm text-gray-900 w-40 sm:w-52 md:w-64 lg:w-72 focus:outline-none bg-transparent"/>
                {search && <button onClick={()=>{ setSearch(""); setShowDrop(false); searchRef.current?.focus(); }} aria-label="검색어 지우기" className="pr-2 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
              </div>
            )}
            <button aria-label="검색" onClick={()=>{ if(searchOpen){ setSearch(""); setShowDrop(false); } setSearchOpen(s=>!s); }} className="text-white hover:text-green-200 flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"><Search size={20}/></button>
          </div>
        </div>
        {/* 검색 드롭다운 */}
        {searchOpen&&showDrop&&search.trim()&&(
          <SearchDropdown
            results={searchResults} query={search} dark={dark}
            onSelect={a=>{ openArticle(a); setShowDrop(false); setSearchOpen(false); setSearch(""); }}
            onViewAll={()=>{ setShowDrop(false); }}/>
        )}
        {/* 최근 검색어 */}
        {searchOpen&&showDrop&&!search.trim()&&recentSearches.length>0&&(
          <div className={"absolute top-full left-0 right-0 z-50 border-b shadow-lg " + (dark?"bg-gray-900 border-gray-700":"bg-white border-gray-200")}>
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className={"text-xs font-medium " + (dark?"text-gray-400":"text-gray-500")}>최근 검색어</span>
                <button onClick={()=>{ setRecentSearches([]); try{localStorage.removeItem("cv_recent_q");}catch{} }} className={"text-xs " + (dark?"text-gray-500 hover:text-gray-300":"text-gray-400 hover:text-gray-600")}>전체 삭제</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q,i)=>(
                  <button key={i} onClick={()=>{ setSearch(q); setShowDrop(true); }}
                    className={"flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors " + (dark?"border-gray-700 text-gray-300 hover:border-green-500 hover:text-green-400":"border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600")}>
                    <Search size={10}/> {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* LOGIN MODAL */}
      {showLogin&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>{setShowLogin(false);setShowSignup(false);setSignupDone(false);setSignupErr("");setLoginError("");}}>
          <div className={`rounded-2xl shadow-2xl p-6 w-84 max-w-sm w-full ${dark?"bg-gray-900 text-gray-100":"bg-white text-gray-900"}`} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">{showSignup?"회원가입":"로그인"}</h2>
              <button onClick={()=>{setShowLogin(false);setShowSignup(false);setSignupDone(false);setSignupErr("");setLoginError("");}}><X size={18}/></button>
            </div>

            {/* 탭 */}
            {!showSignup&&(
              <div className={`flex gap-1 mb-4 p-1 rounded-lg ${dark?"bg-gray-800":"bg-gray-100"}`}>
                {[{key:"member",label:"회원"},{key:"staff",label:"직원"}].map(t=>(
                  <button key={t.key} onClick={()=>{setLoginTab(t.key);setLoginError("");}}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${loginTab===t.key?(dark?"bg-gray-700 text-white":"bg-white shadow text-gray-900"):(dark?"text-gray-400":"text-gray-500")}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* 직원 로그인 */}
            {!showSignup&&loginTab==="staff"&&(
              <div className="space-y-3">
                <input value={loginForm.id} onChange={e=>setLoginForm({...loginForm,id:e.target.value})} placeholder="아이디" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                <input type="password" value={loginForm.pw} onChange={e=>setLoginForm({...loginForm,pw:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="비밀번호" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                {loginError&&<p className="text-red-500 text-xs">{loginError}</p>}
                <button onClick={handleLogin} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">로그인</button>
              </div>
            )}

            {/* 회원 로그인 */}
            {!showSignup&&loginTab==="member"&&(
              <div className="space-y-3">
                <input type="email" value={memberForm.email} onChange={e=>setMemberForm({...memberForm,email:e.target.value})} placeholder="이메일" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                <input type="password" value={memberForm.pw} onChange={e=>setMemberForm({...memberForm,pw:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleMemberLogin()} placeholder="비밀번호" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                {loginError&&<p className="text-red-500 text-xs">{loginError}</p>}
                <button onClick={handleMemberLogin} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">로그인</button>
                <div className="relative flex items-center gap-2 my-1">
                  <div className={`flex-1 h-px ${dark?"bg-gray-700":"bg-gray-200"}`}/>
                  <span className={`text-xs ${dark?"text-gray-500":"text-gray-400"}`}>또는</span>
                  <div className={`flex-1 h-px ${dark?"bg-gray-700":"bg-gray-200"}`}/>
                </div>
                <button onClick={handleGoogleLogin} className={`w-full py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 hover:opacity-80 transition-opacity ${dark?"border-gray-600 text-gray-200":"border-gray-300 text-gray-700"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Google로 로그인 / 회원가입
                </button>
                <button onClick={()=>{setShowSignup(true);setLoginError("");}} className={`w-full py-2 rounded-lg text-sm border transition-colors ${dark?"border-gray-600 text-gray-300 hover:bg-gray-800":"border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  이메일로 회원가입
                </button>
              </div>
            )}

            {/* 회원가입 폼 */}
            {showSignup&&!signupDone&&(
              <div className="space-y-3">
                <input value={signupForm.name} onChange={e=>setSignupForm({...signupForm,name:e.target.value})} placeholder="이름 *" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                <input type="email" value={signupForm.email} onChange={e=>setSignupForm({...signupForm,email:e.target.value})} placeholder="이메일 *" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                <input type="password" value={signupForm.pw} onChange={e=>setSignupForm({...signupForm,pw:e.target.value})} placeholder="비밀번호 * (6자 이상)" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                <input type="password" value={signupForm.pwConfirm} onChange={e=>setSignupForm({...signupForm,pwConfirm:e.target.value})} placeholder="비밀번호 확인 *" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
                {/* 약관 동의 */}
                <div className={`rounded-xl border p-3 space-y-2 ${dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-200"}`}>
                  <p className={`text-xs font-semibold ${dark?"text-gray-300":"text-gray-600"}`}>약관 동의 (필수)</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={termsCheck.service} onChange={e=>setTermsCheck(p=>({...p,service:e.target.checked}))} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                    <span className={`text-xs leading-relaxed ${dark?"text-gray-300":"text-gray-600"}`}>
                      <button type="button" onClick={()=>setTermsView("service")} className="font-semibold underline text-green-600 hover:text-green-700">서비스 이용약관</button>에 동의합니다 (필수)
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={termsCheck.privacy} onChange={e=>setTermsCheck(p=>({...p,privacy:e.target.checked}))} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                    <span className={`text-xs leading-relaxed ${dark?"text-gray-300":"text-gray-600"}`}>
                      <button type="button" onClick={()=>setTermsView("privacy")} className="font-semibold underline text-green-600 hover:text-green-700">개인정보 처리방침</button>에 동의합니다 (필수)
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={termsCheck.service&&termsCheck.privacy} onChange={e=>setTermsCheck({service:e.target.checked,privacy:e.target.checked})} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                    <span className={`text-xs font-medium ${dark?"text-gray-300":"text-gray-600"}`}>모두 동의합니다</span>
                  </label>
                </div>
                {signupErr&&<p className="text-red-500 text-xs">{signupErr}</p>}
                <button onClick={handleSignup} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">가입 신청</button>
                <button onClick={()=>{setShowSignup(false);setSignupErr("");}} className={`w-full py-1.5 text-xs ${dark?"text-gray-400":"text-gray-500"} hover:underline`}>← 로그인으로</button>
              </div>
            )}

            {/* 가입 완료 */}
            {showSignup&&signupDone&&(
              <div className="text-center py-4 space-y-3">
                <CheckCircle size={40} className="text-green-500 mx-auto"/>
                <p className="font-medium text-green-600">가입 신청이 완료됐습니다!</p>
                <p className="text-xs text-gray-400">관리자 승인 후 칼럼을 작성할 수 있습니다.</p>
                <button onClick={()=>{setShowLogin(false);setShowSignup(false);setSignupDone(false);setSignupForm({name:"",email:"",pw:"",pwConfirm:""});}} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">확인</button>
              </div>
            )}
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

      {showShare&&selected&&<ShareModal article={selected} onClose={()=>setShowShare(false)} dark={dark}/>}

      {/* 약관 전문 보기 모달 */}
      {termsView&&<TermsViewModal type={termsView} onClose={()=>setTermsView("")} dark={dark}/>}

      {/* 탈퇴 확인 모달 */}
      {showWithdraw&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`rounded-2xl shadow-2xl p-7 w-full max-w-sm text-center ${dark?"bg-gray-900 text-gray-100":"bg-white text-gray-900"}`} onClick={e=>e.stopPropagation()}>
            <AlertTriangle size={38} className="text-red-500 mx-auto mb-3"/>
            <h3 className="font-bold text-lg mb-1">정말 탈퇴하시겠어요?</h3>
            <p className={`text-xs mb-1 ${dark?"text-gray-400":"text-gray-500"}`}>
              계정(<span className="font-medium">{user?.email}</span>)이 즉시 삭제되며
            </p>
            <p className={`text-xs mb-5 ${dark?"text-gray-400":"text-gray-500"}`}>이 작업은 <span className="text-red-500 font-semibold">되돌릴 수 없습니다.</span></p>
            <div className="flex gap-3">
              <button onClick={()=>setShowWithdraw(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm border font-medium transition-colors ${dark?"border-gray-700 text-gray-300 hover:bg-gray-800":"border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                취소
              </button>
              <button onClick={handleWithdraw}
                className="flex-1 py-2.5 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google 신규 가입 약관 동의 모달 */}
      {showTermsAgree&&pendingAuthUser&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-sm ${dark?"bg-gray-900 text-gray-100":"bg-white text-gray-900"}`} onClick={e=>e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-1">서비스 이용 동의</h2>
            <p className={`text-xs mb-4 ${dark?"text-gray-400":"text-gray-500"}`}>Google 계정으로 처음 가입하십니다.<br/>아래 약관에 동의하시면 가입이 완료됩니다.</p>
            <div className={`rounded-xl border p-3 space-y-2 mb-4 ${dark?"bg-gray-800 border-gray-700":"bg-gray-50 border-gray-200"}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsCheck.service} onChange={e=>setTermsCheck(p=>({...p,service:e.target.checked}))} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                <span className={`text-xs leading-relaxed ${dark?"text-gray-300":"text-gray-600"}`}>
                  <button type="button" onClick={()=>setTermsView("service")} className="font-semibold underline text-green-600 hover:text-green-700">서비스 이용약관</button> 동의 (필수)
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsCheck.privacy} onChange={e=>setTermsCheck(p=>({...p,privacy:e.target.checked}))} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                <span className={`text-xs leading-relaxed ${dark?"text-gray-300":"text-gray-600"}`}>
                  <button type="button" onClick={()=>setTermsView("privacy")} className="font-semibold underline text-green-600 hover:text-green-700">개인정보 처리방침</button> 동의 (필수)
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsCheck.service&&termsCheck.privacy} onChange={e=>setTermsCheck({service:e.target.checked,privacy:e.target.checked})} className="mt-0.5 accent-green-600 flex-shrink-0"/>
                <span className={`text-xs font-medium ${dark?"text-gray-300":"text-gray-600"}`}>모두 동의합니다</span>
              </label>
            </div>
            <button
              disabled={!termsCheck.service||!termsCheck.privacy}
              onClick={async()=>{
                await loadMemberProfile(pendingAuthUser, true);
                setShowTermsAgree(false);
                setPendingAuthUser(null);
                setTermsCheck({service:false,privacy:false});
              }}
              style={{backgroundColor:(termsCheck.service&&termsCheck.privacy)?SC:"#9ca3af"}}
              className="w-full py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed">
              동의하고 가입 완료
            </button>
            <button onClick={async()=>{ await supabase.auth.signOut(); setShowTermsAgree(false); setPendingAuthUser(null); setTermsCheck({service:false,privacy:false}); }}
              className={`w-full py-1.5 text-xs mt-2 ${dark?"text-gray-500":"text-gray-400"} hover:underline`}>
              취소 (로그아웃)
            </button>
          </div>
        </div>
      )}
      {/* 실시간 금융 */}
      <InfoCarousel dark={dark}/>

      <main className="max-w-6xl mx-auto px-3 md:px-4 py-5 md:py-6">

        {/* ADMIN */}
        {page==="admin"&&user?.role==="admin"&&(
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} style={{color:SC}}/> 관리자 메뉴</h2>
              <button onClick={()=>setPage("home")} className="text-sm hover:underline flex items-center gap-1" style={{color:SC}}><ArrowLeft size={14}/> 홈으로</button>
            </div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {[{key:"pending",label:"승인 대기",icon:<Clock size={13}/>,cnt:articles.filter(a=>a.status==="pending").length},
                {key:"published",label:"게재된 글",icon:<CheckCircle size={13}/>,cnt:articles.filter(a=>a.status==="published").length},
                {key:"rejected",label:"반려된 글",icon:<XCircle size={13}/>,cnt:articles.filter(a=>a.status==="rejected").length},
                {key:"members",label:"회원 관리",icon:<ShieldCheck size={13}/>,cnt:pendingMemberCount},
              ].map(t=>(
                <button key={t.key} onClick={()=>setAdminTab(t.key)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                  style={adminTab===t.key?{backgroundColor:SC,color:"white",borderColor:SC}:{}}>
                  {t.icon}<span className={adminTab!==t.key?(dark?"text-gray-300":"text-gray-600"):""}>{t.label}</span>
                  {t.cnt>0&&<span className={`rounded-full px-1.5 text-xs py-0.5 ${adminTab===t.key?"bg-white/25 text-white":"bg-gray-200 text-gray-600"}`}>{t.cnt}</span>}
                </button>
              ))}
            </div>

            {/* 회원 관리 탭 */}
            {adminTab==="members"&&(
              <div className="space-y-3">
                {members.length===0
                  ?<div className={`rounded-xl border p-10 text-center text-gray-400 text-sm ${card}`}>가입 신청한 회원이 없습니다.</div>
                  :members.map(m=>(
                    <div key={m.id} className={`rounded-xl border p-4 ${card}`}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-sm">{m.display_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${memberRoleStyle[m.role]||"bg-gray-100 text-gray-600"}`}>{memberRoleLabel[m.role]||m.role}</span>
                          </div>
                          {m.email&&<p className="text-xs text-gray-400">{m.email}</p>}
                        </div>
                        {m.role==="pending"&&(
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={()=>approveMember(m.id,'reporter')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><CheckCircle size={12}/> 기자 승인</button>
                            <button onClick={()=>approveMember(m.id,'columnist')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white"><CheckCircle size={12}/> 칼럼니스트 승인</button>
                            <button onClick={()=>rejectMember(m.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white"><XCircle size={12}/> 거절</button>
                          </div>
                        )}
                        {(m.role==="columnist"||m.role==="reporter")&&(
                          <button onClick={()=>rejectMember(m.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-400 hover:bg-red-50"><XCircle size={12}/> 승인 취소</button>
                        )}
                        {m.role==="rejected"&&(
                          <div className="flex gap-2 flex-wrap items-center">
                            <span className="text-xs text-red-400 font-medium flex items-center gap-1"><XCircle size={12}/> 거절됨</span>
                            <button onClick={()=>approveMember(m.id,'reporter')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><CheckCircle size={12}/> 기자로 재승인</button>
                            <button onClick={()=>approveMember(m.id,'columnist')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white"><CheckCircle size={12}/> 칼럼니스트로 재승인</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {adminTab!=="members"&&(articles.filter(a=>a.status===adminTab).length===0
              ?<div className={`rounded-xl border p-10 text-center text-gray-400 text-sm ${card}`}>해당 글이 없습니다.</div>
              :<div className="space-y-3">
                {articles.filter(a=>a.status===adminTab).map(a=>(
                  <div key={a.id} className={`rounded-xl border p-4 ${card}`}>
                    <div className="flex items-start gap-4">
                      <ArticleImage image={a.image} category={a.category} title={a.title} className="rounded-lg flex-shrink-0" style={{width:80,height:64,minWidth:80}}/>
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
            )}
          </div>
        )}

        {/* MYPAGE */}
        {page==="mypage"&&user&&(
          <div className="max-w-2xl mx-auto">
            <button onClick={()=>setPage("home")} className="flex items-center gap-1 text-sm hover:underline mb-4" style={{color:SC}}>
              <ArrowLeft size={15}/> 홈으로
            </button>
            <h2 className="text-2xl font-bold mb-5">마이페이지</h2>

            {/* 프로필 카드 */}
            <div className={`rounded-xl border p-6 mb-6 ${card}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{backgroundColor:SC}}>
                  {user.name?.[0]||"?"}
                </div>
                <div>
                  <p className="font-bold text-lg">{user.name}</p>
                  {user.email&&<p className={`text-sm ${dark?"text-gray-400":"text-gray-500"}`}>{user.email}</p>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${memberRoleStyle[user.role]||"bg-gray-100 text-gray-600"}`}>
                    {memberRoleLabel[user.role]||user.role}
                  </span>
                </div>
              </div>
              {user.role==="rejected"&&(
                <div className={`border-t pt-4 mt-2 ${dark?"border-gray-700":"border-gray-200"}`}>
                  <p className="text-sm text-red-500 mb-3">가입 신청이 거절되었습니다. 재승인을 요청할 수 있습니다.</p>
                  <button onClick={requestReApproval} style={{backgroundColor:SC}} className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">
                    <RefreshCw size={13}/> 재승인 요청
                  </button>
                </div>
              )}
              {user.role==="pending"&&(
                <div className={`border-t pt-4 mt-2 ${dark?"border-gray-700":"border-gray-200"}`}>
                  <p className="text-sm text-yellow-600 flex items-center gap-1.5"><Clock size={13}/> 관리자 승인을 기다리고 있습니다.</p>
                </div>
              )}
            </div>

            {/* 탭 */}
            <div className={`flex gap-1 mb-4 p-1 rounded-lg ${dark?"bg-gray-800":"bg-gray-100"}`}>
              <button onClick={()=>setMypageTab("written")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${mypageTab==="written"?(dark?"bg-gray-700 text-white shadow":"bg-white shadow text-gray-900"):(dark?"text-gray-400":"text-gray-500")}`}>
                <FileText size={14}/> 내가 쓴 글 <span className={`text-xs px-1.5 rounded-full ${mypageTab==="written"?(dark?"bg-gray-600":"bg-gray-100 text-gray-600"):"opacity-60"}`}>{myArticles.length}</span>
              </button>
              <button onClick={()=>setMypageTab("bookmarks")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${mypageTab==="bookmarks"?(dark?"bg-gray-700 text-white shadow":"bg-white shadow text-gray-900"):(dark?"text-gray-400":"text-gray-500")}`}>
                <BookmarkCheck size={14}/> 저장한 글 <span className={`text-xs px-1.5 rounded-full ${mypageTab==="bookmarks"?(dark?"bg-gray-600":"bg-gray-100 text-gray-600"):"opacity-60"}`}>{bookmarkedArticles.length}</span>
              </button>
            </div>

            {/* 내가 쓴 글 */}
            {mypageTab==="written"&&(
              myArticles.length===0
                ?<div className={`rounded-xl border p-10 text-center ${card}`}>
                  <div className="text-5xl mb-2 opacity-60">📝</div>
                  <p className={`text-sm ${dark?"text-gray-300":"text-gray-600"} mb-1`}>아직 작성한 글이 없습니다</p>
                  {canWrite(user.role)&&<button onClick={()=>{setEditId(null);setForm({title:"",category:"경제",type:allowedTypes(user.role)[0],body:"",image:""});setPage("write");}} style={{backgroundColor:SC}} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90">✏️ 글 작성하기</button>}
                </div>
                :<div className="space-y-3">
                  {myArticles.map(a=>(
                    <div key={a.id} onClick={()=>{setSelected(a);setPage("home");}}
                      className={`cursor-pointer rounded-xl border p-4 hover:shadow-md transition-shadow ${card}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                        <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[a.status]}`}>{statusLabel[a.status]}</span>
                        <span className={`text-xs ${dark?"text-gray-400":"text-gray-400"}`}>{a.date}</span>
                      </div>
                      <p className="font-semibold text-sm leading-snug">{a.title}</p>
                    </div>
                  ))}
                </div>
            )}

            {/* 저장한 글 (북마크) */}
            {mypageTab==="bookmarks"&&(
              bookmarkedArticles.length===0
                ?<div className={`rounded-xl border p-10 text-center ${card}`}>
                  <div className="text-5xl mb-2 opacity-60">🔖</div>
                  <p className={`text-sm ${dark?"text-gray-300":"text-gray-600"} mb-1`}>아직 저장한 글이 없습니다</p>
                  <p className={`text-xs ${dark?"text-gray-500":"text-gray-400"}`}>기사 상단의 <span className="font-medium">저장</span> 버튼을 눌러 보관하세요</p>
                </div>
                :<div className="space-y-3">
                  {bookmarkedArticles.map(a=>(
                    <div key={a.id} className={`rounded-xl border p-4 hover:shadow-md transition-shadow ${card} ${a.type==="칼럼"?"border-l-4 border-l-amber-400":""}`}>
                      <div onClick={()=>{setSelected(a);setPage("home");}} className="cursor-pointer">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                          <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
                          <span className={`text-xs ${dark?"text-gray-400":"text-gray-400"}`}>{a.date}</span>
                        </div>
                        <p className="font-semibold text-sm leading-snug mb-1">{a.title}</p>
                        {a.summary&&<p className="text-xs text-gray-500 line-clamp-2">{a.summary}</p>}
                      </div>
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200 flex justify-end">
                        <button onClick={(e)=>{e.stopPropagation();toggleBookmark(a.id,false);}} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"><Trash2 size={11}/> 저장 해제</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* 회원 탈퇴 (회원만) */}
            {user.isMember&&(
              <div className={`rounded-xl border mt-8 p-5 ${dark?"border-red-900 bg-red-950/30":"border-red-100 bg-red-50"}`}>
                <h3 className={`font-bold text-sm mb-1 ${dark?"text-red-400":"text-red-600"}`}>회원 탈퇴</h3>
                <p className={`text-xs mb-3 ${dark?"text-gray-400":"text-gray-500"}`}>
                  탈퇴 시 계정 및 프로필 정보가 즉시 삭제되며 복구할 수 없습니다.<br/>
                  작성한 기사·칼럼은 삭제되지 않으며, 댓글 작성자명은 '탈퇴한 사용자'로 변경됩니다.
                </p>
                <button onClick={()=>setShowWithdraw(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                  <LogOut size={13}/> 회원 탈퇴
                </button>
              </div>
            )}
          </div>
        )}

        {/* WRITE */}
        {page==="write"&&user&&canWrite(user.role)&&(
          <div className="max-w-2xl mx-auto">
            <button onClick={()=>{setPage(user.role==="admin"?"admin":"home");setEditId(null);}} className="flex items-center gap-1 text-sm hover:underline mb-4" style={{color:SC}}>
              <ArrowLeft size={15}/> {user.role==="admin"?"관리자 메뉴로":"홈으로"}
            </button>
            <h2 className="text-2xl font-bold mb-1">{editId!==null?"✏️ 글 수정":"✏️ 새 글 작성"}</h2>
            <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-1"><Clock size={12}/> 작성한 글은 관리자 승인 후 게재됩니다.</p>
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
                 </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">작성자 <span className="text-red-500">*</span></label>
                  <input value={user.name} readOnly className={`w-full border rounded-lg px-3 py-2 text-sm cursor-not-allowed opacity-70 ${inp}`}/>
                  <p className="text-xs text-gray-500 mt-1">로그인된 계정 <strong>{user.id}</strong> 으로 자동 설정됩니다.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">제목 *</label>
                  <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="제목을 입력하세요" maxLength={100} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${inp}`}/>
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
                  <button type="button" onClick={()=>applyFormat("bold")} title="굵게 (선택 영역을 **로 감쌈)" className={`p-1.5 rounded transition-colors ${dark?"text-gray-300 hover:bg-gray-700":"text-gray-600 hover:bg-gray-200"}`}><Bold size={14}/></button>
                  <button type="button" onClick={()=>applyFormat("italic")} title="기울임 (선택 영역을 _로 감쌈)" className={`p-1.5 rounded transition-colors ${dark?"text-gray-300 hover:bg-gray-700":"text-gray-600 hover:bg-gray-200"}`}><Italic size={14}/></button>
                  <button type="button" onClick={()=>applyFormat("list")} title="목록 (각 줄 앞에 - 추가)" className={`p-1.5 rounded transition-colors ${dark?"text-gray-300 hover:bg-gray-700":"text-gray-600 hover:bg-gray-200"}`}><List size={14}/></button>
                  <span className={`ml-auto self-center text-[10px] pr-1 ${dark?"text-gray-500":"text-gray-400"}`}>마크다운: **굵게** _기울임_ - 목록</span>
                </div>
                <textarea ref={bodyRef} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} rows={8} placeholder="본문을 입력하세요..." className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none ${inp}`}/>
              </div>
              {submitErr&&<p className="text-sm text-red-500 text-center">{submitErr}</p>}
              <button onClick={submitArticle} disabled={submitting} style={{backgroundColor:form.type==="칼럼"?"#d97706":SC}}
                className="w-full py-2.5 text-white rounded-lg font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting?<><RefreshCw size={15} className="animate-spin"/>전송 중...</>:<><Save size={15}/>{editId!==null?"수정 후 승인 요청":"승인 요청하기"}</>}
              </button>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {page==="home"&&selected&&(
          <div className="flex flex-col md:flex-row gap-6 lg:gap-10">
            <ReadingProgress/>
            <article className="flex-1 min-w-0 md:max-w-3xl">
              <button onClick={()=>{ setSelected(null); if(window.location.pathname.startsWith('/article/')){ window.history.pushState({}, '', '/'); } window.location.hash=""; if(user?.role==="admin"&&selected.status!=="published") setPage("admin"); }}
                className="flex items-center gap-1 text-sm hover:underline mb-4" style={{color:SC}}>
                <ArrowLeft size={15}/> {user?.role==="admin"&&selected.status!=="published"?"관리자 메뉴로":"목록으로"}
              </button>
              {selected.status!=="published"&&<div className={`text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-1 ${statusStyle[selected.status]}`}>{selected.status==="pending"?<Clock size={12}/>:<XCircle size={12}/>} 미리보기 — {statusLabel[selected.status]} 상태입니다.</div>}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[selected.type]||"bg-gray-500"}`}>{selected.type||"기사"}</span>
                <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[selected.category]||"bg-gray-500"}`}>{selected.category}</span>
              </div>
              <div className="mb-3 md:mb-4">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-[34px] font-bold leading-tight md:leading-[1.25] mb-3 tracking-tight">{selected.title}</h1>
                <div className="flex gap-2 flex-wrap">
                  <BookmarkButton articleId={selected.id} user={user} bookmarks={bookmarks} onToggle={toggleBookmark} dark={dark}/>
                  {user&&<>
                    <button onClick={()=>startEdit(selected)} style={{backgroundColor:SC}} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"><Edit2 size={12}/> 수정</button>
                    {user.role==="admin"&&<button onClick={()=>setConfirmDel(selected.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"><Trash2 size={12}/> 삭제</button>}
                  </>}
                </div>
              </div>
              <div className={`flex items-center justify-between gap-3 text-xs md:text-sm mb-5 pb-4 border-b flex-wrap ${dark?"text-gray-400 border-gray-800":"text-gray-500 border-gray-200"}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span>{selected.date}</span>
                  {selected.author&&<span className="text-amber-600 font-medium flex items-center gap-1"><PenLine size={12}/> {selected.author}</span>}
                  <span className="flex items-center gap-1"><Eye size={12}/> {selected.views.toLocaleString()}</span>
                </div>
                <button onClick={()=>setShowShare(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors hover:opacity-80" style={{borderColor:SC,color:SC}}><Share2 size={12}/> 공유</button>
              </div>
              <ArticleImage image={selected.image} category={selected.category} title={selected.title} priority className="w-full rounded-xl mb-6 md:mb-7 h-48 sm:h-64 md:h-80 lg:h-[420px]"/>
              {selected.author&&<div className="border-l-4 border-amber-400 pl-4 mb-5 py-1.5"><p className="text-xs md:text-sm text-amber-600 font-medium">{selected.type==="칼럼" ? `✒️ 칼럼 — ${selected.author} 기고` : `✍️ 기사 — ${selected.author} 작성`}</p></div>}
              <div className="text-[15px] md:text-[17px] leading-relaxed md:leading-[1.85]">{renderArticleBody(selected.body)}</div>

              <LikeButton articleId={selected.id} dark={dark}/>

              <RelatedArticles current={selected} articles={articles} onOpen={openArticle} dark={dark}/>

              <div className={`border-t mt-8 pt-2 ${dark?"border-gray-800":"border-gray-200"}`}>
                <CommentSection articleId={selected.id} user={user} dark={dark}/>
              </div>
            </article>
            <aside className="md:w-64 lg:w-72 space-y-4 flex-shrink-0">
              <div className={`rounded-xl border p-4 lg:p-5 md:sticky md:top-20 ${card}`}>
                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><TrendingUp size={15} className="text-red-500"/> 가장 많이 본 뉴스</h3>
                <ol className="space-y-2.5">
                  {topViewed.map((a,i)=>(
                    <li key={a.id} onClick={()=>openArticle(a)} className="cursor-pointer flex gap-2 items-start group">
                      <span className={`font-bold text-sm w-5 flex-shrink-0 ${i===0?"text-red-500":i===1?"text-orange-400":i===2?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                      <div className="min-w-0"><span className="text-xs leading-snug group-hover:underline line-clamp-2">{a.title}</span>
                      {a.type==="칼럼"&&<span className="text-xs text-amber-500 block">✒️ 칼럼</span>}</div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className={`rounded-xl border p-4 lg:p-5 ${card}`}>
                <h3 className="font-bold text-sm mb-3">세계를 알리다 SNS</h3>
                <div className="space-y-2">
                  {SNS.map(s=>(
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-2 text-xs hover:underline transition-opacity hover:opacity-80 ${s.color}`}>{s.icon}{s.label} 팔로우</a>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* HOME */}
        {page==="home"&&!selected&&(
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {CATEGORIES.map(c=>(
                <button key={c} onClick={()=>setActiveCat(c)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all hover:-translate-y-0.5 ${activeCategory===c?"shadow-md":"hover:shadow-sm"}`}
                  style={activeCategory===c?{backgroundColor:SC,color:"white",borderColor:SC}:{}}>
                  <span className={activeCategory!==c?(dark?"text-gray-300":"text-gray-600"):""}>{c}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-5 md:mb-6">
              {["전체","기사","칼럼"].map(t=>(
                <button key={t} onClick={()=>setActiveType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all hover:-translate-y-0.5 ${activeType===t?"shadow":""}`}
                  style={activeType===t?{backgroundColor:t==="칼럼"?"#d97706":t==="기사"?"#475569":SC,color:"white",borderColor:"transparent"}:{}}>
                  <span className={activeType!==t?(dark?"text-gray-400":"text-gray-500"):""}>{t==="기사"?"📄 기사":t==="칼럼"?"✒️ 칼럼":"전체"}</span>
                </button>
              ))}
            </div>

            {urgent.length>0&&activeCategory!=="경제"&&activeCategory!=="문화"&&activeCategory!=="기술"&&!search&&(
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-xs font-bold text-red-500 uppercase tracking-widest">긴급 뉴스</span>
                </div>
                <div className="space-y-2">
                  {urgent.slice(0,3).map(a=>(
                    <div key={a.id} onClick={()=>openArticle(a)}
                      className={`cursor-pointer flex items-center gap-3 border border-red-200 rounded-xl px-3 md:px-4 py-2.5 md:py-3 transition-colors ${dark?"bg-red-950 hover:bg-red-900":"bg-red-50 hover:bg-red-100"}`}>
                      <span className="text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded-full flex-shrink-0">긴급</span>
                      <span className="text-sm font-semibold text-red-900 line-clamp-1 min-w-0">{a.title}</span>
                      <span className="text-xs text-red-400 flex-shrink-0 ml-auto whitespace-nowrap">{a.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hero&&activeCategory==="전체"&&activeType==="전체"&&!search&&(
              <div onClick={()=>openArticle(hero)} className="cursor-pointer rounded-2xl overflow-hidden mb-6 md:mb-10 relative group h-56 sm:h-72 md:h-[360px] lg:h-[420px] shadow-md hover:shadow-2xl transition-shadow duration-300">
                <ArticleImage image={hero.image} category={hero.category} title={hero.title} priority className="w-full h-full group-hover:scale-[1.04] transition-transform duration-700 ease-out"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"/>
                <div className="absolute top-3 left-3 md:top-5 md:left-5">
                  <span className="bg-red-500 text-white text-[11px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-lg tracking-wide uppercase animate-pulse">⚡ Top</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-7 lg:p-9">
                  <div className="flex gap-1.5 md:gap-2 mb-2 md:mb-3">
                    <span className={`text-xs text-white px-2.5 py-0.5 rounded-full ${typeColor[hero.type]||"bg-slate-600"}`}>{hero.type||"기사"}</span>
                    <span className={`text-xs text-white px-2.5 py-0.5 rounded-full ${catColor[hero.category]}`}>{hero.category}</span>
                  </div>
                  <h2 className="text-white text-lg md:text-3xl lg:text-4xl font-bold mb-2 md:mb-3 leading-tight line-clamp-2 max-w-3xl tracking-tight">{hero.title}</h2>
                  <p className="text-gray-200 text-sm md:text-base line-clamp-2 hidden md:block max-w-2xl">{hero.summary}</p>
                  <div className="flex items-center gap-3 mt-2 md:mt-3 text-gray-300 text-xs md:text-sm">
                    <span>{hero.date}</span>
                    <span className="opacity-50">·</span>
                    <span className="flex items-center gap-1"><Eye size={12}/> {hero.views?.toLocaleString()||0}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
              <div className="flex-1 min-w-0">
                {(activeCategory!=="전체"||activeType!=="전체"||search)&&(
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className={`text-xs font-medium ${dark?"text-gray-400":"text-gray-500"}`}>활성 필터:</span>
                    {activeCategory!=="전체"&&(
                      <button onClick={()=>setActiveCat("전체")} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-white ${catColor[activeCategory]||"bg-gray-500"} hover:opacity-80 transition-opacity`}>
                        {activeCategory} <X size={11}/>
                      </button>
                    )}
                    {activeType!=="전체"&&(
                      <button onClick={()=>setActiveType("전체")} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-white hover:opacity-80 transition-opacity`} style={{backgroundColor:activeType==="칼럼"?"#d97706":"#475569"}}>
                        {activeType==="기사"?"📄 기사":"✒️ 칼럼"} <X size={11}/>
                      </button>
                    )}
                    {search&&(
                      <button onClick={()=>{setSearch("");}} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${dark?"border-gray-700 text-gray-300 hover:bg-gray-800":"border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                        <Search size={11}/> "{search}" <X size={11}/>
                      </button>
                    )}
                    <button onClick={()=>{setActiveCat("전체");setActiveType("전체");setSearch("");}} className={`text-xs underline ml-1 ${dark?"text-gray-500 hover:text-gray-300":"text-gray-400 hover:text-gray-600"}`}>
                      모두 지우기
                    </button>
                  </div>
                )}
                {search&&<div className="mb-4"><p className={"text-sm font-medium " + (dark?"text-gray-300":"text-gray-700")}><span className="text-green-600 font-bold">{filtered.length}건</span> — <span className="text-green-600 font-semibold">{search}</span> 검색 결과</p><p className={"text-xs mt-0.5 " + (dark?"text-gray-500":"text-gray-400")}>제목 · 본문 · 작성자 · 카테고리에서 검색됨</p></div>}
                {articlesLoading&&filtered.length===0&&<SkeletonCard dark={dark} count={4}/>}
                {!articlesLoading&&filtered.length===0&&(
                  <div className={`rounded-xl border py-12 px-6 text-center ${card}`}>
                    <div className="text-5xl md:text-6xl mb-3 opacity-60">{search ? "🔍" : "📭"}</div>
                    <p className={`text-base font-medium mb-1 ${dark?"text-gray-200":"text-gray-700"}`}>{search ? "검색 결과가 없습니다" : "게재된 글이 없습니다"}</p>
                    <p className={`text-xs md:text-sm mb-4 ${dark?"text-gray-500":"text-gray-400"}`}>
                      {search ? "다른 키워드로 검색해 보세요" : "조건을 바꿔서 다시 시도해 보세요"}
                    </p>
                    {(activeCategory!=="전체"||activeType!=="전체"||search)&&(
                      <button onClick={()=>{setActiveCat("전체");setActiveType("전체");setSearch("");}} style={{backgroundColor:SC}} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity">
                        <RefreshCw size={13}/> 전체 보기
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {filtered.map(a=>(
                    <div key={a.id} onClick={()=>openArticle(a)}
                      className={`cursor-pointer rounded-xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group ${card} ${a.type==="칼럼"?"border-l-4 border-l-amber-400":""}`}>
                      <div className="relative overflow-hidden">
                        <ArticleImage image={a.image} category={a.category} title={a.title} className="w-full group-hover:scale-105 transition-transform duration-500 h-36 sm:h-40 md:h-44 lg:h-48"/>
                      </div>
                      <div className="p-3 md:p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <div className="flex gap-1">
                            <span className={`text-xs text-white px-2 py-0.5 rounded-full ${typeColor[a.type]||"bg-gray-500"}`}>{a.type||"기사"}</span>
                            <span className={`text-xs text-white px-2 py-0.5 rounded-full ${catColor[a.category]||"bg-gray-500"}`}>{a.category}</span>
                          </div>
                          <span className="text-xs text-gray-400">{a.date}</span>
                        </div>
                        <h3 className="font-semibold text-[15px] md:text-base leading-snug mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">{a.title}</h3>
                        {a.author&&<p className="text-xs text-amber-600 mb-0.5">✒️ {a.author}</p>}
                        <p className="text-xs text-gray-500 line-clamp-2">{a.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="md:w-64 lg:w-72 space-y-4 md:flex-shrink-0">
                <div className={`rounded-xl border p-4 lg:p-5 md:sticky md:top-20 ${card}`}>
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><TrendingUp size={15} className="text-red-500"/> 가장 많이 본 뉴스</h3>
                  <ol className="space-y-2.5">
                    {topViewed.map((a,i)=>(
                      <li key={a.id} onClick={()=>openArticle(a)} className="cursor-pointer flex gap-2 items-start group">
                        <span className={`font-bold text-sm w-5 flex-shrink-0 ${i===0?"text-red-500":i===1?"text-orange-400":i===2?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                        <div className="min-w-0"><span className="text-xs leading-snug group-hover:underline line-clamp-2">{a.title}</span>
                        {a.type==="칼럼"&&<span className="text-xs text-amber-500 block">✒️ 칼럼</span>}</div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={`rounded-xl border p-4 lg:p-5 ${card}`}>
                  <h3 className="font-bold text-sm mb-3">세계를 알리다 SNS</h3>
                  <div className="space-y-2">
                    {SNS.map(s=>(
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 text-xs hover:underline transition-opacity hover:opacity-80 ${s.color}`}>{s.icon}{s.label} 팔로우</a>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {page==="home"&&!selected&&(
        <section className="mt-8 md:mt-12 relative overflow-hidden" style={{backgroundColor:SCD}}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage:"radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 50%, white 0%, transparent 50%)"}}/>
          <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-14 text-center">
            <h3 className="text-white text-lg md:text-2xl lg:text-3xl font-bold mb-1.5 md:mb-2 tracking-tight">📬 세계를 알리다 뉴스레터 구독</h3>
            <p className="text-green-200 text-xs md:text-base mb-4 md:mb-6 px-2">매주 목요일 아침 주요 소식을 이메일로 받아보세요.</p>
            {subscribed
              ?<p className="text-green-300 font-medium text-sm md:text-base">✅ 구독이 완료되었습니다!</p>
              :<div className="max-w-sm md:max-w-md mx-auto">
                <div className="flex flex-col sm:flex-row justify-center gap-2">
                  <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="이메일 주소를 입력하세요" className="flex-1 px-4 py-2.5 md:py-3 rounded-lg text-sm md:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm"/>
                  <button onClick={async()=>{
                    if(!email){ setSubscribeErr("이메일을 입력해주세요."); return; }
                    setSubscribeErr("");
                    try{
                      const r=await fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
                      if(r.ok){ setSubscribed(true); }
                      else { setSubscribeErr("구독 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."); }
                    }catch{ setSubscribeErr("네트워크 오류로 구독에 실패했습니다."); }
                  }} style={{backgroundColor:SC}} className="px-5 md:px-6 py-2.5 md:py-3 text-white rounded-lg text-sm md:text-base font-medium hover:opacity-90 border border-green-400 transition-opacity whitespace-nowrap">구독하기</button>
                </div>
                {subscribeErr&&<p className="text-red-300 text-xs md:text-sm mt-2 text-center">{subscribeErr}</p>}
              </div>
            }
          </div>
        </section>
      )}

      <footer className={`border-t ${dark?"border-gray-800 bg-gray-950":"border-gray-200 bg-white"}`}>
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <p className="font-bold text-base md:text-lg mb-1" style={{color:SC}}>📰 세계를 알리다</p>
              <p className="text-xs md:text-sm text-gray-500">표선고등학교 학생 언론사</p>
            </div>
            <div className="text-xs md:text-sm text-gray-500 space-y-1 md:text-right">
              <p>문의: <a href="mailto:psnewspaper01@gmail.com" className="hover:underline break-all">psnewspaper01@gmail.com</a></p>
              <div className="flex gap-3 md:justify-end pt-1">
                {SNS.map(s=>(
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    className={`${s.color} hover:opacity-70 transition-opacity`}>{s.icon}</a>
                ))}
              </div>
            </div>
          </div>
          <div className={`mt-5 md:mt-7 pt-4 md:pt-5 text-center text-[11px] md:text-xs text-gray-400 border-t ${dark?"border-gray-800":"border-gray-100"}`}>
            © 2026 세계를 알리다. All rights reserved.
          </div>
        </div>
      </footer>

      <SuggestionBox user={user} dark={dark}/>
    </div>
    </SCContext.Provider>
  );
}
