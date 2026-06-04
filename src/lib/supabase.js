import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fayxycakxbkglcywhyei.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheXh5Y2FreGJrZ2xjeXdoeWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODM3MzYsImV4cCI6MjA5NDg1OTczNn0.03Mqbid979nlXB-IhuuDu1F3OCSO_Rus2zXCbVIxUGY'

// supabase-js의 토큰 갱신은 navigator.locks로 직렬화되는데, 락이 데드락되면
// 인증 회원의 모든 요청(기사 등록·이미지 업로드 등)이 영구 대기(무한 로딩)할 수 있다.
// 락 획득에 시간이 너무 걸리면(데드락 의심) 락 없이 진행해 멈춤을 방지한다.
// 정상 상황에서는 기존처럼 락으로 갱신을 직렬화한다.
const lockWithTimeout = async (name, acquireTimeout, fn) => {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    return await navigator.locks.request(name, { signal: controller.signal }, async () => {
      clearTimeout(timer)
      return fn()
    })
  } catch {
    clearTimeout(timer)
    return fn()   // 락 획득 실패/타임아웃 → 데드락 방지 위해 락 없이 실행
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: lockWithTimeout },
})

// 공개 콘텐츠(기사 목록 등) 전용 클라이언트.
// 사용자 세션을 저장/첨부하지 않으므로, 로그아웃 후 localStorage에 남은
// 만료된 JWT가 익명 조회 요청에 붙어 401을 일으키는 문제를 원천 차단한다.
// → "로그인을 안 하면 기사가 안 보인다" 버그 방지.
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
