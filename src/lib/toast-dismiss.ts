import { toast } from 'sonner';

/**
 * Close a toast once it has been on screen for `ms`, counting only time the page
 * is visible (a toast raised in a background tab still waits to be seen).
 *
 * Sonner pauses its own countdown while the pointer rests on the toast stack,
 * and on a touch screen a tap on a toast keeps it paused until the next tap
 * somewhere else, so a short informational toast could stay up indefinitely.
 * This timer ignores the pointer. Dismissing a toast that already closed is a
 * no-op.
 */
export function dismissAfterVisible(id: string | number, ms: number): void {
  let left = ms;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    if (timer !== undefined || document.hidden) return;
    startedAt = Date.now();
    timer = setTimeout(done, left);
  };
  const pause = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    left -= Date.now() - startedAt;
  };
  const onVisibility = () => (document.hidden ? pause() : start());
  function done() {
    document.removeEventListener('visibilitychange', onVisibility);
    toast.dismiss(id);
  }

  document.addEventListener('visibilitychange', onVisibility);
  start();
}
