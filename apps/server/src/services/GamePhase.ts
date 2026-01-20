import type { DeathInfo, Segment } from '@repo/types';
import { Effect } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { SocketHandlers } from './SocketHandlers.js';

export class GamePhase extends Effect.Service<GamePhase>()('GamePhase', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const socket = yield* SocketHandlers;
    const deathManager = yield* DeathManager;

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
          // This is a placeholder for the actual segment playing logic
          // In a real implementation, this would handle the specific logic for each segment
          // and might include waiting for user input, timers, etc.

          yield* Effect.log(`Playing segment: ${segment.type}`);

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
  }),
  dependencies: [Game.Default, DeathManager.Default, SocketHandlers.Default],
}) {}
