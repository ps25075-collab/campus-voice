import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`)
    return res.status(401).json({ error: 'unauthorized' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )

  const [{ data: articles }, { data: subscribers }] = await Promise.all([
    supabase.from('articles').select('*').eq('status','published').order('created_at',{ascending:false}).limit(5),
    supabase.from('subscribers').select('email'),
  ])

  if (!subscribers?.length) return res.status(200).json({ sent: 0, message: '구독자 없음' })

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  const siteUrl = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app'
  const dateStr = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })
  const html = buildHTML(articles || [], siteUrl, dateStr)

  let sent = 0
  for (const { email } of subscribers) {
    try {
      await transporter.sendMail({
        from: `세계를 알리다 <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `📰 세계를 알리다 주간 뉴스레터 — ${dateStr}`,
        html,
      })
      sent++
    } catch (e) { console.error(`send failed to ${email}:`, e.message) }
  }

  res.status(200).json({ sent, total: subscribers.length })
}

function buildHTML(articles, siteUrl, dateStr) {
  const items = articles.map(a => `
    <div style="border-bottom:1px solid #e5e7eb;padding:20px 0;">
      <div style="margin-bottom:8px;">
        <span style="background:#1a6b3c;color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;">${a.category}</span>
        ${a.type==='칼럼'?'<span style="background:#d97706;color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-left:4px;">칼럼</span>':''}
      </div>
      <h2 style="margin:8px 0;font-size:17px;color:#111827;line-height:1.4;">${a.title}</h2>
      <p style="color:#6b7280;margin:0 0 10px;font-size:14px;line-height:1.6;">${a.summary||''}</p>
      <a href="${siteUrl}" style="color:#1a6b3c;font-size:13px;font-weight:bold;text-decoration:none;">자세히 읽기 →</a>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a6b3c;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">📰 세계를 알리다</h1>
    <p style="color:#a7f3d0;margin:8px 0 0;font-size:14px;">${dateStr} 주간 뉴스레터</p>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
    <p style="color:#374151;margin:0 0 4px;font-size:15px;">안녕하세요! 이번 주 <strong>세계를 알리다</strong> 주요 기사를 전해드립니다.</p>
    ${items||'<p style="color:#9ca3af;text-align:center;padding:20px 0;">이번 주 발행된 기사가 없습니다.</p>'}
    <div style="margin-top:24px;text-align:center;">
      <a href="${siteUrl}" style="background:#1a6b3c;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">전체 기사 보러가기</a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
    표선고등학교 학생 언론사 · 매주 목요일 발행<br>
    문의: psnewspaper01@gmail.com
  </p>
</div>
</body></html>`
}