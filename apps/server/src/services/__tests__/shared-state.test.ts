import { describe, expect, it } from '@effect/vitest';
import type { DeathInfo, PendingDeath } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import { SharedState } from '../SharedState.js';

describe('SharedState Service', () => {
  it.effect('adds, lists, removes, and clears pending deaths', () =>
    Effect.gen(function* () {
      const sharedState = yield* SharedState;

      const firstDeath: PendingDeath = {
        playerId: 'player-1',
        cause: 'WEREWOLVES',
      };
      const secondDeath: PendingDeath = {
        playerId: 'player-2',
        cause: 'DAY_VOTE',
        metadata: { voteCount: 3 },
      };

      yield* sharedState.addPendingDeath(firstDeath);
      yield* sharedState.addPendingDeath(secondDeath);

      const pending = yield* sharedState.listPendingDeaths;
      expect(pending).toEqual([firstDeath, secondDeath]);

      const removed = yield* sharedState.removePendingDeath('player-1');
      expect(removed).toEqual(firstDeath);

      const remaining = yield* sharedState.listPendingDeaths;
      expect(remaining).toEqual([secondDeath]);

      yield* sharedState.clearPendingDeaths;
      const cleared = yield* sharedState.listPendingDeaths;
      expect(cleared).toEqual([]);
    }).pipe(Effect.provide(SharedState.Default))
  );

  it.effect('adds, lists, removes, and clears death infos', () =>
    Effect.gen(function* () {
      const sharedState = yield* SharedState;

      const firstInfo: DeathInfo = {
        playerId: 'player-1',
        playerName: 'Alice',
        cause: 'WEREWOLVES',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
      };
      const secondInfo: DeathInfo = {
        playerId: 'player-2',
        playerName: 'Bob',
        cause: 'HUNTER_REVENGE',
        timestamp: new Date('2024-01-02T00:00:00.000Z'),
        metadata: { hunterId: 'player-5' },
      };

      yield* sharedState.addDeathInfo(firstInfo);
      yield* sharedState.addDeathInfo(secondInfo);

      const infos = yield* sharedState.listDeathInfos;
      expect(infos).toEqual([firstInfo, secondInfo]);

      const removed = yield* sharedState.removeDeathInfo('player-2');
      expect(removed).toEqual(secondInfo);

      const remaining = yield* sharedState.listDeathInfos;
      expect(remaining).toEqual([firstInfo]);

      yield* sharedState.clearDeathInfos;
      const cleared = yield* sharedState.listDeathInfos;
      expect(cleared).toEqual([]);
    }).pipe(Effect.provide(SharedState.Default))
  );

  it.effect('tracks witch potion availability and resets on death', () =>
    Effect.gen(function* () {
      const sharedState = yield* SharedState;

      expect(yield* sharedState.canWitchHeal).toBe(true);
      expect(yield* sharedState.canWitchPoison).toBe(true);

      yield* sharedState.useWitchHealPotion;
      expect(yield* sharedState.canWitchHeal).toBe(false);
      expect(yield* sharedState.canWitchPoison).toBe(true);

      yield* sharedState.useWitchPoisonPotion;
      expect(yield* sharedState.canWitchPoison).toBe(false);

      yield* sharedState.resetWitchPotions;
      expect(yield* sharedState.canWitchHeal).toBe(true);
      expect(yield* sharedState.canWitchPoison).toBe(true);

      yield* sharedState.resetWitchPotionsOnDeath;
      expect(yield* sharedState.canWitchHeal).toBe(false);
      expect(yield* sharedState.canWitchPoison).toBe(false);
    }).pipe(Effect.provide(SharedState.Default))
  );

  it.effect('tracks werewolf and day votes with tallies', () =>
    Effect.gen(function* () {
      const sharedState = yield* SharedState;

      const werewolfSids = ['wolf-1', 'wolf-2'];
      yield* sharedState.setWerewolfVote('wolf-1', 'target-1');
      yield* sharedState.setWerewolfVote('wolf-2', 'target-1');

      const werewolfTallies = yield* sharedState.getWerewolfVoteTallies;
      expect(werewolfTallies).toEqual({ 'target-1': 2 });
      expect(yield* sharedState.getWerewolfTarget(werewolfSids)).toBe(
        'target-1'
      );

      const playerOne = new Player('Alice', 'target-1', 'VILLAGER');
      const playerTwo = new Player('Bob', 'target-2', 'VILLAGER');
      const players = new Map<string, Player>([
        ['target-1', playerOne],
        ['target-2', playerTwo],
      ]);

      yield* sharedState.setDayVote('player-1', 'target-1');
      yield* sharedState.setDayVote('player-2', 'target-1');
      yield* sharedState.setDayVote('player-3', 'target-2');

      const dayTallies = yield* sharedState.getDayVoteTallies;
      expect(dayTallies).toEqual({ 'target-1': 2, 'target-2': 1 });
      expect(yield* sharedState.getDayVoteTarget(players)).toBe(playerOne);

      yield* sharedState.clearWerewolfVotes;
      expect(yield* sharedState.getWerewolfVoteTallies).toEqual({});

      yield* sharedState.clearDayVotes;
      expect(yield* sharedState.getDayVoteTallies).toEqual({});
    }).pipe(Effect.provide(SharedState.Default))
  );
});
