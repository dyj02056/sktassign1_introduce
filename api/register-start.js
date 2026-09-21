import { generateRegistrationOptions } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { kv, keys, TTL } from '../lib/kv.js';
import { getSession } from './_session.js';

const RP_NAME = 'JSW Private';

function rpID(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 세션이 있으면 기존 계정에 패스키 추가, 없으면 새 계정
  const session = await getSession(req);
  let userId, userName, isNewAccount;

  if (session) {
    userId = session.userId;
    const existing = await kv.get(keys.user(userId));
    userName = existing?.displayName || `user-${userId.slice(0, 8)}`;
    isNewAccount = false;
  } else {
    userId = randomUUID();
    userName = `user-${userId.slice(0, 8)}`;
    isNewAccount = true;
  }

  // 이미 등록된 패스키는 제외 (브라우저에 알려줌)
  const existingUser = await kv.get(keys.user(userId));
  const excludeCredentials = (existingUser?.credentials || []).map(c => ({
    id: c.id,
    type: 'public-key',
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(req),
    userID: new TextEncoder().encode(userId),
    userName,
    userDisplayName: userName,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await kv.set(
    keys.regChallenge(userId),
    { challenge: options.challenge, userId, userName, isNewAccount },
    { ex: TTL.CHALLENGE }
  );

  if (isNewAccount) {
    await kv.set(keys.user(userId), {
      userId,
      displayName: userName,
      credentials: [],
      createdAt: new Date().toISOString(),
    });
  }

  return res.status(200).json({ options, userId, isNewAccount });
}