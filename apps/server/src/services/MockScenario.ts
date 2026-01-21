import { Effect } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { SegmentExecution } from './SegmentExecution.js';
import { SegmentManager } from './SegmentManager.js';
import {
  InvalidRoleError,
  NoPlayersAvailableError,
  NotEnoughPlayersError,
} from './errors.js';

export class MockScenario extends Effect.Service<MockScenario>()(
  '@app/MockScenario',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const segmentManager = yield* SegmentManager;
      const segmentExecution = yield* SegmentExecution;
      const deathManager = yield* DeathManager;

      const setupDaySegment = Effect.gen(function* () {
        const daySegmentIndex = yield* segmentManager.getSegmentIndex(
          'DAY'
        );
        yield* segmentManager.setSegmentIndex(daySegmentIndex);
        yield* segmentExecution.playSegment;
      });

      return {
        runWerewolfKillHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length === 0) {
            return yield* Effect.fail(new NoPlayersAvailableError());
          }

          const hunter = players[0];

          if (hunter.role !== 'HUNTER') {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: hunter.role,
              })
            );
          }

          yield* deathManager.addPendingDeath(hunter, 'WEREWOLVES');

          yield* setupDaySegment;
        }),

        runWerewolfKillLover: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 2) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 2,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          yield* game.setLovers(loverSids);
          yield* deathManager.addPendingDeath(players[0], 'WEREWOLVES');

          yield* setupDaySegment;
        }),

        runWerewolfKillLoverSecondIsHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 5) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 5,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          if (players[1].role !== 'HUNTER') {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: players[1].role,
              })
            );
          }

          yield* game.setLovers(loverSids);
          yield* deathManager.addPendingDeath(players[0], 'WEREWOLVES');

          yield* setupDaySegment;
        }),

        runWerewolfKillLoverWhoIsHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 2) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 2,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          if (players[0].role !== 'HUNTER') {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: players[0].role,
              })
            );
          }

          yield* game.setLovers(loverSids);
          yield* deathManager.addPendingDeath(players[0], 'WEREWOLVES');

          yield* setupDaySegment;
        }),

        runDayVoteKillHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length === 0) {
            return yield* Effect.fail(new NoPlayersAvailableError());
          }

          const hunter = players.find((p) => p.role === 'HUNTER');

          if (!hunter) {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: undefined,
              })
            );
          }

          yield* deathManager.addDayVoteElimination(hunter.socketId, 0);

          yield* setupDaySegment;
        }),

        runDayVoteKillLover: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 2) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 2,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          yield* game.setLovers(loverSids);
          yield* deathManager.addDayVoteElimination(players[0].socketId, 0);

          yield* setupDaySegment;
        }),

        runDayVoteKillLoverWhoIsHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 2) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 2,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          if (players[0].role !== 'HUNTER') {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: players[0].role,
              })
            );
          }

          yield* game.setLovers(loverSids);
          yield* deathManager.addDayVoteElimination(players[0].socketId, 0);

          yield* setupDaySegment;
        }),

        runDayVoteKillLoverSecondIsHunter: Effect.gen(function* () {
          const players = yield* game.getPlayers;

          if (players.length < 2) {
            return yield* Effect.fail(
              new NotEnoughPlayersError({
                required: 2,
                available: players.length,
              })
            );
          }

          const loverSids = [players[0].socketId, players[1].socketId];

          if (players[1].role !== 'HUNTER') {
            return yield* Effect.fail(
              new InvalidRoleError({
                expected: 'HUNTER',
                actual: players[1].role,
              })
            );
          }

          yield* game.setLovers(loverSids);
          yield* deathManager.addDayVoteElimination(players[0].socketId, 0);

          yield* setupDaySegment;
        }),
      };
    }),
    dependencies: [
      Game.Default,
      SegmentManager.Default,
      SegmentExecution.Default,
      DeathManager.Default,
    ],
  }
) {}
