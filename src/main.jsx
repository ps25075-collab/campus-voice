import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.storage = {
  get: async (key) => {
    const val = localStorage.getItem(key);
    return val ? { value: val } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
  },
};

// 렌더 중 예외가 나도 화면 전체가 흰색으로 깨지지 않도록 하는 안전망.
class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { hasError:false }; }
  static getDerivedStateFromError(){ return { hasError:true }; }
  componentDidCatch(error, info){ console.error('App render error:', error, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem',textAlign:'center',fontFamily:'system-ui,sans-serif'}}>
          <div style={{fontSize:'2.5rem'}}>📰</div>
          <h1 style={{fontSize:'1.1rem',fontWeight:700,color:'#1a6b3c'}}>일시적인 오류가 발생했습니다</h1>
          <p style={{fontSize:'.85rem',color:'#6b7280'}}>페이지를 새로고침하면 정상적으로 표시됩니다.</p>
          <button onClick={()=>{ try{ window.location.reload(); }catch{} }}
            style={{padding:'.5rem 1.25rem',borderRadius:'.5rem',background:'#1a6b3c',color:'#fff',border:'none',fontSize:'.85rem',fontWeight:600,cursor:'pointer'}}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
