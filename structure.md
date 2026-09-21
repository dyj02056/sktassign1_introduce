# structure.md — 비전공자를 위한 프로젝트 구조 설명

## 한 줄 요약
공개 소개 페이지 옆에 **패스키로만 열리는 나만의 방**을 하나 붙였습니다.
비밀번호는 없습니다. 기기 안에만 있는 열쇠로 잠그고 열쇠로 엽니다.

---

## 1. 전체 그림
[사용자 브라우저] [Vercel 서버] [Vercel KV 저장소]
index.html /api/*.js chal:reg:...
private.html ─── HTTPS 요청 ───▶ register-start chal:auth:...
common.js register-finish ───▶ user:...
common.css login-start cred:...
login-finish sess:...
logout data:...
private
credentials

text

- 브라우저와 서버는 오직 **HTTPS**로만 대화합니다.
- 서버는 세션·challenge·공개키·비공개 자료를 **KV(키-값 저장소)** 에 넣고 뺍니다.

---

## 2. 파일별 역할 (한 줄씩)

### 화면 (정적 파일)
- **`index.html`** — 공개 소개 페이지. 1번 과제의 내용 그대로. 메뉴에 "JSW.private" 하나만 추가.
- **`private.html`** — 나만 보기 페이지. 잠금 화면, 비공개 자료 화면, 패스키 관리 화면 3개가 한 파일 안에 들어 있음.
- **`common.css`** — 두 페이지가 함께 쓰는 스타일. 1번 과제의 `<style>`을 그대로 옮긴 것.
- **`common.js`** — 두 페이지가 함께 쓰는 동작. 화면 전환, 타이핑 효과, 그리고 패스키 등록·로그인·로그아웃·자료 조회 함수.

### 서버 함수 (Vercel이 자동으로 실행)
- **`api/register-start.js`** — "계정 만들기/패스키 추가" 시작. 일회용 질문(challenge)을 만들어 저장.
- **`api/register-finish.js`** — 기기가 만든 응답을 검증. **공개키만** 저장. 비공개 자료 3개도 함께 생성.
- **`api/login-start.js`** — "패스키로 열기" 시작. 일회용 질문을 만들어 저장.
- **`api/login-finish.js`** — 기기가 보낸 서명을 **공개키로 검증**. 성공하면 세션 토큰을 만들어 쿠키로 심음.
- **`api/logout.js`** — 세션 토큰을 지우고 쿠키를 만료시킴.
- **`api/private.js`** — 로그인한 사람의 비공개 자료 3개를 돌려줌. 로그인 안 했으면 401.
- **`api/credentials.js`** — 로그인한 사람의 패스키 목록 조회, 삭제.
- **`api/_session.js`** — 위 함수들이 공통으로 쓰는 "쿠키에서 세션 확인" 도우미.

### 공용 도우미
- **`lib/kv.js`** — KV에 접근하는 도우미. 키 이름 규칙과 만료 시간이 여기 한 곳에 모여 있음.

### 설정
- **`package.json`** — 서버가 쓰는 외부 라이브러리 2개(`@simplewebauthn/server`, `@vercel/kv`) 목록.

### 문서
- **`submission_note.md`** — 이 프로젝트를 만든 전체 과정 기록.
- **`submission_checklist.md`** — 과제 제출 양식에 맞춘 체크리스트와 인증 구현 설명서.
- **`structure.md`** — 지금 읽고 있는 이 문서.

---

## 3. 흐름 따라가기 (등록 예시)
① 사용자가 [계정 만들기] 클릭
private.html → common.js:registerPasskey()

② 브라우저가 서버에 요청
POST /api/register-start

③ 서버가 일회용 질문을 만들어 저장
api/register-start.js → KV: chal:reg:<userId> = { challenge, ... }

④ 브라우저가 기기에 열쇠를 만들어 달라고 요청
navigator.credentials.create() (기기 안에서만 일어남)

⑤ 기기가 열쇠 쌍을 만듦

개인키: 기기 밖으로 안 나감

공개키: 브라우저로 전달

⑥ 브라우저가 공개키와 서명을 서버에 보냄
POST /api/register-finish

⑦ 서버가 검증하고 공개키를 저장
api/register-finish.js:

KV에서 challenge 꺼내고 → 즉시 삭제 (일회용)

verifyRegistrationResponse()로 검증

KV: cred:<credentialId> = { publicKey, ... }

KV: data:<userId> = [자료 3개]

⑧ 화면 전환
private.html이 비공개 자료 3개를 렌더

text

**로그인**도 같은 흐름이지만, ④⑤⑥이 **"기기가 개인키로 서명"** 으로 바뀝니다. 서버는 저장해 둔 **공개키**로 그 서명이 맞는지 확인합니다.

---

## 4. 자주 나오는 질문

**Q. 비밀번호는 어디 있나요?**
A. 없습니다. 아예 만들지 않았습니다. 대신 기기가 만든 열쇠 쌍이 그 자리를 대신합니다.

**Q. 서버가 개인키를 갖고 있나요?**
A. 아닙니다. **공개키만** 갖고 있습니다. 개인키는 기기(또는 비밀번호 관리자)를 떠나지 않습니다.

**Q. 남이 내 비공개 자료를 볼 수 있나요?**
A. 아닙니다. 서버는 **쿠키에 담긴 세션 토큰**으로만 사람을 식별하고, 그 세션의 주인 자료만 돌려줍니다. 요청에 다른 사람 ID를 끼워 넣어도 무시합니다.

**Q. 패스키를 다 잃어버리면?**
A. 복구할 수 없습니다. 이건 의도된 설계입니다. 그래서 미리 두 개 이상 등록해 두는 걸 권장합니다.

**Q. 왜 로그인할 때마다 "질문"이 바뀌나요?**
A. 같은 질문을 재사용하면 그걸 도청한 사람이 다시 쓸 수 있기 때문입니다. 서버는 매번 새 질문을 만들고, 한 번 쓰면 즉시 지웁니다.

---

## 5. 시연자가 확인할 수 있는 것

1. `https://sktassign8-passkey.vercel.app` — 공개 소개 페이지 (누구나)
2. `https://sktassign8-passkey.vercel.app/private.html` — 잠금 화면
3. `[계정 만들기]` → 패스키 등록 → 비공개 자료 3개 확인
4. `[패스키 관리]` → 등록한 패스키의 이름·등록일 확인, 삭제
5. `[로그아웃]` → `[패스키로 열기]` → 재로그인

---

## 6. 참고: 소스 코드 위치

- 공개 페이지: `index.html`
- 비공개 페이지: `private.html`
- 공용 스타일/스크립트: `common.css`, `common.js`
- 서버 함수: `api/` 폴더
- 저장소 도우미: `lib/kv.js`