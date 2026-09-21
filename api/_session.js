import { kv, keys } from '../lib/kv.js';

export function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

// 쿠키에서 세션 토큰을 꺼내 KV에서 검증. 실패 시 null.
export async function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.jsw_session;
  if (!token) return null;
  const sess = await kv.get(keys.session(token));
  if (!sess) return null;
  return { token, userId: sess.userId, createdAt: sess.createdAt };
}

// 401 응답 헬퍼
export function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}