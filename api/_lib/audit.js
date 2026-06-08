// 감사 로그 — 관리자/스태프의 민감 작업을 service_role로 audit_log에 기록.
// 누가(actor) 언제(created_at) 무엇을(action/target) 어디서(ip) 했는지 남겨,
// 무단 대량 삭제·권한 변경 등을 사후 추적·복구의 단서로 삼는다.
//
// 설계 원칙: 감사 기록 실패가 '주 작업'을 막아선 안 된다(가용성 우선). 실패는 콘솔에만 남긴다.
export async function writeAudit(svc, { actor, action, targetTable, targetId, detail, req }) {
  try {
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
    await svc.from('audit_log').insert({
      actor_id: actor?.id != null ? String(actor.id) : null,
      actor_name: actor?.name ?? null,
      actor_role: actor?.role ?? null,
      action,
      target_table: targetTable ?? null,
      target_id: targetId != null ? String(targetId) : null,
      detail: detail ?? null,
      ip,
    });
  } catch (e) {
    console.error('[audit] 기록 실패:', e?.message);
  }
}
