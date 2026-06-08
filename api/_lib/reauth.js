// 민감 작업 재인증(step-up) — 삭제/영구삭제 등 파괴적 작업 직전, 스태프가
// '현재 비밀번호'를 다시 입력하게 해 탈취된 세션/토큰만으로는 실행되지 않도록 한다.
//
// staff: requireStaff()의 claims 또는 resolvePrincipal()의 staff principal (둘 다 .id 보유).
//        회원(member) principal은 staff_users에 없어 항상 실패 → 멤버는 재인증 대상 아님.
import { verifyPassword } from '../../lib/password.js';

export async function reauthStaff(svc, staff, confirmPassword) {
  if (!staff?.id) return false;
  if (!confirmPassword || typeof confirmPassword !== 'string') return false;
  const { data: u } = await svc
    .from('staff_users')
    .select('password_hash')
    .eq('id', String(staff.id))
    .maybeSingle();
  // verifyPassword는 사용자가 없을 때도 더미 해시로 상수시간 비교(타이밍 누출 방지).
  return verifyPassword(confirmPassword, u?.password_hash);
}
