/**
 * Circle-timetable image gallery builder — the source of truth for /gallery/*.
 *
 * Renders the SAME planner the app draws, once per variation, screenshots it
 * through the read-only /s viewer, and writes a bilingual gallery page around
 * the results. Variations span:
 *   - 6 day archetypes (student, office worker, exam prep, freelancer,
 *     miracle morning, night shift)
 *   - 10 visual styles (colour palette × pattern/gradient background × font ×
 *     light/dark)
 *   - 8 languages for the slice labels (ko en ja de es fr zh ru) — Korean gets
 *     the full style matrix, the other languages one rotated style each, and
 *     every image carries keyword-rich alt text IN that language so it can be
 *     found from image search in that language.
 *
 * Regenerate after editing:  node scripts/gallery/build.mjs
 * (needs a fresh `npm run build` first — the screenshots load ./dist)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { launchPage, serveDist, wait } from '../e2e/_helpers.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'gallery');
const IMG = join(OUT, 'img');
const ORIGIN = 'https://24houring.com';
const DATE = '2026-08-31';

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── Schedules ────────────────────────────────────────────────────────────────
// starts/icons are shared; labels + display name come per language.

const SCHEDULES = [
  {
    slug: 'student',
    starts: ['00:00', '07:00', '08:00', '09:00', '12:30', '13:30', '16:00', '18:30', '19:30', '21:30', '23:00'],
    icons: ['😴', '🪥', '🚌', '📚', '🍱', '📖', '✏️', '🍚', '📝', '🎧', '🛏️'],
    name: { ko: '학생의 하루', en: "A Student's Day", ja: '学生の一日', de: 'Ein Schultag', es: 'El día de un estudiante', fr: "La journée d'un étudiant", zh: '学生的一天', ru: 'День школьника' },
    labels: {
      ko: ['수면', '아침 준비', '등교', '수업', '점심', '수업', '자습', '저녁', '복습', '휴식', '취침 준비'],
      en: ['Sleep', 'Morning', 'Commute', 'Classes', 'Lunch', 'Classes', 'Study', 'Dinner', 'Review', 'Free time', 'Wind down'],
      ja: ['睡眠', '朝の支度', '登校', '授業', '昼食', '授業', '自習', '夕食', '復習', '自由時間', '就寝準備'],
      de: ['Schlaf', 'Morgen', 'Schulweg', 'Unterricht', 'Mittag', 'Unterricht', 'Lernen', 'Abendessen', 'Wiederholung', 'Freizeit', 'Zur Ruhe'],
      es: ['Sueño', 'Mañana', 'Camino', 'Clases', 'Almuerzo', 'Clases', 'Estudio', 'Cena', 'Repaso', 'Tiempo libre', 'A dormir'],
      fr: ['Sommeil', 'Matin', 'Trajet', 'Cours', 'Déjeuner', 'Cours', 'Étude', 'Dîner', 'Révision', 'Temps libre', 'Coucher'],
      zh: ['睡眠', '晨间准备', '上学', '上课', '午餐', '上课', '自习', '晚餐', '复习', '自由时间', '睡前'],
      ru: ['Сон', 'Утро', 'Дорога', 'Уроки', 'Обед', 'Уроки', 'Занятия', 'Ужин', 'Повторение', 'Отдых', 'Ко сну'],
    },
  },
  {
    slug: 'office-worker',
    starts: ['00:00', '06:30', '08:00', '09:00', '12:00', '13:00', '15:00', '18:00', '19:00', '20:00', '23:00'],
    icons: ['😴', '🏃', '🚇', '💻', '🍜', '🗣️', '📊', '🚶', '🍲', '📗', '🌙'],
    name: { ko: '직장인의 하루', en: "An Office Worker's Day", ja: '会社員の一日', de: 'Ein Bürotag', es: 'El día de oficina', fr: 'Journée de bureau', zh: '上班族的一天', ru: 'День офисного работника' },
    labels: {
      ko: ['수면', '기상·운동', '출근', '집중 업무', '점심', '회의', '업무', '퇴근', '저녁', '나의 시간', '취침 준비'],
      en: ['Sleep', 'Wake & move', 'Commute', 'Deep work', 'Lunch', 'Meetings', 'Work', 'Commute home', 'Dinner', 'My time', 'Wind down'],
      ja: ['睡眠', '起床・運動', '通勤', '集中作業', '昼食', '会議', '業務', '帰宅', '夕食', '自分の時間', '就寝準備'],
      de: ['Schlaf', 'Sport', 'Pendeln', 'Deep Work', 'Mittag', 'Meetings', 'Arbeit', 'Heimweg', 'Abendessen', 'Meine Zeit', 'Zur Ruhe'],
      es: ['Sueño', 'Ejercicio', 'Trayecto', 'Trabajo profundo', 'Almuerzo', 'Reuniones', 'Trabajo', 'Vuelta', 'Cena', 'Mi tiempo', 'A dormir'],
      fr: ['Sommeil', 'Sport', 'Trajet', 'Travail profond', 'Déjeuner', 'Réunions', 'Travail', 'Retour', 'Dîner', 'Mon temps', 'Coucher'],
      zh: ['睡眠', '起床·运动', '通勤', '专注工作', '午餐', '会议', '工作', '下班', '晚餐', '我的时间', '睡前'],
      ru: ['Сон', 'Спорт', 'Дорога', 'Глубокая работа', 'Обед', 'Встречи', 'Работа', 'Домой', 'Ужин', 'Моё время', 'Ко сну'],
    },
  },
  {
    slug: 'exam-prep',
    starts: ['00:00', '06:00', '06:30', '09:00', '12:00', '13:00', '16:00', '16:30', '19:00', '20:00', '22:30'],
    icons: ['😴', '☀️', '📕', '📐', '🥗', '📘', '☕', '🧾', '🍚', '🔍', '🛏️'],
    name: { ko: '수험생의 하루', en: "An Exam Candidate's Day", ja: '受験生の一日', de: 'Prüfungstag', es: 'Día de examen', fr: 'Journée de révisions', zh: '备考生的一天', ru: 'День подготовки к экзамену' },
    labels: {
      ko: ['수면', '기상', '국어', '수학', '점심·산책', '영어', '휴식', '기출 풀이', '저녁', '오답 정리', '취침 준비'],
      en: ['Sleep', 'Wake', 'Language', 'Maths', 'Lunch & walk', 'English', 'Break', 'Past papers', 'Dinner', 'Error review', 'Wind down'],
      ja: ['睡眠', '起床', '国語', '数学', '昼食・散歩', '英語', '休憩', '過去問', '夕食', '間違い直し', '就寝準備'],
      de: ['Schlaf', 'Aufstehen', 'Sprache', 'Mathe', 'Mittag & Gehen', 'Englisch', 'Pause', 'Altklausuren', 'Abendessen', 'Fehleranalyse', 'Zur Ruhe'],
      es: ['Sueño', 'Despertar', 'Lengua', 'Matemáticas', 'Almuerzo y paseo', 'Inglés', 'Pausa', 'Exámenes', 'Cena', 'Errores', 'A dormir'],
      fr: ['Sommeil', 'Réveil', 'Langue', 'Maths', 'Déjeuner & marche', 'Anglais', 'Pause', 'Annales', 'Dîner', 'Corrections', 'Coucher'],
      zh: ['睡眠', '起床', '语文', '数学', '午餐·散步', '英语', '休息', '真题', '晚餐', '错题整理', '睡前'],
      ru: ['Сон', 'Подъём', 'Язык', 'Математика', 'Обед и прогулка', 'Английский', 'Перерыв', 'Варианты', 'Ужин', 'Ошибки', 'Ко сну'],
    },
  },
  {
    slug: 'freelancer',
    starts: ['00:00', '07:30', '08:30', '09:00', '12:00', '13:00', '14:30', '17:30', '19:00', '20:00', '23:00'],
    icons: ['😴', '☕', '🚶', '🎨', '🥪', '✉️', '🖥️', '🏋️', '🍝', '📙', '🌙'],
    name: { ko: '프리랜서의 하루', en: "A Freelancer's Day", ja: 'フリーランスの一日', de: 'Freelancer-Tag', es: 'Día freelance', fr: 'Journée freelance', zh: '自由职业者的一天', ru: 'День фрилансера' },
    labels: {
      ko: ['수면', '기상·커피', '가짜 통근', '깊은 작업', '점심', '연락·정산', '깊은 작업', '운동', '저녁', '배움·취미', '취침 준비'],
      en: ['Sleep', 'Wake & coffee', 'Fake commute', 'Deep work', 'Lunch', 'Admin', 'Deep work', 'Exercise', 'Dinner', 'Learning', 'Wind down'],
      ja: ['睡眠', '起床・コーヒー', '擬似通勤', '集中作業', '昼食', '連絡・事務', '集中作業', '運動', '夕食', '学び・趣味', '就寝準備'],
      de: ['Schlaf', 'Kaffee', 'Fake-Pendeln', 'Deep Work', 'Mittag', 'Admin', 'Deep Work', 'Sport', 'Abendessen', 'Lernen', 'Zur Ruhe'],
      es: ['Sueño', 'Café', 'Falso trayecto', 'Trabajo profundo', 'Almuerzo', 'Gestión', 'Trabajo profundo', 'Ejercicio', 'Cena', 'Aprender', 'A dormir'],
      fr: ['Sommeil', 'Café', 'Faux trajet', 'Travail profond', 'Déjeuner', 'Admin', 'Travail profond', 'Sport', 'Dîner', 'Apprendre', 'Coucher'],
      zh: ['睡眠', '起床·咖啡', '假通勤', '深度工作', '午餐', '沟通·事务', '深度工作', '运动', '晚餐', '学习·爱好', '睡前'],
      ru: ['Сон', 'Кофе', 'Фейк-дорога', 'Глубокая работа', 'Обед', 'Дела', 'Глубокая работа', 'Спорт', 'Ужин', 'Учёба', 'Ко сну'],
    },
  },
  {
    slug: 'miracle-morning',
    starts: ['00:00', '05:00', '05:20', '05:50', '06:40', '07:20', '08:00', '12:00', '13:00', '18:00', '21:30'],
    icons: ['😴', '💧', '🧘', '🏃', '📖', '🖊️', '💼', '🍱', '💻', '👨‍👩‍👧', '🌙'],
    name: { ko: '미라클 모닝', en: 'Miracle Morning', ja: 'ミラクルモーニング', de: 'Miracle Morning', es: 'Miracle Morning', fr: 'Miracle Morning', zh: '奇迹清晨', ru: 'Чудо-утро' },
    labels: {
      ko: ['수면', '기상·물 한 잔', '명상', '운동', '독서', '기록', '업무', '점심', '업무', '저녁·가족', '취침 준비'],
      en: ['Sleep', 'Wake & water', 'Meditation', 'Exercise', 'Reading', 'Journaling', 'Work', 'Lunch', 'Work', 'Dinner & family', 'Wind down'],
      ja: ['睡眠', '起床・水', '瞑想', '運動', '読書', '日記', '仕事', '昼食', '仕事', '夕食・家族', '就寝準備'],
      de: ['Schlaf', 'Wasser', 'Meditation', 'Sport', 'Lesen', 'Journal', 'Arbeit', 'Mittag', 'Arbeit', 'Familie', 'Zur Ruhe'],
      es: ['Sueño', 'Agua', 'Meditación', 'Ejercicio', 'Lectura', 'Diario', 'Trabajo', 'Almuerzo', 'Trabajo', 'Familia', 'A dormir'],
      fr: ['Sommeil', 'Eau', 'Méditation', 'Sport', 'Lecture', 'Journal', 'Travail', 'Déjeuner', 'Travail', 'Famille', 'Coucher'],
      zh: ['睡眠', '起床·喝水', '冥想', '运动', '阅读', '日记', '工作', '午餐', '工作', '晚餐·家人', '睡前'],
      ru: ['Сон', 'Вода', 'Медитация', 'Спорт', 'Чтение', 'Дневник', 'Работа', 'Обед', 'Работа', 'Семья', 'Ко сну'],
    },
  },
  {
    slug: 'shift-night',
    starts: ['00:00', '06:00', '07:00', '08:00', '14:00', '15:00', '17:00', '18:30', '20:00', '21:30', '22:30'],
    icons: ['🌃', '🚗', '🥣', '😴', '☀️', '📗', '🚴', '🍲', '💤', '🎒', '🚌'],
    name: { ko: '야간 교대 근무', en: 'Night Shift', ja: '夜勤の一日', de: 'Nachtschicht', es: 'Turno de noche', fr: 'Travail de nuit', zh: '夜班的一天', ru: 'Ночная смена' },
    labels: {
      ko: ['야간 근무', '퇴근', '아침·정리', '수면', '기상', '개인 시간', '운동', '저녁', '낮잠', '출근 준비', '출근'],
      en: ['Night shift', 'Commute home', 'Breakfast', 'Sleep', 'Wake', 'Personal time', 'Exercise', 'Dinner', 'Top-up nap', 'Get ready', 'Commute'],
      ja: ['夜勤', '帰宅', '朝食', '睡眠', '起床', '自分の時間', '運動', '夕食', '仮眠', '出勤準備', '出勤'],
      de: ['Nachtschicht', 'Heimweg', 'Frühstück', 'Schlaf', 'Aufstehen', 'Eigene Zeit', 'Sport', 'Abendessen', 'Nickerchen', 'Fertigmachen', 'Zur Arbeit'],
      es: ['Turno de noche', 'Vuelta', 'Desayuno', 'Sueño', 'Despertar', 'Tiempo propio', 'Ejercicio', 'Cena', 'Siesta', 'Prepararse', 'Al trabajo'],
      fr: ['Nuit de travail', 'Retour', 'Petit-déj', 'Sommeil', 'Réveil', 'Temps perso', 'Sport', 'Dîner', 'Sieste', 'Préparation', 'Départ'],
      zh: ['夜班', '下班', '早餐', '睡眠', '起床', '个人时间', '运动', '晚餐', '小睡', '出门准备', '上班'],
      ru: ['Ночная смена', 'Домой', 'Завтрак', 'Сон', 'Подъём', 'Своё время', 'Спорт', 'Ужин', 'Дрёма', 'Сборы', 'На работу'],
    },
  },
];

// ─── Visual styles ────────────────────────────────────────────────────────────
// Patterns and gradients cover the app's own background options; fonts are the
// app's own faces. For non-Latin languages the font is overridden per language
// below so every script renders with proper glyphs.

const STYLES = [
  { slug: 'pastel-dots', ko: '파스텔 · 도트', en: 'Pastel · dots', theme: 'light', font: 'Pretendard',
    palette: ['#d1d5db', '#fca5a5', '#fdba74', '#fcd34d', '#bef264', '#6ee7b7', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f9a8d4', '#f0abfc'],
    prefs: { bgType: 'pattern', background: 'dots' } },
  { slug: 'ocean-gradient', ko: '바다 · 그라데이션', en: 'Ocean · gradient', theme: 'light', font: 'Gowun Dodum',
    palette: ['#bae6fd', '#7dd3fc', '#38bdf8', '#5eead4', '#2dd4bf', '#99f6e4', '#a5f3fc', '#67e8f9', '#93c5fd', '#818cf8'],
    prefs: { bgType: 'gradient', gradient: { from: '#a1c4fd', via: '#c2e9fb', to: '#e0f2fe', angle: 135, shape: 'linear' } } },
  { slug: 'sunset-paper', ko: '노을 · 종이 질감', en: 'Sunset · paper', theme: 'light', font: 'Nanum Myeongjo',
    palette: ['#fecaca', '#fca5a5', '#fda4af', '#fdba74', '#fcd34d', '#fde68a', '#f9a8d4', '#f0abfc', '#e9d5ff', '#ddd6fe'],
    prefs: { bgType: 'pattern', background: 'paper' } },
  { slug: 'forest-grid', ko: '숲 · 그리드', en: 'Forest · grid', theme: 'light', font: 'Jua',
    palette: ['#d9f99d', '#bef264', '#a3e635', '#86efac', '#6ee7b7', '#5eead4', '#99f6e4', '#fde68a', '#fcd34d', '#d6d3d1'],
    prefs: { bgType: 'pattern', background: 'grid' } },
  { slug: 'mono-dark', ko: '모노 · 다크 모드', en: 'Mono · dark', theme: 'dark', font: 'Noto Sans KR',
    palette: ['#e5e7eb', '#9ca3af', '#d1d5db', '#6b7280', '#cbd5e1', '#94a3b8', '#e7e5e4', '#a8a29e', '#d6d3d1', '#78716c'],
    prefs: { bgType: 'pattern', background: 'none' } },
  { slug: 'calm-handwriting', ko: '차분 · 손글씨', en: 'Calm · handwriting', theme: 'light', font: 'Gaegu',
    palette: ['#cbd5e1', '#a5b4fc', '#93c5fd', '#7dd3fc', '#99f6e4', '#a7f3d0', '#bbf7d0', '#fde68a', '#fbcfe8', '#e9d5ff'],
    prefs: { bgType: 'pattern', background: 'memo' } },
  { slug: 'sunset-radial', ko: '노을 · 방사형 그라데이션', en: 'Sunset · radial gradient', theme: 'light', font: 'Montserrat',
    palette: ['#fda4af', '#fdba74', '#fcd34d', '#fde68a', '#f9a8d4', '#f0abfc', '#e9d5ff', '#fecaca', '#fca5a5', '#ddd6fe'],
    prefs: { bgType: 'gradient', gradient: { from: '#fff1e6', via: '#ffe4e6', to: '#fbc2eb', angle: 0, shape: 'radial' } } },
  { slug: 'ocean-waves', ko: '바다 · 물결 패턴', en: 'Ocean · waves', theme: 'light', font: 'Poppins',
    palette: ['#7dd3fc', '#38bdf8', '#5eead4', '#2dd4bf', '#99f6e4', '#a5f3fc', '#67e8f9', '#93c5fd', '#818cf8', '#bae6fd'],
    prefs: { bgType: 'pattern', background: 'waves' } },
  { slug: 'calm-diagonal', ko: '차분 · 사선 패턴', en: 'Calm · diagonal', theme: 'light', font: 'Lato',
    palette: ['#a5b4fc', '#93c5fd', '#7dd3fc', '#99f6e4', '#a7f3d0', '#bbf7d0', '#fde68a', '#fbcfe8', '#e9d5ff', '#cbd5e1'],
    prefs: { bgType: 'pattern', background: 'diagonal' } },
  { slug: 'forest-dark', ko: '숲 · 다크 체커', en: 'Forest · dark checker', theme: 'dark', font: 'Roboto',
    palette: ['#bef264', '#a3e635', '#86efac', '#6ee7b7', '#5eead4', '#99f6e4', '#fde68a', '#fcd34d', '#d9f99d', '#d6d3d1'],
    prefs: { bgType: 'pattern', background: 'checker' } },
];

// Per-language font override so every script gets real glyphs; Latin languages
// keep the style's own face.
const LANG_FONT = { ja: 'Noto Sans JP', zh: 'Noto Sans SC', ru: 'PT Sans' };
// Keyword-rich alt-text suffix per language (what people actually search).
const ALT_SUFFIX = {
  ko: '원형 24시간 시간표 · 생활계획표',
  en: '24-hour circle timetable · daily schedule',
  ja: '24時間の円形タイムスケジュール・生活計画表',
  de: '24-Stunden-Kreiszeitplan · Tagesplan',
  es: 'horario circular de 24 horas · planificador diario',
  fr: 'emploi du temps circulaire de 24 heures · planning journalier',
  zh: '24小时圆形时间表 · 日程规划',
  ru: 'круговое расписание дня на 24 часа',
};
const LANGS = ['ko', 'en', 'ja', 'de', 'es', 'fr', 'zh', 'ru'];

// ─── Variations ───────────────────────────────────────────────────────────────
// Korean: full 6×10 matrix (primary market). Other languages: each schedule in
// one style, rotated so the international set as a whole shows every style.

function makeVariation(schedule, style, lang, slug) {
  const name = schedule.name[lang];
  return {
    slug, schedule, style, lang,
    alt: `${name} — ${ALT_SUFFIX[lang]}${lang === 'en' ? '' : ` / ${schedule.name.en} — 24-hour circle timetable`}`,
    caption: lang === 'ko'
      ? `<span class="lang-ko">${esc(schedule.name.ko)} · ${esc(style.ko)}</span><span class="lang-en">${esc(schedule.name.en)} · ${esc(style.en)}</span>`
      : `${esc(name)} <span style="opacity:.6">· ${lang.toUpperCase()}</span>`,
  };
}

const VARIATIONS = [];
SCHEDULES.forEach((s, si) => {
  STYLES.forEach((st) => {
    VARIATIONS.push(makeVariation(s, st, 'ko', `${s.slug}-${st.slug}`));
  });
  LANGS.filter((l) => l !== 'ko').forEach((lang, li) => {
    const st = STYLES[(si * 3 + li * 2) % STYLES.length];
    VARIATIONS.push(makeVariation(s, st, lang, `${s.slug}-${st.slug}-${lang}`));
  });
});

const viewCode = (v) => b64url(JSON.stringify({
  v: 1,
  n: v.schedule.name[v.lang],
  s: v.schedule.starts.map((start, i) => [hm(start), v.schedule.labels[v.lang][i], v.style.palette[i % v.style.palette.length], v.schedule.icons[i]]),
}));

// ─── Screenshots ──────────────────────────────────────────────────────────────

async function screenshots() {
  const { base, close } = await serveDist();
  const { browser, page } = await launchPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  try {
    for (const v of VARIATIONS) {
      const font = LANG_FONT[v.lang] ?? v.style.font;
      const prefs = { version: 1, prefs: { language: v.lang, fontFamily: font, ...v.style.prefs } };
      await page.addInitScript(([p, t]) => {
        localStorage.setItem('24h-circle-planner.prefs', p);
        localStorage.setItem('24h-circle-planner.theme', t);
      }, [JSON.stringify(prefs), v.style.theme]);

      await page.goto('about:blank');
      await page.goto(`${base}/s#d=${viewCode(v)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await wait(900); // webfont + background settle

      // Hide everything but the ring: the padded clip would otherwise catch the
      // viewer's heading. `visibility` keeps layout and background intact.
      await page.addStyleTag({ content: `
        body * { visibility: hidden !important }
        svg[role="img"], svg[role="img"] * { visibility: visible !important }
      ` });
      await wait(120);

      const box = await page.locator('svg[role="img"]').first().boundingBox();
      const pad = 26;
      await page.screenshot({
        path: join(IMG, `${v.slug}.png`),
        clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
      });
      console.log(`shot  ${v.slug}.png`);
    }
  } finally {
    await browser.close();
    close();
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const NAV = `
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/guides/"><span class="lang-ko">가이드</span><span class="lang-en">Guides</span></a>
      <a href="/blog/"><span class="lang-ko">블로그</span><span class="lang-en">Blog</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>`;

const FOOT = `
  <footer class="site">
    <nav>
      <a href="/"><span class="lang-ko">홈 Home</span><span class="lang-en">Home</span></a>
      <a href="/life-planner"><span class="lang-ko">생활계획표 Life Planner</span><span class="lang-en">Life Planner</span></a>
      <a href="/guides/"><span class="lang-ko">가이드 Guides</span><span class="lang-en">Guides</span></a>
      <a href="/blog/"><span class="lang-ko">블로그 Blog</span><span class="lang-en">Blog</span></a>
      <a href="/templates/"><span class="lang-ko">템플릿 Templates</span><span class="lang-en">Templates</span></a>
      <a href="/gallery/"><span class="lang-ko">갤러리 Gallery</span><span class="lang-en">Gallery</span></a>
      <a href="/stories/"><span class="lang-ko">스토리 Stories</span><span class="lang-en">Stories</span></a>
      <a href="/health/"><span class="lang-ko">건강 Health</span><span class="lang-en">Health</span></a>
      <a href="/faq"><span class="lang-ko">자주 묻는 질문 FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/privacy"><span class="lang-ko">개인정보처리방침 Privacy</span><span class="lang-en">Privacy</span></a>
      <a href="/terms"><span class="lang-ko">이용약관 Terms</span><span class="lang-en">Terms</span></a>
      <a href="/refund"><span class="lang-ko">환불 Refund</span><span class="lang-en">Refund</span></a>
      <a href="/contact"><span class="lang-ko">문의 Contact</span><span class="lang-en">Contact</span></a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;

const LANG_JS = `
<script>
(function(){try{var o=localStorage.getItem('24h-guides-lang');var l=o;if(!l){var r=localStorage.getItem('24h-circle-planner.prefs');if(r){var p=JSON.parse(r);l=p&&p.prefs&&p.prefs.language;}}if(!l){l=(navigator.language||'ko').slice(0,2);}if(l&&l.toLowerCase()!=='ko'){document.documentElement.classList.add('show-en');}}catch(e){}})();
function setGuideLang(l){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}document.documentElement.classList.toggle('show-en',l!=='ko');}
</script>`;

function figureHtml(v) {
  return `        <figure class="shot">
          <img src="/gallery/img/${v.slug}.png" width="600" height="600" loading="lazy"
               alt="${esc(v.alt)}" />
          <figcaption>${v.caption}</figcaption>
        </figure>`;
}

function hubPage() {
  const koVars = VARIATIONS.filter((v) => v.lang === 'ko');
  const intlVars = VARIATIONS.filter((v) => v.lang !== 'ko');
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: '원형 24시간 시간표 디자인 갤러리 · Circle Timetable Gallery',
    description: `색상 테마·배경 패턴·그라데이션·글꼴·언어를 바꿔 그린 원형 24시간 시간표 ${VARIATIONS.length}가지 예시.`,
    url: `${ORIGIN}/gallery/`,
    inLanguage: LANGS,
    datePublished: DATE,
    publisher: { '@type': 'Organization', name: '24Houring', url: ORIGIN },
    image: VARIATIONS.map((v) => ({
      '@type': 'ImageObject',
      contentUrl: `${ORIGIN}/gallery/img/${v.slug}.png`,
      name: v.alt,
      inLanguage: v.lang,
      creditText: '24Houring',
      license: `${ORIGIN}/terms`,
    })),
  };
  const body = `    <div class="lang-ko">
    <h1>원형 시간표 디자인 갤러리 <span class="en">/ Circle Timetable Gallery</span></h1>
    <p class="lead">같은 하루라도 색과 배경, 글꼴을 바꾸면 전혀 다른 시간표가 됩니다. 아래는 24Houring으로 실제로 그린 ${VARIATIONS.length}가지 예시입니다 — ${SCHEDULES.length}가지 하루 × ${STYLES.length}가지 디자인, 그리고 ${LANGS.length}개 언어.</p>
    <p>마음에 드는 조합을 찾았다면, <a href="/">24Houring</a>에서 같은 색상 테마·배경·폰트를 직접 골라 자신의 하루에 적용할 수 있습니다. 완성한 시간표는 PNG로 내보내 저장하거나 공유할 수 있습니다.</p>

    <h2>어떻게 만들어졌나</h2>
    <p>모든 이미지는 합성이나 목업이 아니라 <strong>실제 앱 화면을 그대로 렌더한 결과</strong>입니다. 각 이미지는 하나의 하루 일정(학생·직장인·수험생·프리랜서·미라클 모닝·야간 교대)에 하나의 디자인 조합 — 색상 팔레트, 배경 패턴(도트·그리드·사선·물결·체커·종이·메모) 또는 선형·방사형 그라데이션, 글꼴, 라이트/다크 — 을 입혀 만들었습니다.</p>
    <p>여기 보이는 모든 스타일은 앱에서 클릭 몇 번으로 재현할 수 있습니다. 색상 팔레트는 타임 팔레트 메뉴에서, 배경과 글꼴은 디자인 매지션이나 환경설정에서 고를 수 있습니다.</p>

    <h2>디자인을 고를 때</h2>
    <p><strong>파스텔·차분 계열</strong>은 항목이 많은 하루에 잘 맞습니다. 색이 강하지 않아 10개 이상의 블록이 있어도 눈이 피로하지 않습니다.</p>
    <p><strong>바다·숲 계열</strong>은 색상 범위가 좁아 시간표가 하나의 덩어리처럼 보입니다. 공부나 업무처럼 한 가지 활동이 하루의 큰 부분을 차지할 때 정돈되어 보입니다.</p>
    <p><strong>모노(무채색)</strong>는 인쇄하거나 문서에 넣을 때 유리하고, 다크 모드와 조합하면 야간 근무자에게 눈이 편합니다.</p>
    <p><strong>손글씨체(개구)</strong>는 아이와 함께 쓰는 생활계획표에, <strong>명조체</strong>는 기록·일기 성격이 강한 시간표에 어울립니다.</p>
    <h2>한국어 시간표 (${koVars.length})</h2>
    </div>
    <div class="lang-en">
    <h1>Circle Timetable Gallery <span class="en">/ 원형 시간표 디자인 갤러리</span></h1>
    <p class="lead">The same day looks like a different plan once the colours, background and typeface change. Below are ${VARIATIONS.length} examples drawn with 24Houring — ${SCHEDULES.length} kinds of day × ${STYLES.length} designs, in ${LANGS.length} languages.</p>
    <p>Found a combination you like? Pick the same palette, background and font in <a href="/">24Houring</a> and apply it to your own day, then export the result as a PNG to keep or share.</p>

    <h2>How these were made</h2>
    <p>None of these are mockups. Every image is a <strong>direct render of the actual app</strong>: one day's schedule (student, office worker, exam candidate, freelancer, miracle morning, night shift) dressed in one design combination — colour palette, a background pattern (dots, grid, diagonal, waves, checker, paper, memo) or a linear/radial gradient, a typeface, and light or dark mode.</p>
    <p>Every style here is reproducible in a few clicks: palettes live under the Time Palette menu, while backgrounds and fonts are chosen in the design magician or in settings.</p>

    <h2>Choosing a design</h2>
    <p><strong>Pastel and calm</strong> palettes suit days with many entries — the colours stay quiet enough that ten or more blocks don't tire the eye.</p>
    <p><strong>Ocean and forest</strong> use a narrow hue range, so the ring reads as one mass. That looks tidy when a single activity — studying, or work — owns a large part of the day.</p>
    <p><strong>Mono</strong> prints well and drops cleanly into documents; paired with dark mode it's easier on the eyes for night workers.</p>
    <p>The <strong>handwriting face</strong> suits a plan made with a child, and the <strong>serif</strong> fits timetables that double as a diary.</p>
    <h2>Korean timetables (${koVars.length})</h2>
    </div>

    <div class="shots">
${koVars.map(figureHtml).join('\n')}
    </div>

    <div class="lang-ko"><h2>다른 언어로 그린 시간표 (${intlVars.length})</h2>
    <p>같은 하루를 영어·일본어·독일어·스페인어·프랑스어·중국어·러시아어로도 그렸습니다. 앱 자체가 ${LANGS.length}개 언어를 지원합니다.</p></div>
    <div class="lang-en"><h2>Timetables in other languages (${intlVars.length})</h2>
    <p>The same days drawn in English, Japanese, German, Spanish, French, Chinese and Russian — the app itself supports ${LANGS.length} languages.</p></div>

    <div class="shots">
${intlVars.map(figureHtml).join('\n')}
    </div>

    <div class="lang-ko">
    <h2>이미지 사용에 대해</h2>
    <p>이 페이지의 이미지는 24Houring이 직접 만든 것입니다. 블로그·과제·소개 글에 출처(24houring.com)를 밝히고 사용하실 수 있습니다.</p>
    </div>
    <div class="lang-en">
    <h2>Using these images</h2>
    <p>These images were made by 24Houring. You're welcome to use them in blog posts, coursework or write-ups with a credit to 24houring.com.</p>
    </div>
    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>내 시간표에 적용해 보기</strong></p>
        <p style="margin:0">24Houring에서 색상 테마·배경·글꼴을 골라 나의 하루에 입혀 보세요. 설치·회원가입 없이 무료입니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Apply it to your own day</strong></p>
        <p style="margin:0">Choose a palette, background and typeface in 24Houring and dress your own day in it. Free, no sign-up.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>원형 시간표 디자인 갤러리 — ${VARIATIONS.length}가지 색·배경·글꼴·언어 예시 · 24Houring</title>
<meta name="description" content="색상 테마·배경 패턴·그라데이션·글꼴을 바꿔 그린 원형 24시간 시간표 ${VARIATIONS.length}가지 예시 — 8개 언어. Circle timetable gallery: ${VARIATIONS.length} designs in 8 languages." />
<link rel="canonical" href="${ORIGIN}/gallery/" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="원형 시간표 디자인 갤러리 · Circle Timetable Gallery" />
<meta property="og:description" content="${VARIATIONS.length} circle-timetable designs across palettes, backgrounds, fonts and 8 languages." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${ORIGIN}/gallery/" />
<meta property="og:image" content="${ORIGIN}/gallery/img/${VARIATIONS[0].slug}.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6947130056543786" crossorigin="anonymous"></script>
<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>${LANG_JS}
<style>
  .shots { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:18px; margin:18px 0 8px }
  .shot { border:1px solid #e3e6ec; border-radius:14px; overflow:hidden; background:#fff }
  .shot img { display:block; width:100%; height:auto }
  .shot figcaption { padding:8px 10px; font-size:12.5px; line-height:1.45; color:#5b6577; border-top:1px solid #eef0f4 }
  [data-theme='dark'] .shot { background:#0f131a; border-color:#232a36 }
  [data-theme='dark'] .shot figcaption { color:#98a1b3; border-top-color:#232a36 }
</style>
</head>
<body>
<div class="wrap">
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>${NAV}
  </header>
  <main class="article">
${body}
  </main>${FOOT}
</div>
</body>
</html>
`;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

mkdirSync(IMG, { recursive: true });
await screenshots();
writeFileSync(join(OUT, 'index.html'), hubPage());
console.log(`page  index.html (${VARIATIONS.length} images: ${VARIATIONS.filter((v) => v.lang === 'ko').length} ko + ${VARIATIONS.filter((v) => v.lang !== 'ko').length} intl)`);
