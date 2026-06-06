// 구독 확인(double opt-in) — 확인 메일의 링크가 호출. 토큰이 일치하면 confirmed=true로 전환.
import { createClient } from '@supabase/supabase-js'

function page(title, msg) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:420px;margin:64px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;">
    <div style="font-size:40px;">📰</div>
    <h1 style="font-size:20px;color:#111827;margin:12px 0;">${title}</h1>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;">${msg}</p>
    <a href="/" style="display:inline-block;margin-top:16px;background:#1a6b3c;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">홈으로</a>
  </div></body></html>`
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const token = req.query && req.query.token
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 128)
    return res.status(400).send(page('잘못된 링크', '확인 링크가 올바르지 않습니다.'))

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).send(page('오류', '서버 설정 오류입니다. 잠시 후 다시 시도해주세요.'))
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  // 토큰 일치 + 미확인 행만 확인 처리. 처리 후 토큰 제거(재사용 불가).
  const { data, error } = await supabase
    .from('subscribers')
    .update({ confirmed: true, confirm_token: null })
    .eq('confirm_token', token)
    .select('email')

  if (error) return res.status(500).send(page('오류', '확인 처리 중 오류가 발생했습니다.'))
  if (!data || data.length === 0)
    return res.status(200).send(page('이미 확인됨', '이미 확인되었거나 만료된 링크입니다.'))

  return res.status(200).send(page('구독 완료 ✅', '뉴스레터 구독이 확인되었습니다. 매주 목요일 아침 소식을 받아보세요!'))
}
