// 요청자 신원 확정 — 스태프 서명 토큰 또는 회원 Supabase 세션 JWT.
// 권한이 필요한 서버 API(기사/이미지 업로드 등)에서 공통 사용.
import { verifyStaffToken, staffTokenFromReq } from './staffToken.js';

export const CAN_WRITE = ['admin', 'editor', 'columnist', 'reporter'];

export function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// svc: service_role 클라이언트 (JWT 검증·profiles 조회용)
export async function resolvePrincipal(req, svc) {
  // 1) 스태프 서명 토큰(HMAC) — HttpOnly 쿠키(cv_staff) 우선, Bearer 폴백
  const staff = verifyStaffToken(staffTokenFromReq(req));
  if (staff) return { kind: 'staff', id: String(staff.id), name: staff.name, role: staff.role };

  // 2) 회원 Supabase 세션 JWT (Authorization 헤더)
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  const uid = data.user.id;
  const { data: prof } = await svc.from('profiles').select('role, display_name').eq('id', uid).single();
  if (!prof) return null;
  return { kind: 'member', id: String(uid), name: prof.display_name || '회원', role: prof.role };
}
