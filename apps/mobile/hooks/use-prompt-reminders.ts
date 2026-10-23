import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import { useEffect } from 'react';
import { remindUntilAnswered } from '@/hooks/prompt-reminders';
import { useModalStore } from '@/hooks/use-modal-store';

const TAPS_PER_BUZZ = 3;
const TAP_GAP_MS = 150;

/** A few strong taps in a row: one alone is easy to miss on a table. */
function buzz() {
  for (let tap = 0; tap < TAPS_PER_BUZZ; tap += 1) {
    setTimeout(() => {
      impactAsync(ImpactFeedbackStyle.Heavy).catch((error) => {
        console.error('Failed to vibrate for a turn reminder', error);
      });
    }, tap * TAP_GAP_MS);
  }
}

/**
 * Vibrates the phone on the reminder schedule (prompt-reminders.ts) while
 * a prompt waits on this player. The store hands out a new modalData on
 * every open, so each prompt restarts the schedule from the beginning.
 */
export function usePromptReminders() {
  const modalData = useModalStore((state) => state.modalData);

  useEffect(
    () => (modalData ? remindUntilAnswered(buzz) : undefined),
    [modalData]
  );
}
