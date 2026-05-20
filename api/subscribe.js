import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body || {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: '유효하지 않은 이메일입니다.' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )

  const { error } = await supabase
    .from('subscribers')
    .upsert({ email }, { onConflict: 'email' })

  if (error) return res.status(500).json({ error: '저장 실패' })
  res.status(200).json({ ok: true })
}