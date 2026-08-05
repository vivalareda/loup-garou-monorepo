import { describe, expect, it, vi } from 'vitest';

import {
  handleWitchHealChoice,
  handleWitchPoisonChoice,
  sendWitchHeal,
  sendWitchPoison,
} from '@/hooks/witch-actions';

describe('sendWitchHeal', () => {
  it('emits exactly one witch:healed-player when the witch chooses yes', () => {
    const emit = vi.fn();
    sendWitchHeal(emit, 'yes');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:healed-player');
  });

  it('emits exactly one witch:skipped-heal when the witch chooses no', () => {
    const emit = vi.fn();
    sendWitchHeal(emit, 'no');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:skipped-heal');
  });

  it('regression: does not compare only the first character (choice[0])', () => {
    // The old code did `choice[0] === 'yes'`, which compared 'y' and never
    // matched, so the heal potion could never be consumed. 'yes' must heal.
    const healEmit = vi.fn();
    sendWitchHeal(healEmit, 'yes');
    expect(healEmit).toHaveBeenCalledWith('witch:healed-player');
    expect(healEmit).not.toHaveBeenCalledWith('witch:skipped-heal');

    // 'no' must skip — its first char 'n' is irrelevant to the comparison.
    const skipEmit = vi.fn();
    sendWitchHeal(skipEmit, 'no');
    expect(skipEmit).toHaveBeenCalledWith('witch:skipped-heal');
    expect(skipEmit).not.toHaveBeenCalledWith('witch:healed-player');
  });

  it('treats any non-"yes" choice as a skip (defensive)', () => {
    const emit = vi.fn();
    sendWitchHeal(emit, 'no');
    expect(emit).toHaveBeenCalledWith('witch:skipped-heal');
  });
});

describe('sendWitchPoison', () => {
  it('emits exactly one witch:poisoned-player with the target SID', () => {
    const emit = vi.fn();
    sendWitchPoison(emit, 'sid-player-3');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:poisoned-player', 'sid-player-3');
  });

  it('emits witch:skipped-poison when the witch skips (null target)', () => {
    const emit = vi.fn();
    sendWitchPoison(emit, null);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:skipped-poison');
  });

  it('treats an empty target string as a skip', () => {
    const emit = vi.fn();
    sendWitchPoison(emit, '');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:skipped-poison');
  });
});

describe('Witch modal action handlers', () => {
  it('heal yes emits exactly once and closes the modal', () => {
    const emit = vi.fn();
    const closeModal = vi.fn();

    handleWitchHealChoice(emit, closeModal, 'yes');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:healed-player');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('heal no emits exactly once and closes the modal', () => {
    const emit = vi.fn();
    const closeModal = vi.fn();

    handleWitchHealChoice(emit, closeModal, 'no');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:skipped-heal');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('poison target emits exactly once and closes the modal', () => {
    const emit = vi.fn();
    const closeModal = vi.fn();

    handleWitchPoisonChoice(emit, closeModal, 'sid-player-3');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:poisoned-player', 'sid-player-3');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('poison skip emits exactly once and closes the modal', () => {
    const emit = vi.fn();
    const closeModal = vi.fn();

    handleWitchPoisonChoice(emit, closeModal, null);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('witch:skipped-poison');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});
