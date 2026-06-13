// 영속(DB) IP 레이트리밋 — login_attempts 테이블을 네임스페이스 키로 재사용한다.
// 서버리스 인스턴스 간 공유되며(메모리 카운터와 달리), 신규 테이블/마이그레이션이 필요 없다.
// login.js·subscribe.js가 쓰던 방식(register_failed_login RPC + reset_at 윈도우)을 공통화한 것.
//
// 사용: const svc = service_role 클라이언트
//   if (await rateLimited(svc, { key: `comment:${clientIp(req)}`, max: 8, windowSeconds: 120 }))
//     return res.status(429).json({ error: '요청이 너무 많습니다.' });

export function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

// 허용량을 초과했으면 true(차단). 통과 시 이번 요청을 원자적으로 카운트(윈도우 만료 시 리셋 포함).
export async function rateLimited(svc, { key, max, windowSeconds }) {
  const { data: rl } = await svc
    .from('login_attempts').select('count, reset_at').eq('ip', key).maybeSingle();
  const active = rl?.reset_at && new Date(rl.reset_at).getTime() > Date.now();
  if (active && rl.count >= max) return true;
  await svc.rpc('register_failed_login', { p_ip: key, p_window_seconds: windowSeconds });
  return false;
}
