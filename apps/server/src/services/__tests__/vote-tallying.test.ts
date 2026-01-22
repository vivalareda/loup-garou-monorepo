import { describe, expect, it } from '@effect/vitest';
import { Player } from '@/core/player.js';
import {
  calculateTallies,
  hasAllVoted,
  getWinningTarget,
  checkForTie,
  calculateDayVoteTallies,
  calculateWerewolfVoteTallies,
  getDayVoteTarget,
  getWerewolfTarget,
  hasAllWerewolvesAgreed,
} from '../vote-tallying.js';

describe('calculateTallies', () => {
  it('calculates vote tallies correctly', () => {
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-1'],
      ['voter-3', 'target-2'],
    ]);

    expect(calculateTallies(votes)).toEqual({
      'target-1': 2,
      'target-2': 1,
    });
  });

  it('returns empty object for empty votes', () => {
    const votes = new Map<string, string>();
    expect(calculateTallies(votes)).toEqual({});
  });

  it('handles single vote', () => {
    const votes = new Map<string, string>([['voter-1', 'target-1']]);
    expect(calculateTallies(votes)).toEqual({ 'target-1': 1 });
  });

  it('handles all votes for same target', () => {
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-1'],
      ['voter-3', 'target-1'],
    ]);

    expect(calculateTallies(votes)).toEqual({ 'target-1': 3 });
  });

  it('handles votes for multiple targets', () => {
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-2'],
      ['voter-3', 'target-3'],
      ['voter-4', 'target-1'],
    ]);

    expect(calculateTallies(votes)).toEqual({
      'target-1': 2,
      'target-2': 1,
      'target-3': 1,
    });
  });
});

describe('hasAllVoted', () => {
  it('returns true when all voters have voted', () => {
    const voters = ['voter-1', 'voter-2', 'voter-3'];
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-2'],
      ['voter-3', 'target-1'],
    ]);

    expect(hasAllVoted(voters, votes)).toBe(true);
  });

  it('returns false when not all voters have voted', () => {
    const voters = ['voter-1', 'voter-2', 'voter-3'];
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-2'],
    ]);

    expect(hasAllVoted(voters, votes)).toBe(false);
  });

  it('returns true for empty voter list', () => {
    const voters: string[] = [];
    const votes = new Map<string, string>();
    expect(hasAllVoted(voters, votes)).toBe(true);
  });

  it('returns false when no votes but voters exist', () => {
    const voters = ['voter-1', 'voter-2'];
    const votes = new Map<string, string>();
    expect(hasAllVoted(voters, votes)).toBe(false);
  });

  it('ignores extra votes from non-voters', () => {
    const voters = ['voter-1', 'voter-2'];
    const votes = new Map<string, string>([
      ['voter-1', 'target-1'],
      ['voter-2', 'target-2'],
      ['voter-3', 'target-1'], // Extra vote
    ]);

    expect(hasAllVoted(voters, votes)).toBe(true);
  });
});

describe('getWinningTarget', () => {
  it('returns target with most votes', () => {
    const tallies = { 'target-1': 3, 'target-2': 1, 'target-3': 2 };
    expect(getWinningTarget(tallies)).toBe('target-1');
  });

  it('returns null when no votes', () => {
    const tallies = {};
    expect(getWinningTarget(tallies)).toBeNull();
  });

  it('returns null when tie exists', () => {
    const tallies = { 'target-1': 2, 'target-2': 2 };
    expect(getWinningTarget(tallies)).toBeNull();
  });

  it('returns winner when clear majority', () => {
    const tallies = { 'target-1': 5, 'target-2': 2, 'target-3': 1 };
    expect(getWinningTarget(tallies)).toBe('target-1');
  });

  it('returns null for three-way tie', () => {
    const tallies = { 'target-1': 1, 'target-2': 1, 'target-3': 1 };
    expect(getWinningTarget(tallies)).toBeNull();
  });

  it('returns winner when one vote ahead', () => {
    const tallies = { 'target-1': 3, 'target-2': 2 };
    expect(getWinningTarget(tallies)).toBe('target-1');
  });

  it('handles single target with votes', () => {
    const tallies = { 'target-1': 5 };
    expect(getWinningTarget(tallies)).toBe('target-1');
  });
});

describe('checkForTie', () => {
  it('returns true for two-way tie', () => {
    const tallies = { 'target-1': 2, 'target-2': 2 };
    expect(checkForTie(tallies)).toBe(true);
  });

  it('returns false when clear winner', () => {
    const tallies = { 'target-1': 3, 'target-2': 1 };
    expect(checkForTie(tallies)).toBe(false);
  });

  it('returns false for empty tallies', () => {
    const tallies = {};
    expect(checkForTie(tallies)).toBe(false);
  });

  it('returns true for three-way tie', () => {
    const tallies = { 'target-1': 2, 'target-2': 2, 'target-3': 2 };
    expect(checkForTie(tallies)).toBe(true);
  });

  it('returns false for single target', () => {
    const tallies = { 'target-1': 5 };
    expect(checkForTie(tallies)).toBe(false);
  });

  it('returns true when two targets tied at top', () => {
    const tallies = { 'target-1': 3, 'target-2': 3, 'target-3': 1 };
    expect(checkForTie(tallies)).toBe(true);
  });

  it('returns false when clear winner among multiple targets', () => {
    const tallies = { 'target-1': 4, 'target-2': 2, 'target-3': 1 };
    expect(checkForTie(tallies)).toBe(false);
  });
});

describe('Werewolf vote tallying (legacy)', () => {
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

describe('Day vote tallying (legacy)', () => {
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

  it('throws when no valid target found', () => {
    const players = new Map<string, Player>();
    const votes = new Map<string, string>();

    expect(() => getDayVoteTarget(votes, players)).toThrow(
      'No valid target found in day vote'
    );
  });

  it('throws when player not found', () => {
    const playerOne = new Player('Alice', 'target-1', 'VILLAGER');
    const players = new Map<string, Player>([['target-1', playerOne]]);
    const votes = new Map<string, string>([
      ['player-1', 'target-2'], // target-2 doesn't exist
    ]);

    expect(() => getDayVoteTarget(votes, players)).toThrow(
      'Player with sid target-2 not found'
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
