# 24H Circle Planner 구조

React 19·TypeScript·Vite 기반의 로컬 우선 일정 편집기입니다. 기본 편집은 로그인 없이 동작하며, Cloudflare Worker와 D1이 인증·동기화·결제·푸시 등 온라인 기능을 제공합니다.

## 진입점과 화면

- `src/main.tsx`: URL에 따라 일반 편집기, 읽기 전용 공유 화면(`/s`, `/s/:id`), 데스크톱 위젯(`/widget`), 내보내기 검증 화면(`?spike=1`)을 선택합니다.
- `src/App.tsx`: 편집 화면, 다이얼로그, 알림 등 기능을 연결합니다.
- `src/components/CircleTimeline/`, `SliceEditor/`: SVG 원형 시간표와 일정 편집 UI입니다. 경계 드래그는 `useSliceInteraction`이 SVG를 직접 갱신하고 완료 시 스토어에 반영합니다.
- `public/`, `scripts/`: 서비스 워커와 정적 콘텐츠, 다국어 HTML·템플릿 생성 및 E2E 도구가 있습니다.

## 상태와 저장 흐름

일반 편집기는 인증 → 환경설정 → 동기화 → 일정 스토어 → 날짜 목록 순으로 Provider를 구성하고, 그 안에 프리셋·메모·다이어리·목표·기록·시간 팔레트를 제공합니다. 공유 화면과 위젯은 필요한 Provider만 사용합니다.

1. 편집 UI가 `useScheduleStore`에 액션을 전달합니다.
2. `src/lib/schedule.ts`의 순수 함수가 슬라이스를 변경하고 24시간 연속성 조건을 검사합니다. 스토어는 실행취소 이력과 다이어리 잠금을 관리합니다.
3. `useDays`가 활성 날짜를 편집 스토어에 불러오고 변경분을 날짜 목록에 반영합니다. 다이어리를 보는 동안에는 작업 중인 날짜를 덮어쓰지 않습니다.
4. 날짜 목록과 부가 데이터는 각 훅에서 localStorage에 저장합니다. 단일 일정 캐시는 `src/lib/storage.ts`에서 500ms 지연 저장하며, 공통 데이터 훅은 `usePersistedState`를 사용합니다.

`src/types/`는 일정·슬라이스·이력 형식을 정의하고, `src/lib/`는 시간 계산, SVG 기하, 공유 링크, PNG/PDF/JSON 내보내기 등을 담당합니다. `src/i18n/`에는 번역과 다국어 콘텐츠가 있습니다.

## 온라인 기능

- `src/hooks/useAuth.tsx`: 계정과 이용권 상태를 제공합니다.
- `src/hooks/useSync.tsx`, `src/lib/sync/`: Pro 이용권과 동의 상태에 따라 지정된 저장 키를 동기화합니다. 서버 버전과 이전 합의 스냅샷을 사용해 3-way 병합하며, 선택적으로 브라우저에서 AES-GCM 암호화를 수행합니다.
- `worker/index.ts`: Google OAuth, 세션, 동기화, Polar 결제·웹훅, 쿠폰·추천, 뉴스 및 푸시 API를 처리합니다. 예약 실행은 푸시 알림을 처리합니다.
- `worker/shares.ts`, `worker/widget.ts`: 공유 일정과 위젯 관련 요청을 처리합니다.
- `worker/migrations/`, `wrangler.jsonc`: D1 스키마 변경과 배포·정적 자산 설정입니다.

오프라인에서는 로컬 편집과 저장을 사용할 수 있습니다. 로그인, 클라우드 동기화, 결제 및 최신 외부 데이터 조회에는 연결이 필요합니다. `build:single`은 폰트를 포함한 단일 HTML 편집기 빌드입니다.

## 검증

- `npx vitest run`: 단위·컴포넌트 테스트. 일정 로직에는 fast-check 속성 테스트가 포함됩니다.
- `npm run build`: TypeScript 검사, Vite 빌드, 다국어 HTML 생성.
- `npm run lint`: ESLint 검사.
- `npm run e2e`: `scripts/e2e/run.mjs`의 브라우저 검증.

변경 영역에 맞는 테스트를 먼저 실행하고, UI·네트워크 동작은 해당 브라우저 시나리오나 전송 모킹으로 확인합니다.
