import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
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
        const socket = yield* Effect.serviceConstants;

        // Simulate emissions
        socket.SocketServer.to('socket-1').emit('test-event', { data: 'test' });
        socket.SocketServer.emit('broadcast-event', { data: 'broadcast' });
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
        const audio = yield* Effect.serviceConstants;

        yield* audio.AudioManager.playIntro();
        yield* audio.AudioManager.playSegmentStart('CUPID');
        yield* audio.AudioManager.playSegmentEnd('CUPID');
        yield* audio.AudioManager.playWinnerAudio('villagers');
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
