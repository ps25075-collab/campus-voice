import { createClient } from '@supabase/supabase-js'

// 환경변수 필수화(하드코딩 폴백 제거) — 누락 시 잘못된 키로 조용히 동작하지 않고 즉시 실패.
// Vercel/로컬에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 반드시 설정돼 있어야 한다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 설정 누락: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수를 설정하세요(.env 또는 Vercel Environment Variables).')
}

// 인증/세션은 supabase-js 기본 동작에 맡긴다(persistSession·자동 토큰 갱신·락).
// 커스텀 락은 세션 복원/토큰 회전을 방해해 로그아웃을 유발할 수 있어 사용하지 않는다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 공개 콘텐츠(기사 목록 등) 전용 클라이언트.
// 사용자 세션을 저장/첨부하지 않으므로, 로그아웃 후 localStorage에 남은
// 만료된 JWT가 익명 조회 요청에 붙어 401을 일으키는 문제를 원천 차단한다.
// → "로그인을 안 하면 기사가 안 보인다" 버그 방지.
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
