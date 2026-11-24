# 배포 준비 체크리스트 (Vercel)

> PLAN 20번 "Vercel 배포 준비". 값(키)은 이 파일에 적지 않는다. 이름만 적고, 값은 `.env`에서 Vercel 환경변수 화면에 직접 옮긴다.
> 아직 배포하지 않았다. 아래를 모두 확인한 뒤 배포한다.

## 1. Vercel 환경변수 (모두 서버 전용, `NEXT_PUBLIC_` 접두사 금지)

| 이름 | 용도 | 비고 |
|---|---|---|
| `SUPABASE_URL` | Supabase 주소 | |
| `SUPABASE_ANON_KEY` | 일반 접속 키 | 로그인 사용자 권한으로만 동작(RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 키 | **탈퇴 처리(계정 삭제)에서만** 사용. 절대 공개 금지 |
| `OPENAI_API_KEY` | AI 계획 생성 | 서버에서만 호출 |
| `OPENAI_MODEL` | 사용할 모델 이름 | 현재 `gpt-4.1-mini` (바꿔도 됨) |

Production / Preview 모두에 등록한다. 등록 후 재배포해야 반영된다.

## 2. 배포 전에 꼭 할 일

- [ ] **Supabase 이메일 확인 켜기** (Authentication → Providers → Email → "Confirm email"). 지금은 개발 편의로 꺼져 있다.
- [ ] Supabase **Site URL / Redirect URL**을 배포 주소로 설정한다.
- [ ] 실행 시간: 계획 만들기는 AI를 최대 3번 부르므로 `app/plan/page.tsx`의 `maxDuration = 90`(대회 검색은 `app/races/page.tsx`의 30)이 요금제 한도 안인지 확인한다. 넘으면 낮춘다.
- [ ] 첫 화면 영상(`app/GuestLanding.tsx`의 `GLOW_VIDEO`)을 외부 주소 대신 직접 호스팅할지 정한다. 바꾸면 `next.config.ts`의 `media-src`도 함께 고친다.
- [ ] 고러닝(gorunning.kr) 사이트 이용약관과 `korean-marathon-schedule` 사용 조건 확인.
- [ ] 법적·전문가 검토: 건강정보 동의 문구·보관 기간, 훈련 규칙의 임시 숫자(`lib/rules/constants.ts`의 "임시/전문가 검토 필요").

## 3. 배포 직전 점검 명령

```powershell
npm run lint
npm test
npm run build
npm run verify:rls
npm run verify:ai
```

- `verify:rls`: 실제 Supabase에 가짜 계정을 만들어 "본인 기록만 보인다"를 확인하고 모두 지운다. (33개)
- `verify:ai`: 실제 OpenAI를 1번 호출한다(소액).
- `npm run survey:summary`: 만족도 설문 집계(개수와 비율만 출력).

## 4. 이미 적용된 보안 설정

- 보안 헤더(`next.config.ts`): CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. (CSP·HSTS는 배포 빌드에만 붙는다)
- 요청 횟수 제한: 계획 만들기 한 시간 5번(데이터베이스 기록 기준), 고러닝 검색 1분 10번(서버 메모리 기준, 서버가 여러 대면 초기화될 수 있음). 로그인 시도 제한은 Supabase 기본 제한에 맡긴다.
- 건강정보는 로그에 남기지 않고, AI에는 허용 목록 값만 보낸다. 관리자 키는 탈퇴 처리에서만 쓴다.
