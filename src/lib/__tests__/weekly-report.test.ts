import { describe, it, expect } from 'vitest';
import { weeklyReport } from '@/lib/weekly-report';
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
});
