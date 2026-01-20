import type { DeathInfo, Segment } from '@repo/types';
import { Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { GameActions } from './GameActions.js';
import { SocketServer } from './SocketServer.js';
import { SpecialScenarios } from './SpecialScenarios.js';

export const makeGamePhase = Effect.gen(function* () {
  const game = yield* Game;
  const socket = yield* SocketServer;
  const deathManager = yield* DeathManager;
  const gameActions = yield* GameActions;
  const audioManager = yield* AudioManager;
  const specialScenarios = yield* SpecialScenarios;

  const processDeathsAndCheckWinner = Effect.gen(function* () {
    // Process any pending deaths
    const pendingDeaths = yield* deathManager.processDeaths((playerId) =>
      Effect.gen(function* () {
        const player = yield* game.getPlayerBySocketId(playerId);
        const partner = yield* game.getPartner(player);
        return partner?.socketId;
      })
    );

    const deaths: DeathInfo[] = [];

    // Transform PendingDeath to DeathInfo for the client
    for (const death of pendingDeaths) {
      const player = yield* game.getPlayerBySocketId(death.playerId);
      const deathInfo: DeathInfo = {
        playerId: death.playerId,
        playerName: player.getName(),
        cause: death.cause,
        timestamp: new Date(),
      };

      if (death.metadata) {
        deathInfo.metadata = death.metadata;
      }

      deaths.push(deathInfo);
    }

    // Check for special scenarios first (narrative audio)
    yield* specialScenarios.handleSpecialDeathScenarios;

    if (deaths.length > 0) {
      // Announce deaths to clients
      yield* socket.emit('night:deaths-announced', deaths);
    }

    // Check for a winner
    const winner = yield* deathManager.checkWinner();

    if (winner) {
      // yield* socket.emit('game:winner', { winner });
      return true; // Game over
    }

    return false; // Game continues
  });

  return {
    playSegment: (segment: Segment) =>
      Effect.gen(function* () {
        yield* Effect.log(`Playing segment: ${segment.type}`);
        yield* socket.emit('game:segment-start', {
          type: segment.type,
          skip: segment.skip,
        });

        if (segment.skip) {
          yield* Effect.log(`Skipping segment: ${segment.type}`);
          return;
        }

        yield* audioManager.playSegmentStart(segment.type);

        switch (segment.type) {
          case 'CUPID':
            yield* gameActions.cupidAction;
            break;
          case 'LOVERS':
            yield* gameActions.loversAction;
            break;
          case 'WEREWOLF':
            yield* gameActions.werewolfAction;
            break;
          case 'HUNTER':
            yield* gameActions.hunterAction;
            break;
          case 'WITCH-HEAL':
            yield* gameActions.witchHealAction;
            break;
          case 'WITCH-POISON':
            yield* gameActions.witchPoisonAction;
            break;
          case 'DAY':
            // Day vote handled separately? Or trigger it here?
            // Usually Day phase involves discussion and voting
            // For now, no specific action trigger here beyond notification
            break;
          default:
            yield* Effect.log(`No action for segment: ${segment.type}`);
            break;
        }

        yield* audioManager.playSegmentEnd(segment.type);

        // After certain segments (like WEREWOLF or DAY), we should process deaths
        if (
          segment.type === 'WEREWOLF' ||
          segment.type === 'WITCH-POISON' ||
          segment.type === 'DAY'
        ) {
          const gameOver = yield* processDeathsAndCheckWinner;
          if (gameOver) {
            return;
          }
        }
      }),

    processDeathsAndCheckWinner,
  };
});

export class GamePhase extends Effect.Service<GamePhase>()('GamePhase', {
  effect: makeGamePhase,
  dependencies: [
    Game.Default,
    DeathManager.Default,
    SocketServer.Default,
    GameActions.Default,
    AudioManager.Default,
    SpecialScenarios.Default,
  ],
}) {}
