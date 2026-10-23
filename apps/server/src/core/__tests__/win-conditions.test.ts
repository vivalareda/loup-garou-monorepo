import { describe, expect, it } from 'vitest';
import { checkWinner } from '@/core/win-conditions';

const midGame = {
  totalPlayers: 6,
  pendingDeathCount: 0,
  livingVillagerCount: 3,
  livingWerewolfCount: 1,
  witchCanStillAct: false,
};

describe('checkWinner', () => {
  it('continues while the wolves are outnumbered', () => {
    expect(checkWinner(midGame)).toBeNull();
  });

  it('waits for queued deaths to resolve', () => {
    expect(
      checkWinner({ ...midGame, pendingDeathCount: 1, livingWerewolfCount: 0 })
    ).toBeNull();
  });

  it('has no winner in an empty lobby', () => {
    expect(
      checkWinner({
        ...midGame,
        totalPlayers: 0,
        livingVillagerCount: 0,
        livingWerewolfCount: 0,
      })
    ).toBeNull();
  });

  it('gives the village the win once no wolf is alive, even on a total wipe', () => {
    expect(checkWinner({ ...midGame, livingWerewolfCount: 0 })).toBe(
      'villagers'
    );
    expect(
      checkWinner({ ...midGame, livingVillagerCount: 0, livingWerewolfCount: 0 })
    ).toBe('villagers');
  });

  it('gives the wolves the win at parity', () => {
    expect(
      checkWinner({ ...midGame, livingVillagerCount: 1, livingWerewolfCount: 1 })
    ).toBe('werewolves');
  });

  it('keeps the game going at parity while a living witch holds a potion', () => {
    expect(
      checkWinner({
        ...midGame,
        livingVillagerCount: 1,
        livingWerewolfCount: 1,
        witchCanStillAct: true,
      })
    ).toBeNull();
  });
});
