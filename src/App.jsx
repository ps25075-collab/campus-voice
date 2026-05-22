import { useState, useEffect, useRef } from "react";
import { supabase } from './lib/supabase';
import { Search, Menu, X, TrendingUp, Instagram, Facebook, Youtube, ArrowLeft, Bold, Italic, List, LogIn, LogOut, Edit2, Trash2, Save, Eye, AlertTriangle, ShieldCheck, Clock, CheckCircle, XCircle, FileText, PenLine, MessageSquarePlus, RefreshCw, Send, Inbox, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";

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

  const items = data ? [
    {label:"코스피",  value:data.kospi,       change:data.kospi_change,  up: data.kospi_change?.startsWith("+")},
    {label:"NASDAQ", value:data.nasdaq,      change:data.nasdaq_change, up: data.nasdaq_change?.startsWith("+")},
    {label:"원/달러", value:data.usdkrw+"원", change:null},
    {label:"기준금리", value:data.rate,        change:null},
  ] : [];

  return (
    <div>
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
  const hIdx     = weather != null ? getLevelIdx(HUMIDITY_LEVELS, weather.relative_humidity_2m) : -1;
  const wIdx     = weather != null ? getLevelIdx(WIND_LEVELS, weather.wind_speed_10m) : -1;
  const hLevel   = hIdx >= 0 ? HUMIDITY_LEVELS[hIdx] : null;
  const wLevel   = wIdx >= 0 ? WIND_LEVELS[wIdx] : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-sm font-bold flex items-center gap-1.5 ${dark?"text-gray-400":"text-gray-500"}`}>
          🌤️ 현재 날씨
        </span>
        <span className={`text-xs ${dark?"text-gray-600":"text-gray-400"}`}>제주 표선 기준</span>
      </div>
      {loading && (
        <div className={`flex items-center gap-2 py-2 ${dark?"text-gray-500":"text-gray-400"}`}>
          <RefreshCw size={15} className="animate-spin"/> <span className="text-sm">날씨 불러오는 중...</span>
        </div>
      )}
      {error && <span className="text-sm text-red-400">날씨 데이터 로드 실패</span>}
      {!loading&&!error&&weather&&(
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className={`rounded-xl border px-4 py-3 ${card}`}>
              <p className="text-xs font-medium mb-1 text-gray-400">날씨</p>
              <p className="text-3xl leading-tight">{WMO_ICON[code]??"🌡️"}</p>
              <p className={`text-sm font-semibold mt-1 ${dark?"text-gray-300":"text-gray-600"}`}>{WMO_LABEL[code]??"알 수 없음"}</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${card}`}>
              <p className="text-xs font-medium mb-1 text-gray-400">기온</p>
              <p className={`text-2xl font-extrabold leading-tight ${val}`}>{weather.temperature_2m}°C</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${card}`}>
              <p className="text-xs font-medium mb-1 text-gray-400">습도</p>
              <p className={`text-2xl font-extrabold leading-tight ${val}`}>{weather.relative_humidity_2m}%</p>
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
            <div className={`rounded-xl border px-4 py-3 ${card}`}>
              <p className="text-xs font-medium mb-1 text-gray-400">풍속</p>
              <p className={`text-2xl font-extrabold leading-tight ${val}`}>{weather.wind_speed_10m}<span className="text-sm font-medium"> km/h</span></p>
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
  const [slide, setSlide] = useState(0);
  const [fade,  setFade]  = useState(true);
  const TOTAL = 2;
  const intervalRef = useRef(null);

  const goTo = (idx) => {
    setFade(false);
    setTimeout(()=>{ setSlide(idx); setFade(true); }, 200);
  };

  const startAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setSlide(prev => (prev + 1) % TOTAL);
        setFade(true);
      }, 200);
    }, 6000);
  };

  useEffect(() => {
    startAutoPlay();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleGoTo = (idx) => {
    goTo(idx);
    startAutoPlay();
  };

  const arrowBtn = `flex items-center justify-center w-8 h-8 rounded-full border transition-colors flex-shrink-0 ${dark?"border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-100":"border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`;

  return (
    <div className={`border-b shadow-sm ${dark?"bg-gray-900 border-gray-800":"bg-white border-gray-200"}`}>
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center gap-3">
          <button onClick={()=>handleGoTo((slide-1+TOTAL)%TOTAL)} className={arrowBtn}>
            <ChevronLeft size={16}/>
          </button>
          <div className="flex-1 min-h-[390px] md:min-h-[280px]" style={{opacity: fade?1:0, transition:"opacity 0.2s"}}>
            {slide===0 ? <FinancePanel dark={dark}/> : <WeatherPanel dark={dark}/>}
          </div>
          <button onClick={()=>handleGoTo((slide+1)%TOTAL)} className={arrowBtn}>
            <ChevronRight size={16}/>
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({length:TOTAL}).map((_,i)=>(
            <button key={i} onClick={()=>handleGoTo(i)}
              className={`rounded-full transition-all duration-300 ${slide===i?"w-5 h-2":"w-2 h-2"}`}
              style={{backgroundColor: slide===i?"#1a6b3c": dark?"#374151":"#d1d5db"}}/>
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
        const { data } = await supabase.from('comments').select('*').eq('article_id', articleId).order('created_at', {ascending:true});
        setComments(data || []);
      }catch{ setComments([]); }
      setLoading(false);
    })();
  },[articleId]);

  const submit = async () => {
    if(!text.trim()) return;
    const newC = { article_id: articleId, name: name.trim()||"익명", text: text.trim(), date: today() };
    const { data } = await supabase.from('comments').insert(newC).select().single();
    if(data) setComments(prev => [...prev, data]);
    setName(""); setText("");
  };

  const del = async (id) => {
    await supabase.from('comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
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
  const [articles,setArticles]       = useState([]);
  const [form,setForm]               = useState({title:"",category:"경제",type:"기사",body:"",image:""});
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
  const [signupForm,setSignupForm]   = useState({name:"",email:"",pw:""});
  const [signupErr,setSignupErr]     = useState("");
  const [signupDone,setSignupDone]   = useState(false);
  const [members,setMembers]         = useState([]);
  const [myArticles,setMyArticles]   = useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const { data } = await supabase.from('articles').select('*').order('created_at',{ascending:false});
        setArticles(data && data.length > 0 ? data : DUMMY_ARTICLES);
      }catch{ setArticles(DUMMY_ARTICLES); }
      try{ const d=localStorage.getItem(DARK_KEY); if(d) setDark(JSON.parse(d)); }catch{}
      let staffLoaded=false;
      try{
        const saved=localStorage.getItem("cv_user");
        if(saved){ setUser(JSON.parse(saved)); staffLoaded=true; }
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

  const toggleDark=()=>setDark(d=>{ const n=!d; try{ localStorage.setItem(DARK_KEY,JSON.stringify(n)); }catch{} return n; });

  const loadMemberProfile = async (authUser) => {
    const { data:profile } = await supabase.from('profiles').select('*').eq('id',authUser.id).single();
    if(!profile){
      const name = authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email?.split('@')[0]||'회원';
      await supabase.from('profiles').upsert({id:authUser.id,display_name:name,role:'pending',email:authUser.email});
      setUser({id:authUser.id,name,role:'pending',email:authUser.email,isMember:true});
    } else {
      setUser({id:authUser.id,name:profile.display_name,role:profile.role,email:profile.email||authUser.email,isMember:true});
    }
  };

  const handleLogin=async()=>{
    setLoginError("");
    try{
      const res=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:loginForm.id,password:loginForm.pw})});
      if(!res.ok){ setLoginError("아이디 또는 비밀번호가 올바르지 않습니다."); return; }
      const userObj=await res.json();
      setUser(userObj);
      localStorage.setItem("cv_user",JSON.stringify(userObj));
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
    const {data,error}=await supabase.auth.signUp({email:signupForm.email,password:signupForm.pw});
    if(error){ setSignupErr(error.message); return; }
    if(!data.user){ setSignupDone(true); return; }
    await supabase.from('profiles').upsert({id:data.user.id,display_name:signupForm.name,role:'pending',email:signupForm.email});
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

  const requestReApproval=async()=>{
    await supabase.from('profiles').update({role:'pending'}).eq('id',user.id);
    setUser(prev=>({...prev,role:'pending'}));
  };

  const handleLogout=async()=>{
    if(user?.isMember) await supabase.auth.signOut();
    else localStorage.removeItem("cv_user");
    setUser(null); setPage("home");
  };

  const submitArticle=async()=>{
    if(!form.title||!form.body||!user?.name) return;
    const eid=editId;
    const fields={
      title:form.title, category:form.category, type:form.type,
      body:form.body, image:form.image||"",
      summary:form.body.slice(0,80)+"...", status:"pending",
      author: user?.name,
    };
    if(eid!==null){
      await supabase.from('articles').update(fields).eq('id',eid);
      setArticles(prev=>prev.map(a=>a.id===eid?{...a,...fields}:a));
      setSelected(prev=>prev?.id===eid?{...prev,...fields}:prev);
    } else {
      const newA={...fields, date:today(), views:0, hero:false};
      const { data } = await supabase.from('articles').insert(newA).select().single();
      if(data) setArticles(prev=>[data,...prev]);
    }
    setEditId(null);
    setForm({title:"",category:"경제",type:allowedTypes(user?.role)[0]||"기사",body:"",image:""});
    setPage(user?.role==="admin"?"admin":"home");
  };

  const startEdit=a=>{ setForm({title:a.title,category:a.category,type:a.type||"기사",body:a.body,image:a.image||""}); setEditId(a.id); setSelected(null); setPage("write"); };
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
  const filtered=published.filter(a=>{
    const mc=activeCategory==="전체"||a.category===activeCategory;
    const mt=activeType==="전체"||a.type===activeType;
    const q=search.toLowerCase();
    const ms=!search||a.title.toLowerCase().includes(q)||a.summary?.toLowerCase().includes(q)||a.body?.toLowerCase().includes(q);
    return mc&&mt&&ms&&(!a.hero||!!search);
  });
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
            {user?.isMember&&(
              <button onClick={()=>{setPage("mypage");loadMyArticles(user.name);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-sm font-medium">
                마이페이지
              </button>
            )}
            {user.role==="admin"&&(
              <button onClick={()=>{setPage("admin");loadMembers();}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-sm font-medium">
                <ShieldCheck size={14}/> 관리자 메뉴
                {(pendingCount+pendingMemberCount)>0&&<span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs">{pendingCount+pendingMemberCount}</span>}
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400 text-red-400 hover:bg-red-400 hover:text-white transition-colors text-sm font-medium"><LogOut size={14}/> 로그아웃</button>
          </div>
        ):(
          <button onClick={()=>setShowLogin(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors text-sm font-medium"><LogIn size={14}/> 로그인</button>
        )}
      </div>

      {/* HEADER */}
      <header style={{backgroundColor:SC}} className="sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-white" onClick={()=>setMenuOpen(!menuOpen)}>
              {menuOpen?<X size={22}/>:<Menu size={22}/>}
            </button>
            <button onClick={()=>{setPage("home");setSelected(null);setActiveCat("전체");setActiveType("전체");setSearch("");setSearchOpen(false);setMenuOpen(false);}} className="text-white font-bold text-xl tracking-tight">📰 세계를 알리다</button>
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
            <button onClick={()=>{ if(searchOpen) setSearch(""); setSearchOpen(s=>!s); }} className="text-white hover:text-green-200"><Search size={20}/></button>
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
                <button onClick={()=>{setShowLogin(false);setShowSignup(false);setSignupDone(false);setSignupForm({name:"",email:"",pw:""}); }} style={{backgroundColor:SC}} className="w-full py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">확인</button>
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

      {/* 실시간 금융 */}
      <InfoCarousel dark={dark}/>

      <main className="max-w-6xl mx-auto px-4 py-6">

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
            )}
          </div>
        )}

        {/* MYPAGE */}
        {page==="mypage"&&user?.isMember&&(
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

            {/* 내가 쓴 글 */}
            <h3 className="font-bold text-base mb-3 flex items-center gap-2"><FileText size={16} style={{color:SC}}/> 내가 쓴 글</h3>
            {myArticles.length===0
              ?<div className={`rounded-xl border p-8 text-center text-gray-400 text-sm ${card}`}>아직 작성한 글이 없습니다.</div>
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
                <Save size={15}/>{editId!==null?"수정 후 승인 요청":"승인 요청하기"}
              </button>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {page==="home"&&selected&&(
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 min-w-0">
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
              {selected.author&&<div className="border-l-4 border-amber-400 pl-4 mb-4 py-1"><p className="text-xs text-amber-600 font-medium">{selected.type==="칼럼" ? `✒️ 칼럼
  — ${selected.author} 기고` : `✍️ 기사 — ${selected.author} 작성`}</p></div>}
              <div className="text-sm leading-relaxed whitespace-pre-line">{selected.body}</div>

              <LikeButton articleId={selected.id} dark={dark}/>

              <div className={`border-t mt-8 pt-2 ${dark?"border-gray-800":"border-gray-200"}`}>
                <CommentSection articleId={selected.id} user={user} dark={dark}/>
              </div>
            </div>
            <aside className="md:w-64 space-y-4 flex-shrink-0">
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
            <p className="text-green-200 text-sm mb-4">매주 목요일 아침 주요 소식을 이메일로 받아보세요.</p>
            {subscribed
              ?<p className="text-green-300 font-medium text-sm">✅ 구독이 완료되었습니다!</p>
              :<div className="flex flex-col sm:flex-row justify-center gap-2 max-w-sm mx-auto">
                <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="이메일 주소를 입력하세요" className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-900 focus:outline-none"/>
                <button onClick={async()=>{
                if(!email) return;
                try{
                  const r=await fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
                  if(r.ok) setSubscribed(true);
                }catch{}
              }} style={{backgroundColor:SC}} className="px-5 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 border border-green-400">구독하기</button>
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
