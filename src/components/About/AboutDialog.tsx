import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/usePreferences';

/** Public contact for feedback / questions (shown in the brand section). */
const CONTACT_EMAIL = 'singlena@gmail.com';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Feature {
  emoji: string;
  title: string;
  desc: string;
}

/** One line a tab or a way of using it, in the order of the five buttons. */
const FEATURES_KO: Feature[] = [
  { emoji: '⏰', title: '시간표 · 하루를 원으로', desc: '원을 눌러 시간대를 나누고 경계를 끌어 시간을 맞춥니다. 24시간·낮·밤 보기, 표 보기, 계획과 실제를 비교하는 기록 모드까지.' },
  { emoji: '📅', title: '캘린더 · 다꾸', desc: '두 달을 나란히 보고 여러 날·반복 일정을 넣습니다. 속지·스티커·마스킹 테이프·사진으로 꾸며 이미지로 저장합니다. 구글 캘린더 불러오기(Pro).' },
  { emoji: '🧭', title: '라이프 · 인생을 한 줄로', desc: '태어난 날부터 오늘, 앞으로의 계획까지 한 줄의 타임라인에 담습니다. 부모님의 선을 나란히 놓아 같은 해를 함께 읽고, 긴 이미지로 저장합니다.' },
  { emoji: '🫂', title: '관계 · 사람 지도', desc: '나를 가운데 두고 가족·친구·동료를 친밀도대로 배치합니다. 소그룹, 사람 사이의 관계, 생일과 연락·만남 기록을 사람마다 남깁니다.' },
  { emoji: '🌍', title: '플레이스 · 가 본 곳', desc: '지구본에 가 본 나라를 칠하고 도시와 핀을 남깁니다. 전체 지도나 지구본 모양으로 저장합니다. 위치는 자동으로 수집하지 않습니다.' },
  { emoji: '📱', title: '홈 화면 위젯', desc: 'Android 앱에서 시간표 원과 캘린더·라이프·사람·플레이스 위젯을 홈 화면에 올려 둘 수 있습니다.' },
  { emoji: '🔔', title: '알림', desc: '다음 시간대가 시작되면 알려 주고, 정각·주기 알림도 켤 수 있습니다. 앱을 닫아도 오는 푸시 알림은 Pro입니다.' },
  { emoji: '📝', title: '메모 · 목표 · 시계 도구', desc: '포스트잇·테두리 메모, 목표, 일기, 시계·타이머·알람·날씨를 곁에 띄워 둡니다.' },
  { emoji: '💾', title: '내보내기 · 공유 · 백업', desc: 'PNG·PDF로 저장하고 이미지나 링크로 공유합니다. 탭마다 JSON으로 백업·복원할 수 있습니다.' },
  { emoji: '☁️', title: '동기화 (Pro)', desc: '로그인하면 여러 기기에서 같은 기록을 씁니다. 일기 잠금을 켜면 종단간 암호화로 보관합니다.' },
  { emoji: '🌐', title: '어디서나, 광고 없이', desc: '8개 언어, 오프라인 동작, 홈 화면 설치. 회원가입 없이 바로 쓰고, 광고는 어디에도 없습니다.' },
];

const FEATURES_EN: Feature[] = [
  { emoji: '⏰', title: 'Timetable · your day as a circle', desc: 'Tap the ring to split blocks and drag the edges to fit. 24-hour, day and night views, a table view, and a record mode to compare plan with reality.' },
  { emoji: '📅', title: 'Calendar · decorate it', desc: 'Two months side by side, multi-day and repeating plans, then paper, stickers, washi tape and photos — saved as an image. Google Calendar import (Pro).' },
  { emoji: '🧭', title: 'Life · one line for a lifetime', desc: 'From the day you were born to today and the plans ahead, on one timeline. Set a parent’s line beside yours to read the same years together, and save it as one long image.' },
  { emoji: '🫂', title: 'Relation · a map of your people', desc: 'You in the middle, family, friends and colleagues placed by how close they are. Subgroups, ties between people, birthdays, and a record of every meeting.' },
  { emoji: '🌍', title: 'Place · where you have been', desc: 'Colour in the countries you have walked on, add cities and pins, and save the flat map or the globe. Your location is never collected automatically.' },
  { emoji: '📱', title: 'Home-screen widgets', desc: 'In the Android app, put the timetable ring and calendar, life, people and place widgets on your home screen.' },
  { emoji: '🔔', title: 'Alarms', desc: 'A nudge when the next block starts, plus on-the-hour or interval chimes. Push alarms that arrive with the app closed are Pro.' },
  { emoji: '📝', title: 'Memos, goals & clock tools', desc: 'Post-it and rim memos, goals, a diary, and a clock, timer, alarm and weather beside the plan.' },
  { emoji: '💾', title: 'Export, share & back up', desc: 'Save as PNG or PDF, share as an image or a link, and back up or restore each tab as JSON.' },
  { emoji: '☁️', title: 'Sync (Pro)', desc: 'Sign in to use the same record on every device; turn on the diary lock for end-to-end encryption.' },
  { emoji: '🌐', title: 'Everywhere, no ads', desc: '8 languages, works offline, installable to the home screen. No sign-up needed, and no ads anywhere.' },
];

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t, lang } = useTranslation();
  const ko = lang === 'ko';
  const features = ko ? FEATURES_KO : FEATURES_EN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
              24Hou<span style={{ color: '#FF4D4D' }}>ring</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {ko
            ? '하루를 원으로 그리는 시간표에서 시작해, 한 달의 캘린더, 한 사람의 인생, 곁에 있는 사람들, 다녀온 곳까지 — 삶을 다섯 장의 그림으로 기록하는 플래너입니다. 회원가입 없이 무료로, 광고 없이 씁니다.'
            : 'It starts with your day drawn as a circle, then goes on to the month, a whole life, the people around you and the places you have been — five pictures of one life. Free, no sign-up, and no ads.'}
        </p>

        {/* Manual — features */}
        <section className="mt-1 flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {ko ? '주요 기능' : 'Features'}
          </h3>
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-2.5">
              <span className="shrink-0 text-lg leading-6" aria-hidden="true">{f.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{f.title}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">{f.desc}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Quick start */}
        <section className="mt-3 rounded-lg bg-muted-foreground/7 p-3">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {ko ? '시작하기' : 'Quick start'}
          </h3>
          <ol className="ml-4 list-decimal text-xs leading-relaxed text-foreground">
            {(ko
              ? ['프리셋을 고르거나 빈 하루에서 시작해, 원을 눌러 시간대를 나누고 경계를 끌어 시간을 맞춥니다.', '상단의 다섯 아이콘으로 시간표·캘린더·라이프·관계·플레이스를 오갑니다. 탭마다 처음 열면 짧은 안내가 나옵니다.', '라이프에는 생일과 인생의 사건을, 관계에는 사람을, 플레이스에는 가 본 나라를 채워 봅니다.', '내보내기(⬇)로 지금 보고 있는 탭을 이미지나 백업 파일로 저장합니다.']
              : ['Pick a preset or start from an empty day; tap the ring to split blocks and drag the edges to fit.', 'Move between Timetable, Calendar, Life, Relation and Place with the five icons up top; each tab offers a short tour the first time.', 'Add your birthday and life’s moments to Life, people to Relation, and countries to Place.', 'Export (⬇) saves the tab you are on as an image or a backup file.']
            ).map((s, i) => (
              <li key={i} className="mt-0.5">{s}</li>
            ))}
          </ol>
        </section>

        {/* Brand — Circloser */}
        <section className="mt-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-bold text-foreground">Circloser</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {ko
              ? 'Circloser는 1인 창업 기업입니다. 원(circle)에 한 걸음 더 가까이(closer) — 일상을 더 단순하고 아름답게 만드는 작은 도구를 직접 설계하고 만듭니다. 24Houring은 Circloser가 선보이는 제품입니다.'
              : 'Circloser is a one-person (indie) startup. A step closer to the circle — we design and build small tools that make everyday life simpler and more beautiful. 24Houring is a product by Circloser.'}
          </p>
          {/* Public contact for feedback / questions. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {ko ? '문의 · 피드백' : 'Contact · feedback'}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        {/* The legal pages used to sit in a footer under the planner; the
            page is the app now, so they are listed here instead. */}
        <nav className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground" data-about-links>
          <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{t('footer.privacy')}</a>
          <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{t('footer.terms')}</a>
          <a href="/refund" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{t('footer.refund')}</a>
          <a href="/contact" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{t('footer.contact')}</a>
          <a href="/guides/" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{t('footer.guides')}</a>
        </nav>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          24houring.com · © Circloser
        </p>
      </DialogContent>
    </Dialog>
  );
}
