import type { DeathInfo } from '@repo/types';
import { Context, Effect, Layer } from 'effect';
import { ActionError } from '../Domain/action-error';
import { SocketService } from '../server/socket-effect';
import { GameService } from './game-effect';

export class GameActionsService extends Context.Tag('GameActionsService')<
  GameActionsService,
  {
    readonly cupidAction: Effect.Effect<void, ActionError>;
    readonly loversAction: Effect.Effect<void, ActionError>;
    readonly werewolfAction: Effect.Effect<void, ActionError>;
    readonly witchHealAction: Effect.Effect<void, ActionError>;
    readonly witchPoisonAction: Effect.Effect<void, ActionError>;
    readonly handleWerewolfVote: (
      socketId: string,
      targetPlayer: string
    ) => Effect.Effect<void, ActionError>;
    readonly handleWerewolfUpdateVote: (
      socketId: string,
      targetPlayer: string,
      oldVote: string
    ) => Effect.Effect<void, ActionError>;
    readonly broadcastWerewolfVotes: Effect.Effect<void, ActionError>;
    readonly announceNightDeaths: (
      deaths: DeathInfo[]
    ) => Effect.Effect<void, ActionError>;
    readonly dayAction: Effect.Effect<void, ActionError>;
    readonly hunterAction: Effect.Effect<void, ActionError>;
  }
>() {}

export const GameActionsLive = Layer.effect(
  GameActionsService,
  Effect.gen(function* (_) {
    const game = yield* _(GameService);
    const socket = yield* _(SocketService);
    // Unused variable audioManager removed
    // yield* _(AudioManagerTag); // We don't use this directly here anymore, but keeping as dependency might be needed if side effects rely on it being initialized?
    // Actually, let's remove it if unused to satisfy linter and runtime.

    const toActionError = (e: unknown) =>
      new ActionError({ message: 'Action failed', cause: e });

    const cupidAction = Effect.gen(function* ($) {
      const cupid = yield* $(game.getSpecialRolePlayer('CUPID'));
      if (!cupid) {
        yield* $(
          Effect.fail(new ActionError({ message: 'Cupid player not found' }))
        );
        return;
      }
      const cupidSocket = cupid.getSocketId();
      if (!cupidSocket) {
        yield* $(
          Effect.fail(new ActionError({ message: 'Cupid socket not found' }))
        );
        return;
      }
      yield* $(
        socket
          .to(cupidSocket)
          .emit('cupid:pick-required')
          .pipe(Effect.mapError(toActionError))
      );
    });

    const loversAction = Effect.gen(function* ($) {
      const lovers = yield* $(game.getLovers);

      if (lovers.length !== 2) {
        yield* $(
          Effect.fail(
            new ActionError({ message: 'Lovers not found or incorrect count' })
          )
        );
        return;
      }

      // Wait a few seconds before prompting the cupid to pick lovers since lover audio file isn't awaited
      yield* $(
        Effect.gen(function* ($$) {
          yield* $$(
            socket
              .to(lovers[0].getSocketId())
              .emit('alert:player-is-lover', lovers[1].getSocketId())
              .pipe(Effect.mapError(toActionError))
          );
          yield* $$(
            socket
              .to(lovers[1].getSocketId())
              .emit('alert:player-is-lover', lovers[0].getSocketId())
              .pipe(Effect.mapError(toActionError))
          );
        }).pipe(Effect.delay('4 seconds'))
      );

      // *This is for the dashboard only* Enable the close button after a delay, like in the mobile app
      yield* $(
        Effect.gen(function* ($$) {
          yield* $$(
            socket
              .to(lovers[0].getSocketId())
              .emit('alert:lovers-can-close-alert')
              .pipe(Effect.mapError(toActionError))
          );
          yield* $$(
            socket
              .to(lovers[1].getSocketId())
              .emit('alert:lovers-can-close-alert')
              .pipe(Effect.mapError(toActionError))
          );
        }).pipe(Effect.delay('3 seconds'))
      );
    });

    const werewolfAction = Effect.gen(function* ($) {
      const werewolves = yield* $(game.getWerewolfList);
      for (const werewolf of werewolves) {
        yield* $(
          socket
            .to(werewolf.getSocketId())
            .emit('werewolf:pick-required')
            .pipe(Effect.mapError(toActionError))
        );
      }
    });

    const witchHealAction = Effect.gen(function* ($) {
      const witch = yield* $(game.getSpecialRolePlayer('WITCH'));

      if (!witch) {
        // No witch, we just return. This is valid flow.
        Effect.log('No witch in the game, skipping witch heal action');
        return;
      }

      const werewolfVictimSid = yield* $(game.getWerewolfTarget);
      if (!werewolfVictimSid) {
        yield* $(
          Effect.fail(new ActionError({ message: 'No werewolf victim found' }))
        );
        return;
      }

      yield* $(
        socket
          .to(witch.getSocketId())
          .emit('witch:can-heal', werewolfVictimSid)
          .pipe(Effect.mapError(toActionError))
      );
    });

    const witchPoisonAction = Effect.gen(function* ($) {
      const witch = yield* $(game.getSpecialRolePlayer('WITCH'));
      if (!witch) {
        Effect.log('Witch player not found');
        return;
      }
      yield* $(
        socket
          .to(witch.getSocketId())
          .emit('witch:pick-poison-player')
          .pipe(Effect.mapError(toActionError))
      );
    });

    const handleWerewolfVote = (socketId: string, targetPlayer: string) =>
      Effect.gen(function* ($) {
        yield* $(game.handleWerewolfVote(socketId, targetPlayer));
        yield* $(broadcastWerewolfVotes);
      }).pipe(Effect.mapError(toActionError));

    const handleWerewolfUpdateVote = (
      socketId: string,
      targetPlayer: string,
      oldVote: string
    ) =>
      Effect.gen(function* ($) {
        yield* $(
          game.handleWerewolfUpdateVote(socketId, targetPlayer, oldVote)
        );
        yield* $(broadcastWerewolfVotes);
      }).pipe(Effect.mapError(toActionError));

    const broadcastWerewolfVotes = Effect.gen(function* ($) {
      const tallies = yield* $(game.getWerewolfVoteTallies);
      const werewolves = yield* $(game.getWerewolfList);

      for (const werewolf of werewolves) {
        yield* $(
          socket
            .to(werewolf.getSocketId())
            .emit('werewolf:current-votes', tallies)
            .pipe(Effect.mapError(toActionError))
        );
      }
    });

    const announceNightDeaths = (deaths: DeathInfo[]) =>
      Effect.gen(function* ($) {
        yield* $(
          socket
            .emit('night:deaths-announced', deaths)
            .pipe(Effect.mapError(toActionError))
        );
        // Log deaths?
      });

    const dayAction = Effect.gen(function* ($) {
      yield* $(
        Effect.gen(function* ($$) {
          yield* $$(
            socket
              .emit('day:voting-phase-start')
              .pipe(Effect.mapError(toActionError))
          );
        }).pipe(Effect.delay('7 seconds'))
      );
    });

    const hunterAction = Effect.gen(function* ($) {
      yield* $(
        socket.emit('hunter:pick-required').pipe(Effect.mapError(toActionError))
      );
    });

    return {
      cupidAction,
      loversAction,
      werewolfAction,
      witchHealAction,
      witchPoisonAction,
      handleWerewolfVote,
      handleWerewolfUpdateVote,
      broadcastWerewolfVotes,
      announceNightDeaths,
      dayAction,
      hunterAction,
    };
  })
);
