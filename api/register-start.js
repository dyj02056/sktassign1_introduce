import { generateRegistrationOptions } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { kv, keys, TTL } from '../lib/kv.js';

const RP_NAME = 'JSW Private';

function rpID(req) {
  // Vercel이 주는 host에서 도메인만 추출 (포트 제거)
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 계정 생성: userId를 서버가 만든다. 비밀번호 없음.
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

  // challenge를 서버에 보관 (일회용)
  await kv.set(
    keys.regChallenge(userId),
    { challenge: options.challenge, userId, userName },
    { ex: TTL.CHALLENGE }
  );

  // user 레코드도 미리 생성 (등록 완료 시 credential 추가)
  await kv.set(keys.user(userId), {
    userId,
    displayName: userName,
    credentials: [],
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({ options, userId });
}