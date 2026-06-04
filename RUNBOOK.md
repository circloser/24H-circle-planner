# 24H Circle Planner — Runbook

## Development

```bash
pnpm dev
```

Starts the Vite dev server at `http://localhost:5173`.

## Production Build

```bash
pnpm build
```

Runs `tsc -b && vite build`. Outputs to `dist/`.
Main JS bundle target: ≤ 250 KB gzip.

## Preview Production Build

```bash
pnpm preview
```

Serves the `dist/` folder at `http://localhost:4173`.

## Tests

```bash
# Run all tests (unit + integration + property)
pnpm test --run

# Watch mode
pnpm test

# Korean dictionary coverage gate (47/47 entries)
pnpm test:dict-coverage

# Coverage report
pnpm test:coverage
```

The R7 property test (`src/lib/__tests__/schedule.property.test.ts`) uses fast-check
with seed `0xC1C1E24` (203169316) and 200 runs. It asserts `isContiguous24h` holds
after every single action across arbitrary action sequences.

## Export Spike

```bash
pnpm spike
```

Runs the export pipeline smoke-test against a production preview server.
Requires `pnpm preview` running on port 4173 in a separate terminal.
Spike results are written to `.omc/verification/spike-output/`.

## Linting / Formatting

```bash
pnpm lint
pnpm format
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Production build (tsc + vite) |
| `pnpm preview` | Serve production build locally |
| `pnpm test --run` | All tests (non-interactive) |
| `pnpm test:dict-coverage` | Korean dict gate (47/47) |
| `pnpm spike` | Export pipeline smoke test |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Architecture Notes

- **Store**: `src/hooks/useScheduleStore.tsx` — Redux-style reducer with undo/redo history
- **Schedule logic**: `src/lib/schedule.ts` — pure functions (split/merge/resizeBoundary)
- **Export pipeline**: lazy-loaded via dynamic import — `src/lib/export/{png,pdf,jsonIo}.ts`
- **Fonts**: WOFF2 served from `public/fonts/` for on-screen; base64 OTF in `src/data/fonts.ts` for export
- **Theme**: `src/hooks/useTheme.ts` — light/dark/system via `data-theme` attribute on `<html>`

## 더블클릭 실행 (단일 파일)

```bash
pnpm build:single
```

`dist-single/index.html` 단일 파일을 생성합니다. 별도 서버 없이 브라우저에서 바로 열 수 있습니다.

### 사용 방법

1. `pnpm build:single` 실행 → `dist-single/index.html` 생성
2. `dist-single/index.html` 파일을 더블클릭 (또는 Chrome/Edge/Firefox 등 브라우저에서 열기)
3. 서버 불필요 — `file://` 프로토콜로 동작

### 주의사항

- **파일 크기**: 폰트(Pretendard WOFF2)가 base64로 인라인되어 약 7–8 MB입니다. 일반 웹 빌드 (`dist/`)는 영향 없음.
- **localStorage**: Chrome, Edge, Firefox에서 `file://` 프로토콜의 localStorage는 정상 동작합니다. 일정 저장/불러오기 모두 가능합니다.
- **기업 브라우저 정책**: 일부 기업 환경에서는 `file://` localStorage 접근을 제한할 수 있습니다.
- **파비콘 404**: 더블클릭 실행 시 `/favicon.svg` 요청이 404가 되지만 기능에는 영향 없습니다.
- **PDF 내보내기**: OTF 폰트가 `data:` URI로 인라인되어 `file://` 환경에서도 정상 동작합니다.

### 파일 구조

| 경로 | 설명 |
|------|------|
| `dist/` | 일반 웹 배포용 (코드 분할, CDN 등) |
| `dist-single/index.html` | 더블클릭용 단일 파일 |

### Playwright 검증

```bash
node scripts/verify-singlefile.mjs
```

스크린샷: `.omc/verification/singlefile-screenshot.png`

## Verification

See `.omc/verification/24h-circle-planner-verification.md` for the full acceptance
criterion matrix (A1–J10).

See `.omc/verification/build-preflight.md` for build preflight report.
