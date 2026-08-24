import { describe, it, expect } from 'vitest';
import { weeklyReport, weeklyInsights } from '@/lib/weekly-report';
import type { RecordItem } from '@/hooks/useRecords';

const rec = (label: string, start: string, end: string, color = '#000'): RecordItem => ({
  id: `${label}-${start}`,
  label,
  start,
  end,
  color,
});

describe('weeklyReport', () => {
  it('aggregates the last 7 days ending today, labels desc with pct', () => {
    const byDate = {
      '2026-08-24': [rec('연구', '09:00', '11:00'), rec('점심', '12:00', '12:30')], // 120 + 30
      '2026-08-23': [rec('연구', '10:00', '11:30')], // 90
      '2026-08-20': [rec('운동', '07:00', '08:00')], // 60 (inside window)
      '2026-08-10': [rec('연구', '09:00', '18:00')], // OUTSIDE the 7-day window
    };
    const r = weeklyReport(byDate, '2026-08-24', 7);

    expect(r.days).toHaveLength(7);
    expect(r.days[6].date).toBe('2026-08-24'); // newest last
    expect(r.days[0].date).toBe('2026-08-18'); // oldest first
    expect(r.total).toBe(300); // 120+30+90+60, 08-10 excluded
    expect(r.activeDays).toBe(3);
    expect(r.maxDay).toBe(150); // 08-24 busiest
    expect(r.avgPerActiveDay).toBe(100); // 300/3

    // byLabel: 연구 210, 운동 60, 점심 30
    expect(r.byLabel.map((x) => [x.label, x.minutes])).toEqual([
      ['연구', 210],
      ['운동', 60],
      ['점심', 30],
    ]);
    expect(r.byLabel[0].pct).toBe(70); // 210/300
  });

  it('joins labels case-insensitively across days', () => {
    const byDate = {
      '2026-08-24': [rec('Study', '09:00', '10:00')],
      '2026-08-23': [rec('study', '09:00', '10:00')],
    };
    const r = weeklyReport(byDate, '2026-08-24', 7);
    expect(r.byLabel).toHaveLength(1);
    expect(r.byLabel[0].minutes).toBe(120);
  });

  it('counts midnight-wrap records and includes empty days as zero', () => {
    const byDate = {
      '2026-08-24': [rec('야근', '23:00', '00:30')], // wraps → 90
    };
    const r = weeklyReport(byDate, '2026-08-24', 7);
    expect(r.total).toBe(90);
    expect(r.days.filter((d) => d.minutes === 0)).toHaveLength(6); // 6 empty days
    expect(r.activeDays).toBe(1);
  });

  it('unlabeled time counts in totals but not the label split', () => {
    const byDate = {
      '2026-08-24': [rec('', '09:00', '10:00'), rec('연구', '10:00', '11:00')],
    };
    const r = weeklyReport(byDate, '2026-08-24', 7);
    expect(r.total).toBe(120);
    expect(r.byLabel).toHaveLength(1);
    expect(r.byLabel[0].label).toBe('연구');
  });

  it('30-day window and empty input', () => {
    expect(weeklyReport({}, '2026-08-24', 30).days).toHaveLength(30);
    const empty = weeklyReport({}, '2026-08-24', 7);
    expect(empty.total).toBe(0);
    expect(empty.activeDays).toBe(0);
    expect(empty.avgPerActiveDay).toBe(0);
    expect(empty.byLabel).toEqual([]);
  });

  it('counts distinct active days per label (once per day)', () => {
    const byDate = {
      '2026-08-24': [rec('연구', '09:00', '10:00'), rec('연구', '14:00', '15:00')], // same day twice
      '2026-08-23': [rec('연구', '09:00', '10:00')],
    };
    const r = weeklyReport(byDate, '2026-08-24', 7);
    expect(r.byLabel[0].days).toBe(2); // 2 distinct days, not 3 records
    expect(r.byLabel[0].minutes).toBe(180);
  });
});

describe('weeklyInsights', () => {
  const base = {
    '2026-08-24': [rec('연구', '09:00', '12:00'), rec('점심', '12:00', '12:30')], // 180 + 30
    '2026-08-23': [rec('연구', '10:00', '11:00')], // 60
    '2026-08-20': [rec('운동', '07:00', '08:00')], // 60
  };

  it('emits top / consistent / busiestDay / trend in order', () => {
    const r = weeklyReport(base, '2026-08-24', 7);
    const ins = weeklyInsights(r, 165); // prev window logged 165 → +100% (330 vs 165)
    expect(ins.map((i) => i.kind)).toEqual(['top', 'consistent', 'busiestDay', 'trend']);

    expect(ins[0].params).toMatchObject({ label: '연구', minutes: 240 }); // 180+60
    expect(ins[1].params).toMatchObject({ label: '연구', days: 2, span: 7 }); // logged 2 days
    expect(ins[2].params).toMatchObject({ date: '08/24', minutes: 210 }); // busiest day
    expect(ins[3].params).toMatchObject({ dir: 'up', pct: 100 }); // (330-165)/165
  });

  it('drops the consistent line when nothing repeats, and trend when no prior', () => {
    const single = { '2026-08-24': [rec('연구', '09:00', '10:00')] };
    const r = weeklyReport(single, '2026-08-24', 7);
    const ins = weeklyInsights(r, 0);
    expect(ins.map((i) => i.kind)).toEqual(['top']); // no consistency (1 day), no busiest (1 active day), no trend (prev 0)
  });

  it('reports a downward trend and returns nothing for an empty window', () => {
    const r = weeklyReport(base, '2026-08-24', 7);
    expect(weeklyInsights(r, 660)[3]).toMatchObject({ kind: 'trend', params: { dir: 'down', pct: 50 } }); // 330 vs 660
    expect(weeklyInsights(weeklyReport({}, '2026-08-24', 7), 100)).toEqual([]);
  });
});
