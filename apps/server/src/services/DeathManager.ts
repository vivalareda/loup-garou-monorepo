import type { DeathCause } from '@repo/types';
import { Context, Effect, Layer } from 'effect';
import type { Player } from '@/core/player.js';
import { VictimNotFound } from './errors.js';
import { Game } from './Game.js';

const makeDeathManager = Effect.gen(function* () {
  const game = yield* Game;
  const pendingDeath: Map<DeathCause, Player> = new Map();

  const isPlayerPending = (socketId: string) =>
    Array.from(pendingDeath.values()).some(
      (player) => player.getSocketId() === socketId
    );

  const analyzeDeath = Effect.fn('analyzeDeath')(function* (
    reason: DeathCause,
    sid: string
  ) {
    if (reason === 'PARTNER_SUICIDE') {
      return;
    }

    const partner = yield* game.getPartner(sid);
    if (!partner?.isAlive) {
      return;
    }

    if (isPlayerPending(partner.getSocketId())) {
      return;
    }

    pendingDeath.set('PARTNER_SUICIDE', partner);
  });

  const addToPendingDeath = Effect.fn('addToPendingDeath')(function* (
    reason: DeathCause,
    sid: string
  ) {
    const player = yield* game.getPlayerBySocketId(sid);
    pendingDeath.set(reason, player);
    yield* analyzeDeath(reason, sid);
  });

  const getVictim = Effect.fn('getWerewolfVictim')(function* (
    reason: DeathCause
  ) {
    yield* Effect.log(pendingDeath);
    return pendingDeath.get(reason) ?? (yield* new VictimNotFound({ reason }));
  });

  const getPendingDeath = Effect.sync(() => pendingDeath);

  const log = Effect.sync(() => {
    pendingDeath.forEach((v, k) => {
      console.log(`the player ${v.getName()} is ${k}`);
    });
  });

  const deathCount = Effect.sync(() => pendingDeath.size);
  const clear = Effect.sync(() => pendingDeath.clear());

  const reviveWerewolfVictim = Effect.sync(() =>
    pendingDeath.delete('WEREWOLVES')
  );

  return {
    addToPendingDeath,
    getVictim,
    deathCount,
    log,
    clear,
    reviveWerewolfVictim,
    getPendingDeath,
    analyzeDeath,
  };
});

type DeathManagerService = typeof makeDeathManager extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class DeathManager extends Context.Tag('@app/DeathManager')<
  DeathManager,
  DeathManagerService
>() {
  static readonly DefaultWithoutDependencies = Layer.effect(
    this,
    makeDeathManager
  );
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Game.Default)
  );
}
