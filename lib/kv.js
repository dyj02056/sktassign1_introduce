import { kv } from '@vercel/kv';

// TTL (초)
export const TTL = {
  CHALLENGE: 60 * 5,      // 5분
  SESSION: 60 * 60 * 24,  // 24시간
};

// 키 규칙 — 일관성을 위해 한 곳에서만 생성
export const keys = {
  regChallenge: (id) => `chal:reg:${id}`,
  authChallenge: (id) => `chal:auth:${id}`,
  user: (userId) => `user:${userId}`,
  cred: (credentialId) => `cred:${credentialId}`,
  session: (token) => `sess:${token}`,
  data: (userId) => `data:${userId}`,
};

// KV 재노출 (다른 파일에서 import { kv } from '../lib/kv.js' 로 씀)
export { kv };