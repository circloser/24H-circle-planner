// Korean landing content for /ko/ (preserves the pre-English-first copy so
// Korean SEO keeps a dedicated indexable page).
export default {
  lang: 'ko',
  ogLocale: 'ko_KR',
  title: '24Houring · 24시간 원형 시간표 플래너 (하루 계획을 원형 시계로)',
  description:
    '하루 24시간을 원형 시계처럼 한눈에 보는 무료 시간표 플래너. 방학 계획표·생활 계획표·하루 일과표·원형 시간표로 두루 쓰기 좋아요. 드래그로 일정을 편집하고, 12·24시간 보기를 전환하며, 이미지로 저장·공유하세요. 설치 없이 브라우저에서 바로, 오프라인에서도 동작합니다.',
  ogTitle: '24Houring · 24시간 원형 시간표 플래너',
  ogDescription: '하루 24시간을 원형 시계처럼 한눈에. 드래그로 편집하고 이미지로 저장·공유하는 무료 시간표 플래너.',
  twTitle: '24Houring · 24시간 원형 시간표 플래너',
  twDescription: '하루 24시간을 원형 시계처럼 한눈에. 드래그로 편집하고 이미지로 저장·공유하는 무료 시간표 플래너.',
  ogImageAlt: '24Houring — 24시간 원형 시간표',
  alternateName: '24시간 원형 시간표 플래너',
  webAppDescription:
    '하루 24시간을 원형 시계처럼 시각화하는 무료 시간표 플래너. 방학 계획표·생활 계획표·하루 일과표·원형 시간표로 두루 쓰기 좋고, 회원가입·설치 없이 브라우저에서 바로 쓰며, 데이터는 기기에만 저장되어 오프라인에서도 동작합니다.',
  faq: [
    { q: '24Houring이 무엇인가요?', a: '24Houring은 하루 24시간을 원형 시계처럼 한눈에 보여주는 무료 웹 시간표 플래너입니다. 회원가입이나 설치 없이 브라우저에서 바로 사용하며, 데이터는 기기에만 저장되어 오프라인에서도 동작합니다.' },
    { q: '24Houring은 무료인가요?', a: '네. 핵심 플래너는 회원가입 없이 완전 무료로 사용할 수 있습니다. 클라우드 동기화·무제한 보관·통계 리포트·광고 제거가 필요하면 선택형 Pro 구독(월 $0.99, 1개월 무료 체험, 자동 갱신 없음)을 이용할 수 있습니다.' },
    { q: '12시간(시계) 보기로 바꿀 수 있나요?', a: '네. 상단 토글로 24시간 → 낮(06–18) → 밤(18–06) 12시간 보기를 전환할 수 있고, 모든 보기는 같은 하루 일정과 연동됩니다.' },
    { q: '만든 시간표를 저장하거나 공유할 수 있나요?', a: '네. PNG·PDF·JSON으로 내보내거나, 공유 버튼으로 시간표 이미지를 인스타그램 등에 바로 공유할 수 있습니다. 전체 백업·복원도 지원합니다.' },
    { q: '어떤 언어를 지원하나요?', a: '한국어, 영어, 독일어, 일본어, 중국어, 프랑스어, 스페인어, 러시아어 등 8개 언어를 지원합니다.' },
  ],
  howtoName: '24Houring으로 하루 시간표 만들기',
  howtoDescription: '원형 24시간 시간표에 하루 일정을 만드는 방법.',
  howto: [
    { name: '시작하기', text: '프리셋(학생·직장인 등)을 고르거나 빈 하루에서 시작합니다.' },
    { name: '일정 편집', text: '원을 클릭해 시간대를 나누고, 항목 이름·색·아이콘을 지정한 뒤 경계를 드래그해 시간을 조절합니다.' },
    { name: '저장·공유', text: 'PNG·PDF·JSON으로 내보내거나 공유 버튼으로 이미지를 공유합니다.' },
  ],
  mainHtml: `      <main style="max-width:760px;margin:0 auto;padding:40px 20px;font-family:'Pretendard',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2430;line-height:1.65">
        <h1 style="font-size:30px;font-weight:800;letter-spacing:-0.5px;margin:0 0 8px">24Houring — 하루를 한눈에, 24시간 원형 시간표 플래너</h1>
        <p style="font-size:17px;color:#3a4150;margin:0 0 20px">
          24Houring은 하루 24시간을 원형 시계처럼 시각화하는 <strong>무료</strong> 웹 시간표 플래너입니다.
          회원가입이나 설치 없이 브라우저에서 바로 사용하고, 데이터는 기기에만 저장되어 <strong>오프라인</strong>에서도 동작합니다.
        </p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">주요 기능</h2>
        <ul style="padding-left:20px;margin:0 0 8px">
          <li>24시간 원형 시간표와 12시간 시계 보기(낮 06–18 · 밤 18–06) 전환 — 모든 보기가 같은 하루와 연동</li>
          <li>드래그로 시간 조절, 클릭 한 번으로 시간대 분할·병합</li>
          <li>생활 패턴 프리셋과 여러 날짜(멀티데이) 시간표</li>
          <li>PNG·PDF·JSON 내보내기, 전체 백업·복원</li>
          <li>시간표를 이미지로 공유(인스타그램·카카오톡 등)</li>
          <li>8개 언어 지원, 오프라인 동작, 홈 화면에 설치 가능</li>
        </ul>

        <p style="font-size:15px;color:#3a4150;margin:8px 0 0">
          방학 계획표, 생활 계획표, 하루 일과표, 하루 실행표, 원형 시간표, 하루 시간표 등 다양한 용도로 활용할 수 있습니다.
        </p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">사용 방법</h2>
        <ol style="padding-left:20px;margin:0 0 8px">
          <li>프리셋을 고르거나 빈 하루에서 시작합니다.</li>
          <li>원을 클릭해 시간대를 나누고 이름·색·아이콘을 지정한 뒤, 경계를 드래그해 시간을 조절합니다.</li>
          <li>PNG·PDF·JSON으로 내보내거나 공유 버튼으로 이미지를 공유합니다.</li>
        </ol>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">자주 묻는 질문</h2>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">24Houring은 무료인가요?</h3>
        <p style="margin:0 0 8px">네. 핵심 플래너는 회원가입 없이 완전 무료입니다. 클라우드 동기화·무제한 보관·통계 리포트·광고 제거는 선택형 Pro 구독(월 $0.99, 1개월 무료 체험, 자동 갱신 없음)으로 제공됩니다.</p>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">12시간(시계) 보기로 바꿀 수 있나요?</h3>
        <p style="margin:0 0 8px">네. 상단 토글로 24시간 → 낮(06–18) → 밤(18–06)을 전환할 수 있고, 모든 보기는 같은 하루 일정과 연동됩니다.</p>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">만든 시간표를 저장·공유할 수 있나요?</h3>
        <p style="margin:0 0 8px">네. PNG·PDF·JSON으로 내보내거나, 공유 버튼으로 시간표 이미지를 인스타그램 등에 바로 공유할 수 있습니다.</p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">왜 원형 시간표인가요?</h2>
        <p style="margin:0 0 8px">하루는 직선이 아니라 원으로 돌아옵니다. 자정에서 자정으로 이어지는 원형 시계 위에 일정을 올리면, 막대형 목록에서는 잘 보이지 않던 <strong>수면과 기상의 균형, 비어 있는 시간, 겹치는 일정</strong>이 한눈에 드러납니다. 각 시간대가 차지하는 넓이가 곧 그 활동에 쓰는 시간의 비중이라, "계획"과 "실제"의 간극을 직관적으로 확인할 수 있습니다.</p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">이런 분께 좋아요</h2>
        <ul style="padding-left:20px;margin:0 0 8px">
          <li>방학·시험을 준비하는 <strong>학생</strong>과 자녀와 함께 계획을 짜는 부모</li>
          <li>낮·밤이 바뀌는 <strong>교대 근무자</strong>와 하루 경계를 스스로 그어야 하는 <strong>프리랜서·재택근무자</strong></li>
          <li>딥워크·집중 시간을 확보하려는 <strong>직장인</strong>, 아침·저녁 루틴을 다지려는 사람</li>
        </ul>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">이렇게 활용하세요</h2>
        <p style="margin:0 0 8px">처음이라면 상황별 <a href="/templates/">템플릿</a>(직장인·수험생·프리랜서·미라클모닝·주말 리셋 등)에서 시작해 나에게 맞게 고치는 것이 가장 빠릅니다. 시간을 어떻게 나눌지 막막하다면 <a href="/guides/time-blocking">타임블로킹</a>·<a href="/guides/time-audit">시간 점검(타임 오딧)</a>·<a href="/guides/morning-evening-routine">아침·저녁 루틴</a> 가이드가 방법을 단계별로 안내합니다.</p>

        <p style="margin:24px 0 0;font-size:15px;color:#7e8aa0">앱을 불러오는 중입니다… · <strong>24houring.com</strong></p>

        <hr style="border:none;border-top:1px solid #e3e6ec;margin:28px 0 14px" />
        <nav style="font-size:14px;color:#7e8aa0">
          <a href="/about" style="color:#7e8aa0;margin-right:14px">소개 · About</a>
          <a href="/privacy" style="color:#7e8aa0;margin-right:14px">개인정보처리방침 · Privacy</a>
          <a href="/contact" style="color:#7e8aa0">문의 · Contact</a>
          <div style="margin-top:8px">© 2026 Circloser · <a href="mailto:singlena@gmail.com" style="color:#7e8aa0">singlena@gmail.com</a></div>
        </nav>
      </main>`,
};
