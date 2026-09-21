// ============================================================
// index.html의 <script> 내용을 그대로 이동한 부분
// ============================================================

const motionButton = document.querySelector('.motion');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setMotion(value) {
  document.body.classList.toggle('reduce-motion', value);
  if (motionButton) {
    motionButton.setAttribute('aria-pressed', value);
    motionButton.textContent = `모션 줄이기: ${value ? 'ON' : 'OFF'}`;
  }
}

document.querySelectorAll('.type-text').forEach(el => {
  el.dataset.text = el.textContent;
  el.textContent = '';
});

function runTypingForPage(pageEl) {
  const targets = pageEl.querySelectorAll('.type-text');
  if (!targets.length) return;

  if (document.body.classList.contains('reduce-motion')) {
    targets.forEach(el => { el.textContent = el.dataset.text; });
    return;
  }

  targets.forEach(el => el.textContent = '');

  let index = 0;
  function typeNextTarget() {
    if (index >= targets.length) return;
    const target = targets[index];
    const text = target.dataset.text;
    let charIdx = 0;
    target.textContent = '';

    function typeChar() {
      if (charIdx < text.length) {
        target.textContent += text.charAt(charIdx);
        charIdx++;
        setTimeout(typeChar, 8);
      } else {
        index++;
        typeNextTarget();
      }
    }
    typeChar();
  }
  typeNextTarget();
}

function openPage(id) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById(id);
  if (!next || next === current) return;

  const reveal = () => {
    if (current) current.classList.remove('active', 'leaving');
    next.classList.add('active');
    next.scrollTop = 0;

    next.querySelectorAll('.typed').forEach(el => {
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = '';
    });

    runTypingForPage(next);
  };

  if (document.body.classList.contains('reduce-motion') || !current) {
    reveal();
  } else {
    current.classList.add('leaving');
    setTimeout(reveal, 220);
  }
}

// SPA 내 이동 + private.html/index.html 간 이동을 모두 처리
document.addEventListener('click', event => {
  const control = event.target.closest('[data-page]');
  if (control) {
    const target = control.dataset.page;
    // 특수 페이지: 다른 HTML로 이동
    if (target === '__private__') {
      window.location.href = '/private.html';
      return;
    }
    if (target === '__home_index__') {
      window.location.href = '/';
      return;
    }
    openPage(target);
  }
});

if (motionButton) {
  motionButton.addEventListener('click', () =>
    setMotion(!document.body.classList.contains('reduce-motion'))
  );
  setMotion(reduced);
}

// ============================================================
// 패스키(WebAuthn) 클라이언트 로직
// ============================================================

// @simplewebauthn/browser를 ESM CDN에서 동적 로드
let _swb = null;
async function swb() {
  if (!_swb) {
    _swb = await import('https://esm.sh/@simplewebauthn/browser@13');
  }
  return _swb;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, body };
}

function toast(msg, ms = 2600) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// --- 등록: "계정 만들기" ---
async function registerPasskey() {
  const start = await api('/api/register-start', { method: 'POST' });
  if (!start.ok) { toast('등록 시작 실패'); return null; }
  const { options, userId } = start.body;

  let attResp;
  try {
    const { startRegistration } = await swb();
    attResp = await startRegistration({ optionsJSON: options });
  } catch (err) {
    toast('패스키 등록이 취소되었습니다');
    return null;
  }

  const finish = await api('/api/register-finish', {
    method: 'POST',
    body: JSON.stringify({ userId, response: attResp }),
  });
  if (!finish.ok) { toast('등록 검증 실패'); return null; }

  toast('패스키가 등록되었습니다');
  return finish.body;
}

// --- 로그인: "패스키로 열기" ---
async function loginPasskey() {
  const start = await api('/api/login-start', { method: 'POST' });
  if (!start.ok) { toast('로그인 시작 실패'); return null; }
  const { options, challengeId } = start.body;

  let authResp;
  try {
    const { startAuthentication } = await swb();
    authResp = await startAuthentication({ optionsJSON: options });
  } catch (err) {
    toast('패스키 로그인이 취소되었습니다');
    return null;
  }

  const finish = await api('/api/login-finish', {
    method: 'POST',
    body: JSON.stringify({ challengeId, response: authResp }),
  });
  if (!finish.ok) { toast('로그인 실패'); return null; }

  toast('로그인 성공');
  return finish.body;
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  toast('로그아웃되었습니다');
}

async function fetchPrivate() {
  return api('/api/private', { method: 'GET' });
}

async function fetchCredentials() {
  return api('/api/credentials', { method: 'GET' });
}

async function deleteCredential(credentialId) {
  return api('/api/credentials', {
    method: 'DELETE',
    body: JSON.stringify({ credentialId }),
  });
}

// 전역 노출 (private.html에서 사용)
window.JSW = {
  openPage, toast,
  registerPasskey, loginPasskey, logout,
  fetchPrivate, fetchCredentials, deleteCredential,
};