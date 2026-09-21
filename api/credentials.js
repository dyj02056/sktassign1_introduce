import { kv, keys } from '../lib/kv.js';
import { getSession, unauthorized } from './_session.js';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return unauthorized(res);

  const user = await kv.get(keys.user(session.userId));
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return res.status(200).json({
      credentials: user.credentials || [],
      count: (user.credentials || []).length,
    });
  }

  if (req.method === 'DELETE') {
    const { credentialId } = req.body || {};
    if (!credentialId) {
      return res.status(400).json({ error: 'credentialId required' });
    }

    // 소유권 확인: 이 credential이 실제로 내 것인가?
    const owned = (user.credentials || []).some(c => c.id === credentialId);
    if (!owned) {
      return res.status(403).json({ error: 'Not your credential' });
    }

    await kv.del(keys.cred(credentialId));
    const remaining = (user.credentials || []).filter(c => c.id !== credentialId);
    await kv.set(keys.user(session.userId), { ...user, credentials: remaining });

    return res.status(200).json({ ok: true, remaining: remaining.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}