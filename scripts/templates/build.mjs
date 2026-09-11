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
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { launchPage, serveDist, wait } from '../e2e/_helpers.mjs';
import deTpl from './i18n/de.mjs';
import jaTpl from './i18n/ja.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'templates');
const IMG = join(OUT, 'img');
const ORIGIN = 'https://24houring.com';
// Localized template routes (/{loc}/templates/…) beyond the ko/en default page.
const LOCALES = { de: deTpl, ja: jaTpl };

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// ─── Template definitions ─────────────────────────────────────────────────────
// slices: [start 'HH:MM', label, color, icon] — contiguous ring; ends come from
// the next slice's start (the last wraps to the first).

const TEMPLATES = [
  {
    "slug": "elementary-summer",
    "name": "초등 여름방학 계획표",
    "ko": {
      "title": "초등학생 여름방학 생활계획표 템플릿",
      "desc": "방학 중 공부·놀이·돌봄 시간을 배치해 보는 예시입니다. 실제 학교 일정과 가족 사정에 맞춰 바꾸세요.",
      "tips": [
        "이동·식사 준비 시간도 블록에 포함하세요.",
        "공부 구간 안에 필요한 휴식을 직접 추가하세요.",
        "아이와 함께 남길 활동과 줄일 활동을 정하세요."
      ]
    },
    "en": {
      "title": "Elementary Summer-Break Daily Planner Template",
      "desc": "This example places study, play and care in a school-break day. Adapt it to school commitments and your household.",
      "tips": [
        "Include travel and meal preparation in the blocks.",
        "Add the breaks needed inside each study period.",
        "Choose activities to keep or shorten together with the child."
      ]
    },
    "related": [
      "vacation-study-planner"
    ],
    "slices": [
      [
        "07:30",
        "기상·세수",
        "#fbbf24",
        "🌅"
      ],
      [
        "08:00",
        "아침밥",
        "#fca5a5",
        "🍚"
      ],
      [
        "08:30",
        "오전 공부",
        "#93c5fd",
        "📚"
      ],
      [
        "10:00",
        "자유놀이",
        "#86efac",
        "🧸"
      ],
      [
        "12:00",
        "점심",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:00",
        "독서·숙제",
        "#a5b4fc",
        "✏️"
      ],
      [
        "14:30",
        "휴식·낮잠",
        "#ddd6fe",
        "😴"
      ],
      [
        "15:30",
        "바깥놀이·운동",
        "#6ee7b7",
        "⚽"
      ],
      [
        "17:30",
        "자유시간",
        "#fdba74",
        "🎨"
      ],
      [
        "18:30",
        "저녁밥",
        "#fca5a5",
        "🍲"
      ],
      [
        "19:30",
        "가족시간",
        "#f9a8d4",
        "👨‍👩‍👧"
      ],
      [
        "21:00",
        "씻고 정리",
        "#a7f3d0",
        "🛁"
      ],
      [
        "21:30",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  },
  {
    "slug": "exam-student",
    "name": "수험생 방학 공부 계획표",
    "ko": {
      "title": "수험생·중고생 방학 공부 계획표 템플릿",
      "desc": "공부와 생활 일정을 비교하기 위한 수험생 예시입니다. 표시된 공부 구간은 휴식이 세분화되지 않은 예약 시간이며 권장 학습량이 아닙니다.",
      "tips": [
        "과목명 대신 이번 구간에서 풀 문제나 읽을 범위를 적으세요.",
        "긴 공부 구간을 나누고 휴식과 식사를 먼저 확인하세요.",
        "실제로 끝낸 분량을 기록한 뒤 다음 날 배정을 줄이거나 늘리세요."
      ]
    },
    "en": {
      "title": "Exam-Prep Study Planner Template (School Break)",
      "desc": "An exam-preparation example for comparing study with daily commitments. Study periods are reserved time without detailed breaks, not a recommended workload.",
      "tips": [
        "Name the questions or pages for each period.",
        "Split long periods and check breaks and meals first.",
        "Record completed work before adjusting the next day."
      ]
    },
    "related": [
      "vacation-study-planner",
      "daily-planning-basics"
    ],
    "slices": [
      [
        "07:00",
        "기상·아침",
        "#fbbf24",
        "🌅"
      ],
      [
        "08:00",
        "공부 1·2교시",
        "#93c5fd",
        "📘"
      ],
      [
        "10:00",
        "휴식",
        "#ddd6fe",
        "☕"
      ],
      [
        "10:20",
        "공부 3교시",
        "#93c5fd",
        "📗"
      ],
      [
        "12:30",
        "점심·산책",
        "#fca5a5",
        "🍽️"
      ],
      [
        "14:00",
        "공부 4·5교시",
        "#a5b4fc",
        "📙"
      ],
      [
        "16:30",
        "운동",
        "#6ee7b7",
        "🏃"
      ],
      [
        "18:00",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "19:00",
        "인강·문제풀이",
        "#93c5fd",
        "💻"
      ],
      [
        "21:00",
        "오답·복습",
        "#fdba74",
        "📝"
      ],
      [
        "22:30",
        "정리·회고",
        "#a7f3d0",
        "🌙"
      ],
      [
        "23:00",
        "수면",
        "#c7d2fe",
        "😴"
      ]
    ]
  },
  {
    "slug": "office-worker",
    "name": "직장인 하루 일과표",
    "ko": {
      "title": "직장인 하루 일과표 템플릿 (저녁 운동형)",
      "desc": "출퇴근·업무·저녁 활동을 함께 표시한 가상 직장인 일정입니다. 실제 근무 조건과 이동 시간부터 바꾸세요.",
      "tips": [
        "회의와 응답 의무가 있는 시간은 집중 작업과 구분하세요.",
        "운동을 남긴다면 이동·준비·씻는 시간도 계산하세요.",
        "퇴근이 늦어지면 저녁 항목 중 옮길 일을 하나 정하세요."
      ]
    },
    "en": {
      "title": "Office Worker Daily Routine Template (Evening Workout)",
      "desc": "An illustrative employee schedule showing commuting, work and evening activities. Change working hours and travel first.",
      "tips": [
        "Distinguish meetings and response duties from focused tasks.",
        "Allow travel, preparation and washing time for exercise.",
        "Choose one evening item to move if work finishes late."
      ]
    },
    "related": [
      "daily-life-planner",
      "time-blocking"
    ],
    "slices": [
      [
        "06:30",
        "기상·아침 루틴",
        "#fbbf24",
        "🌅"
      ],
      [
        "07:30",
        "준비·출근",
        "#d1d5db",
        "🚌"
      ],
      [
        "09:00",
        "오전 집중 업무",
        "#93c5fd",
        "💼"
      ],
      [
        "12:00",
        "점심·산책",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:00",
        "오후 업무·회의",
        "#a5b4fc",
        "🗂️"
      ],
      [
        "18:00",
        "퇴근",
        "#d1d5db",
        "🚇"
      ],
      [
        "19:00",
        "운동",
        "#6ee7b7",
        "💪"
      ],
      [
        "20:00",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "21:00",
        "가족·휴식",
        "#f9a8d4",
        "🏠"
      ],
      [
        "22:30",
        "정리·내일 준비",
        "#a7f3d0",
        "📝"
      ],
      [
        "23:00",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  },
  {
    "slug": "miracle-morning",
    "name": "미라클모닝 계획표",
    "ko": {
      "title": "미라클모닝 생활 계획표 템플릿 (5시 기상)",
      "desc": "오전 5시에 시작하는 가상 일정입니다. 이른 기상이 더 좋은 계획이라는 뜻은 아니며 수면과 의무 일정에 맞춰 전체 시간을 옮길 수 있습니다.",
      "tips": [
        "이 예시의 수면 구간은 22시부터 5시까지 7시간입니다. 개인에게 적합한 목표를 제시하는 값은 아닙니다.",
        "아침 활동은 한 가지부터 남기고 나머지는 선택 항목으로 두세요.",
        "취침을 앞당길 수 없다면 기상만 앞당기지 말고 예시 시간을 바꾸세요."
      ]
    },
    "en": {
      "title": "Miracle Morning Routine Template (5 AM Wake-up)",
      "desc": "An illustrative day starting at 5 AM. An earlier start is not a better plan by itself; shift the whole schedule to fit sleep and commitments.",
      "tips": [
        "The example reserves seven hours from 10 PM to 5 AM; this is not an individual sleep target.",
        "Keep one morning activity and make the rest optional.",
        "If bedtime cannot move earlier, change the example instead of only moving wake-up."
      ]
    },
    "related": [
      "morning-evening-routine",
      "daily-life-planner"
    ],
    "slices": [
      [
        "05:00",
        "기상·물 한 잔",
        "#fbbf24",
        "⏰"
      ],
      [
        "05:15",
        "명상·스트레칭",
        "#ddd6fe",
        "🧘"
      ],
      [
        "05:45",
        "독서·글쓰기",
        "#93c5fd",
        "📖"
      ],
      [
        "06:45",
        "운동",
        "#6ee7b7",
        "🏃"
      ],
      [
        "07:30",
        "샤워·아침",
        "#fca5a5",
        "🍳"
      ],
      [
        "08:30",
        "오전 업무",
        "#a5b4fc",
        "💼"
      ],
      [
        "12:00",
        "점심",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:00",
        "오후 업무",
        "#93c5fd",
        "🗂️"
      ],
      [
        "18:00",
        "저녁·휴식",
        "#f9a8d4",
        "🍲"
      ],
      [
        "20:00",
        "자기계발·취미",
        "#fdba74",
        "🎯"
      ],
      [
        "21:30",
        "정리·내일 준비",
        "#a7f3d0",
        "🌙"
      ],
      [
        "22:00",
        "수면",
        "#c7d2fe",
        "😴"
      ]
    ]
  },
  {
    "slug": "freelancer-remote",
    "name": "프리랜서 재택 시간표",
    "ko": {
      "title": "프리랜서·재택근무 하루 시간표 템플릿",
      "desc": "작업·연락·마감을 구분한 재택근무 예시입니다. 고객이나 팀과 합의한 연락 가능 시간을 우선 반영하세요.",
      "tips": [
        "긴 집중 구간 안에도 쉬는 시간을 따로 넣으세요.",
        "연락을 모아 처리하려면 긴급 연락 경로를 먼저 합의하세요.",
        "마감 때 남은 일과 다음 시작 위치를 짧게 기록하세요."
      ]
    },
    "en": {
      "title": "Freelancer / Remote-Work Daily Timetable Template",
      "desc": "A remote-work example separating tasks, communication and wrap-up. Start with availability agreed with clients or your team.",
      "tips": [
        "Add breaks inside long focus periods.",
        "Agree an urgent contact route before batching messages.",
        "At wrap-up, note unfinished work and where to restart."
      ]
    },
    "related": [
      "daily-life-planner",
      "deep-work-focus"
    ],
    "slices": [
      [
        "07:30",
        "기상·아침 루틴",
        "#fbbf24",
        "🌅"
      ],
      [
        "08:30",
        "집중 작업 1",
        "#93c5fd",
        "🎧"
      ],
      [
        "11:30",
        "이메일·연락",
        "#d1d5db",
        "📮"
      ],
      [
        "12:30",
        "점심·산책",
        "#fca5a5",
        "🥗"
      ],
      [
        "14:00",
        "집중 작업 2",
        "#a5b4fc",
        "💻"
      ],
      [
        "16:30",
        "운동",
        "#6ee7b7",
        "🏋️"
      ],
      [
        "18:00",
        "마감·정리",
        "#fdba74",
        "✅"
      ],
      [
        "19:00",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "20:00",
        "개인 시간",
        "#f9a8d4",
        "🎬"
      ],
      [
        "22:00",
        "저녁 루틴",
        "#a7f3d0",
        "🌙"
      ],
      [
        "23:00",
        "수면",
        "#c7d2fe",
        "😴"
      ]
    ]
  },
  {
    "slug": "weekend-reset",
    "name": "주말 재충전 계획표",
    "ko": {
      "title": "주말 하루 계획표 템플릿 (재충전형)",
      "desc": "집안일·외출·휴식을 배치한 가상 주말입니다. 쉬는 시간을 성과로 평가할 필요 없이 원하는 활동에 맞게 수정하세요.",
      "tips": [
        "집안일이 끝나지 않을 때 넘길 항목을 정하세요.",
        "외출 구간에 왕복 이동을 포함하세요.",
        "다음 주 준비가 필요 없다면 해당 구간을 비워 두세요."
      ]
    },
    "en": {
      "title": "Weekend Day Planner Template (Recharge)",
      "desc": "An illustrative weekend with chores, outings and rest. Adapt it to preferred activities without treating rest as an achievement to measure.",
      "tips": [
        "Choose which chores can wait if time runs out.",
        "Include return travel in the outing period.",
        "Leave next-week preparation empty if you do not need it."
      ]
    },
    "related": [
      "daily-life-planner",
      "morning-evening-routine"
    ],
    "slices": [
      [
        "08:30",
        "늦잠·기상",
        "#fbbf24",
        "☀️"
      ],
      [
        "09:00",
        "브런치",
        "#fca5a5",
        "🥞"
      ],
      [
        "10:30",
        "집안일·정리",
        "#a7f3d0",
        "🧺"
      ],
      [
        "12:00",
        "취미",
        "#fdba74",
        "🎨"
      ],
      [
        "14:00",
        "외출·산책",
        "#6ee7b7",
        "🚶"
      ],
      [
        "17:00",
        "자유시간",
        "#f9a8d4",
        "🎮"
      ],
      [
        "18:30",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "20:00",
        "영화·휴식",
        "#a5b4fc",
        "🎬"
      ],
      [
        "22:30",
        "다음 주 준비",
        "#93c5fd",
        "📝"
      ],
      [
        "23:00",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  },
  {
    "slug": "college-student",
    "name": "대학생 하루 시간표",
    "ko": {
      "title": "대학생 하루 시간표 템플릿 (강의·공강·알바)",
      "desc": "강의·이동·과제·아르바이트를 함께 그린 대학생 예시입니다. 공강 전체를 공부로 채울 필요는 없습니다.",
      "tips": [
        "실제 시간표와 근무표를 먼저 입력하세요.",
        "공강에서 이동·식사 시간을 뺀 뒤 할 일을 정하세요.",
        "팀 과제는 다른 구성원과 확정한 시간만 고정하세요."
      ]
    },
    "en": {
      "title": "College Student Daily Timetable Template",
      "desc": "A student example combining lectures, travel, assignments and a part-time job. Gaps do not all need to become study time.",
      "tips": [
        "Enter confirmed classes and job shifts first.",
        "Subtract travel and meals before assigning work to a gap.",
        "Fix group-work times only after agreeing with others."
      ]
    },
    "related": [
      "exam-student",
      "daily-planning-basics"
    ],
    "slices": [
      [
        "07:30",
        "기상·준비",
        "#fbbf24",
        "🌅"
      ],
      [
        "08:30",
        "등교·이동",
        "#a7f3d0",
        "🚌"
      ],
      [
        "09:00",
        "오전 강의",
        "#93c5fd",
        "🎓"
      ],
      [
        "11:00",
        "공강 자습",
        "#a5b4fc",
        "📖"
      ],
      [
        "12:30",
        "점심",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:30",
        "오후 강의",
        "#7dd3fc",
        "🎓"
      ],
      [
        "16:00",
        "과제·팀플",
        "#fdba74",
        "💻"
      ],
      [
        "18:00",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "19:00",
        "알바",
        "#f9a8d4",
        "💼"
      ],
      [
        "22:00",
        "복습·자유",
        "#6ee7b7",
        "🎧"
      ],
      [
        "23:30",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  },
  {
    "slug": "shift-worker",
    "name": "교대근무 생활계획표",
    "ko": {
      "title": "교대근무자 생활계획표 템플릿 (야간 근무)",
      "desc": "자정을 넘는 야간 근무를 표시하는 편집 예시입니다. 수면 조정이나 건강 관리를 위한 처방이 아닙니다.",
      "tips": [
        "근무가 자정 전후 두 구간으로 보이는지 확인하세요.",
        "퇴근 이동과 돌봄 등 실제 의무를 먼저 반영하세요.",
        "수면 구간은 개인 상황에 맞춰 조정하고 지속적인 어려움은 의료진과 상의하세요."
      ]
    },
    "en": {
      "title": "Shift Worker Daily Planner Template (Night Shift)",
      "desc": "An editing example for a night shift crossing midnight. It does not prescribe sleep changes or health management.",
      "tips": [
        "Check that work appears on both sides of midnight.",
        "Enter real obligations such as the journey home and care duties.",
        "Adapt sleep to your circumstances and discuss persistent difficulties with a clinician."
      ]
    },
    "related": [
      "daily-life-planner",
      "morning-evening-routine"
    ],
    "slices": [
      [
        "00:00",
        "야간 근무",
        "#818cf8",
        "🏭"
      ],
      [
        "06:00",
        "퇴근·이동",
        "#a7f3d0",
        "🚗"
      ],
      [
        "07:00",
        "아침·씻기",
        "#fca5a5",
        "🛁"
      ],
      [
        "08:00",
        "수면",
        "#c7d2fe",
        "😴"
      ],
      [
        "15:00",
        "기상·식사",
        "#fbbf24",
        "🍚"
      ],
      [
        "16:00",
        "자유·운동",
        "#6ee7b7",
        "🏃"
      ],
      [
        "18:00",
        "집안일·용무",
        "#fdba74",
        "🧺"
      ],
      [
        "20:00",
        "저녁·휴식",
        "#f9a8d4",
        "🍲"
      ],
      [
        "22:00",
        "근무 준비·이동",
        "#93c5fd",
        "☕"
      ],
      [
        "23:00",
        "야간 근무",
        "#818cf8",
        "🏭"
      ]
    ]
  },
  {
    "slug": "toddler-routine",
    "name": "유아 생활계획표",
    "ko": {
      "title": "유아 돌봄 일정 편집 예시 템플릿",
      "desc": "돌봄 담당자가 식사·놀이·인계 시간을 표시해 보는 가상 유아 일정입니다. 아기나 모든 연령에 적용되는 수면·수유 기준이 아닙니다.",
      "tips": [
        "아이의 실제 생활과 돌봄기관 일정을 먼저 확인하세요.",
        "낮잠의 횟수와 길이는 이 예시를 그대로 따르지 말고 바꾸세요.",
        "인계 담당자와 시간을 적고 공유 이미지에서 이름 등 개인정보를 빼세요."
      ]
    },
    "en": {
      "title": "Toddler Daily Routine Template",
      "desc": "An illustrative toddler care schedule for recording meals, play and handovers. It is not a sleep or feeding standard for babies or all ages.",
      "tips": [
        "Start with the child’s actual routine and care-setting timetable.",
        "Change the number and length of naps instead of copying this example.",
        "Record handover duties and remove names or other personal details from shared images."
      ]
    },
    "related": [
      "daily-life-planner"
    ],
    "slices": [
      [
        "07:00",
        "기상·아침",
        "#fbbf24",
        "🌅"
      ],
      [
        "08:00",
        "아침밥",
        "#fca5a5",
        "🍚"
      ],
      [
        "09:00",
        "오전 놀이",
        "#86efac",
        "🧸"
      ],
      [
        "10:30",
        "바깥놀이",
        "#6ee7b7",
        "⛅"
      ],
      [
        "12:00",
        "점심",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:00",
        "낮잠",
        "#c7d2fe",
        "😴"
      ],
      [
        "15:00",
        "간식·놀이",
        "#fdba74",
        "🍪"
      ],
      [
        "17:00",
        "자유놀이",
        "#f9a8d4",
        "🎨"
      ],
      [
        "18:00",
        "저녁밥",
        "#fca5a5",
        "🍲"
      ],
      [
        "19:00",
        "목욕·잠자리 준비",
        "#a7f3d0",
        "🛁"
      ],
      [
        "20:00",
        "책·잠자리",
        "#a5b4fc",
        "📖"
      ],
      [
        "20:30",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  },
  {
    "slug": "winter-vacation",
    "name": "겨울방학 계획표",
    "ko": {
      "title": "초·중생 겨울방학 생활계획표 템플릿",
      "desc": "공부·놀이·가족 일정을 배치한 겨울방학 예시입니다. 지역의 계절과 방학 일정에 맞게 바꿔 쓸 수 있습니다.",
      "tips": [
        "방학 과제의 마감일부터 확인하세요.",
        "예습이 필요 없다면 해당 시간을 놀이·독서 등으로 바꾸세요.",
        "학원이나 외출이 있는 날은 이동 시간을 더한 별도 계획을 만드세요."
      ]
    },
    "en": {
      "title": "Winter-Break Daily Planner Template (Students)",
      "desc": "A winter-break example with study, play and family commitments. Adapt it to your local season and school calendar.",
      "tips": [
        "Check school-break assignment deadlines first.",
        "Replace next-term study with play or reading if it is unnecessary.",
        "Make a separate plan including travel for days with classes or outings."
      ]
    },
    "related": [
      "elementary-summer",
      "exam-student"
    ],
    "slices": [
      [
        "08:00",
        "기상·아침",
        "#fbbf24",
        "🌅"
      ],
      [
        "09:00",
        "오전 공부",
        "#93c5fd",
        "📚"
      ],
      [
        "11:00",
        "휴식·자유",
        "#ddd6fe",
        "☕"
      ],
      [
        "12:00",
        "점심",
        "#fca5a5",
        "🍽️"
      ],
      [
        "13:00",
        "독서·숙제",
        "#a5b4fc",
        "✏️"
      ],
      [
        "15:00",
        "실내 운동·놀이",
        "#6ee7b7",
        "🤸"
      ],
      [
        "16:30",
        "자유시간",
        "#fdba74",
        "🎮"
      ],
      [
        "18:00",
        "저녁",
        "#fca5a5",
        "🍲"
      ],
      [
        "19:00",
        "다음 학기 예습",
        "#7dd3fc",
        "📗"
      ],
      [
        "20:00",
        "가족·자유",
        "#f9a8d4",
        "👨‍👩‍👧"
      ],
      [
        "21:30",
        "씻고 정리",
        "#a7f3d0",
        "🛁"
      ],
      [
        "22:00",
        "수면",
        "#c7d2fe",
        "🌙"
      ]
    ]
  }
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
(function(){try{var o=localStorage.getItem('24h-guides-lang');var l=o;if(!l){var r=localStorage.getItem('24h-circle-planner.prefs');if(r){var p=JSON.parse(r);l=p&&p.prefs&&p.prefs.language;}}if(!l){l=(navigator.language||'ko').slice(0,2);}if(l&&l.toLowerCase()!=='ko'){document.documentElement.classList.add('show-en');document.documentElement.lang='en';}}catch(e){}})();
function setGuideLang(l){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}document.documentElement.classList.toggle('show-en',l!=='ko');document.documentElement.lang=l;document.querySelectorAll('[data-template-lang]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.templateLang===l));});}
document.addEventListener('DOMContentLoaded',function(){setGuideLang(document.documentElement.lang==='en'?'en':'ko');});
</${'script'}>`;

const HEAD_NAV = `
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <span class="langswitch"><button type="button" data-template-lang="ko" aria-pressed="true" onclick="setGuideLang('ko')">한국어</button><span class="sep">·</span><button type="button" data-template-lang="en" aria-pressed="false" onclick="setGuideLang('en')">EN</button></span>
      <a href="/templates/"><span class="lang-ko">템플릿</span><span class="lang-en">Templates</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>`;

function shell({ title, desc, canonical, ogImage, jsonld, body, lang = 'ko', hreflang = '' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${canonical}" />
${hreflang}
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<meta name="google-adsense-account" content="ca-pub-6947130056543786">
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
  image: img, datePublished: '2026-07-12', dateModified: '2026-09-11',
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
  const relatedKo = t.related.map((r) => `<a href="/${TEMPLATES.some(x => x.slug === r) ? 'templates' : 'guides'}/${r}">관련 자료</a>`).join(' · ');

  const body = `    <p class="crumb"><a href="/templates/"><span class="lang-ko">← 템플릿 목록</span><span class="lang-en">← All templates</span></a></p>
    <div class="lang-ko">
    <h1>${t.ko.title}</h1>
    <p class="lead">${t.ko.desc}</p><p>2026년 9월 11일 검토 · 편집용 가상 일정입니다.</p>
    </div>
    <div class="lang-en">
    <h1>${t.en.title}</h1>
    <p class="lead">${t.en.desc}</p><p>Reviewed September 11, 2026. The chart and imported activity labels are in Korean; rename them after import.</p>
    </div>

    <p style="text-align:center;margin:18px 0">
      <img src="/templates/img/${t.slug}.png" alt="${t.ko.title} — 24시간 원형 시간표" width="520" style="max-width:100%;height:auto;border-radius:16px" loading="lazy" />
    </p>

    ${['exam-student', 'office-worker'].includes(t.slug) ? `<p style="text-align:center;margin:16px 0 8px"><span class="lang-ko">${t.slug === 'exam-student' ? '공부와 쉬는 시간이 함께 보이는 내 하루.' : '퇴근 후 내 시간을 먼저 확보하세요.'} 가입 없이 예시를 불러오고, 내 기상 시간과 일정에 맞게 수정하세요.</span><span class="lang-en">${t.slug === 'exam-student' ? 'See study and rest together in your day.' : 'Make room for your time after work.'} Load this example without signing up, then adjust it to your wake-up time and commitments.</span></p>` : ''}
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

  return shell({ title: `${t.ko.title} · 24Houring`, desc: t.ko.desc, canonical, ogImage: img, jsonld, body, hreflang: hreflangFor(t.slug) });
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
    jsonld, body, hreflang: hreflangFor(''),
  });
}

// ─── Localized template routes (/{loc}/templates/…) — single-language SEO ─────

function hreflangFor(slug) {
  const path = slug ? `templates/${slug}` : 'templates/';
  const href = (loc) => (loc === 'root' ? `${ORIGIN}/${path}` : `${ORIGIN}/${loc}/${path}`);
  return [
    `<link rel="alternate" hreflang="ko" href="${href('root')}" />`,
    `<link rel="alternate" hreflang="en" href="${href('root')}" />`,
    ...Object.keys(LOCALES).map((l) => `<link rel="alternate" hreflang="${l}" href="${href(l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${href('root')}" />`,
  ].join('\n');
}

function locNav(loc, c) {
  return `
  <header class="site">
    <a class="logo" href="/${loc}/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <a href="/${loc}/templates/">${c.hubTitle}</a>
      <a href="/${loc}/">Home</a>
    </nav>
  </header>`;
}
function locFoot(loc) {
  return `
  <footer class="site">
    <nav>
      <a href="/${loc}/">Home</a>
      <a href="/${loc}/templates/">Templates</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/contact">Contact</a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;
}
function locShell({ title, desc, canonical, ogImage, jsonld, body, lang, hreflang, nav, foot }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${canonical}" />
${hreflang}
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
${jsonld}
</head>
<body>
<div class="wrap">${nav}
  <main class="article">
${body}
  </main>${foot}
</div>
</body>
</html>
`;
}

function localeTemplatePage(t, loc) {
  const tr = LOCALES[loc], c = tr.chrome, tt = tr.templates[t.slug];
  const canonical = `${ORIGIN}/${loc}/templates/${t.slug}`;
  const img = `${ORIGIN}/templates/img/${t.slug}.png`;
  const p = importCode(t), d = viewCode(t);
  const jsonld = `<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: tt.title, description: tt.desc, inLanguage: loc, image: img, datePublished: '2026-08-25', dateModified: '2026-09-11', author: { '@type': 'Organization', name: '24Houring', url: `${ORIGIN}/` }, publisher: { '@type': 'Organization', name: '24Houring', url: `${ORIGIN}/` }, mainEntityOfPage: canonical }, null, 1)}
</${'script'}>`;
  const tips = tt.tips.map((x) => `      <li>${x}</li>`).join('\n');
  const body = `    <p class="crumb"><a href="/${loc}/templates/">${c.allTemplates}</a></p>
    <h1>${tt.title}</h1>
    <p class="lead">${tt.desc}</p><p>${c.exampleNote}</p>
    <p style="text-align:center;margin:18px 0">
      <img src="/templates/img/${t.slug}.png" alt="${tt.title}" width="520" style="max-width:100%;height:auto;border-radius:16px" loading="lazy" />
    </p>
    <p style="text-align:center;margin:0 0 6px"><a class="btn" href="/${loc}/#p=${p}">${c.startCta}</a></p>
    <p style="text-align:center;margin:0 0 22px;font-size:13px"><a href="/s#d=${d}" style="color:#6b7280">${c.preview}</a><span style="color:#9aa3b2"> · </span><span style="color:#9aa3b2">${c.editable}</span></p>
    <h2>${c.scheduleH}</h2>
    <ul>
${schedList(t)}
    </ul>
    <h2>${c.tipsH}</h2>
    <ul>
${tips}
    </ul>
    <div class="cta card">
      <p style="margin:0 0 4px"><strong>${c.makeYoursT}</strong></p>
      <p style="margin:0">${c.makeYoursB}</p>
      <p style="margin:8px 0 0"><a class="btn" href="/${loc}/#p=${p}">${c.loadCta}</a></p>
    </div>`;
  return locShell({ title: `${tt.title} · 24Houring`, desc: tt.desc, canonical, ogImage: img, jsonld, body, lang: loc, hreflang: hreflangFor(t.slug), nav: locNav(loc, c), foot: locFoot(loc) });
}

function localeHubPage(loc) {
  const tr = LOCALES[loc], c = tr.chrome;
  const canonical = `${ORIGIN}/${loc}/templates/`;
  const cards = TEMPLATES.map((t) => `      <a class="gcard" href="/${loc}/templates/${t.slug}">
        <img src="/templates/img/${t.slug}.png" alt="${tr.templates[t.slug].title}" width="240" style="width:100%;height:auto;border-radius:10px;margin-bottom:8px" loading="lazy" />
        <h3>${tr.templates[t.slug].title}</h3>
        <p>${tr.templates[t.slug].desc.split(/[.。]/)[0]}.</p>
      </a>`).join('\n');
  const jsonld = `<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.hubTitle, url: canonical, description: c.hubDesc, inLanguage: loc }, null, 1)}
</${'script'}>`;
  const body = `    <h1>${c.hubTitle}</h1>
    <p class="lead">${c.hubLead}</p>
    <div class="grid">
${cards}
    </div>
    <div class="cta card">
      <p style="margin:0 0 4px"><strong>${c.blankT}</strong></p>
      <p style="margin:0">${c.blankB}</p>
      <p style="margin:8px 0 0"><a class="btn" href="/${loc}/">${c.openCta}</a></p>
    </div>`;
  return locShell({ title: `${c.hubTitle} · 24Houring`, desc: c.hubDesc, canonical, ogImage: `${ORIGIN}/templates/img/${TEMPLATES[0].slug}.png`, jsonld, body, lang: loc, hreflang: hreflangFor(''), nav: locNav(loc, c), foot: locFoot(loc) });
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
if (process.argv.includes('--skip-screenshots')) {
  for (const t of TEMPLATES) if (!existsSync(join(IMG, t.slug + '.png'))) throw new Error('Missing template image: ' + t.slug);
} else await screenshots();
for (const t of TEMPLATES) {
  writeFileSync(join(OUT, `${t.slug}.html`), templatePage(t).replace(/^[ \t]+$/gm, ''));
  console.log(`page  ${t.slug}.html`);
}
writeFileSync(join(OUT, 'index.html'), hubPage());
console.log('page  index.html');

// Localized template routes (/{loc}/templates/…) reusing the same screenshots.
for (const loc of Object.keys(LOCALES)) {
  const dir = join(ROOT, 'public', loc, 'templates');
  mkdirSync(dir, { recursive: true });
  for (const t of TEMPLATES) writeFileSync(join(dir, `${t.slug}.html`), localeTemplatePage(t, loc));
  writeFileSync(join(dir, 'index.html'), localeHubPage(loc));
  console.log(`locale ${loc}: ${TEMPLATES.length} pages + hub`);
}
console.log(`done — ${TEMPLATES.length} templates × ${1 + Object.keys(LOCALES).length} locales`);
