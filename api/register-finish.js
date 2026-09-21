import { verifyRegistrationResponse } from '@simplewebauthn/server';
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

function makeDefaultData(userId) {
  const short = userId.slice(0, 8);
  return [
    { id: 'p1', title: '준비 중인 프로젝트 메모', body: `[${short}] 패스키 실습 프로젝트 진행 중. 다음 단계: 로그인 화면 붙이기.` },
    { id: 'p2', title: '지원하려는 곳 목록', body: `[${short}] 가상 회사 A, B, C. 각각 자기소개서 초안 작성 필요.` },
    { id: 'p3', title: '이번 주 회고', body: `[${short}] WebAuthn challenge-응답 흐름 이해함. 공개키만 서버에 저장되는 것 확인.` },
  ];
}

function guessName(req) {
  const ua = req.headers['user-agent'] || '';
  let browser = 'Browser';
  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return `${browser} on ${os}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, response } = req.body || {};
  if (!userId || !response) {
    return res.status(400).json({ error: 'userId and response required' });
  }

  const stored = await kv.get(keys.regChallenge(userId));
  if (!stored) {
    return res.status(400).json({ error: 'Challenge not found or expired' });
  }

  // 일회용: 검증 전/후 무관하게 즉시 삭제
  await kv.del(keys.regChallenge(userId));

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpID(req),
      requireUserVerification: false,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Verification failed', detail: String(err.message || err) });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Not verified' });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const credentialId = credential.id;
  const publicKey = credential.publicKey; // Uint8Array
  const counter = credential.counter;

  // 사람이 읽을 이름 (T08-C24)
  const existingUser = await kv.get(keys.user(userId));
  const credCount = existingUser?.credentials?.length || 0;
  const baseName = guessName(req);
  const credName = credCount > 0 ? `${baseName} (${credCount + 1})` : baseName;

  const now = new Date().toISOString();

  // 공개키 저장 (T08-C21, C22)
  await kv.set(keys.cred(credentialId), {
    credentialId,
    publicKey: Array.from(publicKey), // KV는 Uint8Array 직접 저장 불가
    counter,
    userId,
    name: credName,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: now,
  });

  // user 레코드 갱신
  await kv.set(keys.user(userId), {
    userId,
    displayName: stored.userName,
    credentials: [...(existingUser?.credentials || []), { id: credentialId, name: credName, createdAt: now }],
    createdAt: existingUser?.createdAt || now,
  });

  // 계정 생성 시 기본 비공개 자료 3개 심기
  const existingData = await kv.get(keys.data(userId));
  if (!existingData) {
    await kv.set(keys.data(userId), makeDefaultData(userId));
  }

  return res.status(200).json({
    verified: true,
    credentialId,
    name: credName,
    userId,
  });
}