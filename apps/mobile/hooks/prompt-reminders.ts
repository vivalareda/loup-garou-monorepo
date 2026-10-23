/**
 * Turn reminders. Players keep their phone face down on the table; when the
 * game waits on one of them (a prompt is open) and they have not answered,
 * their phone vibrates again and again until they do. There is no deadline,
 * so the reminders never stop on their own.
 */

/** Reminders that come quickly after the prompt opens, before slowing down. */
const QUICK_REMINDERS = 6;

const QUICK_INTERVAL_MS = 20_000;
const SLOW_INTERVAL_MS = 60_000;

/** Wait before reminder `n` (0-based): 20s apart for the first two minutes,
 * then once a minute. */
export function reminderDelayMs(n: number) {
  return n < QUICK_REMINDERS ? QUICK_INTERVAL_MS : SLOW_INTERVAL_MS;
}

/**
 * Calls `buzz` on the reminder schedule until the returned function is
 * called (the prompt was answered or closed).
 */
export function remindUntilAnswered(buzz: () => void): () => void {
  let sent = 0;
  let timer: ReturnType<typeof setTimeout>;

  const scheduleNext = () => {
    timer = setTimeout(() => {
      buzz();
      sent += 1;
      scheduleNext();
    }, reminderDelayMs(sent));
  };

  scheduleNext();

  return () => clearTimeout(timer);
}
