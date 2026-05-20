import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'invalid' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${username}@campus-voice.app`,
    password,
  })

  if (error) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  res.status(200).json({
    id: username,
    name: profile?.display_name || username,
    role: profile?.role || 'reader',
  })
}