import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdSlot } from '@/components/Ads/AdSlot';
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

const FEATURES_KO: Feature[] = [
  { emoji: '⏰', title: '24시간 원형 시간표', desc: '원을 클릭해 시간대를 나누고, 경계를 드래그해 시간을 조절하며, +/−로 칸을 추가·병합합니다.' },
  { emoji: '🕛', title: '12시간 시계 보기', desc: '상단 토글로 24시간 → 낮(06–18) → 밤(18–06)을 전환합니다. 같은 하루와 연동됩니다.' },
  { emoji: '🗂️', title: '프리셋 · 여러 날짜', desc: '라이프스타일 프리셋으로 시작하고, 여러 날짜(멀티데이)를 만들며, 내 시간표로 저장·불러옵니다.' },
  { emoji: '💾', title: '내보내기 · 백업', desc: 'PNG·PDF·JSON으로 내보내고, 전체 데이터를 백업·복원합니다.' },
  { emoji: '📤', title: '공유', desc: '시간표를 이미지로 만들어 인스타그램·카카오톡 등으로 바로 공유합니다.' },
  { emoji: '📝', title: '메모', desc: '포스트잇 메모, 테두리(시각 연동) 메모, 그리고 전체 메모 목록을 제공합니다.' },
  { emoji: '🧰', title: '시계 도구', desc: '좌측 하단에서 시계·타이머·알람·캘린더·날씨를 띄울 수 있습니다.' },
  { emoji: '📏', title: '시간선', desc: '현재 시간선의 색·두께를 바꾸고, 세계 여러 도시의 시간선을 추가합니다.' },
  { emoji: '🌐', title: '어디서나, 무료', desc: '7개 언어, 오프라인 동작, 홈 화면에 설치 가능. 회원가입 없이 무료로 씁니다.' },
];

const FEATURES_EN: Feature[] = [
  { emoji: '⏰', title: '24-hour circular timetable', desc: 'Click the ring to split time blocks, drag boundaries to adjust, and use +/− to add or merge.' },
  { emoji: '🕛', title: '12-hour clock views', desc: 'Toggle 24h → Day (06–18) → Night (18–06) up top; every view edits the same day.' },
  { emoji: '🗂️', title: 'Presets & multi-day', desc: 'Start from lifestyle presets, build multiple days, and save/load your own schedules.' },
  { emoji: '💾', title: 'Export & backup', desc: 'Export to PNG, PDF and JSON; back up and restore all your data.' },
  { emoji: '📤', title: 'Share', desc: 'Turn your timetable into an image and share it to Instagram, KakaoTalk and more.' },
  { emoji: '📝', title: 'Memos', desc: 'Post-it notes, rim memos pinned to a time, and a full memo archive.' },
  { emoji: '🧰', title: 'Clock tools', desc: 'Pop out a clock, timer, alarm, calendar and weather from the bottom-left.' },
  { emoji: '📏', title: 'Time lines', desc: 'Recolour/resize the current-time line and add world-clock lines for other cities.' },
  { emoji: '🌐', title: 'Everywhere, free', desc: '7 languages, offline support, installable to your home screen — free, no sign-up.' },
];

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { lang } = useTranslation();
  const ko = lang === 'ko';
  const features = ko ? FEATURES_KO : FEATURES_EN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
              24Hour<span style={{ color: '#FF4D4D' }}>ing</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
          {ko
            ? '하루 24시간을 원형 시계처럼 그리는 무료 시간표 플래너입니다. 드래그로 편집하고, 저장·내보내기·공유까지 한곳에서.'
            : 'A free day planner that draws your 24 hours as a clock. Edit by dragging, then save, export and share — all in one place.'}
        </p>

        {/* Manual — features */}
        <section className="mt-1 flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
            {ko ? '주요 기능' : 'Features'}
          </h3>
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-2.5">
              <span className="shrink-0 text-lg leading-6" aria-hidden="true">{f.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{f.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'hsl(var(--text-muted))' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Quick start */}
        <section className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'hsl(var(--text-muted) / 0.07)' }}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
            {ko ? '시작하기' : 'Quick start'}
          </h3>
          <ol className="ml-4 list-decimal text-xs leading-relaxed" style={{ color: 'hsl(var(--foreground))' }}>
            {(ko
              ? ['프리셋을 고르거나 빈 하루에서 시작합니다.', '원을 클릭해 시간대를 나누고 이름·색·아이콘을 지정한 뒤, 경계를 드래그해 시간을 맞춥니다.', '내보내기 또는 공유로 시간표를 저장합니다.']
              : ['Pick a preset or start from an empty day.', 'Click the ring to split blocks, set a name/color/icon, then drag boundaries to fit your times.', 'Save your timetable via export or share.']
            ).map((s, i) => (
              <li key={i} className="mt-0.5">{s}</li>
            ))}
          </ol>
        </section>

        {/* Brand — Circloser */}
        <section className="mt-3 rounded-lg border p-3" style={{ borderColor: 'hsl(var(--border))' }}>
          <h3 className="text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>Circloser</h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'hsl(var(--text-muted))' }}>
            {ko
              ? 'Circloser는 1인 창업 기업입니다. 원(circle)에 한 걸음 더 가까이(closer) — 일상을 더 단순하고 아름답게 만드는 작은 도구를 직접 설계하고 만듭니다. 24Houring은 Circloser가 선보이는 제품입니다.'
              : 'Circloser is a one-person (indie) startup. A step closer to the circle — we design and build small tools that make everyday life simpler and more beautiful. 24Houring is a product by Circloser.'}
          </p>
          {/* Public contact for feedback / questions. */}
          <p className="mt-2 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
            {ko ? '문의 · 피드백' : 'Contact · feedback'}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium underline underline-offset-2"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        {/* Reserved ad space (consistent with the other dialogs). */}
        <AdSlot slot="about" className="mt-3" />

        <p className="mt-2 text-center text-[11px]" style={{ color: 'hsl(var(--text-muted) / 0.8)' }}>
          24houring.com · © Circloser
        </p>
      </DialogContent>
    </Dialog>
  );
}
