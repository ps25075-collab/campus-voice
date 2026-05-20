const USERS = [
  { id:"admin",      pw:"CV_Admin#2026!",   name:"관리자",  role:"admin"     },
  { id:"editor1",    pw:"CV_Editor1#2026!", name:"김편집",  role:"editor"    },
  { id:"editor2",    pw:"CV_Editor2#2026!", name:"이기자",  role:"editor"    },
  { id:"columnist1", pw:"CV_Column1#2026!", name:"박칼럼",  role:"columnist" },
  { id:"columnist2", pw:"CV_Column2#2026!", name:"최기고",  role:"columnist" },
];

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'invalid' });

  const found = USERS.find(u => u.id === username && u.pw === password);
  if (!found) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  res.status(200).json({ id: found.id, name: found.name, role: found.role });
}
