import { pad2 } from './clock-utils';

/** A simple analog clock face (hour/minute/second hands), driven by `date`. */
export function AnalogClock({ date, size = 150 }: { date: Date; size?: number }) {
  const r = size / 2;
  const cx = r;
  const cy = r;

  const h = date.getHours() % 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  const hourAng = (h + m / 60) * 30;
  const minAng = (m + s / 60) * 6;
  const secAng = s * 6;

  const hand = (angleDeg: number, len: number) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x2: cx + Math.cos(a) * len, y2: cy + Math.sin(a) * len };
  };
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const outer = r - 5;
    const major = i % 3 === 0;
    const inner = r - (major ? 13 : 9);
    return {
      x1: cx + Math.cos(a) * inner,
      y1: cy + Math.sin(a) * inner,
      x2: cx + Math.cos(a) * outer,
      y2: cy + Math.sin(a) * outer,
      major,
    };
  });

  const hh = hand(hourAng, r * 0.5);
  const mm = hand(minAng, r * 0.72);
  const ss = hand(secAng, r * 0.82);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`아날로그 시계 ${pad2(date.getHours())}:${pad2(m)}`}
    >
      <circle cx={cx} cy={cy} r={r - 1} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={2} />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="hsl(var(--foreground))"
          strokeWidth={t.major ? 2.5 : 1}
          opacity={t.major ? 0.9 : 0.4}
          strokeLinecap="round"
        />
      ))}
      <line x1={cx} y1={cy} x2={hh.x2} y2={hh.y2} stroke="hsl(var(--foreground))" strokeWidth={4} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mm.x2} y2={mm.y2} stroke="hsl(var(--foreground))" strokeWidth={3} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={ss.x2} y2={ss.y2} stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3.5} fill="#EF4444" />
    </svg>
  );
}
