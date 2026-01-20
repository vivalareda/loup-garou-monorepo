import { Console, Effect, Layer } from 'effect';
import { Game } from './Game.js';
import { SocketServer } from './SocketServer.js';

const make = Effect.gen(function* () {
  const game = yield* Game;
  const socketServer = yield* SocketServer;

  return {
    cupidAction: Effect.gen(function* () {
      const cupid = yield* game.getSpecialRolePlayer('CUPID');
      const socketId = cupid.getSocketId();

      yield* socketServer.emitTo(socketId, 'cupid:pick-required');
    }),

    loversAction: Effect.gen(function* () {
      // Logic handled via alert:player-is-lover in SocketHandlers during cupid selection
      yield* Console.log(
        'loversAction: Notifications sent during selection phase'
      );
    }),

    werewolfAction: Effect.gen(function* () {
      const werewolves = yield* game.getPlayers;
      const werewolfPlayers = werewolves.filter(
        (p) => p.getRole() === 'WEREWOLF'
      );

      for (const werewolf of werewolfPlayers) {
        yield* socketServer.emitTo(
          werewolf.getSocketId(),
          'werewolf:pick-required'
        );
      }
    }),

    hunterAction: Effect.gen(function* () {
      yield* socketServer.emit('hunter:pick-required');
    }),

    witchHealAction: Effect.gen(function* () {
      // Placeholder implementation until we have access to witch and victim
      const witch = yield* game
        .getSpecialRolePlayer('WITCH')
        .pipe(
          Effect.catchTag('PlayerNotFoundError', () =>
            Effect.succeed(undefined)
          )
        );

      if (!witch) {
        yield* Console.log('No witch in the game, skipping witch heal action');
        return;
      }

      // We need getWerewolfTarget() from Game service
      // const werewolfVictimSid = yield* game.getWerewolfTarget();

      // For now, logging
      yield* Console.log(
        'witchHealAction called - waiting for Game service update'
      );
    }),

    witchPoisonAction: Effect.gen(function* () {
      const witch = yield* game
        .getSpecialRolePlayer('WITCH')
        .pipe(
          Effect.catchTag('PlayerNotFoundError', () =>
            Effect.succeed(undefined)
          )
        );

      if (!witch) {
        yield* Console.error('Witch player not found');
        return;
      }

      yield* Console.log(
        `[WITCH-POISON] Emitting poison prompt to witch ${witch.getName()}`
      );
      yield* socketServer.emitTo(
        witch.getSocketId(),
        'witch:pick-poison-player'
      );
    }),
  };
});

export class GameActions extends Effect.Service<GameActions>()(
  '@app/GameActions',
  {
    effect: make,
    dependencies: [Game.Default, SocketServer.Default],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
