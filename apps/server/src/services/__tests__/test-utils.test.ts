import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { SocketServer } from '../SocketServer.js';
import {
  GameTest,
  LobbyTest,
  makeAudioCapture,
  makeSocketCapture,
} from './test-utils.js';

describe('Test Utilities', () => {
  describe('LobbyTest layer', () => {
    it.effect('provides lobby with maxPlayers=2', () =>
      Effect.gen(function* () {
        const lobby = yield* Lobby;

        yield* lobby.addPlayer('Alice', 'socket-1');
        yield* lobby.addPlayer('Bob', 'socket-2');

        const isLobbyFull = yield* lobby.isLobbyFull;
        expect(isLobbyFull).toBe(true);

        const players = yield* lobby.getAllPlayers;
        expect(players).toHaveLength(2);
      }).pipe(Effect.provide(LobbyTest))
    );
  });

  describe('GameTest layer', () => {
    it.effect('provides game with lobby (maxPlayers=2)', () =>
      Effect.gen(function* () {
        const lobby = yield* Lobby;
        const game = yield* Game;

        yield* lobby.addPlayer('Alice', 'socket-1');
        yield* lobby.addPlayer('Bob', 'socket-2');

        yield* game.startGame;

        const players = yield* game.getPlayers;
        expect(players).toHaveLength(2);
      }).pipe(Effect.provide(GameTest))
    );
  });

  describe('makeSocketCapture', () => {
    it('captures socket emissions', () => {
      const { layer, emissions } = makeSocketCapture();

      const program = Effect.gen(function* () {
        const socketServer = yield* SocketServer;

        // Simulate emissions using type assertions for testing
        (socketServer.to('socket-1') as any).emit('test-event', {
          data: 'test',
        });
        (socketServer as any).emit('broadcast-event', { data: 'broadcast' });
      });

      Effect.runSync(program.pipe(Effect.provide(layer)));

      expect(emissions).toHaveLength(2);
      expect(emissions[0]).toEqual({
        to: 'socket-1',
        event: 'test-event',
        data: { data: 'test' },
      });
      expect(emissions[1]).toEqual({
        to: 'broadcast',
        event: 'broadcast-event',
        data: { data: 'broadcast' },
      });
    });
  });

  describe('makeAudioCapture', () => {
    it('captures audio playback calls', () => {
      const { layer, calls } = makeAudioCapture();

      const program = Effect.gen(function* () {
        const audioManager = yield* AudioManager;

        yield* audioManager.playIntro();
        yield* audioManager.playSegmentStart('CUPID');
        yield* audioManager.playSegmentEnd('CUPID');
        yield* audioManager.playWinnerAudio('villagers');
      });

      Effect.runSync(program.pipe(Effect.provide(layer)));

      expect(calls).toEqual([
        'intro',
        'start:CUPID',
        'end:CUPID',
        'winner:villagers',
      ]);
    });
  });
});
