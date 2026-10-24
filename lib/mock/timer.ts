/** A server-relative, monotonic display timer. The database remains authoritative.
 * Returning false from onExpire retries on the next tick (for an in-flight save).
 */
export function startMockCountdown({ deadlineAt, serverNow, onTick, onExpire, now = () => performance.now() }: {
  deadlineAt: string; serverNow: string; onTick: (seconds: number) => void;
  onExpire: () => boolean; now?: () => number;
}): () => void {
  const localEnd = now() + Math.max(0, Date.parse(deadlineAt) - Date.parse(serverNow));
  let stopped = false;
  const cancel = () => { stopped = true; clearInterval(timer); };
  const tick = () => {
    if (stopped) return;
    const seconds = Math.max(0, Math.ceil((localEnd - now()) / 1000));
    onTick(seconds);
    if (seconds === 0 && onExpire()) cancel();
  };
  const timer = setInterval(tick, 1000);
  tick();
  return cancel;
}
