import { describe, expect, it } from '@effect/vitest';
import type { Role } from '@repo/types';
import { Player } from '@/core/player.js';
import { checkIfWinner, checkWinner } from '../win-conditions.js';

const createPlayer = (name: string, role: Role, isAlive = true) => {
  const player = new Player(name, `${name}-sid`, role);
  if (!isAlive) {
    player.setIsAlive(false);
  }
  return player;
};

describe('checkIfWinner', () => {
  it('returns villagers when all werewolves are dead', () => {
    const players = [
      createPlayer('alice', 'VILLAGER'),
      createPlayer('bob', 'VILLAGER'),
      createPlayer('wolf', 'WEREWOLF', false),
    ];

    expect(checkIfWinner(players, false, false)).toBe('villagers');
  });

  it('returns null when equal numbers and witch has potions', () => {
    const players = [
      createPlayer('witch', 'WITCH'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, true, false)).toBeNull();
  });

  it('returns werewolves when equal numbers without witch potions', () => {
    const players = [
      createPlayer('villager', 'VILLAGER'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, false, false)).toBe('werewolves');
  });

  it('returns werewolves when werewolves outnumber villagers', () => {
    const players = [
      createPlayer('wolf-1', 'WEREWOLF'),
      createPlayer('wolf-2', 'WEREWOLF'),
      createPlayer('villager', 'VILLAGER'),
    ];

    expect(checkIfWinner(players, false, false)).toBe('werewolves');
  });
});

describe('checkWinner', () => {
  describe('villagers win scenarios', () => {
    it('returns villagers when no werewolves remain', () => {
      expect(checkWinner(0, 5, false)).toBe('villagers');
    });

    it('returns villagers when no werewolves remain (even with witch potions)', () => {
      expect(checkWinner(0, 3, true)).toBe('villagers');
    });

    it('returns villagers when no werewolves remain and only 1 villager left', () => {
      expect(checkWinner(0, 1, false)).toBe('villagers');
    });
  });

  describe('werewolves win scenarios', () => {
    it('returns werewolves when they outnumber villagers', () => {
      expect(checkWinner(3, 2, false)).toBe('werewolves');
    });

    it('returns werewolves when they outnumber villagers (even with witch potions)', () => {
      expect(checkWinner(2, 1, true)).toBe('werewolves');
    });

    it('returns werewolves when equal numbers without witch potions', () => {
      expect(checkWinner(1, 1, false)).toBe('werewolves');
    });

    it('returns werewolves when equal numbers (2v2) without witch potions', () => {
      expect(checkWinner(2, 2, false)).toBe('werewolves');
    });

    it('returns werewolves when equal numbers (3v3) without witch potions', () => {
      expect(checkWinner(3, 3, false)).toBe('werewolves');
    });
  });

  describe('game continues scenarios', () => {
    it('returns null when equal numbers with witch potions', () => {
      expect(checkWinner(1, 1, true)).toBeNull();
    });

    it('returns null when equal numbers (2v2) with witch potions', () => {
      expect(checkWinner(2, 2, true)).toBeNull();
    });

    it('returns null when villagers outnumber werewolves', () => {
      expect(checkWinner(1, 3, false)).toBeNull();
    });

    it('returns null when villagers outnumber werewolves (with witch potions)', () => {
      expect(checkWinner(2, 5, true)).toBeNull();
    });

    it('returns null when villagers outnumber werewolves significantly', () => {
      expect(checkWinner(1, 10, false)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles only 1 werewolf vs many villagers', () => {
      expect(checkWinner(1, 10, false)).toBeNull();
    });

    it('handles many werewolves vs 1 villager', () => {
      expect(checkWinner(5, 1, false)).toBe('werewolves');
    });

    it('handles 1v1 with witch potions', () => {
      expect(checkWinner(1, 1, true)).toBeNull();
    });

    it('handles 1v1 without witch potions', () => {
      expect(checkWinner(1, 1, false)).toBe('werewolves');
    });
  });
});
