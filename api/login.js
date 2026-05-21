const USERS = [
  { id: 'admin',      pw: process.env.ADMIN_PW,      name: '관리자',  role: 'admin'     },
  { id: 'editor1',    pw: process.env.EDITOR1_PW,    name: '김편집',  role: 'editor'    },
  { id: 'editor2',    pw: process.env.EDITOR2_PW,    name: '이기자',  role: 'editor'    },
  { id: 'columnist1', pw: process.env.COLUMNIST1_PW, name: '박칼럼',  role: 'columnist' },
  { id: 'columnist2', pw: process.env.COLUMNIST2_PW, name: '최기고',  role: 'columnist' },
];

const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'invalid' });

  const found = USERS.find(u => u.id === username && u.pw === password);
  if (!found) {
    record.count++;
    attempts.set(ip, record);
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  attempts.delete(ip);
  res.status(200).json({ id: found.id, name: found.name, role: found.role });
}
