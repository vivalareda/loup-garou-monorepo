import { Effect } from 'effect';
import type { Player } from '../core/player.js';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import {
  HunterAlreadyFiredError,
  HunterTargetDeadError,
  HunterTargetSelfError,
  NotHunterError,
} from './hunter-errors.js';
import { SocketServer } from './SocketServer.js';

export class HunterService extends Effect.Service<HunterService>()(
  '@app/HunterService',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const deathManager = yield* DeathManager;
      const socketServer = yield* SocketServer;

      const huntersWhoFired = new Set<string>();

      const validateHunter = (hunter: Player) =>
        Effect.gen(function* () {
          if (hunter.getRole() !== 'HUNTER') {
            return yield* Effect.fail(
              new NotHunterError({ playerId: hunter.getSocketId() })
            );
          }
          if (huntersWhoFired.has(hunter.getSocketId())) {
            return yield* Effect.fail(
              new HunterAlreadyFiredError({ hunterId: hunter.getSocketId() })
            );
          }
        });

      return {
        processRevenge: Effect.fn('HunterService.processRevenge')(function* (
          hunterId: string,
          targetId: string
        ) {
          const hunter = yield* game.getPlayerBySocketId(hunterId);
          const target = yield* game.getPlayerBySocketId(targetId);

          yield* validateHunter(hunter);

          if (hunterId === targetId) {
            return yield* Effect.fail(new HunterTargetSelfError({ hunterId }));
          }

          if (!target.isAlive) {
            return yield* Effect.fail(new HunterTargetDeadError({ targetId }));
          }

          yield* deathManager.addHunterRevenge(targetId, hunterId);
          huntersWhoFired.add(hunterId);

          socketServer.io.emit('hunter:revenge-taken', {
            hunter: hunter.getName(),
            victim: target.getName(),
          });
        }),

        reset: Effect.sync(() => {
          huntersWhoFired.clear();
        }),
      };
    }),
    dependencies: [Game.Default, DeathManager.Default, SocketServer.Default],
  }
) {}
