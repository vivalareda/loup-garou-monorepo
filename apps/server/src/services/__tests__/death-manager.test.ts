import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { DeathManager } from '../DeathManager.js';
import { VictimNotFound } from '../errors.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

const makeTestLayer = () => {
  const configLayer = LobbyConfig.Live;
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const deathManagerLayer = DeathManager.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer)
  );

  return Layer.mergeAll(lobbyLayer, gameLayer, deathManagerLayer);
};

describe('DeathManager Service', () => {
  it.effect('adds player to pending death successfully', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-socket');

      const victim = yield* deathManager.getVictim('WEREWOLVES');

      expect(victim.getName()).toBe('Victim');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns VictimNotFound when no victim for death cause', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      const error = yield* deathManager
        .getVictim('WEREWOLVES')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(VictimNotFound);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns VictimNotFound when getting witch poison victim', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      const error = yield* deathManager
        .getVictim('WITCH_POISON')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(VictimNotFound);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('handles multiple pending deaths with different causes', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('WolfVictim', 'wolf-victim-socket');
      yield* lobby.addPlayer('WitchVictim', 'witch-victim-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'wolf-victim-socket');
      yield* deathManager.addToPendingDeath(
        'WITCH_POISON',
        'witch-victim-socket'
      );

      const werewolfVictim = yield* deathManager.getVictim('WEREWOLVES');
      const witchVictim = yield* deathManager.getVictim('WITCH_POISON');

      expect(werewolfVictim.getName()).toBe('WolfVictim');
      expect(witchVictim.getName()).toBe('WitchVictim');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('revives werewolf victim successfully', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-socket');
      const victim = yield* deathManager.getVictim('WEREWOLVES');
      expect(victim.getName()).toBe('Victim');

      yield* deathManager.reviveWerewolfVictim;

      const error = yield* deathManager
        .getVictim('WEREWOLVES')
        .pipe(Effect.flip);
      expect(error).toBeInstanceOf(VictimNotFound);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('isPendingDeathEmpty returns true when empty', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      const isEmpty = yield* deathManager.isPendingDeathEmpty;

      expect(isEmpty).toBe(true);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('isPendingDeathEmpty returns false when has deaths', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-socket');

      const isEmpty = yield* deathManager.isPendingDeathEmpty;

      expect(isEmpty).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('log pending deaths without errors', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim', 'victim-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-socket');

      yield* deathManager.log;

      const victim = yield* deathManager.getVictim('WEREWOLVES');
      expect(victim.getName()).toBe('Victim');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('replaces existing victim for same death cause', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Victim1', 'victim-1-socket');
      yield* lobby.addPlayer('Victim2', 'victim-2-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-1-socket');
      let victim = yield* deathManager.getVictim('WEREWOLVES');
      expect(victim.getName()).toBe('Victim1');

      yield* deathManager.addToPendingDeath('WEREWOLVES', 'victim-2-socket');
      victim = yield* deathManager.getVictim('WEREWOLVES');
      expect(victim.getName()).toBe('Victim2');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('handles DAY_VOTE death cause', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('VotedOut', 'voted-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('DAY_VOTE', 'voted-socket');

      const victim = yield* deathManager.getVictim('DAY_VOTE');
      expect(victim.getName()).toBe('VotedOut');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('handles HUNTER_REVENGE death cause', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('Shot', 'shot-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath('HUNTER_REVENGE', 'shot-socket');

      const victim = yield* deathManager.getVictim('HUNTER_REVENGE');
      expect(victim.getName()).toBe('Shot');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('handles PARTNER_SUICIDE death cause', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      yield* lobby.addPlayer('DeadLover', 'dead-lover-socket');
      yield* game.startGame;

      yield* deathManager.addToPendingDeath(
        'PARTNER_SUICIDE',
        'dead-lover-socket'
      );

      const victim = yield* deathManager.getVictim('PARTNER_SUICIDE');
      expect(victim.getName()).toBe('DeadLover');
    }).pipe(Effect.provide(makeTestLayer()))
  );
});
