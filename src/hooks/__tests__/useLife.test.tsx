import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLife } from '../useLife';
import { LIFE_KEY } from '@/lib/life';
import { resetPersistence } from '@/lib/persistence';

const stored = () => JSON.parse(localStorage.getItem(LIFE_KEY) ?? 'null');

describe('useLife', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPersistence();
  });

  it('does not write just because the page opened', () => {
    renderHook(() => useLife());
    expect(localStorage.getItem(LIFE_KEY)).toBeNull();
  });

  it('saves every edit, sorted on read, and survives a reload', () => {
    const { result, unmount } = renderHook(() => useLife());
    act(() => result.current.setProfile({ birthDate: '1985-05-15' }));
    act(() => { result.current.addMilestone({ date: '2010', title: '입사', category: 'career' }); });
    act(() => { result.current.addMilestone({ date: '2001-03', title: '입학', category: 'education' }); });
    expect(stored().milestones.map((m: { title: string }) => m.title)).toEqual(['입사', '입학']);
    expect(stored().updatedAt).not.toBe('');
    unmount();

    const again = renderHook(() => useLife());
    expect(again.result.current.life.profile.birthDate).toBe('1985-05-15');
    const id = again.result.current.life.milestones[0].id;
    act(() => again.result.current.updateMilestone(id, { date: '2011', title: '이직', category: 'career' }));
    act(() => again.result.current.removeMilestone(again.result.current.life.milestones[1].id));
    expect(stored().milestones).toEqual([{ id, date: '2011', title: '이직', category: 'career' }]);
  });

  it('keeps the ending note only while it has words in it', () => {
    const { result } = renderHook(() => useLife());
    act(() => result.current.setEndingNote('고마웠어요'));
    expect(stored().endingNote.text).toBe('고마웠어요');
    act(() => result.current.setEndingNote('   '));
    expect(stored().endingNote).toBeNull();
  });
});
