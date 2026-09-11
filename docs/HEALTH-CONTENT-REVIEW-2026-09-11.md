# 건강 관련 콘텐츠 정리 및 근거 확인

검토일: 2026-09-11. 범위: 건강 필러 원본 5개 및 구형 가이드 6개, 각 한국어·영어. 의학적 감수 완료나 AdSense 승인 보장을 의미하지 않는다.

## 건강 필러: 기존 재작성 원고의 1차 출처 검증

5개 JSON 전체의 예시 계산, FAQ, 주장과 출처 범위를 확인했다. 원고의 제한된 일반 안내는 아래 공식 자료와 일치하여 유지하고 `reviewed_at`을 실제 재확인일로 갱신했다. 생성 HTML은 통합 빌드에서 재생성한다.

| 원본 | 유지한 일반 주장과 확인한 공식 자료 | 독자에게 제공하는 고유 작업 |
|---|---|---|
| health-sleep.json | [CDC About Sleep](https://www.cdc.gov/sleep/about/): 18~60세 7시간 이상, 수면 문제 상담 안내 | 준비 시간과 수면 기회를 구분하여 22:00~23:30 업무 충돌 계산 |
| health-rhythm.json | [NHLBI Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits): 카페인의 수면 방해 가능성, 교대근무 수면 문제 상담 안내 | 수요일 08시 출근의 준비 시작 06:50 역산 |
| health-nutrition.json | [NHS Eatwell Guide](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/): 식사 균형을 하루·일주일에 걸쳐 고려 | 대기 증가 시 점심 45분이 55분이 되는 계산 및 장소·접근성 대안 |
| health-movement.json | [WHO Physical activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity): 이동·집안일도 신체활동에 포함 | 활동 30분 + 왕복 20분 + 준비 20분 = 총 70분 확인 |
| health-mind.json | [NHS Stress](https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/): 다가올 일·이동 준비, 일상에 영향이 있으면 도움 요청 | 종료 전 미완료 업무의 다음 행동과 연락 기대 협의 |

모든 링크를 검토일에 직접 열어 해당 본문을 확인했다. 본문 `[1]` 표시는 생성기의 출처 링크와 연결해야 한다. 공식 자료는 앱의 치료 효과나 예시 시간의 건강상 적합성을 입증하지 않는다.

## 가이드 6개 전면 재작성

기존의 고정 수면·낮잠·카페인 규칙, 생리학적 단정, 습관 형성 일수·효과 약속을 제거했다. 기존 URL은 유지하되 제목·설명을 실제 내용에 맞게 변경했다. 모두 5단계 연습과 구체적인 가상 사례, 결과 확인 질문, 앱 적용 링크를 제공한다.

| URL | 교체한 실제 작업 | 남긴 출처 |
|---|---|---|
| /guides/sleep-and-day-design | 저녁 보고서가 취침 준비 30분을 침범한 상황에서 완료 범위 줄이기 | CDC: 반복 수면 문제 상담만 |
| /guides/shift-work-time-management | 목요일 야간근무와 금요일 오전 예약을 날짜 양쪽에서 확인 | NHLBI: 지속되는 교대근무 수면 문제 상담만 |
| /guides/burnout-prevention | 꽉 찬 업무일에 2시간 요청이 추가된 상황의 우선순위 협의 문장 | NHS: 일상에 영향을 주는 스트레스 도움 요청만 |
| /guides/becoming-a-morning-person | 60분 아침에 10분 과제를 추가할 때 전날 준비 공간까지 확인 | CDC: 반복 수면 문제 상담만 |
| /guides/energy-management | 전화 방해가 있는 초안 작업과 조용한 이메일 시간의 배치 비교 | 생리학적 주장을 남기지 않은 자체 편집 연습 |
| /guides/habit-building-schedule | 화요일 늦은 귀가와 반복 독서 계획의 충돌, 생략 후 재시작 | 형성 일수·효능 주장을 남기지 않은 자체 편집 연습 |

한국어·영어는 같은 제한과 같은 계산을 제공한다. 숫자는 가상 일정의 배정값임을 명시하고 실제 사용자 성과로 제시하지 않는다. 새 전문가·작성자 경력이나 실험 결과를 만들지 않았다.

## 구조 검증

- 기존 `guide.css`와 핵심 가이드 레이아웃 재사용. 콘텐츠 작성 원칙과 오류 제보 링크, 2026-09-11 갱신일 제공.
- 키보드로 접근 가능한 언어 버튼, `html.lang` 동기화, 본문 바로가기 유지.
- 기존 canonical URL 유지. 낡은 Article 메타데이터 제거 후 기존 핵심 가이드와 같은 정적 메타데이터 방식 사용.
- 광고 로더를 추가하지 않았으며 기존 광고 허용 목록을 확장하지 않음.
- 건강 JSON 5개는 형식 검사, 가이드 6개는 canonical·언어별 본문·갱신일·광고 미삽입을 검사함. 전체 빌드 및 브라우저 검증 결과는 통합 보고서에 기록.

남은 한계: 실제 계정의 AdSense 설정과 Google 내부 심사 판단은 이 코드 검토로 확인할 수 없다.
