import type { ServerToClientEvents } from '@repo/types';
import { Effect, Either } from 'effect';
import { AudioManager } from './audio-manager.js';
import { DeathManager } from './death-manager.js';
import { WerewolfVictimNotFoundError } from './errors.js';
import { Game } from './game.js';
import { SocketServer } from './socket-server.js';

export class GameActions extends Effect.Service<GameActions>()(
  '@app/GameActions',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const audioManager = yield* AudioManager;
      const deathManager = yield* DeathManager;
      const io = yield* SocketServer;

      const emitToPlayer = <K extends keyof ServerToClientEvents>(
        socketId: string,
        event: K,
        ...args: unknown[]
      ) =>
        Effect.sync(() => {
          io.to(socketId).emit(
            event,
            ...(args as Parameters<ServerToClientEvents[K]>)
          );
        });

      const emitToAll = <K extends keyof ServerToClientEvents>(
        event: K,
        ...args: unknown[]
      ) =>
        Effect.sync(() => {
          io.emit(event, ...(args as Parameters<ServerToClientEvents[K]>));
        });

      const broadcastWerewolfVotes = Effect.gen(function* () {
        const voteTallies = yield* game.getWerewolfVoteTallies;
        const werewolves = yield* game.getWerewolfList;

        for (const werewolf of werewolves) {
          yield* emitToPlayer(
            werewolf.getSocketId(),
            'werewolf:current-votes',
            voteTallies
          );
        }
      });

      return {
        cupidAction: Effect.gen(function* () {
          const cupid = yield* game.getSpecialRolePlayer('CUPID');
          yield* emitToPlayer(cupid.getSocketId(), 'cupid:pick-required');
        }),

        loversAction: Effect.gen(function* () {
          const lovers = yield* game.getLovers;
          if (lovers.length < 2) {
            return yield* Effect.void;
          }
          const lover1 = lovers[0];
          const lover2 = lovers[1];

          yield* Effect.sleep('4 seconds');
          yield* emitToPlayer(
            lover1.getSocketId(),
            'alert:player-is-lover',
            lover2.getSocketId()
          );
          yield* emitToPlayer(
            lover2.getSocketId(),
            'alert:player-is-lover',
            lover1.getSocketId()
          );

          yield* Effect.sleep('3 seconds');
          yield* emitToPlayer(
            lover1.getSocketId(),
            'alert:lovers-can-close-alert'
          );
          yield* emitToPlayer(
            lover2.getSocketId(),
            'alert:lovers-can-close-alert'
          );
        }),

        werewolfAction: Effect.gen(function* () {
          const werewolves = yield* game.getWerewolfList;
          for (const werewolf of werewolves) {
            yield* emitToPlayer(
              werewolf.getSocketId(),
              'werewolf:pick-required'
            );
          }
        }),

        witchHealAction: Effect.gen(function* () {
          const witchResult = yield* Effect.either(
            game.getSpecialRolePlayer('WITCH')
          );
          if (Either.isLeft(witchResult)) {
            return yield* Effect.void;
          }

          const witch = witchResult.right;
          const werewolfTarget = yield* game.getWerewolfTarget;

          if (!werewolfTarget) {
            return yield* Effect.fail(
              new WerewolfVictimNotFoundError({
                reason: 'werewolves may not have reached agreement',
              })
            );
          }

          yield* emitToPlayer(
            witch.getSocketId(),
            'witch:can-heal',
            werewolfTarget
          );
        }),

        witchPoisonAction: Effect.gen(function* () {
          const witchResult = yield* Effect.either(
            game.getSpecialRolePlayer('WITCH')
          );
          if (Either.isLeft(witchResult)) {
            return yield* Effect.void;
          }

          const witch = witchResult.right;
          yield* emitToPlayer(witch.getSocketId(), 'witch:pick-poison-player');
        }),

        broadcastWerewolfVotes,

        handleWerewolfVote: (socketId: string, targetPlayer: string) =>
          Effect.gen(function* () {
            yield* game.handleWerewolfVote(socketId, targetPlayer);
            yield* broadcastWerewolfVotes;
          }),

        handleWerewolfUpdateVote: (
          socketId: string,
          targetPlayer: string,
          oldVote: string
        ) =>
          Effect.gen(function* () {
            yield* game.handleWerewolfUpdateVote(
              socketId,
              targetPlayer,
              oldVote
            );
            yield* broadcastWerewolfVotes;
          }),

        processNightDeaths: Effect.gen(function* () {
          const deaths = yield* game.processPendingDeaths;
          yield* emitToAll('night:deaths-announced', deaths);

          for (const death of deaths) {
            yield* emitToPlayer(death.playerId, 'alert:player-is-dead');
            yield* emitToAll('lobby:player-died', death.playerId);
          }

          const winner = yield* game.checkIfWinner;

          if (winner) {
            yield* audioManager.playWinnerAudio(winner);
          }

          return deaths;
        }),

        startVotingPhase: Effect.gen(function* () {
          yield* Effect.sleep('7 seconds');
          yield* emitToAll('day:voting-phase-start');
        }),

        dayAction: Effect.gen(function* () {
          const deaths = yield* game.processPendingDeaths;
          yield* emitToAll('night:deaths-announced', deaths);

          for (const death of deaths) {
            yield* emitToPlayer(death.playerId, 'alert:player-is-dead');
            yield* emitToAll('lobby:player-died', death.playerId);
          }

          const winner = yield* game.checkIfWinner;

          if (winner) {
            yield* audioManager.playWinnerAudio(winner);
            return yield* Effect.void;
          }

          yield* Effect.sleep('7 seconds');
          yield* emitToAll('day:voting-phase-start');
        }),

        hunterAction: Effect.gen(function* () {
          yield* emitToAll('hunter:pick-required');
        }),

        handleDayVote: (socketId: string, targetPlayer: string) =>
          Effect.gen(function* () {
            yield* game.handleDayVote(socketId, targetPlayer);
          }),

        processDayVoteResult: Effect.gen(function* () {
          const targetSid = yield* game.getDayVoteTarget;

          if (!targetSid) {
            yield* emitToAll('day:voting-complete-no-death');
            return yield* Effect.void;
          }

          const tallies = yield* game.calculateDayVoteTallies;
          const voteCount = tallies[targetSid] || 0;

          yield* deathManager.addDayVoteElimination(targetSid, voteCount);
          yield* emitToAll('day:voting-complete', targetSid);
        }),

        healWerewolfVictim: Effect.gen(function* () {
          yield* game.healWerewolfVictim;
        }),

        witchKill: (playerSid: string) =>
          Effect.gen(function* () {
            yield* game.witchKill(playerSid);
          }),

        handleHunterPlayerPick: (targetSid: string) =>
          Effect.gen(function* () {
            yield* game.killHunterRevenge(targetSid);
            yield* game.isHunterInLove;
            yield* emitToPlayer(targetSid, 'alert:player-is-dead');
            yield* emitToAll('lobby:player-died', targetSid);
          }),
      };
    }),
    dependencies: [
      Game.Default,
      AudioManager.Default,
      DeathManager.Default,
      SocketServer.Default,
    ],
  }
) {}
