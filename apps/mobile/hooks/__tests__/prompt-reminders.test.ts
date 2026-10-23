import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { remindUntilAnswered } from '@/hooks/prompt-reminders';

describe('remindUntilAnswered', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not buzz the moment the prompt opens', () => {
    const buzz = vi.fn();
    remindUntilAnswered(buzz);

    vi.advanceTimersByTime(19_999);

    expect(buzz).not.toHaveBeenCalled();
  });

  it('buzzes every 20s for two minutes, then once a minute', () => {
    const buzz = vi.fn();
    remindUntilAnswered(buzz);

    vi.advanceTimersByTime(120_000);
    expect(buzz).toHaveBeenCalledTimes(6);

    vi.advanceTimersByTime(59_999);
    expect(buzz).toHaveBeenCalledTimes(6);

    vi.advanceTimersByTime(1);
    expect(buzz).toHaveBeenCalledTimes(7);
  });

  it('keeps reminding for as long as the prompt stays open', () => {
    const buzz = vi.fn();
    remindUntilAnswered(buzz);

    vi.advanceTimersByTime(120_000 + 30 * 60_000);

    expect(buzz).toHaveBeenCalledTimes(6 + 30);
  });

  it('stops once the prompt is answered', () => {
    const buzz = vi.fn();
    const stop = remindUntilAnswered(buzz);

    vi.advanceTimersByTime(40_000);
    stop();
    vi.advanceTimersByTime(10 * 60_000);

    expect(buzz).toHaveBeenCalledTimes(2);
  });
});
