# 24Houring Pro 동기화 — 백엔드 설계 문서

> 목적: PC↔모바일 등 기기 간 데이터 동기화를 **유료(Pro)** 기능으로 도입.
> 인증 = **OAuth 계정**, 백엔드 = **Cloudflare(Workers + D1)**, 결제 = **Lemon Squeezy(구독)**.
> 무료 티어는 지금처럼 **100% 로컬·무계정** 유지. 동기화는 *옵트인*.
>
> 선행 작업으로 무백엔드 **QR 기기 이전**(`DeviceTransferDialog`, `#p=` 공유링크)이 이미 배포됨 — 수요 검증용. 본 문서는 그 다음 단계.

---

## 1. 목표 / 비목표

**목표(v1)**
- Pro 구독자의 데이터(시간표·여러 날짜·일기·메모·사용자 프리셋)를 계정 기준으로 클라우드에 저장하고 모든 기기에서 동기화.
- 기기 분실/교체 시 **로그인만으로 복구**.
- 오프라인 우선(현재 동작 유지) + 온라인 시 백그라운드 동기화.

**비목표(v1, 추후)**
- 실시간 협업/공유, 공개 프로필.
- 종단간 암호화(E2EE) — v2 프리미엄 옵션.
- 필드 단위 CRDT 병합 — v1은 **Last-Write-Wins(LWW)** + 충돌 시 사용자 선택.
- 네이티브 앱(IAP) — 웹 결제 유지(앱스토어 수수료 회피).

---

## 2. 아키텍처 개요

```
[React SPA (기존, Cloudflare 정적 자산)]
        │  fetch /api/*  (httpOnly 쿠키 세션)
        ▼
[Cloudflare Worker  (신규 API)]
   ├─ /api/auth/*     OAuth(코드+PKCE) · 세션
   ├─ /api/me         로그인/구독 상태
   ├─ /api/sync       GET(pull) · PUT(push, LWW)
   ├─ /api/account    삭제(GDPR)
   └─ /api/webhooks/lemonsqueezy  결제 상태
        │
        ▼
[D1 (SQLite)]  users · sessions · subscriptions · sync_data
```

- **호스팅 변경**: 현재 `wrangler.jsonc`는 **assets-only**(`main` 없음). API를 같은 Worker에 붙이려면 `main`을 추가하고 `assets.binding`으로 정적 자산을 폴스루. (대안: 별도 API Worker + CORS — 배포 분리되나 쿠키 도메인/콜백 단순함 위해 **같은 도메인 단일 Worker** 권장.)
- **저장소**: 사용자/세션/구독 + 동기화 blob 모두 **D1** 사용 권장. KV는 최종일관성이라 동기화 read-after-write에 부적합. blob은 작은 JSON(수 KB)이라 D1 TEXT 컬럼으로 충분.
- **세션**: 불투명 토큰(D1 `sessions`) + **httpOnly·Secure·SameSite=Lax 쿠키**. (JWT 무상태도 가능하나 폐기/로그아웃 단순화 위해 D1 세션 권장.)

---

## 3. D1 스키마

```sql
-- 사용자: OAuth 신원 1개당 1행
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- uuid
  provider      TEXT NOT NULL,             -- 'google' | 'kakao' | 'apple'
  provider_sub  TEXT NOT NULL,             -- 공급자 고유 id(sub)
  email         TEXT,                       -- 영수증/복구용(선택)
  created_at    INTEGER NOT NULL,          -- epoch ms
  UNIQUE (provider, provider_sub)
);

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,            -- 무작위 32B base64url
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL             -- 슬라이딩 만료(예: 60일)
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE subscriptions (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status               TEXT NOT NULL,      -- 'active'|'on_trial'|'past_due'|'cancelled'|'expired'
  current_period_end   INTEGER,           -- epoch ms
  ls_subscription_id   TEXT,
  ls_customer_id       TEXT,
  updated_at           INTEGER NOT NULL
);

-- 동기화 데이터: 사용자당 단일 blob + 단조 증가 version(LWW)
CREATE TABLE sync_data (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blob        TEXT NOT NULL,               -- JSON 문자열(아래 4-1 참고)
  version     INTEGER NOT NULL,            -- 서버가 매 PUT마다 +1
  updated_at  INTEGER NOT NULL,
  device_label TEXT                        -- 마지막으로 쓴 기기(충돌 안내용)
);
```

> 추후 부분 동기화가 필요하면 `sync_data`를 `(user_id, namespace)` 복합키로 분리(schedule/diary/memos별 version). v1은 단일 blob로 단순화.

---

## 4. 동기화 프로토콜

### 4-1. blob 내용
- 기존 백업 직렬화(`exportAllData` 패턴)를 재사용하되 **동기화 대상 = 콘텐츠 키만**:
  `schedule`, `days`, `diary`, `memos`, `rimmemos`, `user-presets`.
- **제외(기기 로컬 설정)**: `theme`, `prefs`(폰트/배경/시간선 등), `onboarded` — 기기별로 다를 수 있어 v1 동기화 제외 권장(설정에서 "설정도 동기화" 옵션은 추후).
- 봉투: `{ v: 1, data: { <key>: <value>, ... } }`. 크기 상한(예: 1MB) 서버에서 검증.

### 4-2. 엔드포인트
| 메서드 · 경로 | 설명 | 권한 |
|---|---|---|
| `GET /api/sync` | `{ blob, version }` 반환(없으면 204) | 로그인 |
| `PUT /api/sync` | `{ blob, baseVersion, deviceLabel }` → 저장, `version+1` | 로그인 + **구독 활성** |

**LWW 규칙**
- 클라이언트는 마지막으로 받은 `version`을 보관.
- `PUT`의 `baseVersion === 서버.version` → 수락, `version+1` 반환.
- 불일치 → **409 Conflict** + 서버의 `{ blob, version, updatedAt, deviceLabel }` 반환.
- 클라이언트 409 처리: 두 blob의 `data.*.updatedAt`(또는 봉투 timestamp) 비교 → 자동 LWW(더 최신 채택) 후 재PUT. 양쪽이 모두 의미 있게 갈리면(드묾) **"이 기기 / 클라우드" 선택 모달**.

### 4-3. 트리거(클라이언트)
- 로그인 직후: **pull**(서버 우선; 로컬과 비교해 더 최신 채택, 첫 로그인이면 로컬 업로드).
- 로컬 변경 시: **디바운스 push**(예: 2–3초, store `present`/days/diary 변경 구독).
- 앱 포커스/온라인 복귀: pull → reconcile.
- 주기적(예: 5분) pull(경량 `If-None-Match`/version 헤더로 변경 없으면 304).
- **오프라인 우선**: 쓰기는 항상 localStorage 즉시 반영 → 온라인 + Pro일 때 push.

### 4-4. 권한(Entitlement)
- `GET /api/sync`: 활성/유예 구독자 허용(만료자도 마지막 pull 허용 = 데이터 인질 방지).
- `PUT /api/sync`: **구독 활성/체험/유예만**. 만료 시 push 거부(읽기전용 동기화) + 업셀.

---

## 5. 인증 흐름 (OAuth Authorization Code + PKCE)

> 클라이언트에 client_secret을 두지 않도록 **토큰 교환은 Worker(서버)에서** 수행. SPA 안전.

1. 클라이언트: `GET /api/auth/google/start` → Worker가 `state`(CSRF)+`code_verifier` 생성·쿠키 저장 → Google 인증 URL로 302.
2. 사용자 동의 → Google이 `GET /api/auth/google/callback?code&state`로 리다이렉트.
3. Worker: `state` 검증 → code+code_verifier로 토큰 교환(server-side, secret 사용) → `id_token` 검증(서명/aud/iss) → `sub` 추출.
4. `users` upsert(`provider+sub`) → `sessions` 생성 → **httpOnly·Secure·SameSite=Lax 쿠키** 설정 → 앱(`/`)으로 302.
5. 이후 모든 `/api/*`는 쿠키 세션으로 인증. `GET /api/me` → `{ user, plan, subscription }`.

**공급자 우선순위**: ① Google(가장 쉬움) → ② **Kakao**(국내 전환↑) → ③ Apple(iOS/국내, 단 개발자 $99/년 + 도메인검증·서명 복잡).
**비밀**: `GOOGLE_CLIENT_SECRET`, `KAKAO_*`, `LS_WEBHOOK_SECRET` 등은 `wrangler secret put`으로 Worker secret 저장(코드/리포 금지).

---

## 6. 결제 / 구독 (Lemon Squeezy · Merchant of Record)

- **체크아웃**: LS 호스티드 체크아웃(오버레이/링크). `checkout[custom][user_id]`에 우리 `user.id`를 넣어 웹훅이 계정에 매핑.
- **웹훅**: `POST /api/webhooks/lemonsqueezy` → **HMAC 서명 검증**(`LS_WEBHOOK_SECRET`) → 이벤트별 `subscriptions` 갱신:
  `subscription_created/updated` → status·current_period_end, `subscription_cancelled/expired` → 상태 반영, `subscription_payment_success` → 기간 연장.
- **관리/해지**: LS 고객 포털 링크 제공.
- **가격(선행 분석 재확인)**: 월 ₩2,000–4,000 / 연 ₩19,000–29,000, **14일 무료 체험**. MoR이 글로벌 VAT·인보이스·환불 대행(수수료 ~5%+α). 국내 전용 확장 시 토스/포트원 병행 가능.
- ⚠️ 추후 네이티브 앱으로 감싸면 디지털상품 IAP 강제 대상 → **웹 구독 유지**가 마진상 유리.

---

## 7. 보안 / 프라이버시

- TLS 전용, httpOnly·Secure 쿠키, OAuth `state`로 CSRF 방지, blob 크기 상한, 사용자/엔드포인트 **레이트리밋**(CF Rate Limiting 또는 D1 카운터).
- **개인정보처리방침 갱신 필수**(`public/privacy.html`): Pro 동기화 시 **서버에 사용자 콘텐츠 저장** 명시, 저장 항목·보관·삭제 절차 고지. 무료 티어는 "기기에만 저장" 유지 문구 보존(자세히는 [[adsense-legal-pages]]).
- **계정 삭제(GDPR)**: `DELETE /api/account` → users CASCADE로 sessions/subscriptions/sync_data 즉시 삭제 + 확인 UI.
- **무료 정체성 보존**: 로그인은 "동기화 켤 때만". 미로그인 사용자에게 강제 로그인 금지(이탈 방지).
- E2EE는 v2(서버가 평문 못 봄 = 강력한 마케팅, 단 패스프레이즈 분실=복구 불가 트레이드오프).

---

## 8. 프론트엔드 통합

- **신규 컨텍스트**
  - `AuthProvider`: `GET /api/me`로 세션/플랜 상태, 로그인/로그아웃 액션.
  - `SyncProvider`: pull/push, `version`, 상태(idle/syncing/offline/conflict), 디바운스 push 구독.
- **재사용**: 기존 백업 직렬화(콘텐츠 키만) → blob. 적용은 `importAllData`와 동일하게 localStorage 갱신 후 프로바이더 리하이드레이트(또는 reload).
- **UI**: 설정에 "계정·동기화" 섹션(로그인 버튼/상태/마지막 동기화 시각/Pro 배지), 충돌 시 "이 기기 vs 클라우드" 모달, Pro 업셀(체험 시작).
- **오프라인 우선 유지**: 동기화는 가산 기능. 로그아웃/무료 = 현행 로컬 동작 그대로.

---

## 9. wrangler / 환경 변경

```jsonc
// wrangler.jsonc (요지)
{
  "name": "24houringp",
  "main": "worker/index.ts",          // ← 추가(현재 assets-only)
  "compatibility_date": "2025-06-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",              // ← Worker가 비-API 요청을 폴스루
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "24houring", "database_id": "<id>" }
  ]
}
```
- Worker 진입점: `/api/*`는 라우팅, 그 외 `return env.ASSETS.fetch(request)`.
- Secrets: `wrangler secret put GOOGLE_CLIENT_ID/SECRET`, `KAKAO_*`, `APPLE_*`, `LS_WEBHOOK_SECRET`, `SESSION_PEPPER`.
- ⚠️ **배포 모델 변화**: assets-only → "Worker+assets". 기존 Cloudflare Workers Builds 설정(빌드 `pnpm run build`, 배포 `wrangler deploy`)은 유지되나, Worker 코드가 생기므로 빌드에 Worker 번들이 포함됨. 메모리 [[cloudflare-deploy]]의 pnpm 10.11.1·assets 규칙은 그대로 유효.

---

## 10. API 스펙 요약

| 경로 | 메서드 | 입력 | 출력 | 권한 |
|---|---|---|---|---|
| `/api/auth/{provider}/start` | GET | — | 302 → 공급자 | 공개 |
| `/api/auth/{provider}/callback` | GET | code,state | 302 → `/` + 세션쿠키 | 공개 |
| `/api/me` | GET | — | `{user,plan,subscription}` 또는 401 | 쿠키 |
| `/api/sync` | GET | — | `{blob,version}` / 204 | 로그인 |
| `/api/sync` | PUT | `{blob,baseVersion,deviceLabel}` | `{version}` / 409 | 로그인+구독 |
| `/api/checkout` | POST | `{plan}` | `{url}`(LS 체크아웃) | 로그인 |
| `/api/webhooks/lemonsqueezy` | POST | LS 페이로드 | 200 | 서명검증 |
| `/api/account` | DELETE | — | 200 | 로그인 |
| `/api/logout` | POST | — | 200(쿠키 만료) | 쿠키 |

---

## 11. 단계적 로드맵

1. **API 골격** — Worker `main` + `/api/*` 라우터 + D1 스키마 마이그레이션 + `env.ASSETS` 폴스루(앱 동작 무변경 확인).
2. **인증** — Google OAuth(코드+PKCE) + D1 세션/쿠키 + `/api/me` + 프론트 `AuthProvider`·로그인 UI.
3. **동기화** — `GET/PUT /api/sync`(LWW+version) + `SyncProvider`(pull/디바운스 push/충돌) + 베타에선 **전원 Pro**로 권한 스텁.
4. **결제** — Lemon Squeezy 체크아웃 + 웹훅 + 실제 entitlement + 14일 체험 + 페이월 + 개인정보처리방침 갱신.
5. **확장** — Kakao/Apple 로그인, 계정 삭제 UI, 충돌 UX 다듬기.
6. **(추후)** E2EE 옵션, 부분/네임스페이스 동기화, 공유/협업.

---

## 12. 비용 / 스케일 (대략, 확인 필요)

- **Cloudflare 무료 티어**로 초기 충분: Workers ~10만 req/day, D1 넉넉한 read/write·스토리지(소형 JSON). 사용자당 blob 수 KB → 스토리지·요청 비용 사실상 0에서 시작.
- **Lemon Squeezy** 수수료 ~5%+α(MoR, VAT 대행).
- 성장 시 Workers Paid($5/월~) 전환으로 한도 상향.

---

## 13. 열린 결정 사항 / 리스크

| 결정 | 옵션 | 권장 |
|---|---|---|
| API 위치 | 단일 Worker(+assets) vs 별도 API Worker | **단일 Worker**(쿠키/콜백 단순) |
| blob 저장 | D1 vs KV vs R2 | **D1**(강한 일관성) |
| 세션 | 불투명(D1) vs JWT | **불투명 D1**(폐기 단순) |
| 동기화 단위 | 단일 blob vs 네임스페이스 | v1 **단일**, 필요 시 분리 |
| 설정 동기화 | 콘텐츠만 vs prefs 포함 | v1 **콘텐츠만**(옵션 추후) |
| 충돌 | LWW vs CRDT | v1 **LWW + 선택모달** |

**주의**: 배포 모델이 assets-only → Worker+assets로 바뀌는 점, 개인정보처리방침에 서버 저장을 반드시 반영해야 하는 점, 무료 사용자 경험을 절대 건드리지 않는 점이 핵심 리스크/원칙.

---

*작성: Pro 동기화 v1 설계. 선행 무백엔드 QR 전송(`#p=`)은 수요 검증용으로 이미 라이브. 본 설계는 검증 후 착수 권장.*
