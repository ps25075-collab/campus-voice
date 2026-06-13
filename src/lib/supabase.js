import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fayxycakxbkglcywhyei.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheXh5Y2FreGJrZ2xjeXdoeWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODM3MzYsImV4cCI6MjA5NDg1OTczNn0.03Mqbid979nlXB-IhuuDu1F3OCSO_Rus2zXCbVIxUGY'

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
