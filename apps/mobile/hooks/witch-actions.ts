/**
 * Witch heal/poison decision logic, extracted so it is unit-testable without
 * the socket.io singleton (which throws on import when the backend URL env
 * var is missing — see `utils/sockets.ts`).
 *
 * The component bridges these to its typed socket via a loose `WitchEmit`
 * adapter; tests pass a `vi.fn()` directly and assert exactly one event is
 * emitted with the right name and payload.
 */

/** Loose emit signature — the component bridges it to its typed socket. */
export type WitchEmit = (event: string, ...args: unknown[]) => void;
export type CloseModal = () => void;

/**
 * Resolve the witch heal choice to a single socket event.
 *
 * `GlobalModal` passes the scalar string `"yes"` or `"no"` for a `yes-no`
 * modal — NOT a `string[]`. The previous code did `choice[0] === "yes"`,
 * which compared the first CHARACTER (`"y"`) and never matched, so the witch
 * could never heal. Compare the whole string instead.
 */
export function sendWitchHeal(emit: WitchEmit, choice: string) {
  if (choice === 'yes') {
    emit('witch:healed-player');
  } else {
    emit('witch:skipped-heal');
  }
}

export function handleWitchHealChoice(
  emit: WitchEmit,
  closeModal: CloseModal,
  choice: string
) {
  sendWitchHeal(emit, choice);
  closeModal();
}

/**
 * Resolve the witch poison choice to a single socket event: poison a target
 * when one is selected, otherwise skip (advance to dawn without poisoning).
 */
export function sendWitchPoison(emit: WitchEmit, targetSid: string | null) {
  if (targetSid) {
    emit('witch:poisoned-player', targetSid);
  } else {
    emit('witch:skipped-poison');
  }
}

export function handleWitchPoisonChoice(
  emit: WitchEmit,
  closeModal: CloseModal,
  targetSid: string | null
) {
  sendWitchPoison(emit, targetSid);
  closeModal();
}
