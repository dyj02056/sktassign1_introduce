# 과제 8 — 내 소개 페이지에 패스키 달기

## 0. 프로젝트 개요

- **결과물 URL**: https://sktassign8-passkey.vercel.app
- **소스 URL**: (https://github.com/dyj02056/sktassign1_introduce/commit/57e79f87c1235332d5b2e27e396d55d3b929a17c)
- **1번 과제(원본)**: https://sktassign1-introduce.vercel.app (그대로 유지)

1번 과제의 소개 페이지를 그대로 이어받아, 그 위에 **패스키(WebAuthn)로 잠긴 비공개 영역**을 새로 얹은 프로젝트입니다.
비밀번호를 만들지 않고, 기기에서 생성한 키 쌍 중 **공개키만 서버에 저장**하고, 로그인은 **매번 새로 발급되는 일회용 challenge에 대한 서명**으로 처리합니다.

- 저장소: `sktassign1_introduce` 저장소의 `assignment8` 브랜치 (main은 1번 그대로 보존)
- 배포: Vercel 프로젝트 2개 (main → 1번 URL, assignment8 → 8번 URL)
- 저장소: Vercel KV (Upstash Redis 기반), 환경변수 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 사용

---

## 1. 1번 과제와의 연결 (T08-C11)

- `main` 브랜치: 1번 과제의 `index.html` 그대로.
- `assignment8` 브랜치: `main`에서 분기.
- `index.html` 상단에 `<!-- branched from main @ assignment 1 (sktassign1_introduce) — T08-C11 -->` 주석으로 출처 명시.
- 1번의 `<style>` 블록은 **한 글자도 바꾸지 않고** `common.css`로 이동. `<script>` 블록도 **한 글자도 바꾸지 않고** `common.js`로 이동.
- `index.html`의 본문 마크업은 그대로 유지. 유일한 추가는 홈 메뉴에 `JSW.private` 버튼 1개.

---

## 2. 인증 흐름 (네 가지 경로)

### (1) 등록 (계정 만들기 / 패스키 추가)
1. 브라우저 → `POST /api/register-start`
2. 서버: 세션 유무 확인 → 세션 있으면 기존 userId 재사용, 없으면 새 UUID 생성
3. 서버: `generateRegistrationOptions()`로 challenge 생성 → KV `chal:reg:<userId>` 저장 (TTL 5분)
4. 브라우저: `startRegistration()` 호출 → 기기가 키 쌍 생성, **개인키는 기기에 남음**
5. 브라우저 → `POST /api/register-finish` (attestation 응답 전달)
6. 서버: **challenge를 KV에서 즉시 삭제** → `verifyRegistrationResponse()`로 검증
7. 서버: **공개키만** KV `cred:<credentialId>`에 저장, user 레코드의 `credentials` 배열에 추가
8. 계정이 새로 만들어지는 경우에만 비공개 자료 3개를 `data:<userId>`에 생성

### (2) 로그인 (패스키로 열기)
1. 브라우저 → `POST /api/login-start`
2. 서버: `generateAuthenticationOptions({ allowCredentials: [] })` → 이 도메인의 모든 패스키를 브라우저가 제시
3. 서버: challenge를 KV `chal:auth:<challengeId>`에 저장 (TTL 5분)
4. 브라우저: `startAuthentication()` → 사용자가 패스키 선택 → **개인키로 서명**
5. 브라우저 → `POST /api/login-finish`
6. 서버: **challenge를 KV에서 즉시 삭제** → `response.id`로 `cred:<id>` 조회 → **공개키로 서명 검증**
7. 서버: 검증 성공 시 랜덤 32바이트 세션 토큰 생성 → KV `sess:<token>` 저장 (TTL 24시간) → HttpOnly + SameSite=Lax 쿠키 설정
8. 서버: 응답에는 **세션 토큰 앞 6자만** 포함 (`sessionPrefix`)

### (3) 로그아웃
- `POST /api/logout` → KV에서 `sess:<token>` 삭제 → 쿠키 `Max-Age=0`으로 만료

### (4) 비공개 자료 조회
- `GET /api/private` → 쿠키에서 세션 토큰 추출 → KV에서 세션 조회 → **세션의 userId로만** `data:<userId>` 조회 → 반환
- 요청의 `?userId=`, body의 `userId`, 헤더의 `X-User-Id` 등은 **절대 사용하지 않음**

---

## 3. KV 저장 구조

| 키 패턴 | 값 | TTL |
|---|---|---|
| `chal:reg:<userId>` | `{ challenge, userId, userName, isNewAccount }` | 5분 |
| `chal:auth:<challengeId>` | `{ challenge }` | 5분 |
| `user:<userId>` | `{ userId, displayName, credentials: [{id, name, createdAt}], createdAt }` | 없음 |
| `cred:<credentialId>` | `{ credentialId, publicKey, counter, userId, name, deviceType, backedUp, createdAt }` | 없음 |
| `sess:<token>` | `{ userId, createdAt }` | 24시간 |
| `data:<userId>` | `[{ id, title, body }, ...]` (3개) | 없음 |

**공개키만 저장**: `cred:<id>.publicKey`는 `Array.from(credential.publicKey)` 로 저장된 공개키 배열. 개인키는 기기를 떠나지 않으므로 서버에 없음.

---

## 4. 검증 기록 (T08-C50 4가지 + C37~C41)

### (1) 로그인 없이 열기 (T08-C16, C17, C18)
- `GET /api/private` (세션 쿠키 없이) → **401 Unauthorized**
- 페이지 소스 확인: 비공개 자료 텍스트 없음

### (2) 남의 패스키·자료 접근 시도 (T08-C37, C38, C39, C40, C41)
- 계정 A userId: `69eca3a9` (앞 8자) / 계정 B userId: `8d683ed7` (앞 8자)
- 계정 A로 로그인한 상태에서 `GET /api/private?userId=8d683ed7-...` 요청
  → 응답 `userId: '69eca3a9-...'` + A의 자료만 반환 (쿼리 무시)
- 계정 B로 로그인한 상태에서 `GET /api/private?userId=69eca3a9-...` 요청
  → 응답 `userId: '8d683ed7-...'` + B의 자료만 반환
- `POST /api/private` (body에 남의 userId) → **405 Method not allowed**
- `GET /api/private` + `X-User-Id: <남의 userId>` → 여전히 내 자료만
- 자료 건수: A = 3건, B = 3건 (동일)
- 계정 A로 로그인 후 B의 credentialId로 `DELETE /api/credentials` → **403 Not your credential**
- 소유권 확인 위치: `api/credentials.js`의 `const owned = (user.credentials || []).some(c => c.id === credentialId); if (!owned) return res.status(403)...`

### (3) 이미 쓴 challenge 재사용 (T08-C31)
- `POST /api/login-start` → `challengeId: 46207d4e-...`
- 같은 `challengeId`로 1차 제출 → `401 Unknown credential` (challenge는 이미 삭제됨)
- 같은 `challengeId`로 2차 제출 → **400 `Challenge not found or expired`**

### (4) 패스키 삭제 후 로그인 (T08-C44, C45, C46)
- 계정 A에 패스키 2개 등록 → 목록에 이름·등록일 표시 (T08-C42, C43)
- 1개 삭제 → 남은 1개로 로그인 **성공** (T08-C44)
- 삭제된 credentialId로 로그인 시도 → `401 Unknown credential` (T08-C45)
- 남은 1개도 삭제 → 목록이 비고 화면에 **"등록된 패스키가 없습니다. 복구할 수 없습니다. 새 계정을 만들어 주세요."** 표시 (T08-C46)

---

## 5. 소스 위치 (T08-C49)

| 흐름 | 지나는 소스 |
|---|---|
| 등록 | `api/register-start.js` → `common.js:registerPasskey()` → `api/register-finish.js` |
| 로그인 | `api/login-start.js` → `common.js:loginPasskey()` → `api/login-finish.js` |
| 로그아웃 | `api/logout.js` ← `common.js:logout()` |
| 비공개 자료 조회 | `api/private.js` ← `common.js:fetchPrivate()` |
| 세션 검증 (공통) | `api/_session.js`의 `getSession(req)` |

---

## 6. 아직 못 막은 것 (T08-C51)

**마지막 패스키를 잃으면 계정 복구가 불가능합니다.** 비밀번호·이메일·SMS 등 대체 인증 수단이 없어서, 등록된 패스키가 0개가 되는 순간 계정은 영구 잠깁니다. 화면에는 "복구할 수 없습니다" 안내와 "마지막 패스키" 경고 배지로 대비하지만, 실제 복구 경로는 제공하지 않습니다.

보조 완화:
- challenge TTL은 5분이며 검증 직전에 즉시 삭제하므로 실질 재사용 창이 거의 없음.
- 세션은 HttpOnly + Secure(https) + SameSite=Lax로 완화. XSS 자체는 막지 못함.
- 동일 기기에 두 번째 패스키 등록은 브라우저·OS 정책상 어려워 다른 인증기(휴대폰)로 우회.

---

## 7. AI와 내 판단 (T08-C53)

- **AI에게 맡긴 일**: WebAuthn 서버 코드 초안, KV 키 구조, 공통 CSS/JS 추출, 검증 명령, 문서 초안
- **내가 판단한 일**: 저장소를 새로 만들지 않고 `assignment8` 브랜치로 분리해 1번 과제를 보존한 결정, KV가 Upstash로 바뀐 뒤에도 `KV_*` 환경변수명을 확인해 `@vercel/kv`를 유지한 판단, 두 번째 패스키를 휴대폰으로 등록한 선택
- **AI 제안을 따르지 않은 일**: impeccable의 PRODUCT.md·DESIGN.md 생성을 생략하고 기존 `index.html`의 시각 언어를 evidence로 삼은 것 (과제가 요구한 문서 3개 외 추가 산출물 최소화)
