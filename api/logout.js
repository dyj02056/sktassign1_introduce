import { kv, keys } from '../lib/kv.js';
import { getSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession(req);
  if (session) {
    await kv.del(keys.session(session.token));
  }

  // 쿠키 만료
  res.setHeader('Set-Cookie', 'jsw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.status(200).json({ ok: true });
}