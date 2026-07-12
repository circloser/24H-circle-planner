/**
 * Template gallery builder — the source of truth for /templates/*.
 *
 * For each template below it:
 *  1. encodes the schedule into a `#p=` import code (opens the app with a
 *     confirm-and-load dialog) and a `#d=` read-only view code,
 *  2. screenshots the chart via the /s viewer → public/templates/img/<slug>.png,
 *  3. writes a bilingual (KO/EN) static page public/templates/<slug>.html plus
 *     the hub public/templates/index.html (guides-style, reuses /guides/guide.css).
 *
 * Regenerate after editing:  node scripts/templates/build.mjs
 * (needs a fresh `npm run build` first — the screenshots load ./dist)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { launchPage, serveDist, wait } from '../e2e/_helpers.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'templates');
const IMG = join(OUT, 'img');

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// ─── Template definitions ─────────────────────────────────────────────────────
// slices: [start 'HH:MM', label, color, icon] — contiguous ring; ends come from
// the next slice's start (the last wraps to the first).

const TEMPLATES = [
  {
    slug: 'elementary-summer',
    name: '초등 여름방학 계획표',
    ko: {
      title: '초등학생 여름방학 생활계획표 템플릿',
      desc: '기상·공부·놀이·운동·취침의 균형을 잡은 초등학생 여름방학 하루 계획표. 원형 시간표로 한눈에 보고, 클릭 한 번으로 내 계획표로 가져와 수정할 수 있습니다.',
      tips: ['기상·취침 시간은 방학 내내 같게 유지하는 것이 계획표 절반의 성공입니다.', '오전 공부 블록(50분 공부+10분 휴식)을 아이 컨디션에 맞게 1~3개로 조절하세요.', '바깥놀이·운동은 더위를 피해 아침이나 해 질 무렵으로 옮겨도 좋습니다.'],
    },
    en: {
      title: 'Elementary Summer-Break Daily Planner Template',
      desc: 'A balanced summer-break day for elementary kids — wake, study, play, exercise, sleep. See it as a circle and import it into your own planner with one click.',
      tips: ['Keeping the same wake/sleep times all break is half the battle.', 'Adjust the morning study blocks (50 min study + 10 min rest) to 1–3 per day.', 'Move outdoor play to early morning or dusk to beat the heat.'],
    },
    related: ['vacation-study-planner'],
    slices: [
      ['07:30', '기상·세수', '#fbbf24', '🌅'],
      ['08:00', '아침밥', '#fca5a5', '🍚'],
      ['08:30', '오전 공부', '#93c5fd', '📚'],
      ['10:00', '자유놀이', '#86efac', '🧸'],
      ['12:00', '점심', '#fca5a5', '🍽️'],
      ['13:00', '독서·숙제', '#a5b4fc', '✏️'],
      ['14:30', '휴식·낮잠', '#ddd6fe', '😴'],
      ['15:30', '바깥놀이·운동', '#6ee7b7', '⚽'],
      ['17:30', '자유시간', '#fdba74', '🎨'],
      ['18:30', '저녁밥', '#fca5a5', '🍲'],
      ['19:30', '가족시간', '#f9a8d4', '👨‍👩‍👧'],
      ['21:00', '씻고 정리', '#a7f3d0', '🛁'],
      ['21:30', '수면', '#c7d2fe', '🌙'],
    ],
  },
  {
    slug: 'exam-student',
    name: '수험생 방학 공부 계획표',
    ko: {
      title: '수험생·중고생 방학 공부 계획표 템플릿',
      desc: '공부 블록 사이에 휴식과 운동을 끼워 하루 8시간 학습을 지속 가능하게 설계한 수험생 방학 계획표. 원형 시간표로 공부·휴식 균형이 한눈에 보입니다.',
      tips: ['공부는 "몇 시간"이 아니라 50분 블록 몇 개로 세세요 — 이 표는 하루 8블록입니다.', '가장 어려운 과목을 오전 첫 블록(뇌가 가장 맑을 때)에 두세요.', '운동 30분이 오후 집중력을 살립니다. 아깝다고 빼지 마세요.'],
    },
    en: {
      title: 'Exam-Prep Study Planner Template (School Break)',
      desc: 'A sustainable 8-hour study day for exam students — focus blocks with rest and exercise between them, visible at a glance on the circle.',
      tips: ['Count study in 50-minute blocks, not hours — this day has 8 blocks.', 'Put the hardest subject in the first morning block, when your head is clearest.', '30 minutes of exercise revives afternoon focus — don’t cut it.'],
    },
    related: ['vacation-study-planner', 'daily-planning-basics'],
    slices: [
      ['07:00', '기상·아침', '#fbbf24', '🌅'],
      ['08:00', '공부 1·2교시', '#93c5fd', '📘'],
      ['10:00', '휴식', '#ddd6fe', '☕'],
      ['10:20', '공부 3교시', '#93c5fd', '📗'],
      ['12:30', '점심·산책', '#fca5a5', '🍽️'],
      ['14:00', '공부 4·5교시', '#a5b4fc', '📙'],
      ['16:30', '운동', '#6ee7b7', '🏃'],
      ['18:00', '저녁', '#fca5a5', '🍲'],
      ['19:00', '인강·문제풀이', '#93c5fd', '💻'],
      ['21:00', '오답·복습', '#fdba74', '📝'],
      ['22:30', '정리·회고', '#a7f3d0', '🌙'],
      ['23:00', '수면', '#c7d2fe', '😴'],
    ],
  },
  {
    slug: 'office-worker',
    name: '직장인 하루 일과표',
    ko: {
      title: '직장인 하루 일과표 템플릿 (저녁 운동형)',
      desc: '출퇴근·업무·저녁 운동·가족 시간까지, 무너지지 않는 직장인 하루 일과표. 고정 일정을 먼저 그리고 남는 시간을 확인하는 원형 시간표 방식입니다.',
      tips: ['오전 업무 첫 90분을 "방해 금지 집중 블록"으로 지키면 하루 성과의 대부분이 나옵니다.', '퇴근 후 운동은 "장소 이동"과 묶으면(퇴근길 헬스장) 빠지기 어렵습니다.', '내일 준비 15분이 다음 날 아침의 결정 피로를 없애 줍니다.'],
    },
    en: {
      title: 'Office Worker Daily Routine Template (Evening Workout)',
      desc: 'A daily routine that survives real life — commute, work, an evening workout, and family time, drawn as a circle so the fixed anchors come first.',
      tips: ['Protect the first 90 minutes of the morning as a no-interruption focus block.', 'Chain the workout to the commute (gym on the way home) so it’s hard to skip.', '15 minutes of prep for tomorrow removes next-morning decision fatigue.'],
    },
    related: ['daily-life-planner', 'time-blocking'],
    slices: [
      ['06:30', '기상·아침 루틴', '#fbbf24', '🌅'],
      ['07:30', '준비·출근', '#d1d5db', '🚌'],
      ['09:00', '오전 집중 업무', '#93c5fd', '💼'],
      ['12:00', '점심·산책', '#fca5a5', '🍽️'],
      ['13:00', '오후 업무·회의', '#a5b4fc', '🗂️'],
      ['18:00', '퇴근', '#d1d5db', '🚇'],
      ['19:00', '운동', '#6ee7b7', '💪'],
      ['20:00', '저녁', '#fca5a5', '🍲'],
      ['21:00', '가족·휴식', '#f9a8d4', '🏠'],
      ['22:30', '정리·내일 준비', '#a7f3d0', '📝'],
      ['23:00', '수면', '#c7d2fe', '🌙'],
    ],
  },
  {
    slug: 'miracle-morning',
    name: '미라클모닝 계획표',
    ko: {
      title: '미라클모닝 생활 계획표 템플릿 (5시 기상)',
      desc: '5시 기상 → 명상·독서·운동으로 하루를 여는 미라클모닝 생활 계획표. 핵심은 이른 기상이 아니라 22시 취침 — 원형 시간표로 수면 시간부터 확보하세요.',
      tips: ['미라클모닝의 성패는 기상이 아니라 취침 시간입니다. 22시 취침을 먼저 지키세요.', '새벽 시간은 "나를 위한 일"(독서·운동·글쓰기)에만 쓰세요. 업무를 당겨오면 그냥 야근입니다.', '주말에도 기상 시간을 1시간 이상 늦추지 않아야 리듬이 유지됩니다.'],
    },
    en: {
      title: 'Miracle Morning Routine Template (5 AM Wake-up)',
      desc: 'Open the day at 5 AM with meditation, reading, and exercise. The real key is the 10 PM bedtime — secure sleep first on the circle.',
      tips: ['The miracle morning is won at bedtime, not wake-up. Protect 10 PM first.', 'Spend dawn hours only on yourself (reading, exercise, writing) — pulling work forward is just overtime.', 'Keep weekend wake-ups within an hour of weekdays to hold the rhythm.'],
    },
    related: ['morning-evening-routine', 'daily-life-planner'],
    slices: [
      ['05:00', '기상·물 한 잔', '#fbbf24', '⏰'],
      ['05:15', '명상·스트레칭', '#ddd6fe', '🧘'],
      ['05:45', '독서·글쓰기', '#93c5fd', '📖'],
      ['06:45', '운동', '#6ee7b7', '🏃'],
      ['07:30', '샤워·아침', '#fca5a5', '🍳'],
      ['08:30', '오전 업무', '#a5b4fc', '💼'],
      ['12:00', '점심', '#fca5a5', '🍽️'],
      ['13:00', '오후 업무', '#93c5fd', '🗂️'],
      ['18:00', '저녁·휴식', '#f9a8d4', '🍲'],
      ['20:00', '자기계발·취미', '#fdba74', '🎯'],
      ['21:30', '정리·내일 준비', '#a7f3d0', '🌙'],
      ['22:00', '수면', '#c7d2fe', '😴'],
    ],
  },
  {
    slug: 'freelancer-remote',
    name: '프리랜서 재택 시간표',
    ko: {
      title: '프리랜서·재택근무 하루 시간표 템플릿',
      desc: '일과 휴식의 경계가 무너지기 쉬운 재택근무를 위한 하루 시간표. "일 끝나는 시각"을 정식 일정으로 넣은 것이 핵심입니다.',
      tips: ['재택의 최대 적은 무한 근무입니다. 18시 "마감·정리"를 지키세요.', '오전 집중 블록엔 알림을 끄고 연락은 11시 반 이후로 몰아서 처리하세요.', '점심 산책 20분이 오후 능률을 좌우합니다 — 책상에서 먹지 마세요.'],
    },
    en: {
      title: 'Freelancer / Remote-Work Daily Timetable Template',
      desc: 'A remote-work day where work and rest keep their boundary — the "work ends here" slot is a formal part of the schedule.',
      tips: ['The biggest enemy of remote work is endless work. Keep the 6 PM wrap-up.', 'Silence notifications during the morning focus block; batch messages after 11:30.', 'A 20-minute lunch walk decides the afternoon — don’t eat at your desk.'],
    },
    related: ['daily-life-planner', 'deep-work-focus'],
    slices: [
      ['07:30', '기상·아침 루틴', '#fbbf24', '🌅'],
      ['08:30', '집중 작업 1', '#93c5fd', '🎧'],
      ['11:30', '이메일·연락', '#d1d5db', '📮'],
      ['12:30', '점심·산책', '#fca5a5', '🥗'],
      ['14:00', '집중 작업 2', '#a5b4fc', '💻'],
      ['16:30', '운동', '#6ee7b7', '🏋️'],
      ['18:00', '마감·정리', '#fdba74', '✅'],
      ['19:00', '저녁', '#fca5a5', '🍲'],
      ['20:00', '개인 시간', '#f9a8d4', '🎬'],
      ['22:00', '저녁 루틴', '#a7f3d0', '🌙'],
      ['23:00', '수면', '#c7d2fe', '😴'],
    ],
  },
  {
    slug: 'weekend-reset',
    name: '주말 재충전 계획표',
    ko: {
      title: '주말 하루 계획표 템플릿 (재충전형)',
      desc: '늦잠은 자되 하루를 통째로 흘려보내지 않는 주말 계획표. 집안일·취미·산책·다음 주 준비까지, 쉬면서도 남는 게 있는 하루입니다.',
      tips: ['주말 기상이 평일보다 2시간 이상 늦으면 월요일이 힘들어집니다. 1시간 이내로.', '집안일은 오전에 90분으로 묶어 끝내면 오후가 통째로 자유로워집니다.', '일요일 저녁 30분 "다음 주 준비"가 월요일 아침을 바꿉니다.'],
    },
    en: {
      title: 'Weekend Day Planner Template (Recharge)',
      desc: 'Sleep in without losing the whole day — chores, hobbies, a walk, and next-week prep, so the weekend rests you and still leaves something behind.',
      tips: ['Keep weekend wake-up within an hour of weekdays, or Monday will hurt.', 'Batch chores into one 90-minute morning block and the afternoon is fully yours.', '30 minutes of next-week prep on Sunday evening transforms Monday morning.'],
    },
    related: ['daily-life-planner', 'morning-evening-routine'],
    slices: [
      ['08:30', '늦잠·기상', '#fbbf24', '☀️'],
      ['09:00', '브런치', '#fca5a5', '🥞'],
      ['10:30', '집안일·정리', '#a7f3d0', '🧺'],
      ['12:00', '취미', '#fdba74', '🎨'],
      ['14:00', '외출·산책', '#6ee7b7', '🚶'],
      ['17:00', '자유시간', '#f9a8d4', '🎮'],
      ['18:30', '저녁', '#fca5a5', '🍲'],
      ['20:00', '영화·휴식', '#a5b4fc', '🎬'],
      ['22:30', '다음 주 준비', '#93c5fd', '📝'],
      ['23:00', '수면', '#c7d2fe', '🌙'],
    ],
  },
];

// ─── Encoding (mirrors src/lib/share-link.ts) ────────────────────────────────

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const payload = (t) => ({ v: 1, n: t.name, s: t.slices.map(([st, l, c, i]) => [hm(st), l, c, i]) });
const importCode = (t) => b64url(JSON.stringify(payload(t)));
const viewCode = (t) => b64url(JSON.stringify(payload(t)));

// ─── Page shell (guides-style, bilingual) ────────────────────────────────────

const NAV_FOOT = `
  <footer class="site">
    <nav>
      <a href="/"><span class="lang-ko">홈 Home</span><span class="lang-en">Home</span></a>
      <a href="/templates/"><span class="lang-ko">템플릿 Templates</span><span class="lang-en">Templates</span></a>
      <a href="/guides/"><span class="lang-ko">가이드 Guides</span><span class="lang-en">Guides</span></a>
      <a href="/stories/"><span class="lang-ko">스토리 Stories</span><span class="lang-en">Stories</span></a>
      <a href="/health/"><span class="lang-ko">건강 Health</span><span class="lang-en">Health</span></a>
      <a href="/faq"><span class="lang-ko">FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/privacy"><span class="lang-ko">개인정보처리방침 Privacy</span><span class="lang-en">Privacy</span></a>
      <a href="/terms"><span class="lang-ko">이용약관 Terms</span><span class="lang-en">Terms</span></a>
      <a href="/contact"><span class="lang-ko">문의 Contact</span><span class="lang-en">Contact</span></a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;

const LANG_SCRIPT = `<script>
(function(){try{var o=localStorage.getItem('24h-guides-lang');var l=o;if(!l){var r=localStorage.getItem('24h-circle-planner.prefs');if(r){var p=JSON.parse(r);l=p&&p.prefs&&p.prefs.language;}}if(!l){l=(navigator.language||'ko').slice(0,2);}if(l&&l.toLowerCase()!=='ko'){document.documentElement.classList.add('show-en');}}catch(e){}})();
function setGuideLang(l){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}document.documentElement.classList.toggle('show-en',l!=='ko');}
</${'script'}>`;

const HEAD_NAV = `
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/templates/"><span class="lang-ko">템플릿</span><span class="lang-en">Templates</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>`;

function shell({ title, desc, canonical, ogImage, jsonld, body }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6947130056543786" crossorigin="anonymous"></${'script'}>
${jsonld}
${LANG_SCRIPT}
</head>
<body>
<div class="wrap">${HEAD_NAV}
  <main class="article">
${body}
  </main>${NAV_FOOT}
</div>
</body>
</html>
`;
}

const fmtHM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function schedList(t) {
  const s = t.slices.map(([st, l, , i]) => ({ start: hm(st), label: l, icon: i }));
  return s.map((sl, idx) => {
    const end = s[(idx + 1) % s.length].start;
    return `      <li><strong>${fmtHM(sl.start)}–${fmtHM(end)}</strong> ${sl.icon} ${sl.label}</li>`;
  }).join('\n');
}

function templatePage(t) {
  const canonical = `https://24houring.com/templates/${t.slug}`;
  const img = `https://24houring.com/templates/img/${t.slug}.png`;
  const p = importCode(t);
  const d = viewCode(t);
  const jsonld = `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Article',
  headline: t.ko.title, description: t.ko.desc, inLanguage: ['ko', 'en'],
  image: img, datePublished: '2026-07-12', dateModified: '2026-07-12',
  author: { '@type': 'Organization', name: '24Houring', url: 'https://24houring.com/' },
  publisher: { '@type': 'Organization', name: '24Houring', url: 'https://24houring.com/' },
  mainEntityOfPage: canonical,
}, null, 1)}
</${'script'}>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '템플릿', item: 'https://24houring.com/templates/' },
    { '@type': 'ListItem', position: 2, name: t.ko.title, item: canonical },
  ],
}, null, 1)}
</${'script'}>`;

  const tipsKo = t.ko.tips.map((x) => `      <li>${x}</li>`).join('\n');
  const tipsEn = t.en.tips.map((x) => `      <li>${x}</li>`).join('\n');
  const relatedKo = t.related.map((r) => `<a href="/guides/${r}">관련 가이드</a>`).join(' · ');

  const body = `    <p class="crumb"><a href="/templates/"><span class="lang-ko">← 템플릿 목록</span><span class="lang-en">← All templates</span></a></p>
    <div class="lang-ko">
    <h1>${t.ko.title}</h1>
    <p class="lead">${t.ko.desc}</p>
    </div>
    <div class="lang-en">
    <h1>${t.en.title}</h1>
    <p class="lead">${t.en.desc}</p>
    </div>

    <p style="text-align:center;margin:18px 0">
      <img src="/templates/img/${t.slug}.png" alt="${t.ko.title} — 24시간 원형 시간표" width="520" style="max-width:100%;height:auto;border-radius:16px" loading="lazy" />
    </p>

    <p style="text-align:center;margin:0 0 6px">
      <a class="btn" href="/#p=${p}"><span class="lang-ko">이 계획표로 바로 시작하기 →</span><span class="lang-en">Start with this template →</span></a>
    </p>
    <p style="text-align:center;margin:0 0 22px;font-size:13px">
      <a href="/s#d=${d}" style="color:#6b7280"><span class="lang-ko">읽기 전용으로 미리보기</span><span class="lang-en">Read-only preview</span></a>
      <span style="color:#9aa3b2"> · </span>
      <span style="color:#9aa3b2"><span class="lang-ko">가져온 뒤 드래그로 자유롭게 수정할 수 있어요</span><span class="lang-en">Fully editable after import</span></span>
    </p>

    <div class="lang-ko">
    <h2>시간표 구성</h2>
    <ul>
${schedList(t)}
    </ul>
    <h2>활용 팁</h2>
    <ul>
${tipsKo}
    </ul>
    <p>${relatedKo} · <a href="/guides/24-hour-circle-method">원형 시간표 활용법</a></p>
    </div>
    <div class="lang-en">
    <h2>The schedule</h2>
    <ul>
${schedList(t)}
    </ul>
    <h2>Tips</h2>
    <ul>
${tipsEn}
    </ul>
    </div>

    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>내 하루에 맞게 고쳐 쓰세요</strong></p>
        <p style="margin:0">버튼 한 번으로 24Houring에 불러와 드래그로 시간을 조절하고, 이미지로 저장·공유할 수 있습니다. 무료, 설치·회원가입 없음.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/#p=${p}">템플릿 불러오기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Make it yours</strong></p>
        <p style="margin:0">One click loads it into 24Houring — drag to adjust, then save or share as an image. Free, no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/#p=${p}">Load the template →</a></p>
      </div>
    </div>`;

  return shell({ title: `${t.ko.title} · 24Houring`, desc: t.ko.desc, canonical, ogImage: img, jsonld, body });
}

function hubPage() {
  const cards = TEMPLATES.map((t) => `      <a class="gcard" href="/templates/${t.slug}">
        <img src="/templates/img/${t.slug}.png" alt="${t.ko.title}" width="240" style="width:100%;height:auto;border-radius:10px;margin-bottom:8px" loading="lazy" />
        <h3><span class="lang-ko">${t.ko.title}</span><span class="lang-en">${t.en.title}</span></h3>
        <p><span class="lang-ko">${t.ko.desc.split('.')[0]}.</span><span class="lang-en">${t.en.desc.split('.')[0]}.</span></p>
      </a>`).join('\n');

  const jsonld = `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: '원형 시간표 템플릿 모음', url: 'https://24houring.com/templates/',
  description: '방학 계획표·생활 계획표·하루 일과표 템플릿을 원형 시간표로 미리 보고, 클릭 한 번으로 가져와 수정하세요.',
  inLanguage: ['ko', 'en'],
}, null, 1)}
</${'script'}>`;

  const body = `    <h1><span class="lang-ko">원형 시간표 템플릿</span><span class="lang-en">Circular Timetable Templates</span></h1>
    <p class="lead"><span class="lang-ko">방학 계획표·생활 계획표·하루 일과표를 원형 시간표로 미리 보고, "바로 시작" 버튼 한 번으로 내 플래너에 불러와 자유롭게 수정하세요. 모두 무료입니다.</span><span class="lang-en">Preview vacation planners, daily routines, and day schedules as circles, then load any of them into your own planner with one click — all free.</span></p>

    <div class="grid">
${cards}
    </div>

    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>빈 하루에서 직접 시작할 수도 있어요</strong></p>
        <p style="margin:0">템플릿 없이 나만의 원형 시간표를 그리고 싶다면 지금 바로 시작하세요. 설치·회원가입 없이 무료입니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Or start from a blank day</strong></p>
        <p style="margin:0">Draw your own circular timetable from scratch — free, no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

  return shell({
    title: '원형 시간표 템플릿 — 방학 계획표·생활 계획표·하루 일과표 · 24Houring',
    desc: '방학 계획표, 생활 계획표, 하루 일과표, 미라클모닝, 직장인·수험생·프리랜서 하루 시간표 템플릿 모음. 원형 시간표로 미리 보고 클릭 한 번으로 가져와 수정하세요.',
    canonical: 'https://24houring.com/templates/',
    ogImage: `https://24houring.com/templates/img/${TEMPLATES[0].slug}.png`,
    jsonld, body,
  });
}

// ─── Screenshots via the /s read-only viewer ─────────────────────────────────

async function screenshots() {
  const { base, close } = await serveDist();
  const { browser, page } = await launchPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  try {
    for (const t of TEMPLATES) {
      await page.goto('about:blank');
      await page.goto(`${base}/s#d=${viewCode(t)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await wait(700); // fonts settle
      const el = page.locator('svg[role="img"]').first();
      await el.screenshot({ path: join(IMG, `${t.slug}.png`) });
      console.log(`shot  ${t.slug}.png`);
    }
  } finally {
    await browser.close();
    close();
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

mkdirSync(IMG, { recursive: true });
await screenshots();
for (const t of TEMPLATES) {
  writeFileSync(join(OUT, `${t.slug}.html`), templatePage(t));
  console.log(`page  ${t.slug}.html`);
}
writeFileSync(join(OUT, 'index.html'), hubPage());
console.log('page  index.html');
console.log(`done — ${TEMPLATES.length} templates`);
