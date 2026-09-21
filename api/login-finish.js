import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { randomBytes } from 'node:crypto';
import { kv, keys, TTL } from '../lib/kv.js';

function rpID(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

function origin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { challengeId, response } = req.body || {};
  if (!challengeId || !response) {
    return res.status(400).json({ error: 'challengeId and response required' });
  }

  const stored = await kv.get(keys.authChallenge(challengeId));
  if (!stored) {
    return res.status(400).json({ error: 'Challenge not found or expired' });
  }

  // 일회용: 즉시 삭제
  await kv.del(keys.authChallenge(challengeId));

  // credentialId는 response.id에 들어있음
  const credentialId = response.id;
  const cred = await kv.get(keys.cred(credentialId));
  if (!cred) {
    return res.status(401).json({ error: 'Unknown credential' });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpID(req),
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: cred.counter,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return res.status(401).json({ error: 'Verification failed', detail: String(err.message || err) });
  }

  if (!verification.verified) {
    return res.status(401).json({ error: 'Not verified' });
  }

  // counter 갱신 (clone 감지 대비)
  await kv.set(keys.cred(credentialId), {
    ...cred,
    counter: verification.authenticationInfo.newCounter,
  });

  // 세션 토큰 생성 → KV 저장 → HttpOnly 쿠키
  const sessionToken = randomBytes(32).toString('base64url');
  await kv.set(
    keys.session(sessionToken),
    { userId: cred.userId, createdAt: new Date().toISOString() },
    { ex: TTL.SESSION }
  );

  const isHttps = (req.headers['x-forwarded-proto'] || 'http') === 'https';
  const cookie = [
    `jsw_session=${sessionToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isHttps ? 'Secure' : '',
    `Max-Age=${TTL.SESSION}`,
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({
    verified: true,
    userId: cred.userId,
    sessionPrefix: sessionToken.slice(0, 6), // T08-C34: 전체는 노출 안 함
  });
}