# UTM 태깅 가이드 — 채널별 유입 측정

> GA4는 URL의 `utm_*` 파라미터를 **자동 수집**합니다(코드 불필요). 아래 규칙대로
> 링크를 태깅해서 게시하면, GA4 → 획득 → **트래픽 획득**(세션 소스/매체)과
> **탐색 → 유입경로**에서 채널별 유입 → 활성화(schedule_edit / alarm_enable)
> 전환을 볼 수 있습니다. 활성화 이벤트는 [[growth-instrumentation]] 참고.

## 규칙 (3개 파라미터만)
| 파라미터 | 의미 | 값 예시 |
|---|---|---|
| `utm_source` | 어디서 왔나 (채널) | `pinterest` `instagram` `reddit` `youtube` `x` `playstore` `naver` `everytime` |
| `utm_medium` | 유형 | `social` `referral` `cpc`(유료) `qr` `bio`(프로필 링크) |
| `utm_campaign` | 캠페인/소재 | `cards` `studygram` `templates` `launch` `sunset` |

- **소문자·하이픈**만 사용(대소문자 다르면 GA4가 다른 채널로 셈).
- 로컬라이즈 라우트에 그대로 붙이면 언어권별 측정까지 됨: `/de/?utm_...`, `/ja/?utm_...`.
- 파라미터는 `?`로 시작, 여러 개는 `&`로 연결. (프래그먼트 `#…` 앞에 와야 함)

## 즉시 사용 링크 (복사)

### 핀터레스트 (핀 설명/링크)
```
https://24houring.com/?utm_source=pinterest&utm_medium=social&utm_campaign=cards
```

### 인스타그램 / 스터디그램 (프로필 bio 링크)
```
https://24houring.com/?utm_source=instagram&utm_medium=bio&utm_campaign=studygram
```
일본 스터디 계정용(일본어 랜딩으로):
```
https://24houring.com/ja/?utm_source=instagram&utm_medium=bio&utm_campaign=studygram
```

### Reddit / 커뮤니티 (댓글·글 링크)
```
https://24houring.com/?utm_source=reddit&utm_medium=referral&utm_campaign=community
```
독일어권 서브레딧/포럼:
```
https://24houring.com/de/?utm_source=reddit&utm_medium=referral&utm_campaign=community
```

### 에브리타임 / 네이버 카페 (국내 커뮤니티)
```
https://24houring.com/?utm_source=everytime&utm_medium=referral&utm_campaign=community
https://24houring.com/?utm_source=naver&utm_medium=referral&utm_campaign=community
```

### YouTube / Shorts (설명란)
```
https://24houring.com/?utm_source=youtube&utm_medium=social&utm_campaign=demo
```

### X(트위터)
```
https://24houring.com/?utm_source=x&utm_medium=social&utm_campaign=cards
```

### Play 스토어 → (웹으로 되돌리는 경우만; 스토어 유입 자체는 Play Console에서 봄)
스토어 리스팅 링크에는 UTM 대신 Google Play의 자체 추적을 쓰세요(Play Console → 획득 보고서). 웹에서 스토어로 보낼 때는 앱 내 배너가 이미 처리.

## 언어권 매핑 (권장)
| 채널/시장 | 랜딩 |
|---|---|
| 글로벌 영어 (Pinterest, Reddit, X) | `/` |
| 한국 (에타·네이버·스터디그램 KR) | `/ko/` |
| 일본 (勉強垢) | `/ja/` |
| 독일 | `/de/` |
| 중국어권/프랑스/스페인/러시아 | `/zh/ /fr/ /es/ /ru/` |

## GA4에서 보기
1. **획득 → 트래픽 획득** → 기본 채널 대신 "세션 소스/매체"로 보기 → `pinterest / social` 등 확인.
2. **탐색 → 유입경로 탐색**: 1단계 `session_source` → `schedule_edit` → `alarm_enable`. 채널별 **유입→아하 전환율** 비교.
3. 소스/매체별 `alarm_enable` 전환이 높은 채널에 시간·예산 집중.

## 팁
- 소셜 카드(`npm run social`)를 올릴 때 캡션 링크에 위 태깅 URL 사용.
- 같은 캠페인은 `utm_campaign` 값을 통일해야 묶여서 집계됨.
- 링크 단축(bit.ly 등)을 써도 최종 도착 URL에 utm이 있으면 GA4가 수집.
