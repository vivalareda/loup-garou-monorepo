import { describe, expect, it } from '@effect/vitest';
import type { Role } from '@repo/types';
import { Player } from '@/core/player.js';
import { checkIfWinner } from '../win-conditions.js';

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

  it('returns villagers when all werewolves are dead (multiple werewolves)', () => {
    const players = [
      createPlayer('villager-1', 'VILLAGER'),
      createPlayer('villager-2', 'VILLAGER'),
      createPlayer('witch', 'WITCH'),
      createPlayer('wolf-1', 'WEREWOLF', false),
      createPlayer('wolf-2', 'WEREWOLF', false),
    ];

    expect(checkIfWinner(players, true, true)).toBe('villagers');
  });

  it('returns null when no winner yet (werewolves alive, outnumbered)', () => {
    const players = [
      createPlayer('villager-1', 'VILLAGER'),
      createPlayer('villager-2', 'VILLAGER'),
      createPlayer('villager-3', 'VILLAGER'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, false, false)).toBeNull();
  });

  it('returns villagers when only villagers remain', () => {
    const players = [
      createPlayer('villager-1', 'VILLAGER'),
      createPlayer('witch', 'WITCH'),
      createPlayer('cupid', 'CUPID'),
      createPlayer('wolf', 'WEREWOLF', false),
    ];

    expect(checkIfWinner(players, false, false)).toBe('villagers');
  });

  it('returns werewolves when equal count but witch has no potions', () => {
    const players = [
      createPlayer('villager', 'VILLAGER'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, false, false)).toBe('werewolves');
  });

  it('returns null when equal count and witch has heal potion', () => {
    const players = [
      createPlayer('villager', 'VILLAGER'),
      createPlayer('witch', 'WITCH'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, true, false)).toBeNull();
  });

  it('returns null when equal count and witch has poison potion', () => {
    const players = [
      createPlayer('villager', 'VILLAGER'),
      createPlayer('witch', 'WITCH'),
      createPlayer('wolf', 'WEREWOLF'),
    ];

    expect(checkIfWinner(players, false, true)).toBeNull();
  });
});
