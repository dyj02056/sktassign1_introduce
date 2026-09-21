import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { kv, keys, TTL } from '../lib/kv.js';

function rpID(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const options = await generateAuthenticationOptions({
    rpID: rpID(req),
    allowCredentials: [], // 빈 배열 = 브라우저가 이 도메인의 모든 패스키를 보여줌
    userVerification: 'preferred',
  });

  // challengeId로 보관 (등록과 달리 userId를 모르는 상태)
  const challengeId = randomUUID();
  await kv.set(
    keys.authChallenge(challengeId),
    { challenge: options.challenge },
    { ex: TTL.CHALLENGE }
  );

  return res.status(200).json({ options, challengeId });
}