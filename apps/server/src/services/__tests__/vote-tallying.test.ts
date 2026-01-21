import { describe, expect, it } from '@effect/vitest';
import { Player } from '@/core/player.js';
import {
  calculateDayVoteTallies,
  calculateWerewolfVoteTallies,
  getDayVoteTarget,
  getWerewolfTarget,
  hasAllWerewolvesAgreed,
} from '../vote-tallying.js';

describe('Werewolf vote tallying', () => {
  it('calculates werewolf vote tallies', () => {
    const votes = new Map<string, string>([
      ['wolf-1', 'target-1'],
      ['wolf-2', 'target-1'],
      ['wolf-3', 'target-2'],
    ]);

    expect(calculateWerewolfVoteTallies(votes)).toEqual({
      'target-1': 2,
      'target-2': 1,
    });
  });

  it('detects unanimous agreement', () => {
    const werewolfSids = ['wolf-1', 'wolf-2'];
    const votes = new Map<string, string>([
      ['wolf-1', 'target-1'],
      ['wolf-2', 'target-1'],
    ]);

    expect(hasAllWerewolvesAgreed(votes, werewolfSids)).toBe(true);
    expect(getWerewolfTarget(votes, werewolfSids)).toBe('target-1');
  });

  it('returns false on disagreement', () => {
    const werewolfSids = ['wolf-1', 'wolf-2'];
    const votes = new Map<string, string>([
      ['wolf-1', 'target-1'],
      ['wolf-2', 'target-2'],
    ]);

    expect(hasAllWerewolvesAgreed(votes, werewolfSids)).toBe(false);
    expect(getWerewolfTarget(votes, werewolfSids)).toBeUndefined();
  });

  it('returns false when not all werewolves voted', () => {
    const werewolfSids = ['wolf-1', 'wolf-2'];
    const votes = new Map<string, string>([['wolf-1', 'target-1']]);

    expect(hasAllWerewolvesAgreed(votes, werewolfSids)).toBe(false);
  });

  it('updates tallies when votes change', () => {
    const votes = new Map<string, string>([
      ['wolf-1', 'target-1'],
      ['wolf-2', 'target-1'],
    ]);

    votes.set('wolf-2', 'target-2');

    expect(calculateWerewolfVoteTallies(votes)).toEqual({
      'target-1': 1,
      'target-2': 1,
    });
  });
});

describe('Day vote tallying', () => {
  it('calculates day vote tallies', () => {
    const votes = new Map<string, string>([
      ['player-1', 'target-1'],
      ['player-2', 'target-1'],
      ['player-3', 'target-2'],
    ]);

    expect(calculateDayVoteTallies(votes)).toEqual({
      'target-1': 2,
      'target-2': 1,
    });
  });

  it('returns player with most votes', () => {
    const playerOne = new Player('Alice', 'target-1', 'VILLAGER');
    const playerTwo = new Player('Bob', 'target-2', 'VILLAGER');
    const players = new Map<string, Player>([
      ['target-1', playerOne],
      ['target-2', playerTwo],
    ]);
    const votes = new Map<string, string>([
      ['player-1', 'target-1'],
      ['player-2', 'target-1'],
      ['player-3', 'target-2'],
    ]);

    expect(getDayVoteTarget(votes, players)).toBe(playerOne);
  });

  it('throws on tie', () => {
    const playerOne = new Player('Alice', 'target-1', 'VILLAGER');
    const playerTwo = new Player('Bob', 'target-2', 'VILLAGER');
    const players = new Map<string, Player>([
      ['target-1', playerOne],
      ['target-2', playerTwo],
    ]);
    const votes = new Map<string, string>([
      ['player-1', 'target-1'],
      ['player-2', 'target-2'],
    ]);

    expect(() => getDayVoteTarget(votes, players)).toThrow(
      'Tie in day vote - will be implemented later'
    );
  });

  it('updates tallies when votes change', () => {
    const votes = new Map<string, string>([
      ['player-1', 'target-1'],
      ['player-2', 'target-1'],
    ]);

    votes.set('player-2', 'target-2');

    expect(calculateDayVoteTallies(votes)).toEqual({
      'target-1': 1,
      'target-2': 1,
    });
  });
});
