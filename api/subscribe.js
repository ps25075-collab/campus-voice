// 뉴스레터 구독 신청 — double opt-in.
// 보호: IP rate limit + 허니팟(봇 차단) + 이메일 형식 검증 + 재발송 쿨다운.
// 등록은 confirmed=false(미확인)로 저장하고 확인 메일을 보낸다. 뉴스레터는 확인된 주소에만 발송.
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { guardMutation } from './_lib/csrf.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 간이 IP rate limit (login.js와 동일 패턴; 서버리스 인스턴스별 메모리)
const attempts = new Map()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 60 * 1000 // 동일 미확인 주소 확인메일 재발송 최소 간격(메일폭탄 방지)

export default async function handler(req, res) {
  if (guardMutation(req, res)) return // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end()

  // 허니팟: 사람에게 안 보이는 필드(hp)가 채워져 오면 봇 → 조용히 성공 처리(아무 동작 안 함)
  const { email, hp } = req.body || {}
  if (hp) return res.status(200).json({ ok: true })

  if (!email || typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email))
    return res.status(400).json({ error: '유효하지 않은 이메일입니다.' })
  const addr = email.trim().toLowerCase()

  // IP rate limit
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const rec = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS }
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + WINDOW_MS }
  if (rec.count >= MAX_ATTEMPTS)
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' })
  rec.count++; attempts.set(ip, rec)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' })
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  // 기존 상태 확인
  const { data: existing } = await supabase
    .from('subscribers').select('confirmed, confirm_sent_at').eq('email', addr).maybeSingle()

  // 이미 확인된 구독자 → 메일 재발송 없이 성공 응답
  if (existing?.confirmed) return res.status(200).json({ ok: true, already: true })

  // 최근에 확인메일을 보낸 미확인 주소면 재발송하지 않음(메일폭탄 방지)
  if (existing?.confirm_sent_at && (now - new Date(existing.confirm_sent_at).getTime()) < RESEND_COOLDOWN_MS)
    return res.status(200).json({ ok: true, pending: true })

  const token = crypto.randomBytes(24).toString('hex')
  const { error: upErr } = await supabase
    .from('subscribers')
    .upsert({ email: addr, confirmed: false, confirm_token: token, confirm_sent_at: new Date().toISOString() }, { onConflict: 'email' })
  if (upErr) return res.status(500).json({ error: '저장 실패' })

  // 확인 메일 발송 (GMAIL 미설정 시 발송 불가 → 500)
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)
    return res.status(500).json({ error: 'mailer not configured' })

  const siteUrl = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app'
  const confirmUrl = `${siteUrl}/api/subscribe-confirm?token=${token}`
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  try {
    await transporter.sendMail({
      from: `세계를 알리다 <${process.env.GMAIL_USER}>`,
      to: addr,
      subject: '📬 [세계를 알리다] 뉴스레터 구독 확인',
      html: `<div style="max-width:480px;margin:0 auto;font-family:-apple-system,'Segoe UI',sans-serif;">
        <div style="background:#1a6b3c;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">📰 세계를 알리다</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <p style="color:#374151;font-size:15px;line-height:1.6;">아래 버튼을 누르면 <strong>뉴스레터 구독</strong>이 완료됩니다. 본인이 신청하지 않았다면 이 메일을 무시하세요.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${confirmUrl}" style="background:#1a6b3c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">구독 확인하기</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;word-break:break-all;">버튼이 안 되면: ${confirmUrl}</p>
        </div>
      </div>`,
    })
  } catch (e) {
    console.error('confirm mail failed:', e.message)
    return res.status(500).json({ error: '확인 메일 발송에 실패했습니다.' })
  }

  return res.status(200).json({ ok: true, pending: true })
}
