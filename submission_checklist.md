# 과제 8 제출 체크리스트

## 결과물 및 소스 URL
- **결과물 URL**: `https://sktassign8-passkey.vercel.app`
- **소스 저장소 URL**: `https://github.com/dyj02056/sktassign1_introduce/tree/assignment8`

(모든 URL은 계정 생성·로그인·인증·초대·비밀번호·OAuth·CAPTCHA 없이 새 시크릿 창에서 열립니다.)

---

## 재현·통과 확인 4가지

```text
어디로 가나요: https://sktassign8-passkey.vercel.app/private.html

무엇을 하나요(3단계 이내):
  1) 시크릿 창에서 위 주소를 연다 → 잠금 화면이 뜬다 (비공개 자료는 보이지 않는다).
  2) [계정 만들기] → 기기의 패스키로 등록 → 비공개 자료 3건이 화면에 나타난다.
  3) [로그아웃] 후 [패스키로 열기] → 방금 등록한 패스키로 다시 들어간다.

무엇이 보이면 통과:
  - 잠금 화면에서 비공개 자료가 전혀 보이지 않고, 네트워크 탭의 /api/private 응답이 401이다.
  - 등록·로그인 후 화면 상단에 `세션 sess:xxxxxx…` 와 `계정 xxxxxxxx`가 표시된다.
  - 등록한 패스키가 [패스키 관리] 화면에 이름과 등록일과 함께 보인다.
  - 로그아웃 후에도 같은 패스키로 재로그인이 된다.

안 될 때:
  - 잠금 화면에서 [계정 만들기]를 눌러도 패스키 창이 안 뜨면 https(또는 localhost)인지 확인.
  - 등록 후 자료가 0건이면 F12 → Network의 /api/register-finish 응답을 확인.
  - 로그인 시 "보안 키를 USB에 삽입" 안내만 뜨면 이 브라우저 프로필에 아직 패스키가 없는 것.
AI와 내 판단 3줄
text
AI에게 맡긴 일: WebAuthn 서버 코드 초안, KV 키 구조, 공통 CSS/JS 추출, 검증 명령, 문서 초안

내가 판단한 일: 저장소를 새로 만들지 않고 assignment8 브랜치로 분리해 1번 과제를 보존한 결정,
                KV가 Upstash로 바뀐 뒤에도 KV_* 환경변수명을 확인해 @vercel/kv를 유지한 판단,
                두 번째 패스키를 휴대폰으로 등록한 선택

AI 제안을 따르지 않은 일: impeccable의 PRODUCT.md·DESIGN.md 생성을 생략하고
                        기존 index.html의 시각 언어를 evidence로 삼은 것
                        (과제가 요구한 문서 3개 외 추가 산출물 최소화)
인증 구현 설명서 (6항목)
㉮ 무엇으로 붙였나
직접 구현 + 라이브러리 조합

서버: @simplewebauthn/server@13 (Node.js, Vercel Serverless Functions)

브라우저: @simplewebauthn/browser@13 (esm.sh CDN에서 동적 import)

저장소: @vercel/kv (Upstash Redis 기반)

세션: Node 표준 crypto.randomBytes(32)

㉯ 왜 그걸 골랐나
WebAuthn 서명 검증(CBOR 파싱, COSE 키 디코딩)을 직접 구현하면 버그·보안 위험이 큼.

@simplewebauthn/*는 Google 공식 문서가 권장하는 사실상 표준 라이브러리.

저장소는 세션·challenge·공개키처럼 키-값 조회가 중심이라 KV가 최소·적합. 관계형 DB는 과함.

빌드 도구 없이 CDN 동적 import로 파일 수·설정을 최소화.

㉰ 어디를 어떻게 고쳤나
등록: api/register-start.js (challenge 발급, 세션 있으면 기존 계정 재사용) → common.js:registerPasskey() (브라우저 호출) → api/register-finish.js (검증, 공개키 저장)

로그인: api/login-start.js (allowCredentials 빈 배열) → common.js:loginPasskey() → api/login-finish.js (서명 검증, 세션 발급)

로그아웃: api/logout.js ← common.js:logout()

비공개 자료 조회: api/private.js ← common.js:fetchPrivate()

세션 검증(공통): api/_session.js의 getSession(req)

UI: index.html(공개) + private.html(잠금/비공개/패스키 관리) + common.css + common.js

㉱ 안 열리는 것을 확인한 기록
로그인 없이 열기: 세션 쿠키 없이 GET /api/private → 401 Unauthorized. 페이지 소스에 비공개 텍스트 없음.

남의 패스키로 열기:

A 세션으로 GET /api/private?userId=<B> → A 자료만 반환

B 세션으로 GET /api/private?userId=<A> → B 자료만 반환

POST /api/private (body에 남의 userId) → 405 Method not allowed

A 세션으로 B의 credentialId DELETE /api/credentials → 403 Not your credential

자료 건수: A=3, B=3 (거절 앞뒤로 반대편 자료 건수 동일)

이미 쓴 challenge 재사용: 같은 challengeId로 1차 제출(401) 후 2차 제출 → 400 Challenge not found or expired

패스키 삭제 뒤 로그인: 2개 등록 → 1개 삭제 → 남은 1개로 로그인 성공 / 삭제한 credentialId로는 401 Unknown credential / 마지막 1개 삭제 시 화면에 "복구할 수 없습니다"

㉲ AI와 나
AI에게 맡긴 일: WebAuthn 서버 코드 초안, KV 키 구조, 공통 CSS/JS 추출, 검증 명령, 문서 초안

내가 판단한 일: 저장소 분리 전략(assignment8 브랜치), KV 환경변수명 확인 후 @vercel/kv 유지, 두 번째 패스키를 휴대폰으로 등록

AI 제안을 따르지 않은 일: impeccable의 PRODUCT.md·DESIGN.md 생성 생략, 기존 index.html의 시각 언어를 evidence로 사용

㉳ 아직 못 막은 것
마지막 패스키를 잃으면 계정 복구가 불가능합니다. 비밀번호·이메일·SMS 등 대체 인증 수단이 없어서, 등록된 패스키가 0개가 되는 순간 계정은 영구 잠깁니다. 화면에는 "복구할 수 없습니다" 안내와 "마지막 패스키" 경고 배지로 대비하지만, 실제 복구 경로는 제공하지 않습니다.

참고: 검증에 사용한 값
계정 A userId 앞 8자: 69eca3a9

계정 B userId 앞 8자: 8d683ed7

계정 A 남은 패스키: 1개 / 계정 B 남은 패스키: 0개 (시연 후 삭제 완료)

패스키 저장 위치: Google 비밀번호 관리자 (첫 번째), 휴대폰 (두 번째)

세션 토큰은 문서에 전체를 기재하지 않고 앞 6자만 표기 (T08-C34)
