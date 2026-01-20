import { Context, Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { PlayerNotFoundError, SpecialPlayerNotFoundError } from '../errors.js';
import { Game } from '../Game.js';
import { GameActions } from '../GameActions.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';

describe('GameActions', () => {
  const mockEmit = vi.fn();
  const mockEmitTo = vi.fn();

  const MockSocketServer = Layer.succeed(
    SocketServer,
    SocketServer.of({
      io: {} as SocketIOInstance,
      emit: (event, ...args) => Effect.sync(() => mockEmit(event, ...args)),
      emitTo: (socketId, event, ...args) =>
        Effect.sync(() => mockEmitTo(socketId, event, ...args)),
    } as any)
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cupidAction should emit cupid:pick-required to the cupid player', async () => {
    const cupidPlayer = new Player('Cupid', 'cupid-sid', 'CUPID');

    const MockGame = Layer.succeed(
      Game,
      Game.of({
        startGame: Effect.succeed([]),
        getPlayers: Effect.succeed([]),
        getClientPlayerList: Effect.succeed([]),
        getSpecialRolePlayer: (role) =>
          role === 'CUPID'
            ? Effect.succeed(cupidPlayer)
            : Effect.fail(new SpecialPlayerNotFoundError({ role })),
        getPlayerBySocketId: (socketId) =>
          Effect.fail(new PlayerNotFoundError({ socketId })),
      } as any)
    );

    const program = Effect.gen(function* () {
      const actions = yield* GameActions;
      yield* actions.cupidAction;
    });

    const runnable = program.pipe(
      Effect.provide(GameActions.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    await Effect.runPromise(runnable);

    expect(mockEmitTo).toHaveBeenCalledWith('cupid-sid', 'cupid:pick-required');
  });

  it('werewolfAction should emit werewolf:pick-required to all werewolves', async () => {
    const ww1 = new Player('WW1', 'ww1-sid', 'WEREWOLF');
    const ww2 = new Player('WW2', 'ww2-sid', 'WEREWOLF');
    const villager = new Player('Villager', 'v-sid', 'VILLAGER');

    const MockGame = Layer.succeed(
      Game,
      Game.of({
        startGame: Effect.succeed([]),
        getPlayers: Effect.succeed([ww1, ww2, villager]),
        getClientPlayerList: Effect.succeed([]),
        getSpecialRolePlayer: (role) =>
          Effect.fail(new SpecialPlayerNotFoundError({ role })),
        getPlayerBySocketId: (socketId) =>
          Effect.fail(new PlayerNotFoundError({ socketId })),
      } as any)
    );

    const program = Effect.gen(function* () {
      const actions = yield* GameActions;
      yield* actions.werewolfAction;
    });

    const runnable = program.pipe(
      Effect.provide(GameActions.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    await Effect.runPromise(runnable);

    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww1-sid',
      'werewolf:pick-required'
    );
    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww2-sid',
      'werewolf:pick-required'
    );
    expect(mockEmitTo).toHaveBeenCalledTimes(2);
  });

  it('hunterAction should emit hunter:pick-required to everyone', async () => {
    const MockGame = Layer.succeed(
      Game,
      Game.of({
        startGame: Effect.succeed([]),
        getPlayers: Effect.succeed([]),
        getClientPlayerList: Effect.succeed([]),
        getSpecialRolePlayer: (role) =>
          Effect.fail(new SpecialPlayerNotFoundError({ role })),
        getPlayerBySocketId: (socketId) =>
          Effect.fail(new PlayerNotFoundError({ socketId })),
      } as any)
    );

    const program = Effect.gen(function* () {
      const actions = yield* GameActions;
      yield* actions.hunterAction;
    });

    const runnable = program.pipe(
      Effect.provide(GameActions.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    await Effect.runPromise(runnable);

    expect(mockEmit).toHaveBeenCalledWith('hunter:pick-required');
  });
});
