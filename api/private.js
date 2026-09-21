import { kv, keys } from '../lib/kv.js';
import { getSession, unauthorized } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession(req);
  if (!session) return unauthorized(res);

  const user = await kv.get(keys.user(session.userId));
  const data = await kv.get(keys.data(session.userId));

  return res.status(200).json({
    userId: session.userId,
    displayName: user?.displayName || 'unknown',
    sessionPrefix: session.token.slice(0, 6),
    items: data || [],
  });
}