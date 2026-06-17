// 기사 이미지 서명 업로드 URL 발급 — 버킷 직접 쓰기는 RLS로 차단되므로 업로드는 이 경로로만.
// 권한 검증(작성 권한자) + 작성자별 경로 강제(타인 파일 덮어쓰기 불가). 실제 바이트 전송은
// 클라이언트 → Storage(서명 URL)로 직접 이뤄지고, 버킷의 용량/MIME 제한이 서버에서 적용된다.
import { createClient } from '@supabase/supabase-js';
import { resolvePrincipal, CAN_WRITE } from './_lib/principal.js';
import { guardMutation } from './_lib/csrf.js';
import { clientIp, rateLimited } from './_lib/rateLimit.js';
import crypto from 'crypto';

const BUCKET = 'article-images';
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export default async function handler(req, res) {
  if (guardMutation(req, res)) return; // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  // IP 레이트리밋(우려 #5): 서명 URL 발급 남용/스토리지 폭주 차단. 인증 검증 전에 둔다.
  // 기사당 이미지 여러 장을 고려해 분당 30건. login_attempts 재사용(신규 테이블 불필요).
  if (await rateLimited(svc, { key: `upload:${clientIp(req)}`, max: 30, windowSeconds: 60 }))
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });

  const principal = await resolvePrincipal(req, svc);
  if (!principal) return res.status(401).json({ error: 'unauthorized' });
  if (!CAN_WRITE.includes(principal.role)) return res.status(403).json({ error: 'forbidden' });

  let ext = String((req.body && req.body.ext) || 'webp').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) ext = 'webp';

  // 경로에 작성자 식별자를 서버가 강제 → 임의 경로·타인 파일 덮어쓰기 불가.
  const safeId = (principal.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)) || 'user';
  const rand = crypto.randomBytes(6).toString('hex');
  const path = `articles/${safeId}/${Date.now()}-${rand}.${ext}`;

  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });

  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(data.path);
  return res.status(200).json({ path: data.path, token: data.token, publicUrl: pub.publicUrl });
}
