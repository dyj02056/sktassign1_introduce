import { generateRegistrationOptions } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { kv, keys, TTL } from '../lib/kv.js';

const RP_NAME = 'JSW Private';

function rpID(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = randomUUID();
  const userName = `user-${userId.slice(0, 8)}`;

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(req),
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: 'none',
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await kv.set(
    keys.regChallenge(userId),
    { challenge: options.challenge, userId, userName },
    { ex: TTL.CHALLENGE }
  );

  await kv.set(keys.user(userId), {
    userId,
    displayName: userName,
    credentials: [],
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({ options, userId });
}