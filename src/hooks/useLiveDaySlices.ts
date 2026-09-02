import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDayChange } from '@/hooks/useDayChange';
import type { TimeSlice } from '@/types/time-slice';

/**
 * The timetable alarms are allowed to speak for: TODAY's, or `null` while the
 * app is showing a saved/diary day of another date.
 *
 * Opening a past day replaces `present` with THAT day's timetable (LOAD_DIARY),
 * so anything reading `present` blindly starts announcing an old schedule. That
 * bit hardest through Web Push: the plan is a server-side snapshot shared by
 * every device, so a single upload made from a diary view left ALL of them
 * ringing yesterday's blocks — and since the diary-view cursor itself syncs,
 * both devices land in that view together. Alarms follow the live day only;
 * leaving the view restores `present` and the plan re-uploads on its own.
 *
 * (`useDailyDoneReset` already draws the same line for the daily check reset.)
 */
export function useLiveDaySlices(): readonly TimeSlice[] | null {
  const today = useDayChange();
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const slices = useStoreSelector((s) => s.history.present.slices);
  return liveDaySlices(slices, diaryDate, today);
}

/** The rule itself, split out so it can be tested without a store. `diaryDate`
 *  null = the live day; equal to `today` = today's own saved day (still live). */
export function liveDaySlices(
  slices: readonly TimeSlice[],
  diaryDate: string | null,
  today: string,
): readonly TimeSlice[] | null {
  return !diaryDate || diaryDate === today ? slices : null;
}
