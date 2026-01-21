import { describe, expect } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { DeathManager } from './death-manager.js';
import { Game } from './Game.js';
import { MockScenario } from './MockScenario.js';
import { SegmentManager } from './SegmentManager.js';
import { SegmentExecution } from './SegmentExecution.js';

const TestLayer = Layer.mergeAll(
  Game.Default,
  SegmentManager.Default,
  SegmentExecution.Default,
  DeathManager.Default,
  MockScenario.Default
);

describe('MockScenario', () => {
  describe('runWerewolfKillHunter', () => {
    it.effect('should run werewolf kill hunter scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length === 0) {
          return;
        }

        const firstPlayer = players[0];
        
        if (firstPlayer.role !== 'HUNTER') {
          const result = yield* Effect.either(
            mockScenario.runWerewolfKillHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runWerewolfKillHunter;

        const playerInQueue = yield* deathManager.isInDeathQueue(
          firstPlayer.socketId
        );
        expect(playerInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runWerewolfKillLover', () => {
    it.effect('should run werewolf kill lover scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2) {
          return;
        }

        yield* mockScenario.runWerewolfKillLover;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runWerewolfKillLoverSecondIsHunter', () => {
    it.effect('should run werewolf kill lover where second is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 5 || players[1].role !== 'HUNTER') {
          const result = yield* Effect.either(
            mockScenario.runWerewolfKillLoverSecondIsHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runWerewolfKillLoverSecondIsHunter;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
        expect(players[1].role).toBe('HUNTER');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runWerewolfKillLoverWhoIsHunter', () => {
    it.effect('should run werewolf kill lover who is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2 || players[0].role !== 'HUNTER') {
          const result = yield* Effect.either(
            mockScenario.runWerewolfKillLoverWhoIsHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runWerewolfKillLoverWhoIsHunter;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
        expect(players[0].role).toBe('HUNTER');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runDayVoteKillHunter', () => {
    it.effect('should run day vote kill hunter scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          const result = yield* Effect.either(
            mockScenario.runDayVoteKillHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runDayVoteKillHunter;

        const hunterInQueue = yield* deathManager.isInDeathQueue(
          hunter.socketId
        );
        expect(hunterInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runDayVoteKillLover', () => {
    it.effect('should run day vote kill lover scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2) {
          return;
        }

        yield* mockScenario.runDayVoteKillLover;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runDayVoteKillLoverWhoIsHunter', () => {
    it.effect('should run day vote kill lover who is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2 || players[0].role !== 'HUNTER') {
          const result = yield* Effect.either(
            mockScenario.runDayVoteKillLoverWhoIsHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runDayVoteKillLoverWhoIsHunter;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
        expect(players[0].role).toBe('HUNTER');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('runDayVoteKillLoverSecondIsHunter', () => {
    it.effect('should run day vote kill lover where second is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2 || players[1].role !== 'HUNTER') {
          const result = yield* Effect.either(
            mockScenario.runDayVoteKillLoverSecondIsHunter
          );
          expect(result._tag).toBe('Left');
          return;
        }

        yield* mockScenario.runDayVoteKillLoverSecondIsHunter;

        const firstPlayerInQueue = yield* deathManager.isInDeathQueue(
          players[0].socketId
        );
        expect(firstPlayerInQueue).toBe(true);

        const lover1 = yield* game.isPlayerLover(players[0].socketId);
        const lover2 = yield* game.isPlayerLover(players[1].socketId);
        expect(lover1).toBe(true);
        expect(lover2).toBe(true);
        expect(players[1].role).toBe('HUNTER');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('edge cases', () => {
    it.effect('should fail when no players for werewolf kill hunter', () =>
      Effect.gen(function* () {
        const mockScenario = yield* MockScenario;

        const result = yield* Effect.either(mockScenario.runWerewolfKillHunter);
        expect(result._tag).toBe('Left');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail when insufficient players for werewolf kill lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length >= 2) {
          return;
        }

        const result = yield* Effect.either(mockScenario.runWerewolfKillLover);
        expect(result._tag).toBe('Left');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail when no hunter for day vote kill hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const mockScenario = yield* MockScenario;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        const hunter = players.find((p) => p.role === 'HUNTER');
        if (hunter) {
          return;
        }

        const result = yield* Effect.either(mockScenario.runDayVoteKillHunter);
        expect(result._tag).toBe('Left');
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
