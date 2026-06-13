// 보안 모니터링/알림 — 대량 삭제 등 파괴적 작업의 비정상 급증을 조기 탐지해 관리자에게 이메일 경보.
//
// 동작: 파괴적 작업이 audit_log에 기록된 직후 호출하면, 최근 WINDOW_MIN분 동안의
//   삭제성 액션 수를 세어 THRESHOLD를 넘으면 관리자에게 1회 경보 메일을 보낸다.
//   (감사 로그와 같은 원칙 — 실패해도 주 작업을 막지 않는 best-effort.)
//
// 함수 수 영향 없음(_lib). 메일은 newsletter/subscribe와 동일한 GMAIL 환경변수를 재사용.
//   수신: ALERT_EMAIL → 없으면 GMAIL_USER.
import nodemailer from 'nodemailer';

const WINDOW_MIN = 10;        // 관찰 윈도우(분)
const THRESHOLD = 5;          // 이 횟수를 초과하면 경보
const DESTRUCTIVE = ['comment.delete', 'article.delete', 'article.purge', 'subscriber.delete'];

function mailer() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

// 임의 보안 경보 발송(best-effort). 성공 여부 boolean 반환.
export async function sendAlert(subject, text) {
  try {
    const t = mailer();
    if (!t) return false;
    const to = process.env.ALERT_EMAIL || process.env.GMAIL_USER;
    await t.sendMail({
      from: `세계를 알리다 보안 <${process.env.GMAIL_USER}>`,
      to,
      subject: `🚨 [보안 경보] ${subject}`,
      text,
    });
    return true;
  } catch (e) {
    console.error('[alert] 발송 실패:', e?.message);
    return false;
  }
}

// 파괴적 작업 직후 호출 — 최근 윈도우의 삭제성 액션이 임계치를 넘으면 경보.
// svc: service_role 클라이언트, actor: 행위자 principal, action: 방금 수행한 액션명.
export async function checkMassDeletion(svc, { actor, action, req } = {}) {
  try {
    const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
    const { count, error } = await svc
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .in('action', DESTRUCTIVE)
      .gte('created_at', since);
    if (error || count == null) return;

    if (count > THRESHOLD) {
      const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      await sendAlert(
        `최근 ${WINDOW_MIN}분간 삭제성 작업 ${count}건(임계치 ${THRESHOLD} 초과)`,
        [
          `최근 ${WINDOW_MIN}분 동안 삭제/영구삭제 작업이 ${count}건 발생했습니다.`,
          `방금 작업: ${action}`,
          `행위자: ${actor?.name || '?'} (${actor?.role || '?'}, id=${actor?.id ?? '?'})`,
          `IP: ${ip}`,
          ``,
          `대량 삭제 공격일 수 있습니다. audit_log를 확인하고, 필요 시 백업으로 복구하세요`,
          `(휴지통 글은 /api/articles restore, 영구삭제·댓글은 최신 백업에서 복원).`,
        ].join('\n')
      );
    }
  } catch (e) {
    console.error('[alert] checkMassDeletion 실패:', e?.message);
  }
}
